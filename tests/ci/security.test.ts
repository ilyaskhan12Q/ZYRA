import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { runCI, loadCIBaseline, CIValidationError } from '../../src/ci/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

describe('CI Security Boundaries — Phase 09 Validation', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-ci-sec-test-'));
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rejects attempt to read non-JSON or secret file as baseline', async () => {
    const envFile = path.join(tempDir, '.env.production');
    await fs.writeFile(envFile, 'DATABASE_PASSWORD=supersecret\nAPI_KEY=123456\n', 'utf-8');

    // Directly loading must reject with CIValidationError
    await assert.rejects(async () => {
      await loadCIBaseline(envFile);
    }, CIValidationError);

    // Runner should catch and produce INCONCLUSIVE without executing or leaking
    const dummyEvidence: ZyraEvidence = {
      schemaVersion: '1.0',
      target: { url: 'https://example.com/', device: 'mobile', timestamp: '2026-09-08T10:00:00.000Z' },
      run: { durationMs: 4000, lighthouseVersion: '13.4.1' },
      scores: { performance: 0.9 },
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

    const res = await runCI({
      targetUrl: 'https://example.com/',
      baseline: envFile,
      currentEvidence: dummyEvidence
    });

    assert.equal(res.status, 'INCONCLUSIVE');
    assert.equal(res.exitCode, 3);
  });

  it('never mutates the filesystem during CI regression checks', async () => {
    const canaryFile = path.join(tempDir, 'canary.txt');
    await fs.writeFile(canaryFile, 'CANARY_ORIGINAL', 'utf-8');

    const dummyEvidence: ZyraEvidence = {
      schemaVersion: '1.0',
      target: { url: 'https://example.com/', device: 'mobile', timestamp: '2026-09-08T10:00:00.000Z' },
      run: { durationMs: 4000, lighthouseVersion: '13.4.1' },
      scores: { performance: 0.9 },
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

    await runCI({
      targetUrl: 'https://example.com/',
      baseline: dummyEvidence,
      currentEvidence: dummyEvidence
    });

    const canaryContent = await fs.readFile(canaryFile, 'utf-8');
    assert.equal(canaryContent, 'CANARY_ORIGINAL');
  });
});
