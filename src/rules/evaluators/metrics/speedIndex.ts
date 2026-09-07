import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const SPEED_INDEX_SLOW_RULE: PerformanceRule = {
  id: 'SPEED_INDEX_SLOW',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'WARNING',
  title: 'Speed Index is Slow',
  description: 'Speed Index exceeds the 3,400 ms threshold.',
  evidenceConsumed: ['metrics.speedIndex'],
  thresholdSummary: THRESHOLDS.SPEED_INDEX_SLOW.condition,
  thresholdSource: THRESHOLDS.SPEED_INDEX_SLOW.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const si = evidence?.metrics?.speedIndex?.value;
    if (si === null || si === undefined || typeof si !== 'number' || si <= 0) {
      return [];
    }

    if (si <= THRESHOLDS.SPEED_INDEX_SLOW.value) {
      return [];
    }

    const isCritical = si > THRESHOLDS.SPEED_INDEX_CRITICAL.value;
    const severity = isCritical ? 'HIGH' : 'WARNING';
    const title = isCritical
      ? 'Speed Index is Critically Slow'
      : 'Speed Index is Slow';

    const thresholdApplied = isCritical ? THRESHOLDS.SPEED_INDEX_CRITICAL : THRESHOLDS.SPEED_INDEX_SLOW;

    return [
      {
        id: 'finding:speed_index_slow',
        ruleId: 'SPEED_INDEX_SLOW',
        ruleVersion: '1.0',
        category: 'metrics',
        severity,
        title,
        description: `Speed Index was observed at ${Math.round(si).toLocaleString()} ms, exceeding the threshold of ${thresholdApplied.value.toLocaleString()} ms.`,
        observed: {
          value: si,
          unit: 'ms',
          displayValue: `${(si / 1000).toFixed(2)} s`
        },
        threshold: {
          value: thresholdApplied.value,
          unit: thresholdApplied.unit,
          condition: thresholdApplied.condition,
          source: thresholdApplied.source
        },
        evidenceRefs: ['metrics.speedIndex'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate visual page progression, main-thread contention during render, and critical resource delivery.'
      }
    ];
  }
};
