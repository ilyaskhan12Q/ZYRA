import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createCIBaseline,
  loadCIBaseline,
  saveCIBaseline,
  validateCIBaselineCompatibility,
  CIValidationError
} from '../../src/ci/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

function createDummyEvidence(url = 'https://example.com/page', device: 'mobile' | 'desktop' = 'mobile'): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url,
      device,
      timestamp: '2026-09-08T10:00:00.000Z'
    },
    run: {
      durationMs: 4500,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.88
    },
    metrics: {
      fcp: { value: 1600, unit: 'ms', score: 0.9 },
      lcp: { value: 2400, unit: 'ms', score: 0.85 },
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

describe('CI Baseline Management — Phase 09 Validation', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-ci-baseline-test-'));
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates an authoritative CIBaseline from ZyraEvidence', () => {
    const evidence = createDummyEvidence();
    const baseline = createCIBaseline(evidence, { branch: 'main', commitSha: 'abcdef1' });

    assert.equal(baseline.schemaVersion, '1.0');
    assert.equal(baseline.url, 'https://example.com/page');
    assert.equal(baseline.normalizedUrl, 'https://example.com/page');
    assert.equal(baseline.device, 'mobile');
    assert.equal(baseline.metrics.lcp, 2400);
    assert.equal(baseline.metadata?.branch, 'main');
    assert.ok(baseline.snapshot);
  });

  it('saves and loads a CIBaseline file', async () => {
    const evidence = createDummyEvidence();
    const baseline = createCIBaseline(evidence);
    const filePath = path.join(tempDir, 'saved-baseline.json');

    await saveCIBaseline(baseline, filePath);
    const loaded = await loadCIBaseline(filePath);

    assert.equal(loaded.id, baseline.id);
    assert.equal(loaded.url, baseline.url);
    assert.equal(loaded.metrics.lcp, 2400);
  });

  it('flexibly loads raw ZyraEvidence JSON as a baseline', async () => {
    const evidence = createDummyEvidence('https://example.com/raw');
    const filePath = path.join(tempDir, 'raw-evidence.json');
    await fs.writeFile(filePath, JSON.stringify(evidence, null, 2), 'utf-8');

    const loaded = await loadCIBaseline(filePath);
    assert.equal(loaded.schemaVersion, '1.0');
    assert.equal(loaded.url, 'https://example.com/raw');
    assert.equal(loaded.metrics.lcp, 2400);
  });

  it('accepts compatible baseline and current targets', () => {
    const evidence = createDummyEvidence('https://example.com/app/');
    const baseline = createCIBaseline(evidence);

    const check = validateCIBaselineCompatibility(baseline, 'https://example.com/app', 'mobile');
    assert.equal(check.compatible, true);
  });

  it('rejects cross-profile comparison (mobile baseline vs desktop run)', () => {
    const evidence = createDummyEvidence('https://example.com/app', 'mobile');
    const baseline = createCIBaseline(evidence);

    const check = validateCIBaselineCompatibility(baseline, 'https://example.com/app', 'desktop');
    assert.equal(check.compatible, false);
    assert.ok(check.reason?.includes('Device profile mismatch'));
  });

  it('rejects target URL mismatch between baseline and current run', () => {
    const evidence = createDummyEvidence('https://example.com/app', 'mobile');
    const baseline = createCIBaseline(evidence);

    const check = validateCIBaselineCompatibility(baseline, 'https://example.com/other-page', 'mobile');
    assert.equal(check.compatible, false);
    assert.ok(check.reason?.includes('Target URL mismatch'));
  });

  it('rejects malformed baseline JSON with CIValidationError', async () => {
    const filePath = path.join(tempDir, 'bad-baseline.json');
    await fs.writeFile(filePath, 'not json at all!', 'utf-8');

    await assert.rejects(async () => {
      await loadCIBaseline(filePath);
    }, CIValidationError);
  });
});
