/**
 * ZYRA CI Regression Detection Engine
 *
 * Deterministic evaluation of performance deltas against baseline measurements,
 * distinguishing true regressions from laboratory measurement jitter.
 */

import { type MeasurementSnapshot, type MetricDelta } from '../verification/types.js';
import { compareMeasurements } from '../verification/comparator.js';
import {
  type CIRegression,
  type CIComparisonSummary,
  type CIBudgetEvaluation
} from './types.js';

const CORE_WEB_VITALS = new Set(['lcp', 'cls', 'inp']);

/**
 * Detects performance regressions between baseline and current measurement snapshots.
 */
export function detectCIRegressions(
  baselineSnapshot: MeasurementSnapshot,
  currentSnapshot: MeasurementSnapshot,
  budgetEvaluations?: CIBudgetEvaluation[]
): CIComparisonSummary {
  const comparison = compareMeasurements(
    baselineSnapshot.evidence,
    currentSnapshot.evidence
  );

  if (!comparison.compatible) {
    return {
      compatible: false,
      incompatibilityReason: comparison.incompatibilityReason,
      overallStatus: 'INCONCLUSIVE',
      metrics: {},
      regressions: [],
      improvements: [],
      unchanged: []
    };
  }

  const budgetViolationMap = new Map<string, boolean>();
  if (budgetEvaluations) {
    for (const b of budgetEvaluations) {
      if (b.status === 'FAIL') {
        budgetViolationMap.set(b.metric, true);
      }
    }
  }

  const regressions: CIRegression[] = [];

  for (const delta of comparison.regressions) {
    const isCwv = CORE_WEB_VITALS.has(delta.metric);
    const hasBudgetViolation = budgetViolationMap.get(delta.metric) ?? false;

    // Severity classification: Core Web Vitals or budget violations are CRITICAL
    let severity: 'CRITICAL' | 'WARNING' = 'WARNING';
    if (isCwv || hasBudgetViolation) {
      severity = 'CRITICAL';
    }

    const absDeltaStr = Math.abs(delta.absoluteDelta ?? 0);
    const pctStr = delta.percentageDelta !== null ? `${Math.abs(delta.percentageDelta).toFixed(1)}%` : 'N/A';
    const details = `${delta.name} regressed by +${absDeltaStr}${delta.unit} (${pctStr})`;

    regressions.push({
      metric: delta.metric,
      name: delta.name,
      baseline: delta.before,
      current: delta.after,
      absoluteDelta: delta.absoluteDelta,
      percentageDelta: delta.percentageDelta,
      direction: delta.direction,
      status: delta.status,
      isSignificant: delta.isSignificant,
      unit: delta.unit,
      severity,
      budgetViolation: hasBudgetViolation,
      details
    });
  }

  // Deterministic sorting: CRITICAL regressions first, then by metric name
  regressions.sort((a, b) => {
    if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
    if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
    return a.metric.localeCompare(b.metric);
  });

  return {
    compatible: true,
    overallStatus: comparison.overallStatus,
    metrics: comparison.metrics,
    regressions,
    improvements: comparison.improvements,
    unchanged: comparison.unchanged
  };
}
