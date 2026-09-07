import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const IMAGE_OPTIMIZATION_RULE: PerformanceRule = {
  id: 'IMAGE_OPTIMIZATION_OPPORTUNITY',
  version: '1.0',
  category: 'images',
  defaultSeverity: 'WARNING',
  title: 'Image Optimization Opportunity',
  description: 'Potential image compression or next-gen format savings exceed 100 KB.',
  evidenceConsumed: ['images.items', 'audits.modern-image-formats'],
  thresholdSummary: THRESHOLDS.IMAGE_WASTED_BYTES.condition,
  thresholdSource: THRESHOLDS.IMAGE_WASTED_BYTES.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const images = evidence?.images?.items ?? [];
    if (!Array.isArray(images) || images.length === 0) {
      return [];
    }

    const totalWastedBytes = images.reduce((sum, img) => sum + (img.wastedBytes ?? 0), 0);

    if (totalWastedBytes <= THRESHOLDS.IMAGE_WASTED_BYTES.value) {
      return [];
    }

    const wastedKb = (totalWastedBytes / 1024).toFixed(1);

    return [
      {
        id: 'finding:image_optimization_opportunity',
        ruleId: 'IMAGE_OPTIMIZATION_OPPORTUNITY',
        ruleVersion: '1.0',
        category: 'images',
        severity: 'WARNING',
        title: 'Image Optimization Opportunity',
        description: `Identified an estimated ${wastedKb} KB in potential savings through modern image formatting or optimized compression.`,
        observed: {
          value: totalWastedBytes,
          unit: 'bytes',
          displayValue: `${wastedKb} KB potential savings`
        },
        threshold: {
          value: THRESHOLDS.IMAGE_WASTED_BYTES.value,
          unit: THRESHOLDS.IMAGE_WASTED_BYTES.unit,
          condition: THRESHOLDS.IMAGE_WASTED_BYTES.condition,
          source: THRESHOLDS.IMAGE_WASTED_BYTES.source
        },
        evidenceRefs: ['images.items', 'audits.modern-image-formats'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate modern image encoding (WebP/AVIF), lossy compression settings, and image dimensions matching display containers.'
      }
    ];
  }
};

export const LARGE_IMAGE_RULE: PerformanceRule = {
  id: 'LARGE_IMAGE',
  version: '1.0',
  category: 'images',
  defaultSeverity: 'WARNING',
  title: 'Large Image Asset Detected',
  description: 'Individual image assets transfer greater than 500 KB.',
  evidenceConsumed: ['images.items'],
  thresholdSummary: THRESHOLDS.LARGE_IMAGE_BYTES.condition,
  thresholdSource: THRESHOLDS.LARGE_IMAGE_BYTES.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const images = evidence?.images?.items ?? [];
    if (!Array.isArray(images) || images.length === 0) {
      return [];
    }

    const largeImages = images.filter(
      (img) => (img.transferSizeBytes ?? 0) > THRESHOLDS.LARGE_IMAGE_BYTES.value
    );

    if (largeImages.length === 0) {
      return [];
    }

    const maxTransfer = Math.max(...largeImages.map((img) => img.transferSizeBytes));
    const count = largeImages.length;
    const maxKb = (maxTransfer / 1024).toFixed(1);

    return [
      {
        id: 'finding:large_image',
        ruleId: 'LARGE_IMAGE',
        ruleVersion: '1.0',
        category: 'images',
        severity: 'WARNING',
        title: 'Large Image Asset Detected',
        description: `Observed ${count} image asset(s) exceeding 500 KB transfer size, with the largest transferring ${maxKb} KB.`,
        observed: {
          value: maxTransfer,
          unit: 'bytes',
          displayValue: `${maxKb} KB max (${count} image${count > 1 ? 's' : ''})`
        },
        threshold: {
          value: THRESHOLDS.LARGE_IMAGE_BYTES.value,
          unit: THRESHOLDS.LARGE_IMAGE_BYTES.unit,
          condition: THRESHOLDS.LARGE_IMAGE_BYTES.condition,
          source: THRESHOLDS.LARGE_IMAGE_BYTES.source
        },
        evidenceRefs: ['images.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate responsive image sizing (srcset/sizes), proper image compression, and resolution matching viewport requirements.'
      }
    ];
  }
};
