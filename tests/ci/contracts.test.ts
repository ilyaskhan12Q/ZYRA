import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  CI_SCHEMA_VERSION,
  validateCIResult,
  validateCIBaseline,
  validateCIPolicy,
  validateCIBudgetConfig,
  CIValidationError,
  type CIResult,
  type CIBaseline
} from '../../src/ci/index.js';

function createSampleCIResult(): CIResult {
  return {
    schemaVersion: CI_SCHEMA_VERSION,
    id: 'ci_test_123',
    timestamp: '2026-09-08T12:00:00.000Z',
    targetUrl: 'https://example.com/',
    device: 'mobile',
    status: 'PASS',
    exitCode: 0,
    policy: {
      failOnRegression: true,
      failOnBudgetViolation: true
    },
    currentRun: {
      url: 'https://example.com/',
      device: 'mobile',
      metrics: {
        fcp: 1700,
        lcp: 2400,
        cls: 0.05,
        tbt: 150,
        speedIndex: 3200,
        inp: null
      },
      scores: {
        performance: 0.92
      },
      evidenceTimestamp: '2026-09-08T12:00:00.000Z'
    },
    baseline: {
      id: 'base_test_123',
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-07T12:00:00.000Z',
      metrics: {
        fcp: 1750,
        lcp: 2450,
        cls: 0.05,
        tbt: 160,
        speedIndex: 3300,
        inp: null
      },
      scores: {
        performance: 0.90
      },
      compatible: true
    },
    comparison: {
      compatible: true,
      overallStatus: 'UNCHANGED',
      metrics: {},
      regressions: [],
      improvements: [],
      unchanged: []
    },
    budgets: {
      passed: true,
      evaluations: [
        {
          metric: 'lcp',
          name: 'Largest Contentful Paint',
          actual: 2400,
          budgetMax: 2500,
          unit: 'ms',
          status: 'PASS',
          delta: -100,
          percentageOfBudget: 96.0
        }
      ],
      violations: [],
      warnings: []
    },
    summary: 'CI Check Passed: All performance budgets met and zero regressions detected.'
  };
}

function createSampleCIBaseline(): CIBaseline {
  return {
    schemaVersion: CI_SCHEMA_VERSION,
    id: 'base_sample_123',
    url: 'https://example.com/',
    normalizedUrl: 'https://example.com',
    device: 'mobile',
    timestamp: '2026-09-08T12:00:00.000Z',
    zyraVersion: '0.9.4',
    metrics: {
      fcp: 1700,
      lcp: 2400,
      cls: 0.05,
      tbt: 150,
      speedIndex: 3200,
      inp: null
    },
    scores: {
      performance: 0.92
    },
    snapshot: {
      id: 'snap_1',
      timestamp: '2026-09-08T12:00:00.000Z',
      url: 'https://example.com/',
      device: 'mobile',
      metrics: {
        fcp: 1700,
        lcp: 2400,
        cls: 0.05,
        tbt: 150,
        speedIndex: 3200,
        inp: null
      },
      scores: {
        performance: 0.92
      },
      evidence: {} as any
    }
  };
}

describe('CI Contracts — Phase 09 Validation', () => {
  it('validates a conformant CIResult (Schema v1.0)', () => {
    const valid = createSampleCIResult();
    const result = validateCIResult(valid);
    assert.equal(result.schemaVersion, '1.0');
    assert.equal(result.status, 'PASS');
    assert.equal(result.exitCode, 0);
  });

  it('rejects CIResult with invalid schemaVersion', () => {
    const invalid: any = createSampleCIResult();
    invalid.schemaVersion = '2.0';
    assert.throws(() => validateCIResult(invalid), CIValidationError);
  });

  it('rejects CIResult with unrecognized status', () => {
    const invalid: any = createSampleCIResult();
    invalid.status = 'UNKNOWN_STATUS';
    assert.throws(() => validateCIResult(invalid), CIValidationError);
  });

  it('rejects CIResult with invalid exitCode', () => {
    const invalid: any = createSampleCIResult();
    invalid.exitCode = 99;
    assert.throws(() => validateCIResult(invalid), CIValidationError);
  });

  it('rejects CIResult with missing currentRun', () => {
    const invalid: any = createSampleCIResult();
    delete invalid.currentRun;
    assert.throws(() => validateCIResult(invalid), CIValidationError);
  });

  it('validates a conformant CIBaseline', () => {
    const base = createSampleCIBaseline();
    const validated = validateCIBaseline(base);
    assert.equal(validated.schemaVersion, '1.0');
    assert.equal(validated.device, 'mobile');
  });

  it('rejects CIBaseline with invalid device', () => {
    const invalid: any = createSampleCIBaseline();
    invalid.device = 'tablet';
    assert.throws(() => validateCIBaseline(invalid), CIValidationError);
  });

  it('validates CIBudgetConfig with valid numbers and objects', () => {
    const valid = {
      budgets: {
        LCP: 2500,
        CLS: { max: 0.1, warn: 0.08 }
      }
    };
    const validated = validateCIBudgetConfig(valid);
    assert.equal(validated.budgets.LCP, 2500);
  });

  it('rejects CIBudgetConfig with negative numbers', () => {
    const invalid = {
      budgets: {
        LCP: -100
      }
    };
    assert.throws(() => validateCIBudgetConfig(invalid), CIValidationError);
  });
});
