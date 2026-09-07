import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CONFIDENCE_WEIGHTS,
  calculateConfidence,
  resolveCorrelationStatus
} from '../../src/correlation/confidence.js';

describe('Correlation Confidence — Deterministic Scoring Model', () => {
  it('returns zero confidence when no signals are present', () => {
    const conf = calculateConfidence([]);
    assert.strictEqual(conf.score, 0);
    assert.strictEqual(conf.signals.length, 0);
    const { status, level } = resolveCorrelationStatus(conf);
    assert.strictEqual(status, 'NO_CORRELATION');
    assert.strictEqual(level, 'UNKNOWN');
  });

  it('aggregates multiple positive signals deterministically within [0, 1] bounds', () => {
    const signals = [
      CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH,      // +0.35
      CONFIDENCE_WEIGHTS.LCP_ELEMENT_AUDIT_MATCH, // +0.25
      CONFIDENCE_WEIGHTS.EXACT_ROUTE_MATCH,       // +0.20
      CONFIDENCE_WEIGHTS.METADATA_CORROBORATION,  // +0.10
      CONFIDENCE_WEIGHTS.MULTIPLE_INDEPENDENT_SIGNALS // +0.10
    ];
    const conf = calculateConfidence(signals);
    assert.strictEqual(conf.score, 1.0); // 0.35 + 0.25 + 0.20 + 0.10 + 0.10 = 1.0
    assert.strictEqual(conf.signals.length, 5);

    const { status, level } = resolveCorrelationStatus(conf);
    assert.strictEqual(status, 'STRONGLY_SUPPORTED');
    assert.strictEqual(level, 'STRONGLY_SUPPORTED_CONTRIBUTOR');
  });

  it('applies contradiction penalties to downgrade score and prevent STRONGLY_SUPPORTED', () => {
    const signals = [
      CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH,         // +0.35
      CONFIDENCE_WEIGHTS.LCP_ELEMENT_AUDIT_MATCH,    // +0.25
      CONFIDENCE_WEIGHTS.CONTRADICTING_CACHED_TRANSFER // -0.25
    ];
    const conf = calculateConfidence(signals);
    // 0.35 + 0.25 - 0.25 = 0.35
    assert.strictEqual(conf.score, 0.35);

    const { status, level } = resolveCorrelationStatus(conf);
    // Even though score is 0.35, contradictions prevent STRONGLY_SUPPORTED
    assert.strictEqual(status, 'POSSIBLE_CORRELATION');
    assert.strictEqual(level, 'CORRELATED');
    assert.match(conf.rationale, /Penalized by CONTRADICTING_CACHED_TRANSFER/);
  });

  it('resolves INSUFFICIENT_EVIDENCE when external or unresolved flag is set', () => {
    const signals = [
      CONFIDENCE_WEIGHTS.MISSING_LOCAL_SOURCE_PENALTY // -0.40
    ];
    const conf = calculateConfidence(signals);
    assert.strictEqual(conf.score, 0);

    const { status, level } = resolveCorrelationStatus(conf, true);
    assert.strictEqual(status, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(level, 'UNKNOWN');
  });

  it('resolves SUPPORTED_CONTRIBUTOR for moderate confidence without contradictions', () => {
    const signals = [
      CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH, // +0.35
      CONFIDENCE_WEIGHTS.EXACT_ROUTE_MATCH  // +0.20
    ];
    const conf = calculateConfidence(signals);
    assert.strictEqual(conf.score, 0.55);

    const { status, level } = resolveCorrelationStatus(conf);
    assert.strictEqual(status, 'SUPPORTED_CONTRIBUTOR');
    assert.strictEqual(level, 'SUPPORTED_CONTRIBUTOR');
  });
});
