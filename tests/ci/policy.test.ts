import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  evaluateCIPolicy,
  CI_EXIT_CODES,
  type CIBudgetEvaluation,
  type CIRegression
} from '../../src/ci/index.js';

function makePassingBudgets(): { passed: boolean; violations: CIBudgetEvaluation[]; warnings: CIBudgetEvaluation[] } {
  return {
    passed: true,
    violations: [],
    warnings: []
  };
}

describe('CI Policy Engine — Phase 09 Validation', () => {
  it('resolves PASS (exit 0) when budgets pass and zero regressions exist', () => {
    const res = evaluateCIPolicy({
      baselineProvided: true,
      baselineCompatible: true,
      budgets: makePassingBudgets(),
      comparison: {
        compatible: true,
        overallStatus: 'UNCHANGED',
        metrics: {},
        regressions: [],
        improvements: [],
        unchanged: []
      }
    });

    assert.equal(res.status, 'PASS');
    assert.equal(res.exitCode, CI_EXIT_CODES.PASS);
  });

  it('resolves FAIL (exit 1) on critical regression', () => {
    const regressions: CIRegression[] = [
      {
        metric: 'lcp',
        name: 'Largest Contentful Paint',
        baseline: 2400,
        current: 3100,
        absoluteDelta: 700,
        percentageDelta: 29.2,
        direction: 'regressed',
        status: 'REGRESSED',
        isSignificant: true,
        unit: 'ms',
        severity: 'CRITICAL',
        details: 'LCP regressed by +700ms'
      }
    ];

    const res = evaluateCIPolicy({
      baselineProvided: true,
      baselineCompatible: true,
      budgets: makePassingBudgets(),
      comparison: {
        compatible: true,
        overallStatus: 'REGRESSED',
        metrics: {},
        regressions,
        improvements: [],
        unchanged: []
      }
    });

    assert.equal(res.status, 'FAIL');
    assert.equal(res.exitCode, CI_EXIT_CODES.FAIL);
    assert.ok(res.summary.includes('significant regression'));
  });

  it('resolves FAIL (exit 1) on budget violation', () => {
    const violations: CIBudgetEvaluation[] = [
      {
        metric: 'lcp',
        name: 'Largest Contentful Paint',
        actual: 3200,
        budgetMax: 2500,
        unit: 'ms',
        status: 'FAIL',
        delta: 700,
        percentageOfBudget: 128.0
      }
    ];

    const res = evaluateCIPolicy({
      baselineProvided: true,
      baselineCompatible: true,
      budgets: { passed: false, violations, warnings: [] }
    });

    assert.equal(res.status, 'FAIL');
    assert.equal(res.exitCode, CI_EXIT_CODES.FAIL);
    assert.ok(res.summary.includes('budget violation'));
  });

  it('resolves WARN (exit 2) when warning threshold crossed', () => {
    const warnings: CIBudgetEvaluation[] = [
      {
        metric: 'lcp',
        name: 'Largest Contentful Paint',
        actual: 2350,
        budgetMax: 2500,
        budgetWarn: 2200,
        unit: 'ms',
        status: 'WARN',
        delta: -150,
        percentageOfBudget: 94.0
      }
    ];

    const res = evaluateCIPolicy({
      baselineProvided: true,
      baselineCompatible: true,
      budgets: { passed: true, violations: [], warnings }
    });

    assert.equal(res.status, 'WARN');
    assert.equal(res.exitCode, CI_EXIT_CODES.WARN);
  });

  it('elevates WARN to FAIL (exit 1) when failOnWarn is enabled', () => {
    const warnings: CIBudgetEvaluation[] = [
      {
        metric: 'lcp',
        name: 'Largest Contentful Paint',
        actual: 2350,
        budgetMax: 2500,
        budgetWarn: 2200,
        unit: 'ms',
        status: 'WARN',
        delta: -150,
        percentageOfBudget: 94.0
      }
    ];

    const res = evaluateCIPolicy({
      baselineProvided: true,
      baselineCompatible: true,
      budgets: { passed: true, violations: [], warnings },
      policy: { failOnWarn: true }
    });

    assert.equal(res.status, 'FAIL');
    assert.equal(res.exitCode, CI_EXIT_CODES.FAIL);
  });

  it('resolves INCONCLUSIVE (exit 3) when baseline is incompatible', () => {
    const res = evaluateCIPolicy({
      baselineProvided: true,
      baselineCompatible: false,
      incompatibilityReason: 'Device mismatch: mobile vs desktop',
      budgets: makePassingBudgets()
    });

    assert.equal(res.status, 'INCONCLUSIVE');
    assert.equal(res.exitCode, CI_EXIT_CODES.INCONCLUSIVE);
    assert.ok(res.summary.includes('Device mismatch'));
  });

  it('resolves INCONCLUSIVE (exit 3) when baseline is missing and not allowed', () => {
    const res = evaluateCIPolicy({
      baselineProvided: false,
      baselineCompatible: false,
      budgets: makePassingBudgets()
    });

    assert.equal(res.status, 'INCONCLUSIVE');
    assert.equal(res.exitCode, CI_EXIT_CODES.INCONCLUSIVE);
  });

  it('resolves PASS (exit 0) when baseline is missing but allowMissingBaseline is true', () => {
    const res = evaluateCIPolicy({
      baselineProvided: false,
      baselineCompatible: false,
      budgets: makePassingBudgets(),
      policy: { allowMissingBaseline: true }
    });

    assert.equal(res.status, 'PASS');
    assert.equal(res.exitCode, CI_EXIT_CODES.PASS);
  });

  it('resolves MEASUREMENT_FAILED (exit 4) when telemetry collection failed', () => {
    const res = evaluateCIPolicy({
      measurementFailed: true,
      measurementError: 'ChromeLaunchError: Chrome binary not found',
      baselineProvided: true,
      baselineCompatible: true,
      budgets: makePassingBudgets()
    });

    assert.equal(res.status, 'MEASUREMENT_FAILED');
    assert.equal(res.exitCode, CI_EXIT_CODES.MEASUREMENT_FAILED);
    assert.ok(res.summary.includes('Chrome binary not found'));
  });
});
