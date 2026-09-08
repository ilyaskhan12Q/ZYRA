/**
 * ZYRA CI Policy Engine
 *
 * Evaluates regressions, performance budgets, and baseline compatibility
 * to deterministically resolve CI exit status and exit code.
 */

import {
  type CIExitStatus,
  type CIPolicy,
  type CIComparisonSummary,
  type CIBudgetEvaluation,
  CI_EXIT_CODES
} from './types.js';

export interface PolicyEvaluationInput {
  measurementFailed?: boolean;
  measurementError?: string;
  baselineProvided: boolean;
  baselineCompatible: boolean;
  incompatibilityReason?: string;
  comparison?: CIComparisonSummary;
  budgets: {
    passed: boolean;
    violations: CIBudgetEvaluation[];
    warnings: CIBudgetEvaluation[];
  };
  policy?: CIPolicy;
}

export interface PolicyEvaluationResult {
  status: CIExitStatus;
  exitCode: number;
  summary: string;
  reasons: string[];
}

export const DEFAULT_CI_POLICY: CIPolicy = {
  failOnRegression: true,
  failOnBudgetViolation: true,
  warnOnBudgetViolation: false,
  warnOnMinorRegression: true,
  allowMissingBaseline: false,
  failOnWarn: false
};

/**
 * Deterministically resolves the CI run's status and exit code.
 */
export function evaluateCIPolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policy: CIPolicy = { ...DEFAULT_CI_POLICY, ...input.policy };
  const reasons: string[] = [];

  // 1. Telemetry / Measurement Failure
  if (input.measurementFailed) {
    const errorMsg = input.measurementError || 'Unknown measurement failure occurred.';
    return {
      status: 'MEASUREMENT_FAILED',
      exitCode: CI_EXIT_CODES.MEASUREMENT_FAILED,
      summary: `Measurement Failed: ${errorMsg}`,
      reasons: [errorMsg]
    };
  }

  // 2. Baseline Incompatibility Check
  if (input.baselineProvided && !input.baselineCompatible) {
    const reason = input.incompatibilityReason || 'Baseline is incompatible with current measurement target.';
    return {
      status: 'INCONCLUSIVE',
      exitCode: CI_EXIT_CODES.INCONCLUSIVE,
      summary: `Inconclusive: ${reason}`,
      reasons: [reason]
    };
  }

  // 3. Missing Baseline Handling
  if (!input.baselineProvided && !policy.allowMissingBaseline) {
    const reason = 'Baseline is required for CI performance gating, but none was provided.';
    return {
      status: 'INCONCLUSIVE',
      exitCode: CI_EXIT_CODES.INCONCLUSIVE,
      summary: `Inconclusive: ${reason}`,
      reasons: [reason]
    };
  }

  // 4. Hard Budget Violations
  const hasBudgetViolations = input.budgets.violations.length > 0;
  if (hasBudgetViolations) {
    for (const v of input.budgets.violations) {
      reasons.push(
        `Budget violation: ${v.name} was ${v.actual}${v.unit} (budget: ${v.budgetMax}${v.unit}, delta: +${v.delta}${v.unit})`
      );
    }
  }

  // 5. Regressions
  const regressions = input.comparison?.regressions || [];
  const hasCriticalRegressions = regressions.some((r) => r.severity === 'CRITICAL');
  const hasAnyRegressions = regressions.length > 0;

  if (hasAnyRegressions) {
    for (const r of regressions) {
      reasons.push(`Regression: ${r.details}`);
    }
  }

  // 6. Evaluate Fail Conditions
  const shouldFailOnBudget = hasBudgetViolations && policy.failOnBudgetViolation && !policy.warnOnBudgetViolation;
  const shouldFailOnRegression = policy.failOnRegression && (hasCriticalRegressions || (hasAnyRegressions && !policy.warnOnMinorRegression));

  if (shouldFailOnBudget || shouldFailOnRegression) {
    const summaryParts: string[] = [];
    if (shouldFailOnBudget) summaryParts.push(`${input.budgets.violations.length} budget violation(s)`);
    if (shouldFailOnRegression) summaryParts.push(`${regressions.length} significant regression(s)`);

    return {
      status: 'FAIL',
      exitCode: CI_EXIT_CODES.FAIL,
      summary: `CI Check Failed: Detected ${summaryParts.join(' and ')}.`,
      reasons
    };
  }

  // 7. Evaluate Warning Conditions
  const hasBudgetWarnings = input.budgets.warnings.length > 0 || (hasBudgetViolations && policy.warnOnBudgetViolation);
  const hasWarningRegressions = hasAnyRegressions && policy.warnOnMinorRegression && !hasCriticalRegressions;

  if (hasBudgetWarnings || hasWarningRegressions) {
    if (input.budgets.warnings.length > 0) {
      for (const w of input.budgets.warnings) {
        reasons.push(
          `Budget warning: ${w.name} was ${w.actual}${w.unit} (warning threshold: ${w.budgetWarn}${w.unit})`
        );
      }
    }

    const warnSummary = `CI Check Warning: Non-blocking performance regressions or warning thresholds crossed.`;

    if (policy.failOnWarn) {
      return {
        status: 'FAIL',
        exitCode: CI_EXIT_CODES.FAIL,
        summary: `${warnSummary} (Elevated to FAIL via failOnWarn).`,
        reasons
      };
    }

    return {
      status: 'WARN',
      exitCode: CI_EXIT_CODES.WARN,
      summary: warnSummary,
      reasons
    };
  }

  // 8. All Checks Pass
  return {
    status: 'PASS',
    exitCode: CI_EXIT_CODES.PASS,
    summary: 'CI Check Passed: All performance budgets met and zero regressions detected.',
    reasons: ['All evaluated metrics within budgets and compatible with baseline.']
  };
}
