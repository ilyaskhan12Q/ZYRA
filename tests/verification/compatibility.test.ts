import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  validateMeasurementCompatibility,
  normalizeUrlForComparison,
  createMeasurementSnapshot
} from '../../src/verification/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

function createMockEvidence(overrides: Partial<ZyraEvidence> = {}): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/app',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: {
      durationMs: 15000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.70
    },
    metrics: {
      fcp: { value: 2000, unit: 'ms', score: 0.8 },
      lcp: { value: 3500, unit: 'ms', score: 0.6 },
      cls: { value: 0.05, unit: 'score', score: 0.95 },
      tbt: { value: 250, unit: 'ms', score: 0.7 },
      speedIndex: { value: 3200, unit: 'ms', score: 0.75 },
      inp: null
    },
    audits: [],
    resources: { summary: [], items: [] },
    network: { requests: [] },
    scripts: { items: [], longTasks: [] },
    images: { items: [] },
    fonts: { items: [] },
    traceability: {},
    ...overrides
  };
}

describe('Measurement Compatibility & Snapshots — Phase 08 Verification', () => {
  it('accepts compatible baseline and post-fix measurements', () => {
    const base = createMockEvidence();
    const post = createMockEvidence({
      metrics: {
        ...createMockEvidence().metrics,
        lcp: { value: 2400, unit: 'ms', score: 0.9 }
      }
    });

    const result = validateMeasurementCompatibility(base, post);
    assert.equal(result.compatible, true);
    assert.equal(result.reason, undefined);
  });

  it('rejects cross-profile comparison (mobile baseline vs desktop post-fix)', () => {
    const base = createMockEvidence({
      target: { url: 'https://example.com/app', device: 'mobile', timestamp: '2026-09-06T12:00:00.000Z' }
    });
    const post = createMockEvidence({
      target: { url: 'https://example.com/app', device: 'desktop', timestamp: '2026-09-06T12:05:00.000Z' }
    });

    const result = validateMeasurementCompatibility(base, post);
    assert.equal(result.compatible, false);
    assert.ok(result.reason?.includes('Device profile mismatch'));
    assert.ok(result.reason?.includes('mobile'));
    assert.ok(result.reason?.includes('desktop'));
  });

  it('rejects target URL mismatch between runs', () => {
    const base = createMockEvidence({
      target: { url: 'https://example.com/landing', device: 'mobile', timestamp: '2026-09-06T12:00:00.000Z' }
    });
    const post = createMockEvidence({
      target: { url: 'https://example.com/dashboard', device: 'mobile', timestamp: '2026-09-06T12:05:00.000Z' }
    });

    const result = validateMeasurementCompatibility(base, post);
    assert.equal(result.compatible, false);
    assert.ok(result.reason?.includes('Target URL mismatch'));
  });

  it('normalizes trailing slashes when comparing URLs', () => {
    const base = createMockEvidence({
      target: { url: 'https://example.com/app/', device: 'mobile', timestamp: '2026-09-06T12:00:00.000Z' }
    });
    const post = createMockEvidence({
      target: { url: 'https://example.com/app', device: 'mobile', timestamp: '2026-09-06T12:05:00.000Z' }
    });

    const result = validateMeasurementCompatibility(base, post);
    assert.equal(result.compatible, true);
  });

  it('normalizes URLs correctly in helper function', () => {
    assert.equal(normalizeUrlForComparison('https://example.com/'), 'https://example.com');
    assert.equal(normalizeUrlForComparison('http://localhost:3000/test/'), 'http://localhost:3000/test');
    assert.equal(normalizeUrlForComparison('http://localhost:3000/test?foo=1'), 'http://localhost:3000/test');
  });

  it('rejects incompatible evidence schema version', () => {
    const base = createMockEvidence();
    const post = createMockEvidence({ schemaVersion: '0.9' as any });

    const result = validateMeasurementCompatibility(base, post);
    assert.equal(result.compatible, false);
    assert.ok(result.reason?.includes('Incompatible evidence schema versions'));
  });

  it('creates an authoritative MeasurementSnapshot from raw evidence', () => {
    const evidence = createMockEvidence();
    const snapshot = createMeasurementSnapshot(evidence);

    assert.ok(snapshot.id.startsWith('snap_'));
    assert.equal(snapshot.url, 'https://example.com/app');
    assert.equal(snapshot.device, 'mobile');
    assert.equal(snapshot.metrics.lcp, 3500);
    assert.equal(snapshot.metrics.fcp, 2000);
    assert.equal(snapshot.metrics.cls, 0.05);
    assert.equal(snapshot.metrics.inp, null);
    assert.equal(snapshot.scores.performance, 0.70);
  });
});
