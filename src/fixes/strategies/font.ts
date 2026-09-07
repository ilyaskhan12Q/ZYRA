/**
 * Font Display Swap Optimization Fix Strategy
 */

import * as path from 'node:path';
import {
  type FixCandidate,
  type FixOperation,
  type FixPlan,
  type FixPlanningContext,
  type FixPrecondition,
  type FixRiskLevel
} from '../types.js';
import { BaseFixStrategy } from './base.js';

export class FontOptimizationStrategy extends BaseFixStrategy {
  readonly id = 'FIX_LARGE_FONT';
  readonly version = '1.0';
  readonly name = 'Font Display Swap Optimization';
  readonly description =
    'Adds font-display: swap to @font-face rules referencing large local font assets to prevent flash of invisible text (FOIT).';
  readonly applicableFindings = ['FONT_RESOURCE_LARGE'];
  readonly applicableCorrelations = ['CORR_FONT_ASSET'];
  readonly preconditions = [
    'Target asset is a local font',
    'Stylesheet with matching @font-face declaration exists in workspace',
    'font-display: swap is not already configured'
  ];
  readonly riskLevel: FixRiskLevel = 'LOW';

  canApply(candidate: FixCandidate, context: FixPlanningContext): boolean {
    if (!candidate.targetPath) return false;
    const ext = path.extname(candidate.targetPath).toLowerCase();
    const isFontExt = ['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext);
    if (!isFontExt) return false;

    return candidate.findingRefs.some((f) => f.includes('FONT_RESOURCE_LARGE') || f.includes('font'));
  }

  async plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> {
    if (!this.canApply(candidate, context)) return null;

    const fontFilename = path.posix.basename(candidate.targetPath);

    // Search CSS / SCSS files for @font-face containing fontFilename
    for (const file of context.codebase.files) {
      if (file.category === 'stylesheet' || file.extension === '.css' || file.extension === '.scss') {
        const fileData = await this.readWorkspaceFile(file.relativePath, context.workspaceRoot);
        if (!fileData) continue;

        if (fileData.content.includes(fontFilename) && fileData.content.includes('@font-face')) {
          // Find the @font-face block
          const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
          let match: RegExpExecArray | null;

          while ((match = fontFaceRegex.exec(fileData.content)) !== null) {
            const blockContent = match[1] ?? '';
            if (blockContent.includes(fontFilename)) {
              if (blockContent.includes('font-display')) {
                // Already has font-display, skip
                continue;
              }

              const originalBlock = match[0];
              const replacementBlock = originalBlock.replace(
                /\{\s*/,
                '{\n  font-display: swap;\n  '
              );

              const op: FixOperation = {
                id: `op_${file.relativePath.replace(/[^a-z0-9]/gi, '_')}_font_display_swap`,
                type: 'INSERT_TEXT',
                targetPath: file.relativePath,
                originalContentHash: fileData.hash,
                expectedOriginalContent: originalBlock,
                replacementContent: replacementBlock,
                reason: `Add 'font-display: swap;' to ensure text remains visible while font '${fontFilename}' loads.`
              };

              const preconditions: FixPrecondition[] = [
                {
                  description: 'Matching @font-face block found in stylesheet',
                  satisfied: true
                },
                {
                  description: 'font-display is currently missing',
                  satisfied: true
                }
              ];

              return this.createPlan({
                candidate,
                context,
                operations: [op],
                risk: 'LOW',
                expectedImpact: {
                  targetMetric: 'FCP / LCP',
                  estimatedDirection: 'improve',
                  description: 'Potential reduction in text rendering delay by enabling immediate fallback rendering.'
                },
                preconditions
              });
            }
          }
        }
      }
    }

    return null;
  }
}
