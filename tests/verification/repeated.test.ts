import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { verifyOptimization } from '../../src/verification/index.js';
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
      durationMs: 14000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.65
    },
    metrics: {
      fcp: { value: metrics.fcp ?? 2000, unit: 'ms', score: 0.8 },
      lcp: { value: metrics.lcp ?? 4500, unit: 'ms', score: 0.5 },
      cls: { value: metrics.cls ?? 0.04, unit: 'score', score: 0.95 },
      tbt: { value: metrics.tbt ?? 300, unit: 'ms', score: 0.7 },
      speedIndex: { value: metrics.speedIndex ?? 3500, unit: 'ms', score: 0.7 },
      inp: null
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

describe('Bounded Repeated Measurements — Phase 08 Verification', () => {
  it('identifies CONSISTENT_IMPROVEMENT when all runs demonstrate optimization', async () => {
    const baseline = createMockEvidence({ lcp: 5000 });
    const run1 = createMockEvidence({ lcp: 3200 });
    const run2 = createMockEvidence({ lcp: 3100 });
    const run3 = createMockEvidence({ lcp: 3300 });

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix: run1,
      repeatedRuns: [run1, run2, run3]
    });

    assert.equal(result.status, 'VERIFIED_IMPROVEMENT');
    assert.equal(result.decision, 'KEEP_FIX');
    assert.ok(result.repeatedRuns);
    assert.equal(result.repeatedRuns.outcome, 'CONSISTENT_IMPROVEMENT');
    assert.equal(result.repeatedRuns.consistent, true);
    assert.equal(result.repeatedRuns.completedRuns, 3);
    assert.equal(result.repeatedRuns.metricAverages.lcp.afterMean, 3200);
  });

  it('identifies MIXED_RESULTS when runs contradict each other', async () => {
    const baseline = createMockEvidence({ lcp: 5000, cls: 0.04 });
    const run1 = createMockEvidence({ lcp: 3200, cls: 0.04 }); // improved
    const run2 = createMockEvidence({ lcp: 5200, cls: 0.20 }); // regressed

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix: run1,
      repeatedRuns: [run1, run2]
    });

    assert.equal(result.status, 'INCONCLUSIVE');
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.ok(result.repeatedRuns);
    assert.equal(result.repeatedRuns.outcome, 'MIXED_RESULTS');
    assert.equal(result.repeatedRuns.consistent, false);
    assert.ok(result.summary.includes('mixed results'));
  });

  it('clamps excessive runs to safe upper bound of 5 (no infinite loops)', async () => {
    const baseline = createMockEvidence({ lcp: 5000 });
    // Provide 8 runs
    const runs = Array.from({ length: 8 }, () => createMockEvidence({ lcp: 3000 }));

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix: runs[0],
      repeatedRuns: runs
    });

    assert.ok(result.repeatedRuns);
    assert.equal(result.repeatedRuns.totalRuns, 5);
    assert.equal(result.repeatedRuns.completedRuns, 5);
  });
});
