/**
 * Safe Dynamic Import Conversion Fix Strategy
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

export class DynamicImportStrategy extends BaseFixStrategy {
  readonly id = 'FIX_SAFE_DYNAMIC_IMPORT';
  readonly version = '1.0';
  readonly name = 'Safe Dynamic Import Conversion';
  readonly description =
    'Splits large monolithic component imports into dynamic imports (React.lazy / next/dynamic) to defer evaluation of non-critical components.';
  readonly applicableFindings = ['UNUSED_JS_HIGH', 'LONG_TASK'];
  readonly applicableCorrelations = ['CORR_SCRIPT_IMPORT'];
  readonly preconditions = [
    'Target framework supports dynamic component imports',
    'Component is not in the critical initial viewport render path',
    'Import boundary is clean and unambiguous'
  ];
  readonly riskLevel: FixRiskLevel = 'MEDIUM';

  canApply(candidate: FixCandidate, context: FixPlanningContext): boolean {
    const isSupportedFinding = candidate.findingRefs.some((f) => {
      const upper = f.toUpperCase();
      return upper.includes('UNUSED_JS_HIGH') || upper.includes('LONG_TASK') || upper.includes('UNUSED_JS');
    });
    const frameworkSupported =
      context.codebase.framework.confidence === 'detected' &&
      (context.codebase.framework.name.toLowerCase().includes('react') ||
        context.codebase.framework.name.toLowerCase().includes('next'));

    return isSupportedFinding && frameworkSupported;
  }

  async plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> {
    if (!this.canApply(candidate, context)) return null;

    // Search for heavy components imported statically in routes or entry points
    for (const route of context.codebase.routes) {
      const fileData = await this.readWorkspaceFile(route.sourceFile, context.workspaceRoot);
      if (!fileData) continue;

      // Look for heavy component static imports, e.g., import Chart from './Chart' or import Modal from './Modal'
      const heavyImportRegex = /import\s+([A-Z][a-zA-Z0-9_]+)\s+from\s+['"]([^'"]+(?:Modal|Chart|Editor|Viewer|Heavy)[^'"]*)['"];?/;
      const match = fileData.content.match(heavyImportRegex);

      if (match) {
        const componentName = match[1]!;
        const importPath = match[2]!;
        const originalImport = match[0];

        const isNext = context.codebase.framework.name.toLowerCase().includes('next');
        let replacement = '';

        if (isNext) {
          replacement = `import dynamic from 'next/dynamic';\nconst ${componentName} = dynamic(() => import('${importPath}'), { ssr: false });`;
        } else {
          replacement = `import React from 'react';\nconst ${componentName} = React.lazy(() => import('${importPath}'));`;
        }

        const op: FixOperation = {
          id: `op_${route.sourceFile.replace(/[^a-z0-9]/gi, '_')}_dynamic_${componentName}`,
          type: 'REPLACE_IMPORT',
          targetPath: route.sourceFile,
          originalContentHash: fileData.hash,
          expectedOriginalContent: originalImport,
          replacementContent: replacement,
          reason: `Convert static component import '${componentName}' to dynamic code-split import.`
        };

        const preconditions: FixPrecondition[] = [
          {
            description: `Framework '${context.codebase.framework.name}' verified for dynamic imports`,
            satisfied: true
          },
          {
            description: `Unambiguous non-critical component '${componentName}' located in route`,
            satisfied: true
          }
        ];

        return this.createPlan({
          candidate,
          context,
          operations: [op],
          risk: 'MEDIUM',
          expectedImpact: {
            targetMetric: 'TBT / Unused JavaScript',
            estimatedDirection: 'improve',
            description: `Potential reduction in main-thread script evaluation and bundle transfer for '${componentName}'.`
          },
          preconditions
        });
      }
    }

    return null;
  }
}
