import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { evaluateMetricDelta, METRIC_SIGNIFICANCE_RULES } from '../../src/verification/index.js';

describe('Significance & Noise Policy — Phase 08 Verification', () => {
  it('defines explicit noise boundaries for all Core Web Vitals', () => {
    assert.ok(METRIC_SIGNIFICANCE_RULES.lcp);
    assert.ok(METRIC_SIGNIFICANCE_RULES.cls);
    assert.ok(METRIC_SIGNIFICANCE_RULES.inp);
    assert.ok(METRIC_SIGNIFICANCE_RULES.fcp);
    assert.ok(METRIC_SIGNIFICANCE_RULES.tbt);
    assert.ok(METRIC_SIGNIFICANCE_RULES.speedIndex);
    assert.equal(METRIC_SIGNIFICANCE_RULES.lcp.minAbsoluteDelta, 100);
    assert.equal(METRIC_SIGNIFICANCE_RULES.cls.minAbsoluteDelta, 0.015);
  });

  it('classifies small timing differences as UNCHANGED (noise filtering)', () => {
    // 30ms delta on 4000ms LCP is 0.75% change (below 100ms and 3%)
    const delta = evaluateMetricDelta('lcp', 4000, 3970);
    assert.equal(delta.isSignificant, false);
    assert.equal(delta.status, 'UNCHANGED');
    assert.equal(delta.direction, 'unchanged');
    assert.equal(delta.absoluteDelta, -30);
  });

  it('classifies substantial timing reductions as IMPROVED', () => {
    // 1500ms reduction on 5000ms LCP is -30% change
    const delta = evaluateMetricDelta('lcp', 5000, 3500);
    assert.equal(delta.isSignificant, true);
    assert.equal(delta.status, 'IMPROVED');
    assert.equal(delta.direction, 'improved');
    assert.equal(delta.absoluteDelta, -1500);
    assert.equal(delta.percentageDelta, -30);
  });

  it('classifies substantial timing increases as REGRESSED', () => {
    // 600ms increase on 2000ms FCP is +30% change
    const delta = evaluateMetricDelta('fcp', 2000, 2600);
    assert.equal(delta.isSignificant, true);
    assert.equal(delta.status, 'REGRESSED');
    assert.equal(delta.direction, 'regressed');
    assert.equal(delta.absoluteDelta, 600);
    assert.equal(delta.percentageDelta, 30);
  });

  it('correctly evaluates layout shift (CLS) significance', () => {
    // 0.005 difference is below 0.015 threshold -> UNCHANGED
    const minorShift = evaluateMetricDelta('cls', 0.05, 0.055);
    assert.equal(minorShift.isSignificant, false);
    assert.equal(minorShift.status, 'UNCHANGED');

    // 0.15 increase is above 0.015 threshold -> REGRESSED
    const majorRegression = evaluateMetricDelta('cls', 0.05, 0.20);
    assert.equal(majorRegression.isSignificant, true);
    assert.equal(majorRegression.status, 'REGRESSED');

    // 0.15 reduction -> IMPROVED
    const majorImprovement = evaluateMetricDelta('cls', 0.20, 0.05);
    assert.equal(majorImprovement.isSignificant, true);
    assert.equal(majorImprovement.status, 'IMPROVED');
  });

  it('handles null or unmeasured metrics explicitly as NOT_AVAILABLE', () => {
    const missingBefore = evaluateMetricDelta('inp', null, 150);
    assert.equal(missingBefore.status, 'NOT_AVAILABLE');
    assert.equal(missingBefore.direction, 'unavailable');
    assert.equal(missingBefore.absoluteDelta, null);
    assert.equal(missingBefore.percentageDelta, null);

    const missingAfter = evaluateMetricDelta('inp', 200, null);
    assert.equal(missingAfter.status, 'NOT_AVAILABLE');

    const bothMissing = evaluateMetricDelta('inp', null, null);
    assert.equal(bothMissing.status, 'NOT_AVAILABLE');
  });

  it('handles zero baseline gracefully without NaN percentage', () => {
    // CLS before = 0, after = 0.10
    const fromZero = evaluateMetricDelta('cls', 0, 0.10);
    assert.equal(fromZero.percentageDelta, null);
    assert.equal(fromZero.absoluteDelta, 0.10);
    assert.equal(fromZero.status, 'REGRESSED');
  });
});
