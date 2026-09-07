/**
 * Render-Blocking Resource Deferral Fix Strategy
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

export class RenderBlockingStrategy extends BaseFixStrategy {
  readonly id = 'FIX_RENDER_BLOCKING_RESOURCE';
  readonly version = '1.0';
  readonly name = 'Render-Blocking Resource Deferral';
  readonly description =
    'Eliminates render-blocking scripts and stylesheets by adding defer attributes or preload directives in HTML/entry files.';
  readonly applicableFindings = ['RENDER_BLOCKING_RESOURCE'];
  readonly applicableCorrelations = ['CORR_RENDER_BLOCKING'];
  readonly preconditions = [
    'Target resource is correlated with render-blocking finding',
    'Resource tag exists in an accessible HTML or entry template',
    'Resource reference occurs unambiguously (exactly once in file)'
  ];
  readonly riskLevel: FixRiskLevel = 'LOW';

  canApply(candidate: FixCandidate, context: FixPlanningContext): boolean {
    return candidate.findingRefs.some((f) => f.includes('RENDER_BLOCKING_RESOURCE') || f.includes('render_blocking'));
  }

  async plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> {
    if (!this.canApply(candidate, context)) return null;

    const resourceName = candidate.targetPath ? path.posix.basename(candidate.targetPath) : candidate.targetName;
    if (!resourceName) return null;

    // Search HTML files in the workspace (e.g. index.html)
    let targetHtmlFile: { relativePath: string; content: string; hash: string } | null = null;
    let occurrences = 0;

    for (const file of context.codebase.files) {
      if (file.extension === '.html' || file.relativePath.endsWith('layout.tsx') || file.relativePath.endsWith('index.html')) {
        const data = await this.readWorkspaceFile(file.relativePath, context.workspaceRoot);
        if (!data) continue;

        if (data.content.includes(resourceName)) {
          const count = data.content.split(resourceName).length - 1;
          if (count > 0) {
            occurrences += count;
            targetHtmlFile = {
              relativePath: file.relativePath,
              content: data.content,
              hash: data.hash
            };
          }
        }
      }
    }

    const preconditions: FixPrecondition[] = [
      {
        description: 'Resource reference exists in HTML or entry template',
        satisfied: targetHtmlFile !== null
      },
      {
        description: 'Resource reference occurs unambiguously',
        satisfied: occurrences === 1,
        reason: occurrences > 1 ? 'Multiple references found in workspace' : undefined
      }
    ];

    if (!targetHtmlFile || occurrences !== 1) {
      return null;
    }

    const content = targetHtmlFile.content;

    // Check for script tag
    const scriptRegex = new RegExp(`<script[^>]*${resourceName.replace('.', '\\.')}[^>]*><\\/script>`, 'i');
    const scriptMatch = content.match(scriptRegex);

    if (scriptMatch) {
      const originalScript = scriptMatch[0];
      if (!originalScript.includes('defer') && !originalScript.includes('async') && !originalScript.includes('type="module"')) {
        const replacementScript = originalScript.replace('<script', '<script defer');
        const op: FixOperation = {
          id: `op_${targetHtmlFile.relativePath.replace(/[^a-z0-9]/gi, '_')}_defer_script`,
          type: 'EDIT_ATTRIBUTE',
          targetPath: targetHtmlFile.relativePath,
          originalContentHash: targetHtmlFile.hash,
          expectedOriginalContent: originalScript,
          replacementContent: replacementScript,
          reason: `Add 'defer' attribute to eliminate render-blocking script execution.`
        };

        return this.createPlan({
          candidate,
          context,
          operations: [op],
          risk: 'LOW',
          expectedImpact: {
            targetMetric: 'FCP / LCP',
            estimatedDirection: 'improve',
            description: 'Potential reduction in early paint delay by deferring script execution until HTML parsing completes.'
          },
          preconditions
        });
      }
    }

    // Check for stylesheet link tag
    const cssRegex = new RegExp(`<link[^>]*rel=["']stylesheet["'][^>]*${resourceName.replace('.', '\\.')}[^>]*>`, 'i');
    const cssMatch = content.match(cssRegex);

    if (cssMatch) {
      const originalLink = cssMatch[0];
      if (!originalLink.includes('media=')) {
        const replacementLink = originalLink.replace(
          /rel=["']stylesheet["']/,
          'rel="preload" as="style" onload="this.onload=null;this.rel=\'stylesheet\'"'
        );
        const op: FixOperation = {
          id: `op_${targetHtmlFile.relativePath.replace(/[^a-z0-9]/gi, '_')}_preload_css`,
          type: 'EDIT_ATTRIBUTE',
          targetPath: targetHtmlFile.relativePath,
          originalContentHash: targetHtmlFile.hash,
          expectedOriginalContent: originalLink,
          replacementContent: replacementLink,
          reason: `Preload stylesheet asynchronously to eliminate render-blocking delay.`
        };

        return this.createPlan({
          candidate,
          context,
          operations: [op],
          risk: 'LOW',
          expectedImpact: {
            targetMetric: 'FCP',
            estimatedDirection: 'improve',
            description: 'Potential reduction in first paint delay by loading non-critical stylesheet asynchronously.'
          },
          preconditions
        });
      }
    }

    return null;
  }
}
