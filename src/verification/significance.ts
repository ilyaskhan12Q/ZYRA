/**
 * ZYRA Significance & Noise Evaluation Policy
 *
 * Grounded in Rule 14 (Do Not Hide Uncertainty) and Rule 3 (Never Claim Unverified Improvements).
 * Distinguishes genuine performance optimizations from routine lab measurement jitter.
 */

import { type MetricDelta, type MetricDirection, type MetricStatus } from './types.js';

export interface MetricSignificanceRule {
  readonly minAbsoluteDelta: number;
  readonly minPercentageDelta: number; // in percent (e.g. 3.0 for 3%)
  readonly unit: 'ms' | 'score';
  readonly name: string;
  readonly rationale: string;
}

export const METRIC_SIGNIFICANCE_RULES: Record<string, MetricSignificanceRule> = {
  fcp: {
    minAbsoluteDelta: 50,
    minPercentageDelta: 3.0,
    unit: 'ms',
    name: 'First Contentful Paint',
    rationale: 'FCP lab variance under 50ms or 3% is routine browser timing jitter.'
  },
  lcp: {
    minAbsoluteDelta: 100,
    minPercentageDelta: 3.0,
    unit: 'ms',
    name: 'Largest Contentful Paint',
    rationale: 'LCP variations under 100ms or 3% represent network/render jitter rather than code impact.'
  },
  cls: {
    minAbsoluteDelta: 0.015,
    minPercentageDelta: 5.0,
    unit: 'score',
    name: 'Cumulative Layout Shift',
    rationale: 'CLS variations under 0.015 are layout calculation rounding variations.'
  },
  tbt: {
    minAbsoluteDelta: 30,
    minPercentageDelta: 5.0,
    unit: 'ms',
    name: 'Total Blocking Time',
    rationale: 'TBT variations under 30ms or 5% reflect background OS scheduling jitter.'
  },
  speedIndex: {
    minAbsoluteDelta: 100,
    minPercentageDelta: 3.0,
    unit: 'ms',
    name: 'Speed Index',
    rationale: 'Visual progression variations under 100ms or 3% are frame capture jitter.'
  },
  inp: {
    minAbsoluteDelta: 25,
    minPercentageDelta: 5.0,
    unit: 'ms',
    name: 'Interaction to Next Paint',
    rationale: 'Synthetic or lab INP variations under 25ms are event dispatch jitter.'
  }
};

/**
 * Evaluates the delta and significance between before and after metric measurements.
 *
 * For all Core Web Vitals and timing metrics, lower is better.
 */
export function evaluateMetricDelta(
  metricKey: string,
  before: number | null,
  after: number | null,
  threshold: number | string = 'N/A'
): MetricDelta {
  const rule = METRIC_SIGNIFICANCE_RULES[metricKey] || {
    minAbsoluteDelta: 50,
    minPercentageDelta: 3.0,
    unit: 'ms',
    name: metricKey.toUpperCase(),
    rationale: 'Default significance rule'
  };

  // Missing data cases
  if (before === null || after === null || typeof before !== 'number' || typeof after !== 'number') {
    return {
      metric: metricKey,
      name: rule.name,
      before,
      after,
      absoluteDelta: null,
      percentageDelta: null,
      direction: 'unavailable',
      status: 'NOT_AVAILABLE',
      unit: rule.unit,
      threshold,
      isSignificant: false
    };
  }

  const absoluteDelta = after - before;

  // Calculate percentage delta only when before > 0
  let percentageDelta: number | null = null;
  if (before !== 0) {
    percentageDelta = (absoluteDelta / Math.abs(before)) * 100;
  }

  const absDelta = Math.abs(absoluteDelta);
  const absPct = percentageDelta !== null ? Math.abs(percentageDelta) : 0;

  // Determine significance based on rule
  let isSignificant = false;
  if (rule.unit === 'score') {
    // For CLS, absolute change is primary
    isSignificant = absDelta >= rule.minAbsoluteDelta;
  } else {
    // For timing metrics, require BOTH minimum absolute change AND percentage change
    // or significant absolute difference if percentage is huge
    isSignificant = absDelta >= rule.minAbsoluteDelta && (percentageDelta === null || absPct >= rule.minPercentageDelta);
  }

  let direction: MetricDirection = 'unchanged';
  let status: MetricStatus = 'UNCHANGED';

  if (isSignificant) {
    if (absoluteDelta < 0) {
      // Metric decreased: for Web Vitals timing & CLS, lower is better -> improved!
      direction = 'improved';
      status = 'IMPROVED';
    } else {
      // Metric increased: worse performance -> regressed!
      direction = 'regressed';
      status = 'REGRESSED';
    }
  }

  return {
    metric: metricKey,
    name: rule.name,
    before,
    after,
    absoluteDelta,
    percentageDelta,
    direction,
    status,
    unit: rule.unit,
    threshold,
    isSignificant
  };
}
