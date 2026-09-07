/**
 * ZYRA Deterministic Measurement Comparator
 *
 * Pure evaluation engine comparing baseline and post-fix browser evidence.
 */

import { type ZyraEvidence } from '../evidence/types.js';
import { type ComparisonResult, type MetricDelta } from './types.js';
import { validateMeasurementCompatibility } from './compatibility.js';
import { evaluateMetricDelta } from './significance.js';
import { THRESHOLDS } from '../rules/thresholds.js';

const ORDERED_METRICS: Array<{ key: string; thresholdVal: string | number }> = [
  { key: 'lcp', thresholdVal: THRESHOLDS.LCP_SLOW.condition },
  { key: 'cls', thresholdVal: THRESHOLDS.CLS_WARNING.condition },
  { key: 'inp', thresholdVal: THRESHOLDS.INP_SLOW.condition },
  { key: 'fcp', thresholdVal: THRESHOLDS.FCP_SLOW.condition },
  { key: 'tbt', thresholdVal: THRESHOLDS.TBT_HIGH.condition },
  { key: 'speedIndex', thresholdVal: THRESHOLDS.SPEED_INDEX_SLOW.condition }
];

/**
 * Pure function comparing baseline and post-fix ZyraEvidence.
 */
export function compareMeasurements(
  baseline: ZyraEvidence,
  postFix: ZyraEvidence
): ComparisonResult {
  const compCheck = validateMeasurementCompatibility(baseline, postFix);

  if (!compCheck.compatible) {
    return {
      compatible: false,
      incompatibilityReason: compCheck.reason,
      metrics: {},
      overallStatus: 'INCONCLUSIVE',
      regressions: [],
      improvements: [],
      unchanged: []
    };
  }

  const metrics: Record<string, MetricDelta> = {};
  const regressions: MetricDelta[] = [];
  const improvements: MetricDelta[] = [];
  const unchanged: MetricDelta[] = [];

  for (const { key, thresholdVal } of ORDERED_METRICS) {
    const beforeVal = (baseline.metrics as Record<string, any>)[key]?.value ?? null;
    const afterVal = (postFix.metrics as Record<string, any>)[key]?.value ?? null;

    const delta = evaluateMetricDelta(key, beforeVal, afterVal, thresholdVal);
    metrics[key] = delta;

    if (delta.status === 'REGRESSED') {
      regressions.push(delta);
    } else if (delta.status === 'IMPROVED') {
      improvements.push(delta);
    } else if (delta.status === 'UNCHANGED') {
      unchanged.push(delta);
    }
  }

  let overallStatus: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED' | 'INCONCLUSIVE' = 'UNCHANGED';

  if (regressions.length > 0) {
    overallStatus = 'REGRESSED';
  } else if (improvements.length > 0) {
    overallStatus = 'IMPROVED';
  } else {
    overallStatus = 'UNCHANGED';
  }

  return {
    compatible: true,
    metrics,
    overallStatus,
    regressions,
    improvements,
    unchanged
  };
}
