import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const INP_SLOW_RULE: PerformanceRule = {
  id: 'INP_SLOW',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'WARNING',
  title: 'Interaction to Next Paint is Slow',
  description: 'Interaction to Next Paint exceeds the Core Web Vitals 200 ms threshold.',
  evidenceConsumed: ['metrics.inp'],
  thresholdSummary: THRESHOLDS.INP_SLOW.condition,
  thresholdSource: THRESHOLDS.INP_SLOW.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    // Invariant: If INP is null or uncaptured in lab measurement, DO NOT trigger a finding.
    const inp = evidence?.metrics?.inp?.value;
    if (inp === null || inp === undefined || typeof inp !== 'number' || inp <= 0) {
      return [];
    }

    if (inp <= THRESHOLDS.INP_SLOW.value) {
      return [];
    }

    const isCritical = inp > THRESHOLDS.INP_CRITICAL.value;
    const severity = isCritical ? 'HIGH' : 'WARNING';
    const title = isCritical
      ? 'Interaction to Next Paint is Critically Slow'
      : 'Interaction to Next Paint is Slow';

    const thresholdApplied = isCritical ? THRESHOLDS.INP_CRITICAL : THRESHOLDS.INP_SLOW;

    return [
      {
        id: 'finding:inp_slow',
        ruleId: 'INP_SLOW',
        ruleVersion: '1.0',
        category: 'metrics',
        severity,
        title,
        description: `Interaction to Next Paint was observed at ${Math.round(inp).toLocaleString()} ms, exceeding the threshold of ${thresholdApplied.value} ms.`,
        observed: {
          value: inp,
          unit: 'ms',
          displayValue: `${Math.round(inp).toLocaleString()} ms`
        },
        threshold: {
          value: thresholdApplied.value,
          unit: thresholdApplied.unit,
          condition: thresholdApplied.condition,
          source: thresholdApplied.source
        },
        evidenceRefs: ['metrics.inp'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate event listener execution duration, input delay, and rendering/presentation delays following interactions.'
      }
    ];
  }
};
