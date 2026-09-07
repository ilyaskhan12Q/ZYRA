import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const TBT_HIGH_RULE: PerformanceRule = {
  id: 'TBT_HIGH',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'WARNING',
  title: 'Total Blocking Time is High',
  description: 'Total Blocking Time exceeds the 200 ms threshold.',
  evidenceConsumed: ['metrics.tbt'],
  thresholdSummary: THRESHOLDS.TBT_HIGH.condition,
  thresholdSource: THRESHOLDS.TBT_HIGH.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const tbt = evidence?.metrics?.tbt?.value;
    if (tbt === null || tbt === undefined || typeof tbt !== 'number' || tbt <= 0) {
      return [];
    }

    if (tbt > THRESHOLDS.TBT_HIGH.value && tbt <= THRESHOLDS.TBT_CRITICAL.value) {
      return [
        {
          id: 'finding:tbt_high',
          ruleId: 'TBT_HIGH',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'WARNING',
          title: 'Total Blocking Time is High',
          description: `Total Blocking Time was observed at ${Math.round(tbt).toLocaleString()} ms, exceeding the 200 ms threshold for good responsiveness.`,
          observed: {
            value: tbt,
            unit: 'ms',
            displayValue: `${Math.round(tbt).toLocaleString()} ms`
          },
          threshold: {
            value: THRESHOLDS.TBT_HIGH.value,
            unit: THRESHOLDS.TBT_HIGH.unit,
            condition: THRESHOLDS.TBT_HIGH.condition,
            source: THRESHOLDS.TBT_HIGH.source
          },
          evidenceRefs: ['metrics.tbt'],
          confidence: 'DETERMINISTIC',
          nextInvestigation:
            'Investigate main-thread long tasks, heavy script parsing/compilation, and third-party script execution.'
        }
      ];
    }

    return [];
  }
};

export const TBT_CRITICAL_RULE: PerformanceRule = {
  id: 'TBT_CRITICAL',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'CRITICAL',
  title: 'Total Blocking Time is Critically High',
  description: 'Total Blocking Time exceeds the 600 ms critical threshold.',
  evidenceConsumed: ['metrics.tbt'],
  thresholdSummary: THRESHOLDS.TBT_CRITICAL.condition,
  thresholdSource: THRESHOLDS.TBT_CRITICAL.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const tbt = evidence?.metrics?.tbt?.value;
    if (tbt === null || tbt === undefined || typeof tbt !== 'number' || tbt <= 0) {
      return [];
    }

    if (tbt > THRESHOLDS.TBT_CRITICAL.value) {
      return [
        {
          id: 'finding:tbt_critical',
          ruleId: 'TBT_CRITICAL',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'CRITICAL',
          title: 'Total Blocking Time is Critically High',
          description: `Total Blocking Time was observed at ${Math.round(tbt).toLocaleString()} ms, exceeding the 600 ms critical boundary.`,
          observed: {
            value: tbt,
            unit: 'ms',
            displayValue: `${Math.round(tbt).toLocaleString()} ms`
          },
          threshold: {
            value: THRESHOLDS.TBT_CRITICAL.value,
            unit: THRESHOLDS.TBT_CRITICAL.unit,
            condition: THRESHOLDS.TBT_CRITICAL.condition,
            source: THRESHOLDS.TBT_CRITICAL.source
          },
          evidenceRefs: ['metrics.tbt'],
          confidence: 'DETERMINISTIC',
          nextInvestigation:
            'Investigate extensive main-thread blocking tasks, synchronous framework hydration/bootstrapping, and heavy JavaScript bundles.'
        }
      ];
    }

    return [];
  }
};
