/**
 * ZYRA Verification Engine
 *
 * Grounded in the central Phase 08 principle:
 * A successful code modification is NOT evidence of a successful performance optimization.
 * Only post-fix measurement and comparison can establish whether performance actually improved.
 */

import { type ZyraEvidence } from '../evidence/types.js';
import { type FixResult, type FixPlan } from '../fixes/types.js';
import {
  VERIFICATION_SCHEMA_VERSION,
  type VerificationResult,
  type VerificationStatus,
  type OptimizationDecision,
  type TargetVerification,
  type VerificationProvenance,
  type RepeatedRunSummary,
  type MetricDelta
} from './types.js';
import { createMeasurementSnapshot } from './compatibility.js';
import { compareMeasurements } from './comparator.js';
import { verifyWorkspaceCodeState } from './code-state.js';

export interface VerificationOptions {
  targetUrl: string;
  workspace: string;
  baseline: ZyraEvidence;
  postFix: ZyraEvidence;
  repeatedRuns?: ZyraEvidence[];
  fixResult?: FixResult;
  fixPlan?: FixPlan;
  targetMetric?: string;
  verificationId?: string;
  timestamp?: string;
}

/**
 * Maps common strategy IDs or target metric strings to canonical metric keys.
 */
function resolveTargetMetricKey(
  targetMetric?: string,
  fixPlan?: FixPlan,
  fixResult?: FixResult
): string | undefined {
  if (targetMetric) {
    const norm = targetMetric.trim().toLowerCase();
    if (norm.includes('lcp')) return 'lcp';
    if (norm.includes('cls')) return 'cls';
    if (norm.includes('inp')) return 'inp';
    if (norm.includes('fcp')) return 'fcp';
    if (norm.includes('tbt')) return 'tbt';
    if (norm.includes('speedindex') || norm.includes('speed_index') || norm.includes('speed index')) return 'speedIndex';
    return norm;
  }

  const expectedMetric = fixPlan?.expectedImpact?.targetMetric;
  if (expectedMetric) {
    const norm = expectedMetric.trim().toLowerCase();
    if (norm.includes('lcp')) return 'lcp';
    if (norm.includes('cls')) return 'cls';
    if (norm.includes('inp')) return 'inp';
    if (norm.includes('fcp')) return 'fcp';
    if (norm.includes('tbt')) return 'tbt';
    if (norm.includes('speedindex') || norm.includes('speed_index') || norm.includes('speed index')) return 'speedIndex';
  }

  const strategyId = fixPlan?.strategy?.id || fixResult?.strategyId;
  if (strategyId) {
    switch (strategyId) {
      case 'FIX_IMAGE_OPTIMIZATION':
      case 'FIX_RESOURCE_REFERENCE':
        return 'lcp';
      case 'FIX_RENDER_BLOCKING_RESOURCE':
      case 'FIX_LARGE_FONT':
        return 'fcp';
      case 'FIX_UNUSED_IMPORT':
      case 'FIX_SAFE_DYNAMIC_IMPORT':
        return 'tbt';
    }
  }

  return undefined;
}

/**
 * Evaluates multiple bounded repeated post-fix measurements against a baseline.
 */
function evaluateRepeatedRuns(
  baseline: ZyraEvidence,
  runs: ZyraEvidence[]
): RepeatedRunSummary {
  // Cap bounded runs to 5 max
  const boundedRuns = runs.slice(0, 5);
  const totalRuns = boundedRuns.length;

  let improvementCount = 0;
  let regressionCount = 0;
  let unchangedCount = 0;

  const metricSums: Record<string, { beforeTotal: number; afterTotal: number; deltaTotal: number; count: number }> = {};

  for (const postFixRun of boundedRuns) {
    const comp = compareMeasurements(baseline, postFixRun);
    if (comp.overallStatus === 'REGRESSED') {
      regressionCount++;
    } else if (comp.overallStatus === 'IMPROVED') {
      improvementCount++;
    } else {
      unchangedCount++;
    }

    for (const [key, delta] of Object.entries(comp.metrics)) {
      if (delta.before !== null && delta.after !== null && delta.absoluteDelta !== null) {
        if (!metricSums[key]) {
          metricSums[key] = { beforeTotal: 0, afterTotal: 0, deltaTotal: 0, count: 0 };
        }
        metricSums[key].beforeTotal += delta.before;
        metricSums[key].afterTotal += delta.after;
        metricSums[key].deltaTotal += delta.absoluteDelta;
        metricSums[key].count++;
      }
    }
  }

  let outcome: 'CONSISTENT_IMPROVEMENT' | 'CONSISTENT_REGRESSION' | 'MIXED_RESULTS' | 'INCONCLUSIVE' = 'MIXED_RESULTS';
  let consistent = false;

  if (improvementCount === totalRuns) {
    outcome = 'CONSISTENT_IMPROVEMENT';
    consistent = true;
  } else if (regressionCount === totalRuns) {
    outcome = 'CONSISTENT_REGRESSION';
    consistent = true;
  } else if (unchangedCount === totalRuns) {
    outcome = 'INCONCLUSIVE';
    consistent = true;
  } else {
    outcome = 'MIXED_RESULTS';
    consistent = false;
  }

  const metricAverages: Record<string, { beforeMean: number; afterMean: number; deltaMean: number }> = {};
  for (const [key, stats] of Object.entries(metricSums)) {
    if (stats.count > 0) {
      metricAverages[key] = {
        beforeMean: Math.round((stats.beforeTotal / stats.count) * 100) / 100,
        afterMean: Math.round((stats.afterTotal / stats.count) * 100) / 100,
        deltaMean: Math.round((stats.deltaTotal / stats.count) * 100) / 100
      };
    }
  }

  return {
    totalRuns,
    completedRuns: totalRuns,
    consistent,
    outcome,
    metricAverages
  };
}

/**
 * Executes a verification analysis comparing baseline and post-fix measurements.
 */
export async function verifyOptimization(options: VerificationOptions): Promise<VerificationResult> {
  const {
    targetUrl,
    workspace,
    baseline,
    postFix,
    repeatedRuns,
    fixResult,
    fixPlan,
    targetMetric,
    verificationId = `verif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp = new Date().toISOString()
  } = options;

  const baselineSnap = createMeasurementSnapshot(baseline);
  const postFixSnap = createMeasurementSnapshot(postFix);

  // 1. Code State Verification (if fixResult is provided)
  let codeStateValid = true;
  let filesVerified: VerificationProvenance['filesVerified'] = [];

  if (fixResult && workspace) {
    const codeStateRes = await verifyWorkspaceCodeState(workspace, fixResult);
    codeStateValid = codeStateRes.valid;
    filesVerified = codeStateRes.files;
  }

  const provenance: VerificationProvenance = {
    fixResultId: fixResult?.planId,
    planId: fixPlan?.planId || fixResult?.planId,
    strategyId: fixPlan?.strategy?.id || fixResult?.strategyId,
    workspace,
    filesVerified,
    codeStateValid
  };

  // 2. Perform Deterministic Metric Comparison
  const comparison = compareMeasurements(baseline, postFix);

  // If measurements are not compatible, verification is inconclusive
  if (!comparison.compatible) {
    return {
      schemaVersion: VERIFICATION_SCHEMA_VERSION,
      verificationId,
      timestamp,
      targetUrl,
      device: baseline.target.device,
      status: 'INCONCLUSIVE',
      decision: 'INCONCLUSIVE',
      baseline: baselineSnap,
      postFix: postFixSnap,
      comparison,
      regressions: [],
      provenance,
      summary: `Verification Inconclusive: Measurements are not comparable (${comparison.incompatibilityReason}).`
    };
  }

  // If code state drifted, mark inconclusive
  if (!codeStateValid) {
    return {
      schemaVersion: VERIFICATION_SCHEMA_VERSION,
      verificationId,
      timestamp,
      targetUrl,
      device: baseline.target.device,
      status: 'INCONCLUSIVE',
      decision: 'NO_ACTION',
      baseline: baselineSnap,
      postFix: postFixSnap,
      comparison,
      regressions: comparison.regressions,
      provenance,
      summary: 'Verification Inconclusive: Workspace code state has drifted from the applied fix.'
    };
  }

  // 3. Repeated Runs Evaluation (if provided)
  let repeatedSummary: RepeatedRunSummary | undefined;
  if (repeatedRuns && repeatedRuns.length > 1) {
    repeatedSummary = evaluateRepeatedRuns(baseline, repeatedRuns);
  }

  // 4. Target Finding Verification
  const resolvedTargetKey = resolveTargetMetricKey(targetMetric, fixPlan, fixResult);
  let targetVerification: TargetVerification | undefined;

  if (resolvedTargetKey && comparison.metrics[resolvedTargetKey]) {
    const targetDelta = comparison.metrics[resolvedTargetKey];
    const targetImproved = targetDelta.status === 'IMPROVED';

    targetVerification = {
      targetMetric: resolvedTargetKey.toUpperCase(),
      expectedDirection: 'improve',
      observedDelta: targetDelta,
      targetImproved,
      findingId: fixPlan?.sourceFindingIds?.[0],
      evidenceCheckPassed: targetDelta.status !== 'NOT_AVAILABLE',
      details: targetImproved
        ? `Target metric ${resolvedTargetKey.toUpperCase()} improved by ${Math.abs(targetDelta.absoluteDelta ?? 0)}${targetDelta.unit} (${Math.abs(Math.round(targetDelta.percentageDelta ?? 0))}%)`
        : targetDelta.status === 'REGRESSED'
        ? `Target metric ${resolvedTargetKey.toUpperCase()} regressed by +${Math.abs(targetDelta.absoluteDelta ?? 0)}${targetDelta.unit}`
        : `Target metric ${resolvedTargetKey.toUpperCase()} showed no material change (delta ${targetDelta.absoluteDelta ?? 0}${targetDelta.unit})`
    };
  }

  // 5. Synthesis: Decision and Status
  let status: VerificationStatus = 'VERIFIED_NO_IMPROVEMENT';
  let decision: OptimizationDecision = 'NO_ACTION';
  let summary = '';

  const hasRegressions = comparison.regressions.length > 0;
  const targetImproved = targetVerification ? targetVerification.targetImproved : comparison.improvements.length > 0;

  if (repeatedSummary && repeatedSummary.outcome === 'MIXED_RESULTS') {
    status = 'INCONCLUSIVE';
    decision = 'INCONCLUSIVE';
    summary = `Repeated measurements (${repeatedSummary.totalRuns} runs) yielded mixed results without consistent improvement or regression.`;
  } else if (hasRegressions) {
    // Regression detected on any metric!
    status = 'REGRESSION_DETECTED';
    decision = 'ROLLBACK_RECOMMENDED';
    const regressedNames = comparison.regressions.map((r) => r.name).join(', ');
    summary = `Performance regression detected in: ${regressedNames}. Rollback is recommended to protect application performance.`;
  } else if (targetImproved) {
    status = 'VERIFIED_IMPROVEMENT';
    decision = 'KEEP_FIX';
    if (targetVerification) {
      summary = `Verified performance improvement: ${targetVerification.details}. No regressions detected across other metrics.`;
    } else {
      const impNames = comparison.improvements.map((i) => i.name).join(', ');
      summary = `Verified performance improvements in ${impNames}. Zero regressions observed.`;
    }
  } else {
    // No regressions, but target didn't improve materially
    status = 'VERIFIED_NO_IMPROVEMENT';
    decision = 'NO_ACTION';
    summary = 'No material performance improvement detected compared to baseline. Fix caused no regressions, but produced no measurable benefit.';
  }

  return {
    schemaVersion: VERIFICATION_SCHEMA_VERSION,
    verificationId,
    timestamp,
    targetUrl,
    device: baseline.target.device,
    status,
    decision,
    baseline: baselineSnap,
    postFix: postFixSnap,
    comparison,
    targetVerification,
    regressions: comparison.regressions,
    provenance,
    repeatedRuns: repeatedSummary,
    summary
  };
}
