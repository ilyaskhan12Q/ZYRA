/**
 * Resource Hint & Preload Optimization Fix Strategy
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

export class ResourceOptimizationStrategy extends BaseFixStrategy {
  readonly id = 'FIX_RESOURCE_REFERENCE';
  readonly version = '1.0';
  readonly name = 'Resource Preload Optimization';
  readonly description =
    'Adds resource preload directives in HTML documents for critical large resources detected in early page loading.';
  readonly applicableFindings = ['LARGE_RESOURCE'];
  readonly applicableCorrelations = ['CORR_RESOURCE_ASSET'];
  readonly preconditions = [
    'Resource is local to workspace',
    'HTML entry file is accessible',
    'Preload tag is not already present'
  ];
  readonly riskLevel: FixRiskLevel = 'LOW';

  canApply(candidate: FixCandidate, context: FixPlanningContext): boolean {
    return candidate.findingRefs.some((f) => f.includes('LARGE_RESOURCE') || f.includes('large_resource'));
  }

  async plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> {
    if (!this.canApply(candidate, context)) return null;

    const resourcePath = candidate.targetPath ?? candidate.targetName;
    if (!resourcePath) return null;
    const filename = path.posix.basename(resourcePath);

    // Search for entry HTML file
    for (const file of context.codebase.files) {
      if (file.extension === '.html') {
        const fileData = await this.readWorkspaceFile(file.relativePath, context.workspaceRoot);
        if (!fileData) continue;

        if (fileData.content.includes('</head>') && !fileData.content.includes(filename)) {
          const ext = path.extname(filename).toLowerCase();
          let asAttr = 'fetch';
          if (['.woff', '.woff2'].includes(ext)) asAttr = 'font';
          else if (['.jpg', '.png', '.webp', '.avif'].includes(ext)) asAttr = 'image';
          else if (ext === '.css') asAttr = 'style';
          else if (ext === '.js') asAttr = 'script';

          const preloadTag = `  <link rel="preload" href="/${resourcePath.replace(/^public\//, '')}" as="${asAttr}"${asAttr === 'font' ? ' crossorigin' : ''}>\n</head>`;
          const originalHead = '</head>';

          const op: FixOperation = {
            id: `op_${file.relativePath.replace(/[^a-z0-9]/gi, '_')}_preload_${filename.replace(/[^a-z0-9]/gi, '_')}`,
            type: 'INSERT_TEXT',
            targetPath: file.relativePath,
            originalContentHash: fileData.hash,
            expectedOriginalContent: originalHead,
            replacementContent: preloadTag,
            reason: `Add preload hint for early discovered resource '${filename}'.`
          };

          const preconditions: FixPrecondition[] = [
            {
              description: `Entry HTML file '${file.relativePath}' contains valid </head> tag`,
              satisfied: true
            },
            {
              description: `Resource '${filename}' is not already preloaded`,
              satisfied: true
            }
          ];

          return this.createPlan({
            candidate,
            context,
            operations: [op],
            risk: 'LOW',
            expectedImpact: {
              targetMetric: 'Resource Load Time',
              estimatedDirection: 'improve',
              description: `Potential reduction in resource discovery latency by preloading '${filename}'.`
            },
            preconditions
          });
        }
      }
    }

    return null;
  }
}
