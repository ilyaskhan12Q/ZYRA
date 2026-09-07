/**
 * Unused Import Removal Fix Strategy
 */

import {
  type FixCandidate,
  type FixOperation,
  type FixPlan,
  type FixPlanningContext,
  type FixPrecondition,
  type FixRiskLevel
} from '../types.js';
import { BaseFixStrategy } from './base.js';

export class UnusedImportStrategy extends BaseFixStrategy {
  readonly id = 'FIX_UNUSED_IMPORT';
  readonly version = '1.0';
  readonly name = 'Unused Import Removal';
  readonly description =
    'Removes provably dead static imports from source code files to reduce bundle size and parse overhead.';
  readonly applicableFindings = ['UNUSED_JS_HIGH'];
  readonly applicableCorrelations = ['CORR_SCRIPT_IMPORT'];
  readonly preconditions = [
    'Import statement is verified unused in the file body',
    'Import identifier occurs exactly once in the file',
    'Target file is inside workspace and not protected'
  ];
  readonly riskLevel: FixRiskLevel = 'LOW';

  canApply(candidate: FixCandidate, context: FixPlanningContext): boolean {
    return candidate.findingRefs.some((f) => f.includes('UNUSED_JS_HIGH') || f.includes('unused_js'));
  }

  async plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> {
    if (!this.canApply(candidate, context)) return null;

    // Search source files for unused imports
    for (const file of context.codebase.files) {
      if (file.category !== 'source') continue;

      const fileData = await this.readWorkspaceFile(file.relativePath, context.workspaceRoot);
      if (!fileData) continue;

      const lines = fileData.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Check for static named or default import: import { Foo } from '...'; or import Foo from '...';
        const importMatch = line.match(/^import\s+(?:\{?\s*([a-zA-Z0-9_]+)\s*\}?|\*\s+as\s+([a-zA-Z0-9_]+))\s+from\s+['"][^'"]+['"];?\s*$/);
        if (importMatch) {
          const identifier = importMatch[1] ?? importMatch[2];
          if (!identifier) continue;

          // Verify identifier is not used in any other line
          const regex = new RegExp(`\\b${identifier}\\b`, 'g');
          const allMatches = fileData.content.match(regex);

          // If it appears only once in the entire file, it's unused in the body
          if (allMatches && allMatches.length === 1) {
            const operations: FixOperation[] = [
              {
                id: `op_${file.relativePath.replace(/[^a-z0-9]/gi, '_')}_remove_unused_${identifier}`,
                type: 'REMOVE_UNUSED_IMPORT',
                targetPath: file.relativePath,
                originalContentHash: fileData.hash,
                expectedOriginalContent: line,
                replacementContent: '', // Remove line
                location: { startLine: i + 1, endLine: i + 1 },
                reason: `Remove unused import '${identifier}' which is not referenced anywhere in '${file.relativePath}'.`
              }
            ];

            const preconditions: FixPrecondition[] = [
              {
                description: `Import identifier '${identifier}' is not referenced in file body`,
                satisfied: true
              },
              {
                description: 'Target file is inside workspace and not protected',
                satisfied: true
              }
            ];

            return this.createPlan({
              candidate,
              context,
              operations,
              risk: 'LOW',
              expectedImpact: {
                targetMetric: 'Unused JavaScript / Bundle Size',
                estimatedDirection: 'improve',
                description: `Potential reduction in JavaScript bundle payload by eliminating unused dependency import '${identifier}'.`
              },
              preconditions
            });
          }
        }
      }
    }

    return null;
  }
}
