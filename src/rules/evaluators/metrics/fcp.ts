import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const FCP_SLOW_RULE: PerformanceRule = {
  id: 'FCP_SLOW',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'WARNING',
  title: 'First Contentful Paint is Slow',
  description: 'First Contentful Paint exceeds the recommended 1,800 ms threshold.',
  evidenceConsumed: ['metrics.fcp'],
  thresholdSummary: THRESHOLDS.FCP_SLOW.condition,
  thresholdSource: THRESHOLDS.FCP_SLOW.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const fcp = evidence?.metrics?.fcp?.value;
    if (fcp === null || fcp === undefined || typeof fcp !== 'number' || fcp <= 0) {
      return [];
    }

    // If critical (> 3000 ms), FCP_CRITICAL handles it
    if (fcp > THRESHOLDS.FCP_SLOW.value && fcp <= THRESHOLDS.FCP_CRITICAL.value) {
      return [
        {
          id: 'finding:fcp_slow',
          ruleId: 'FCP_SLOW',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'WARNING',
          title: 'First Contentful Paint is Slow',
          description: `First Contentful Paint was observed at ${Math.round(fcp).toLocaleString()} ms, exceeding the standard threshold of 1,800 ms.`,
          observed: {
            value: fcp,
            unit: 'ms',
            displayValue: `${(fcp / 1000).toFixed(2)} s`
          },
          threshold: {
            value: THRESHOLDS.FCP_SLOW.value,
            unit: THRESHOLDS.FCP_SLOW.unit,
            condition: THRESHOLDS.FCP_SLOW.condition,
            source: THRESHOLDS.FCP_SLOW.source
          },
          evidenceRefs: ['metrics.fcp'],
          confidence: 'DETERMINISTIC',
          nextInvestigation:
            'Investigate server response latency, render-blocking resources, and critical font delivery.'
        }
      ];
    }

    return [];
  }
};

export const FCP_CRITICAL_RULE: PerformanceRule = {
  id: 'FCP_CRITICAL',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'HIGH',
  title: 'First Contentful Paint is Critically Slow',
  description: 'First Contentful Paint exceeds the 3,000 ms critical threshold.',
  evidenceConsumed: ['metrics.fcp'],
  thresholdSummary: THRESHOLDS.FCP_CRITICAL.condition,
  thresholdSource: THRESHOLDS.FCP_CRITICAL.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const fcp = evidence?.metrics?.fcp?.value;
    if (fcp === null || fcp === undefined || typeof fcp !== 'number' || fcp <= 0) {
      return [];
    }

    if (fcp > THRESHOLDS.FCP_CRITICAL.value) {
      return [
        {
          id: 'finding:fcp_critical',
          ruleId: 'FCP_CRITICAL',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'HIGH',
          title: 'First Contentful Paint is Critically Slow',
          description: `First Contentful Paint was observed at ${Math.round(fcp).toLocaleString()} ms, exceeding the critical boundary of 3,000 ms.`,
          observed: {
            value: fcp,
            unit: 'ms',
            displayValue: `${(fcp / 1000).toFixed(2)} s`
          },
          threshold: {
            value: THRESHOLDS.FCP_CRITICAL.value,
            unit: THRESHOLDS.FCP_CRITICAL.unit,
            condition: THRESHOLDS.FCP_CRITICAL.condition,
            source: THRESHOLDS.FCP_CRITICAL.source
          },
          evidenceRefs: ['metrics.fcp'],
          confidence: 'DETERMINISTIC',
          nextInvestigation:
            'Investigate server response latency, heavy render-blocking resources, and document delivery bottlenecks.'
        }
      ];
    }

    return [];
  }
};
