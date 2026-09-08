import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectCIRegressions } from '../../src/ci/index.js';
import { createMeasurementSnapshot } from '../../src/verification/compatibility.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

function makeEvidence(metrics: Partial<Record<string, number | null>>, url = 'https://example.com/'): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url,
      device: 'mobile',
      timestamp: '2026-09-08T10:00:00.000Z'
    },
    run: {
      durationMs: 4000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.85
    },
    metrics: {
      fcp: { value: metrics.fcp ?? 1500, unit: 'ms', score: 0.9 },
      lcp: { value: metrics.lcp ?? 2400, unit: 'ms', score: 0.85 },
      cls: { value: metrics.cls ?? 0.05, unit: 'score', score: 0.95 },
      tbt: { value: metrics.tbt ?? 150, unit: 'ms', score: 0.9 },
      speedIndex: { value: metrics.speedIndex ?? 3000, unit: 'ms', score: 0.88 },
      inp: metrics.inp !== undefined ? (metrics.inp === null ? null : { value: metrics.inp, unit: 'ms', score: 0.9 }) : null
    },
    audits: [],
    resources: { summary: [], items: [] },
    network: { requests: [] },
    scripts: { items: [], longTasks: [] },
    images: { items: [] },
    fonts: { items: [] },
    traceability: {}
  };
}

describe('CI Regression Detection — Phase 09 Validation', () => {
  it('detects significant regression in LCP with CRITICAL severity', () => {
    const baseline = createMeasurementSnapshot(makeEvidence({ lcp: 2400 }));
    const current = createMeasurementSnapshot(makeEvidence({ lcp: 2900 })); // +500ms (+20.8%)

    const result = detectCIRegressions(baseline, current);
    assert.equal(result.compatible, true);
    assert.equal(result.overallStatus, 'REGRESSED');
    assert.equal(result.regressions.length, 1);
    assert.equal(result.regressions[0].metric, 'lcp');
    assert.equal(result.regressions[0].severity, 'CRITICAL');
    assert.equal(result.regressions[0].isSignificant, true);
    assert.equal(result.regressions[0].absoluteDelta, 500);
  });

  it('filters out minor lab measurement jitter as UNCHANGED', () => {
    const baseline = createMeasurementSnapshot(makeEvidence({ lcp: 2400, fcp: 1500 }));
    const current = createMeasurementSnapshot(makeEvidence({ lcp: 2420, fcp: 1515 })); // Jitter under thresholds

    const result = detectCIRegressions(baseline, current);
    assert.equal(result.compatible, true);
    assert.equal(result.overallStatus, 'UNCHANGED');
    assert.equal(result.regressions.length, 0);
  });

  it('detects significant improvement in LCP', () => {
    const baseline = createMeasurementSnapshot(makeEvidence({ lcp: 3500 }));
    const current = createMeasurementSnapshot(makeEvidence({ lcp: 2200 })); // -1300ms

    const result = detectCIRegressions(baseline, current);
    assert.equal(result.compatible, true);
    assert.equal(result.overallStatus, 'IMPROVED');
    assert.equal(result.improvements.length, 1);
    assert.equal(result.improvements[0].metric, 'lcp');
  });

  it('assigns WARNING severity to non-CWV regressions unless correlated with budget failure', () => {
    const baseline = createMeasurementSnapshot(makeEvidence({ speedIndex: 3000 }));
    const current = createMeasurementSnapshot(makeEvidence({ speedIndex: 3500 })); // +500ms

    const result = detectCIRegressions(baseline, current);
    assert.equal(result.regressions.length, 1);
    assert.equal(result.regressions[0].metric, 'speedIndex');
    assert.equal(result.regressions[0].severity, 'WARNING');
  });
});
