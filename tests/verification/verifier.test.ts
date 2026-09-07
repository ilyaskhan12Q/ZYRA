import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { verifyOptimization, type VerificationOptions } from '../../src/verification/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type FixPlan } from '../../src/fixes/types.js';

function createMockEvidence(metrics: Record<string, number | null> = {}, device: 'mobile' | 'desktop' = 'mobile'): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device,
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

describe('Verification Engine Lifecycle & Fixtures — Phase 08 Verification', () => {
  it('Case A — Clear improvement: LCP 4500 -> 2800 verifies improvement with KEEP_FIX', async () => {
    const baseline = createMockEvidence({ lcp: 4500, cls: 0.04, tbt: 300 });
    const postFix = createMockEvidence({ lcp: 2800, cls: 0.04, tbt: 290 });

    const fixPlan: Partial<FixPlan> = {
      planId: 'plan_img_1',
      sourceFindingIds: ['LCP_CRITICAL'],
      strategy: { id: 'FIX_IMAGE_OPTIMIZATION', version: '1.0', name: 'Image Optimization' },
      expectedImpact: { targetMetric: 'LCP', estimatedDirection: 'improve', description: 'Faster LCP' }
    };

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix,
      fixPlan: fixPlan as FixPlan
    });

    assert.equal(result.status, 'VERIFIED_IMPROVEMENT');
    assert.equal(result.decision, 'KEEP_FIX');
    assert.equal(result.regressions.length, 0);
    assert.ok(result.targetVerification);
    assert.equal(result.targetVerification.targetImproved, true);
    assert.equal(result.targetVerification.targetMetric, 'LCP');
    assert.ok(result.summary.includes('Verified performance improvement'));
  });

  it('Case B — No material improvement: LCP 4500 -> 4470 results in VERIFIED_NO_IMPROVEMENT with NO_ACTION', async () => {
    const baseline = createMockEvidence({ lcp: 4500, cls: 0.04, tbt: 300 });
    const postFix = createMockEvidence({ lcp: 4470, cls: 0.04, tbt: 300 }); // 30ms delta is within noise

    const fixPlan: Partial<FixPlan> = {
      planId: 'plan_img_2',
      sourceFindingIds: ['LCP_SLOW'],
      strategy: { id: 'FIX_IMAGE_OPTIMIZATION', version: '1.0', name: 'Image Optimization' },
      expectedImpact: { targetMetric: 'LCP', estimatedDirection: 'improve', description: 'Faster LCP' }
    };

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix,
      fixPlan: fixPlan as FixPlan
    });

    assert.equal(result.status, 'VERIFIED_NO_IMPROVEMENT');
    assert.equal(result.decision, 'NO_ACTION');
    assert.equal(result.regressions.length, 0);
    assert.ok(result.targetVerification);
    assert.equal(result.targetVerification.targetImproved, false);
    assert.ok(result.summary.includes('No material performance improvement'));
  });

  it('Case C — Regression: LCP 4500 -> 3000 but CLS 0.04 -> 0.20 triggers REGRESSION_DETECTED with ROLLBACK_RECOMMENDED', async () => {
    const baseline = createMockEvidence({ lcp: 4500, cls: 0.04, tbt: 300 });
    const postFix = createMockEvidence({ lcp: 3000, cls: 0.20, tbt: 300 }); // CLS regressed +0.16

    const fixPlan: Partial<FixPlan> = {
      planId: 'plan_img_3',
      sourceFindingIds: ['LCP_CRITICAL'],
      strategy: { id: 'FIX_IMAGE_OPTIMIZATION', version: '1.0', name: 'Image Optimization' },
      expectedImpact: { targetMetric: 'LCP', estimatedDirection: 'improve', description: 'Faster LCP' }
    };

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix,
      fixPlan: fixPlan as FixPlan
    });

    assert.equal(result.status, 'REGRESSION_DETECTED');
    assert.equal(result.decision, 'ROLLBACK_RECOMMENDED');
    assert.equal(result.regressions.length, 1);
    assert.equal(result.regressions[0].metric, 'cls');
    assert.ok(result.summary.includes('Performance regression detected'));
    assert.ok(result.summary.includes('Cumulative Layout Shift'));
  });

  it('Case D — Incompatible profiles: mobile baseline vs desktop postFix produces INCONCLUSIVE', async () => {
    const baseline = createMockEvidence({ lcp: 4500 }, 'mobile');
    const postFix = createMockEvidence({ lcp: 2500 }, 'desktop');

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix
    });

    assert.equal(result.status, 'INCONCLUSIVE');
    assert.equal(result.decision, 'INCONCLUSIVE');
    assert.ok(result.summary.includes('Device profile mismatch'));
  });

  it('Case E — Missing metric: before = null, after = 2500 is classified as NOT_AVAILABLE without hallucinated improvement', async () => {
    const baseline = createMockEvidence({ inp: null });
    const postFix = createMockEvidence({ inp: 150 });

    const result = await verifyOptimization({
      targetUrl: 'https://example.com/',
      workspace: '/mock/workspace',
      baseline,
      postFix,
      targetMetric: 'INP'
    });

    assert.equal(result.comparison.metrics.inp.status, 'NOT_AVAILABLE');
    assert.equal(result.comparison.metrics.inp.direction, 'unavailable');
    assert.equal(result.comparison.metrics.inp.absoluteDelta, null);
  });
});
