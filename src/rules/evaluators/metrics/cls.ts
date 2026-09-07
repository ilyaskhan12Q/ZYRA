import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const CLS_POOR_RULE: PerformanceRule = {
  id: 'CLS_POOR',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'WARNING',
  title: 'Cumulative Layout Shift is High',
  description: 'Cumulative Layout Shift exceeds the Core Web Vitals 0.10 threshold.',
  evidenceConsumed: ['metrics.cls'],
  thresholdSummary: THRESHOLDS.CLS_WARNING.condition,
  thresholdSource: THRESHOLDS.CLS_WARNING.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const cls = evidence?.metrics?.cls?.value;
    if (cls === null || cls === undefined || typeof cls !== 'number' || cls < 0) {
      return [];
    }

    // CLS of 0 or <= 0.10 is Good
    if (cls <= THRESHOLDS.CLS_WARNING.value) {
      return [];
    }

    const isCritical = cls > THRESHOLDS.CLS_CRITICAL.value;
    const severity = isCritical ? 'CRITICAL' : 'WARNING';
    const title = isCritical
      ? 'Cumulative Layout Shift is Critically High'
      : 'Cumulative Layout Shift is High';

    const thresholdApplied = isCritical ? THRESHOLDS.CLS_CRITICAL : THRESHOLDS.CLS_WARNING;

    return [
      {
        id: 'finding:cls_poor',
        ruleId: 'CLS_POOR',
        ruleVersion: '1.0',
        category: 'metrics',
        severity,
        title,
        description: `Cumulative Layout Shift was observed at ${cls.toFixed(3)}, exceeding the threshold of ${thresholdApplied.value} (${isCritical ? 'poor' : 'needs improvement'}).`,
        observed: {
          value: cls,
          unit: 'score',
          displayValue: cls.toFixed(3)
        },
        threshold: {
          value: thresholdApplied.value,
          unit: thresholdApplied.unit,
          condition: thresholdApplied.condition,
          source: thresholdApplied.source
        },
        evidenceRefs: ['metrics.cls'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate unsized image/video elements, dynamic content injection without reserved aspect ratios, and web font FOIT/FOUT shift.'
      }
    ];
  }
};
