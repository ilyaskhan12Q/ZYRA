import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  parseBudgetConfig,
  evaluateBudgets,
  normalizeMetricKey,
  CIValidationError
} from '../../src/ci/index.js';

describe('Performance Budgets Engine — Phase 09 Validation', () => {
  it('normalizes common metric key aliases correctly', () => {
    assert.equal(normalizeMetricKey('LCP'), 'lcp');
    assert.equal(normalizeMetricKey('cls'), 'cls');
    assert.equal(normalizeMetricKey('SpeedIndex'), 'speedIndex');
    assert.equal(normalizeMetricKey('speed_index'), 'speedIndex');
  });

  it('parses inline JSON string configuration', async () => {
    const jsonStr = JSON.stringify({
      budgets: {
        LCP: 2500,
        CLS: 0.1,
        INP: { max: 200, warn: 150 }
      }
    });

    const config = await parseBudgetConfig(jsonStr);
    assert.equal(config.budgets.lcp, 2500);
    assert.equal(config.budgets.cls, 0.1);
    assert.deepEqual(config.budgets.inp, { max: 200, warn: 150 });
  });

  it('rejects invalid JSON string configuration', async () => {
    await assert.rejects(async () => {
      await parseBudgetConfig('{ bad json }');
    }, CIValidationError);
  });

  it('evaluates all budgets passing', () => {
    const metrics = {
      lcp: 2200,
      fcp: 1500,
      cls: 0.05,
      tbt: 100,
      speedIndex: 2900,
      inp: null
    };

    const config = {
      budgets: {
        lcp: 2500,
        fcp: 1800,
        cls: 0.10
      }
    };

    const result = evaluateBudgets(metrics, config);
    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
    assert.equal(result.warnings.length, 0);
    assert.equal(result.evaluations.length, 3);
  });

  it('evaluates budget violation with correct delta and FAIL status', () => {
    const metrics = {
      lcp: 2800 // Exceeds 2500
    };

    const config = {
      budgets: {
        lcp: 2500
      }
    };

    const result = evaluateBudgets(metrics, config);
    assert.equal(result.passed, false);
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0].status, 'FAIL');
    assert.equal(result.violations[0].delta, 300);
    assert.equal(Math.round(result.violations[0].percentageOfBudget!), 112);
  });

  it('evaluates budget warning threshold crossed', () => {
    const metrics = {
      lcp: 2300 // below max (2500), but above warn (2200)
    };

    const config = {
      budgets: {
        lcp: { max: 2500, warn: 2200 }
      }
    };

    const result = evaluateBudgets(metrics, config);
    assert.equal(result.passed, true); // No hard violations
    assert.equal(result.violations.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].status, 'WARN');
  });

  it('handles null/missing metrics as NOT_AVAILABLE without zero fabrication', () => {
    const metrics = {
      inp: null
    };

    const config = {
      budgets: {
        inp: 200
      }
    };

    const result = evaluateBudgets(metrics, config);
    assert.equal(result.passed, true);
    assert.equal(result.evaluations[0].status, 'NOT_AVAILABLE');
    assert.equal(result.evaluations[0].actual, null);
    assert.equal(result.evaluations[0].delta, null);
  });

  it('orders evaluations deterministically: FAIL > WARN > PASS', () => {
    const metrics = {
      fcp: 1400, // PASS
      lcp: 2900, // FAIL
      tbt: 180   // WARN (max 200, warn 150)
    };

    const config = {
      budgets: {
        fcp: 1800,
        lcp: 2500,
        tbt: { max: 200, warn: 150 }
      }
    };

    const result = evaluateBudgets(metrics, config);
    assert.equal(result.evaluations[0].status, 'FAIL');
    assert.equal(result.evaluations[0].metric, 'lcp');
    assert.equal(result.evaluations[1].status, 'WARN');
    assert.equal(result.evaluations[1].metric, 'tbt');
    assert.equal(result.evaluations[2].status, 'PASS');
    assert.equal(result.evaluations[2].metric, 'fcp');
  });
});
