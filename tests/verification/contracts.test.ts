import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  VERIFICATION_SCHEMA_VERSION,
  validateVerificationResult,
  VerificationValidationError,
  type VerificationResult
} from '../../src/verification/index.js';

function createSampleVerificationResult(): VerificationResult {
  return {
    schemaVersion: VERIFICATION_SCHEMA_VERSION,
    verificationId: 'verif_test_123',
    timestamp: '2026-09-06T12:00:00.000Z',
    targetUrl: 'https://example.com/',
    device: 'mobile',
    status: 'VERIFIED_IMPROVEMENT',
    decision: 'KEEP_FIX',
    baseline: {
      id: 'snap_base_1',
      timestamp: '2026-09-06T11:50:00.000Z',
      url: 'https://example.com/',
      device: 'mobile',
      metrics: {
        fcp: 2200,
        lcp: 4500,
        cls: 0.05,
        tbt: 350,
        speedIndex: 3800,
        inp: null
      },
      scores: {
        performance: 0.65
      },
      evidence: {} as any
    },
    postFix: {
      id: 'snap_post_1',
      timestamp: '2026-09-06T12:00:00.000Z',
      url: 'https://example.com/',
      device: 'mobile',
      metrics: {
        fcp: 2100,
        lcp: 2800,
        cls: 0.05,
        tbt: 340,
        speedIndex: 3500,
        inp: null
      },
      scores: {
        performance: 0.85
      },
      evidence: {} as any
    },
    comparison: {
      compatible: true,
      metrics: {
        lcp: {
          metric: 'lcp',
          name: 'Largest Contentful Paint',
          before: 4500,
          after: 2800,
          absoluteDelta: -1700,
          percentageDelta: -37.8,
          direction: 'improved',
          status: 'IMPROVED',
          unit: 'ms',
          threshold: '<= 2500 ms',
          isSignificant: true
        }
      },
      overallStatus: 'IMPROVED',
      regressions: [],
      improvements: [],
      unchanged: []
    },
    targetVerification: {
      targetMetric: 'LCP',
      expectedDirection: 'improve',
      observedDelta: {
        metric: 'lcp',
        name: 'Largest Contentful Paint',
        before: 4500,
        after: 2800,
        absoluteDelta: -1700,
        percentageDelta: -37.8,
        direction: 'improved',
        status: 'IMPROVED',
        unit: 'ms',
        threshold: '<= 2500 ms',
        isSignificant: true
      },
      targetImproved: true,
      findingId: 'LCP_CRITICAL',
      evidenceCheckPassed: true,
      details: 'LCP improved by 1700ms'
    },
    regressions: [],
    provenance: {
      planId: 'plan_123',
      strategyId: 'FIX_IMAGE_OPTIMIZATION',
      workspace: '/path/to/project',
      filesVerified: [],
      codeStateValid: true
    },
    summary: 'Verified improvement in LCP.'
  };
}

describe('Verification Contracts — Phase 08 Verification', () => {
  it('validates a conformant VerificationResult (Schema v1.0)', () => {
    const validResult = createSampleVerificationResult();
    const validated = validateVerificationResult(validResult);
    assert.equal(validated.schemaVersion, '1.0');
    assert.equal(validated.verificationId, 'verif_test_123');
    assert.equal(validated.status, 'VERIFIED_IMPROVEMENT');
    assert.equal(validated.decision, 'KEEP_FIX');
  });

  it('rejects invalid schemaVersion', () => {
    const invalid = createSampleVerificationResult();
    (invalid as any).schemaVersion = '2.0';
    assert.throws(
      () => validateVerificationResult(invalid),
      /Invalid schemaVersion/
    );
  });

  it('rejects missing or empty verificationId', () => {
    const invalid = createSampleVerificationResult();
    invalid.verificationId = '';
    assert.throws(
      () => validateVerificationResult(invalid),
      /Missing or invalid verificationId/
    );
  });

  it('rejects unrecognized verification status', () => {
    const invalid = createSampleVerificationResult();
    (invalid as any).status = 'SUCCESSFUL_OPTIMIZATION';
    assert.throws(
      () => validateVerificationResult(invalid),
      /Invalid verification status/
    );
  });

  it('rejects unrecognized optimization decision', () => {
    const invalid = createSampleVerificationResult();
    (invalid as any).decision = 'APPLY_MORE_FIXES';
    assert.throws(
      () => validateVerificationResult(invalid),
      /Invalid optimization decision/
    );
  });

  it('rejects missing baseline measurement snapshot', () => {
    const invalid = createSampleVerificationResult();
    delete (invalid as any).baseline;
    assert.throws(
      () => validateVerificationResult(invalid),
      /Missing or invalid baseline measurement snapshot/
    );
  });

  it('rejects missing postFix measurement snapshot', () => {
    const invalid = createSampleVerificationResult();
    delete (invalid as any).postFix;
    assert.throws(
      () => validateVerificationResult(invalid),
      /Missing or invalid postFix measurement snapshot/
    );
  });

  it('rejects non-array regressions list', () => {
    const invalid = createSampleVerificationResult();
    (invalid as any).regressions = 'none';
    assert.throws(
      () => validateVerificationResult(invalid),
      /regressions must be an array/
    );
  });

  it('rejects missing provenance record', () => {
    const invalid = createSampleVerificationResult();
    delete (invalid as any).provenance;
    assert.throws(
      () => validateVerificationResult(invalid),
      /Missing or invalid verification provenance/
    );
  });
});
