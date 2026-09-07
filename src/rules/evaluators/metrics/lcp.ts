import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const LCP_SLOW_RULE: PerformanceRule = {
  id: 'LCP_SLOW',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'WARNING',
  title: 'Largest Contentful Paint is Slow',
  description: 'Largest Contentful Paint exceeds the Core Web Vitals 2,500 ms threshold.',
  evidenceConsumed: ['metrics.lcp'],
  thresholdSummary: THRESHOLDS.LCP_SLOW.condition,
  thresholdSource: THRESHOLDS.LCP_SLOW.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const lcp = evidence?.metrics?.lcp?.value;
    if (lcp === null || lcp === undefined || typeof lcp !== 'number' || lcp <= 0) {
      return [];
    }

    if (lcp > THRESHOLDS.LCP_SLOW.value && lcp <= THRESHOLDS.LCP_CRITICAL.value) {
      return [
        {
          id: 'finding:lcp_slow',
          ruleId: 'LCP_SLOW',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'WARNING',
          title: 'Largest Contentful Paint is Slow',
          description: `Largest Contentful Paint was observed at ${Math.round(lcp).toLocaleString()} ms, exceeding the 2,500 ms threshold for good user experience.`,
          observed: {
            value: lcp,
            unit: 'ms',
            displayValue: `${(lcp / 1000).toFixed(2)} s`
          },
          threshold: {
            value: THRESHOLDS.LCP_SLOW.value,
            unit: THRESHOLDS.LCP_SLOW.unit,
            condition: THRESHOLDS.LCP_SLOW.condition,
            source: THRESHOLDS.LCP_SLOW.source
          },
          evidenceRefs: ['metrics.lcp'],
          confidence: 'DETERMINISTIC',
          nextInvestigation:
            'Investigate LCP candidate element discovery, asset load delays, and render-blocking resources.'
        }
      ];
    }

    return [];
  }
};

export const LCP_CRITICAL_RULE: PerformanceRule = {
  id: 'LCP_CRITICAL',
  version: '1.0',
  category: 'metrics',
  defaultSeverity: 'CRITICAL',
  title: 'Largest Contentful Paint is Critically Slow',
  description: 'Largest Contentful Paint exceeds the Core Web Vitals 4,000 ms critical threshold.',
  evidenceConsumed: ['metrics.lcp'],
  thresholdSummary: THRESHOLDS.LCP_CRITICAL.condition,
  thresholdSource: THRESHOLDS.LCP_CRITICAL.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const lcp = evidence?.metrics?.lcp?.value;
    if (lcp === null || lcp === undefined || typeof lcp !== 'number' || lcp <= 0) {
      return [];
    }

    if (lcp > THRESHOLDS.LCP_CRITICAL.value) {
      return [
        {
          id: 'finding:lcp_critical',
          ruleId: 'LCP_CRITICAL',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'CRITICAL',
          title: 'Largest Contentful Paint is Critically Slow',
          description: `Largest Contentful Paint was observed at ${Math.round(lcp).toLocaleString()} ms, exceeding the 4,000 ms poor performance boundary.`,
          observed: {
            value: lcp,
            unit: 'ms',
            displayValue: `${(lcp / 1000).toFixed(2)} s`
          },
          threshold: {
            value: THRESHOLDS.LCP_CRITICAL.value,
            unit: THRESHOLDS.LCP_CRITICAL.unit,
            condition: THRESHOLDS.LCP_CRITICAL.condition,
            source: THRESHOLDS.LCP_CRITICAL.source
          },
          evidenceRefs: ['metrics.lcp'],
          confidence: 'DETERMINISTIC',
          nextInvestigation:
            'Investigate LCP resource delivery bottlenecks, server response delays, client-side rendering delays, and large hero assets.'
        }
      ];
    }

    return [];
  }
};
