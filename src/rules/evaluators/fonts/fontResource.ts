import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const FONT_RESOURCE_LARGE_RULE: PerformanceRule = {
  id: 'FONT_RESOURCE_LARGE',
  version: '1.0',
  category: 'fonts',
  defaultSeverity: 'WARNING',
  title: 'Large Web Font Payload Detected',
  description: 'Individual web font files exceed 100 KB transfer size.',
  evidenceConsumed: ['fonts.items'],
  thresholdSummary: THRESHOLDS.LARGE_FONT_BYTES.condition,
  thresholdSource: THRESHOLDS.LARGE_FONT_BYTES.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const fonts = evidence?.fonts?.items ?? [];
    if (!Array.isArray(fonts) || fonts.length === 0) {
      return [];
    }

    const largeFonts = fonts.filter(
      (f) => (f.transferSizeBytes ?? 0) > THRESHOLDS.LARGE_FONT_BYTES.value
    );

    if (largeFonts.length === 0) {
      return [];
    }

    const maxTransfer = Math.max(...largeFonts.map((f) => f.transferSizeBytes));
    const count = largeFonts.length;
    const maxKb = (maxTransfer / 1024).toFixed(1);

    return [
      {
        id: 'finding:font_resource_large',
        ruleId: 'FONT_RESOURCE_LARGE',
        ruleVersion: '1.0',
        category: 'fonts',
        severity: 'WARNING',
        title: 'Large Web Font Payload Detected',
        description: `Observed ${count} web font file(s) exceeding the 100 KB transfer budget, with the largest transferring ${maxKb} KB.`,
        observed: {
          value: maxTransfer,
          unit: 'bytes',
          displayValue: `${maxKb} KB max (${count} font${count > 1 ? 's' : ''})`
        },
        threshold: {
          value: THRESHOLDS.LARGE_FONT_BYTES.value,
          unit: THRESHOLDS.LARGE_FONT_BYTES.unit,
          condition: THRESHOLDS.LARGE_FONT_BYTES.condition,
          source: THRESHOLDS.LARGE_FONT_BYTES.source
        },
        evidenceRefs: ['fonts.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate font subsetting (unicode-range), utilizing modern WOFF2 compression, and avoiding downloading unrendered weights or italic variants.'
      }
    ];
  }
};
