import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { runCI, createCIBaseline, CI_SCHEMA_VERSION } from '../../src/ci/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

function createDummyEvidence(lcp = 2400): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-08T10:00:00.000Z'
    },
    run: {
      durationMs: 4000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.90
    },
    metrics: {
      fcp: { value: 1600, unit: 'ms', score: 0.9 },
      lcp: { value: lcp, unit: 'ms', score: 0.85 },
      cls: { value: 0.04, unit: 'score', score: 0.95 },
      tbt: { value: 120, unit: 'ms', score: 0.92 },
      speedIndex: { value: 3100, unit: 'ms', score: 0.89 },
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

describe('CI Determinism — Phase 09 Validation', () => {
  it('guarantees 100% deterministic output across repeated runs on identical input', async () => {
    const baseEvidence = createDummyEvidence(2400);
    const baseline = createCIBaseline(baseEvidence);
    const currEvidence = createDummyEvidence(2800);
    const fixedId = 'ci_deterministic_test_id';
    const fixedTimestamp = '2026-09-08T12:00:00.000Z';

    const run1 = await runCI({
      id: fixedId,
      timestamp: fixedTimestamp,
      targetUrl: 'https://example.com/',
      baseline,
      currentEvidence: currEvidence,
      budgetConfig: {
        budgets: {
          lcp: 2500,
          cls: 0.1,
          fcp: 1800
        }
      }
    });

    const run2 = await runCI({
      id: fixedId,
      timestamp: fixedTimestamp,
      targetUrl: 'https://example.com/',
      baseline,
      currentEvidence: currEvidence,
      budgetConfig: {
        budgets: {
          lcp: 2500,
          cls: 0.1,
          fcp: 1800
        }
      }
    });

    assert.equal(JSON.stringify(run1), JSON.stringify(run2));
  });
});
