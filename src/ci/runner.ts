/**
 * ZYRA CI Runner
 *
 * Orchestrates the end-to-end CI performance check pipeline:
 * measurement collection -> baseline comparison -> budget evaluation -> policy resolution.
 */

import { collectEvidence } from '../evidence/collector.js';
import { type ZyraEvidence } from '../evidence/types.js';
import { createMeasurementSnapshot } from '../verification/compatibility.js';
import {
  CI_SCHEMA_VERSION,
  type CIResult,
  type CIRunOptions,
  type CIBaseline,
  type CIComparisonSummary
} from './types.js';
import { loadCIBaseline, createCIBaseline, validateCIBaselineCompatibility } from './baseline.js';
import { evaluateBudgets, DEFAULT_BUDGET_CONFIG } from './budgets.js';
import { detectCIRegressions } from './regression.js';
import { evaluateCIPolicy } from './policy.js';
import { formatCIPRComment } from './reporter.js';
import { validateCIResult } from './validator.js';

/**
 * Runs a complete deterministic CI performance check.
 */
export async function runCI(options: CIRunOptions): Promise<CIResult> {
  const {
    targetUrl,
    device = 'mobile',
    timeoutMs = 60000,
    policy = {},
    budgetConfig = DEFAULT_BUDGET_CONFIG,
    id = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp = new Date().toISOString()
  } = options;

  // 1. Ingest or Collect Current Measurement Telemetry
  let currentEvidence: ZyraEvidence;
  try {
    if (options.currentEvidence) {
      currentEvidence = options.currentEvidence;
    } else {
      const collected = await collectEvidence({
        url: targetUrl,
        device,
        timeoutMs
      });
      currentEvidence = collected.evidence;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    const policyRes = evaluateCIPolicy({
      measurementFailed: true,
      measurementError: errorMsg,
      baselineProvided: Boolean(options.baseline),
      baselineCompatible: false,
      budgets: { passed: false, violations: [], warnings: [] },
      policy
    });

    const failedResult: CIResult = {
      schemaVersion: CI_SCHEMA_VERSION,
      id,
      timestamp,
      targetUrl,
      device,
      status: policyRes.status,
      exitCode: policyRes.exitCode,
      policy,
      currentRun: {
        url: targetUrl,
        device,
        metrics: {},
        scores: {},
        evidenceTimestamp: timestamp
      },
      budgets: {
        passed: false,
        evaluations: [],
        violations: [],
        warnings: []
      },
      summary: policyRes.summary
    };

    return validateCIResult(failedResult);
  }

  const currentSnapshot = createMeasurementSnapshot(currentEvidence);

  // 2. Load and Validate Baseline
  let baseline: CIBaseline | undefined;
  let baselineCompatible = false;
  let incompatibilityReason: string | undefined;

  if (options.baseline) {
    try {
      if (typeof options.baseline === 'string') {
        baseline = await loadCIBaseline(options.baseline);
      } else if ('snapshot' in options.baseline && 'normalizedUrl' in options.baseline) {
        baseline = options.baseline as CIBaseline;
      } else {
        baseline = createCIBaseline(options.baseline as ZyraEvidence);
      }

      const compCheck = validateCIBaselineCompatibility(baseline, targetUrl, device);
      baselineCompatible = compCheck.compatible;
      incompatibilityReason = compCheck.reason;
    } catch (err) {
      baselineCompatible = false;
      incompatibilityReason = (err as Error).message;
    }
  }

  // 3. Evaluate Performance Budgets
  const budgets = evaluateBudgets(currentSnapshot.metrics, budgetConfig);

  // 4. Evaluate Baseline Comparison and Regressions
  let comparison: CIComparisonSummary | undefined;
  if (baseline && baselineCompatible) {
    comparison = detectCIRegressions(baseline.snapshot, currentSnapshot, budgets.evaluations);
  }

  // 5. Evaluate CI Policy for Final Status and Exit Code
  const policyRes = evaluateCIPolicy({
    baselineProvided: Boolean(options.baseline),
    baselineCompatible,
    incompatibilityReason,
    comparison,
    budgets,
    policy
  });

  const result: CIResult = {
    schemaVersion: CI_SCHEMA_VERSION,
    id,
    timestamp,
    targetUrl,
    device,
    status: policyRes.status,
    exitCode: policyRes.exitCode,
    policy,
    currentRun: {
      url: targetUrl,
      device,
      metrics: currentSnapshot.metrics,
      scores: currentSnapshot.scores,
      evidenceTimestamp: currentSnapshot.timestamp
    },
    baseline: baseline
      ? {
          id: baseline.id,
          url: baseline.url,
          device: baseline.device,
          timestamp: baseline.timestamp,
          metrics: baseline.metrics,
          scores: baseline.scores,
          compatible: baselineCompatible,
          incompatibilityReason
        }
      : undefined,
    comparison,
    budgets,
    summary: policyRes.summary
  };

  // 6. Generate PR Markdown Comment
  result.prComment = formatCIPRComment(result);

  return validateCIResult(result);
}
