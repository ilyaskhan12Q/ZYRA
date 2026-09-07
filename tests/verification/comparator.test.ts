import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { compareMeasurements } from '../../src/verification/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

function createMockEvidence(metrics: Record<string, number | null> = {}): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: {
      durationMs: 12000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.60
    },
    metrics: {
      fcp: { value: metrics.fcp ?? 2200, unit: 'ms', score: 0.8 },
      lcp: { value: metrics.lcp ?? 4800, unit: 'ms', score: 0.4 },
      cls: { value: metrics.cls ?? 0.05, unit: 'score', score: 0.95 },
      tbt: { value: metrics.tbt ?? 400, unit: 'ms', score: 0.6 },
      speedIndex: { value: metrics.speedIndex ?? 4200, unit: 'ms', score: 0.6 },
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

describe('Deterministic Comparator — Phase 08 Verification', () => {
  it('detects clear improvements across metrics', () => {
    const baseline = createMockEvidence({ lcp: 5000, fcp: 2500 });
    const postFix = createMockEvidence({ lcp: 3000, fcp: 1800 });

    const comp = compareMeasurements(baseline, postFix);
    assert.equal(comp.compatible, true);
    assert.equal(comp.overallStatus, 'IMPROVED');
    assert.ok(comp.improvements.some((m) => m.metric === 'lcp'));
    assert.ok(comp.improvements.some((m) => m.metric === 'fcp'));
    assert.equal(comp.regressions.length, 0);
  });

  it('detects metric regression and flags overallStatus as REGRESSED', () => {
    // LCP improved by 1500ms, but CLS regressed from 0.04 to 0.22
    const baseline = createMockEvidence({ lcp: 5000, cls: 0.04 });
    const postFix = createMockEvidence({ lcp: 3500, cls: 0.22 });

    const comp = compareMeasurements(baseline, postFix);
    assert.equal(comp.compatible, true);
    assert.equal(comp.overallStatus, 'REGRESSED');
    assert.equal(comp.regressions.length, 1);
    assert.equal(comp.regressions[0].metric, 'cls');
    assert.equal(comp.improvements.length, 1);
    assert.equal(comp.improvements[0].metric, 'lcp');
  });

  it('detects unchanged performance when deltas are within noise boundaries', () => {
    const baseline = createMockEvidence({ lcp: 4000, fcp: 2000, tbt: 300 });
    const postFix = createMockEvidence({ lcp: 3980, fcp: 2010, tbt: 305 });

    const comp = compareMeasurements(baseline, postFix);
    assert.equal(comp.compatible, true);
    assert.equal(comp.overallStatus, 'UNCHANGED');
    assert.equal(comp.improvements.length, 0);
    assert.equal(comp.regressions.length, 0);
  });

  it('returns INCONCLUSIVE when measurements are not compatible', () => {
    const baseline = createMockEvidence();
    const postFix = createMockEvidence();
    postFix.target.device = 'desktop';

    const comp = compareMeasurements(baseline, postFix);
    assert.equal(comp.compatible, false);
    assert.equal(comp.overallStatus, 'INCONCLUSIVE');
    assert.ok(comp.incompatibilityReason?.includes('Device profile mismatch'));
  });

  it('is a pure function producing identical results on repeated calls', () => {
    const baseline = createMockEvidence({ lcp: 4500 });
    const postFix = createMockEvidence({ lcp: 3200 });

    const comp1 = compareMeasurements(baseline, postFix);
    const comp2 = compareMeasurements(baseline, postFix);

    assert.deepEqual(comp1, comp2);
  });
});
