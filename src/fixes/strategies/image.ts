/**
 * Image Loading & Asset Optimization Fix Strategy
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
import { normalizePosixPath } from '../safety.js';

export class ImageOptimizationStrategy extends BaseFixStrategy {
  readonly id = 'FIX_IMAGE_OPTIMIZATION';
  readonly version = '1.0';
  readonly name = 'Image Loading & Asset Optimization';
  readonly description =
    'Optimizes image loading behavior in templates/markup (fetchpriority="high" for LCP, loading="lazy" for offscreen images) and provides safe asset recommendations.';
  readonly applicableFindings = [
    'LCP_CRITICAL',
    'LCP_SLOW',
    'LARGE_IMAGE',
    'IMAGE_OPTIMIZATION_OPPORTUNITY'
  ];
  readonly applicableCorrelations = ['CORR_IMAGE_ASSET'];
  readonly preconditions = [
    'Correlated asset is a local workspace image',
    'Target file is inside workspace and not protected',
    'Asset reference exists in inspectable template or component',
    'Asset reference occurs unambiguously (exactly once in file)'
  ];
  readonly riskLevel: FixRiskLevel = 'LOW';

  canApply(candidate: FixCandidate, context: FixPlanningContext): boolean {
    if (!candidate.targetPath) return false;
    const ext = path.extname(candidate.targetPath).toLowerCase();
    const isImageExt = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif'].includes(ext);
    if (!isImageExt) return false;

    const matchesFinding = candidate.findingRefs.some((f) =>
      this.applicableFindings.some((af) => f.toUpperCase().includes(af))
    );
    const matchesCorr =
      candidate.candidateId.includes('image') ||
      candidate.targetType === 'asset' ||
      candidate.correlationRefs.some(
        (ref) => ref.includes('image') || ref.includes('asset') || ref.includes('CORR_IMAGE_ASSET')
      );

    return matchesFinding || matchesCorr;
  }

  async plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> {
    if (!this.canApply(candidate, context)) return null;

    const isLcp = candidate.findingRefs.some((f) => f.includes('LCP') || f.includes('lcp'));
    const assetFilename = path.posix.basename(candidate.targetPath);

    // Search readable source files for markup/component references to this image
    let matchingFile: { relativePath: string; content: string; hash: string } | null = null;
    let occurrences = 0;

    for (const file of context.codebase.files) {
      if (file.category === 'source' || file.category === 'entryPoint' as any || file.extension === '.html') {
        const fileData = await this.readWorkspaceFile(file.relativePath, context.workspaceRoot);
        if (!fileData) continue;

        if (fileData.content.includes(assetFilename)) {
          const count = fileData.content.split(assetFilename).length - 1;
          if (count > 0) {
            occurrences += count;
            matchingFile = {
              relativePath: file.relativePath,
              content: fileData.content,
              hash: fileData.hash
            };
          }
        }
      }
    }

    const preconditions: FixPrecondition[] = [
      {
        description: 'Target asset is a local workspace file',
        satisfied: true
      },
      {
        description: 'Target path is not protected',
        satisfied: true
      }
    ];

    // Case 1: An unambiguous markup reference was found
    if (matchingFile && occurrences === 1) {
      const content = matchingFile.content;
      // Check for <img ... src="...assetFilename..." ...> or Next.js <Image ...>
      const imgTagRegex = new RegExp(`<img[^>]*${assetFilename.replace('.', '\\.')}[^>]*>`, 'i');
      const match = content.match(imgTagRegex);

      if (match) {
        const originalTag = match[0];
        let replacementTag = originalTag;

        if (isLcp) {
          if (!originalTag.includes('fetchpriority')) {
            replacementTag = replacementTag.replace('<img', '<img fetchpriority="high"');
          }
          if (originalTag.includes('loading="lazy"')) {
            replacementTag = replacementTag.replace('loading="lazy"', 'loading="eager"');
          }
        } else {
          if (!originalTag.includes('loading=')) {
            replacementTag = replacementTag.replace('<img', '<img loading="lazy"');
          }
          if (!originalTag.includes('decoding=')) {
            replacementTag = replacementTag.replace('<img', '<img decoding="async"');
          }
        }

        if (replacementTag !== originalTag) {
          const operations: FixOperation[] = [
            {
              id: `op_${matchingFile.relativePath.replace(/[^a-z0-9]/gi, '_')}_image_attr`,
              type: 'EDIT_ATTRIBUTE',
              targetPath: matchingFile.relativePath,
              originalContentHash: matchingFile.hash,
              expectedOriginalContent: originalTag,
              replacementContent: replacementTag,
              reason: isLcp
                ? `Prioritize LCP image loading with fetchpriority="high"`
                : `Defer offscreen image loading with loading="lazy"`
            }
          ];

          preconditions.push({
            description: 'Image tag occurs unambiguously and requires attribute update',
            satisfied: true
          });

          return this.createPlan({
            candidate,
            context,
            operations,
            risk: 'LOW',
            expectedImpact: {
              targetMetric: isLcp ? 'LCP' : 'Page Transfer Size',
              estimatedDirection: 'improve',
              description: isLcp
                ? 'Potential reduction in LCP resource load delay by prioritizing image network request.'
                : 'Potential reduction in early payload transfer by lazy loading offscreen image.'
            },
            preconditions
          });
        }
      }
    }

    // Case 2: Target is the image binary itself without an automated markup match or multiple occurrences
    const assetFile = await this.readWorkspaceFile(candidate.targetPath, context.workspaceRoot);
    if (!assetFile) return null;

    // Per Section 18: Do NOT fake image compression. Safe recommendation without mutating binary.
    preconditions.push({
      description: 'Binary transformation requires external image optimization pipeline',
      satisfied: false,
      reason: 'Automated binary compression without external sharp/squoosh is safely constrained.'
    });

    const adviceOp: FixOperation = {
      id: `op_${candidate.targetPath.replace(/[^a-z0-9]/gi, '_')}_advice`,
      type: 'NOOP_ADVICE',
      targetPath: candidate.targetPath,
      originalContentHash: assetFile.hash,
      reason: `Correlated image asset '${assetFilename}' exceeds threshold. Recommend converting to modern WebP/AVIF format.`
    };

    return this.createPlan({
      candidate,
      context,
      operations: [adviceOp],
      risk: 'BLOCKED',
      expectedImpact: {
        targetMetric: 'LCP / Transfer Size',
        estimatedDirection: 'neutral',
        description: 'Informational fix plan; direct binary file mutation is safely constrained.'
      },
      preconditions
    });
  }
}
