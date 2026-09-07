import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateCorrelationResult } from '../../src/correlation/validator.js';
import { type CorrelationResult } from '../../src/correlation/types.js';

function createValidResult(): CorrelationResult {
  return {
    schemaVersion: '1.0',
    evaluatedAt: '2026-09-06T12:00:00.000Z',
    correlatorVersion: '1.0',
    summary: {
      totalFindings: 1,
      correlatedFindings: 1,
      stronglySupportedCandidates: 1,
      supportedCandidates: 0,
      possibleCandidates: 0,
      insufficientEvidenceCount: 0,
      noCorrelationCount: 0
    },
    candidates: [
      {
        id: 'candidate:image:public/images/hero.webp',
        targetPath: 'public/images/hero.webp',
        targetType: 'asset',
        targetName: 'public/images/hero.webp',
        findingIds: ['finding:lcp_critical'],
        status: 'STRONGLY_SUPPORTED',
        assessmentLevel: 'STRONGLY_SUPPORTED_CONTRIBUTOR',
        confidence: {
          score: 0.85,
          signals: [{ name: 'EXACT_ASSET_MATCH', weight: 0.35, description: 'Exact match' }],
          rationale: 'Supported by EXACT_ASSET_MATCH.'
        },
        links: [
          {
            sourceType: 'image',
            sourceRef: 'images[hero.webp]',
            targetType: 'asset',
            targetRef: 'assets[public/images/hero.webp]',
            relationship: 'EXACT_MATCH',
            strength: 'strong',
            reason: 'Path match'
          }
        ],
        supportingEvidence: ['Matches asset'],
        contradictingEvidence: [],
        missingEvidence: [],
        reasoning: 'Asset matches LCP image.',
        nextInvestigation: 'Compress image.'
      }
    ],
    assessments: [
      {
        id: 'assessment:finding:lcp_critical',
        findingId: 'finding:lcp_critical',
        status: 'STRONGLY_SUPPORTED',
        assessmentLevel: 'STRONGLY_SUPPORTED_CONTRIBUTOR',
        topCandidateId: 'candidate:image:public/images/hero.webp',
        candidateIds: ['candidate:image:public/images/hero.webp'],
        confidence: {
          score: 0.85,
          signals: [],
          rationale: 'High'
        },
        summary: 'LCP delay attributed to hero.webp',
        primaryBottleneckType: 'image_payload',
        supportingEvidence: ['LCP element match'],
        contradictingEvidence: [],
        missingEvidence: []
      }
    ],
    warnings: []
  };
}

describe('Correlation Validator — Schema Invariants', () => {
  it('validates compliant CorrelationResult as valid', () => {
    const res = createValidResult();
    const val = validateCorrelationResult(res);
    assert.strictEqual(val.isValid, true);
    assert.strictEqual(val.errors.length, 0);
  });

  it('rejects unsupported schema version', () => {
    const res = createValidResult();
    // @ts-expect-error test invalid version
    res.schemaVersion = '2.0';
    const val = validateCorrelationResult(res);
    assert.strictEqual(val.isValid, false);
    assert.match(val.errors[0]!, /Unsupported schemaVersion/);
  });

  it('rejects out-of-bounds confidence score (> 1.0 or < 0.0)', () => {
    const res = createValidResult();
    res.candidates[0]!.confidence.score = 1.5;
    const val = validateCorrelationResult(res);
    assert.strictEqual(val.isValid, false);
    assert.match(val.errors[0]!, /confidence score must be between 0.0 and 1.0/);
  });

  it('rejects invalid status enum values', () => {
    const res = createValidResult();
    // @ts-expect-error test invalid status
    res.candidates[0]!.status = 'CONFIRMED';
    const val = validateCorrelationResult(res);
    assert.strictEqual(val.isValid, false);
    assert.match(val.errors[0]!, /invalid status 'CONFIRMED'/);
  });

  it('rejects duplicate candidate IDs', () => {
    const res = createValidResult();
    res.candidates.push({ ...res.candidates[0]! });
    const val = validateCorrelationResult(res);
    assert.strictEqual(val.isValid, false);
    assert.match(val.errors[0]!, /Duplicate candidate ID/);
  });

  it('rejects non-object result input', () => {
    const val = validateCorrelationResult('string');
    assert.strictEqual(val.isValid, false);
    assert.match(val.errors[0]!, /must be a non-null object/);
  });
});
