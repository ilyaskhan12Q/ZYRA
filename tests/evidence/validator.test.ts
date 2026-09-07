import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeEvidence } from '../../src/evidence/normalizer.js';
import { validateEvidence } from '../../src/evidence/validator.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

describe('Evidence Engine — Validator', async () => {
  const mobileFixtureRaw = await fs.readFile(
    path.resolve(process.cwd(), 'fixtures/lighthouse/synthetic-mobile.json'),
    'utf-8'
  );
  const mobileLhr = JSON.parse(mobileFixtureRaw);

  function createValidEvidence(): ZyraEvidence {
    return normalizeEvidence({
      metadata: {
        targetUrl: 'https://example.com/',
        requestedUrl: 'https://example.com/',
        finalDisplayedUrl: 'https://example.com/',
        device: 'mobile',
        timestamp: new Date().toISOString(),
        durationMs: 3000,
        lighthouseVersion: '13.4.1'
      },
      rawLhr: mobileLhr
    });
  }

  it('validates compliant ZyraEvidence as valid', () => {
    const evidence = createValidEvidence();
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, true, 'Compliant evidence should be valid');
    assert.equal(result.errors.length, 0);
  });

  it('rejects unsupported schema versions', () => {
    const evidence = createValidEvidence() as any;
    evidence.schemaVersion = '99.0';
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('Unsupported schemaVersion')));
  });

  it('rejects invalid or unsupported URL protocols', () => {
    const evidence = createValidEvidence() as any;
    evidence.target.url = 'ftp://example.com/file';
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('must be \'http:\' or \'https:\'')));
  });

  it('rejects invalid device types', () => {
    const evidence = createValidEvidence() as any;
    evidence.target.device = 'smartwatch';
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('Invalid device')));
  });

  it('rejects impossible negative timing values', () => {
    const evidence = createValidEvidence();
    evidence.metrics.tbt.value = -50;
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('tbt') && e.includes('non-negative')));
  });

  it('explicitly allows CLS = 0 as valid', () => {
    const evidence = createValidEvidence();
    evidence.metrics.cls.value = 0;
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, true);
  });

  it('explicitly allows null metric values (when metric could not be measured)', () => {
    const evidence = createValidEvidence();
    evidence.metrics.lcp.value = null;
    evidence.metrics.lcp.score = null;
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, true);
  });

  it('rejects invalid performance scores', () => {
    const evidence = createValidEvidence();
    evidence.scores.performance = 1.5;
    const result = validateEvidence(evidence);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes('Performance score must be between 0.0 and 1.0')));
  });

  it('rejects non-object evidence input', () => {
    assert.equal(validateEvidence(null).isValid, false);
    assert.equal(validateEvidence(undefined).isValid, false);
    assert.equal(validateEvidence('string').isValid, false);
  });
});
