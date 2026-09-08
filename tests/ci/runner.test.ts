import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { runCI, CI_SCHEMA_VERSION, CI_EXIT_CODES } from '../../src/ci/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

function createDummyEvidence(lcp = 2400, url = 'https://example.com/'): ZyraEvidence {
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

describe('CI Runner Engine — Phase 09 Validation', () => {
  it('executes clean CI run resulting in PASS (exit 0)', async () => {
    const baseEvidence = createDummyEvidence(2400);
    const currEvidence = createDummyEvidence(2300);

    const result = await runCI({
      targetUrl: 'https://example.com/',
      baseline: baseEvidence,
      currentEvidence: currEvidence,
      budgetConfig: {
        budgets: {
          lcp: 2500,
          cls: 0.1
        }
      }
    });

    assert.equal(result.schemaVersion, CI_SCHEMA_VERSION);
    assert.equal(result.status, 'PASS');
    assert.equal(result.exitCode, CI_EXIT_CODES.PASS);
    assert.equal(result.budgets.passed, true);
    assert.ok(result.prComment);
  });

  it('executes CI run resulting in FAIL (exit 1) on regression', async () => {
    const baseEvidence = createDummyEvidence(2400);
    const currEvidence = createDummyEvidence(3200); // +800ms regression and budget failure

    const result = await runCI({
      targetUrl: 'https://example.com/',
      baseline: baseEvidence,
      currentEvidence: currEvidence,
      budgetConfig: {
        budgets: {
          lcp: 2500
        }
      }
    });

    assert.equal(result.status, 'FAIL');
    assert.equal(result.exitCode, CI_EXIT_CODES.FAIL);
    assert.equal(result.budgets.passed, false);
    assert.equal(result.comparison?.regressions.length, 1);
  });

  it('handles incompatible baseline and produces INCONCLUSIVE (exit 3)', async () => {
    const baseEvidence = createDummyEvidence(2400, 'https://different.org/');
    const currEvidence = createDummyEvidence(2400, 'https://example.com/');

    const result = await runCI({
      targetUrl: 'https://example.com/',
      baseline: baseEvidence,
      currentEvidence: currEvidence
    });

    assert.equal(result.status, 'INCONCLUSIVE');
    assert.equal(result.exitCode, CI_EXIT_CODES.INCONCLUSIVE);
  });
});
