/**
 * ZYRA Correlation Result Schema Validator (Schema Version 1.0)
 */

import {
  CORRELATION_SCHEMA_VERSION,
  type CorrelationResult,
  type CorrelationValidationResult,
  type CorrelationStatus,
  type AssessmentLevel,
  type EvidenceSourceType
} from './types.js';

const VALID_STATUSES: Set<CorrelationStatus> = new Set([
  'NO_CORRELATION',
  'POSSIBLE_CORRELATION',
  'SUPPORTED_CONTRIBUTOR',
  'STRONGLY_SUPPORTED',
  'INSUFFICIENT_EVIDENCE'
]);

const VALID_ASSESSMENT_LEVELS: Set<AssessmentLevel> = new Set([
  'OBSERVED',
  'CORRELATED',
  'SUPPORTED_CONTRIBUTOR',
  'STRONGLY_SUPPORTED_CONTRIBUTOR',
  'UNKNOWN'
]);

const VALID_SOURCE_TYPES: Set<EvidenceSourceType> = new Set([
  'performanceFinding',
  'browserMetric',
  'lighthouseAudit',
  'networkResource',
  'script',
  'image',
  'font',
  'route',
  'entryPoint',
  'asset',
  'import',
  'dependency',
  'configuration',
  'externalResource'
]);

/**
 * Validates a CorrelationResult object against Schema Version 1.0 invariants.
 */
export function validateCorrelationResult(result: unknown): CorrelationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result || typeof result !== 'object') {
    return {
      isValid: false,
      errors: ['Correlation result must be a non-null object.'],
      warnings: []
    };
  }

  const res = result as Partial<CorrelationResult>;

  // Schema version
  if (res.schemaVersion !== CORRELATION_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion: expected '${CORRELATION_SCHEMA_VERSION}', received '${String(res.schemaVersion)}'.`
    );
  }

  // Evaluated at timestamp
  if (typeof res.evaluatedAt !== 'string' || res.evaluatedAt.trim() === '') {
    errors.push('Field evaluatedAt must be a non-empty string.');
  }

  // Correlator version
  if (typeof res.correlatorVersion !== 'string' || res.correlatorVersion.trim() === '') {
    errors.push('Field correlatorVersion must be a non-empty string.');
  }

  // Summary
  if (!res.summary || typeof res.summary !== 'object') {
    errors.push('Field summary must be a valid object.');
  } else {
    const s = res.summary;
    if (typeof s.totalFindings !== 'number' || s.totalFindings < 0) {
      errors.push('Summary totalFindings must be a non-negative number.');
    }
    if (typeof s.correlatedFindings !== 'number' || s.correlatedFindings < 0) {
      errors.push('Summary correlatedFindings must be a non-negative number.');
    }
  }

  // Candidates
  if (!Array.isArray(res.candidates)) {
    errors.push('Field candidates must be an array.');
  } else {
    const seenCandidateIds = new Set<string>();

    for (let i = 0; i < res.candidates.length; i++) {
      const c = res.candidates[i];
      if (!c || typeof c !== 'object') {
        errors.push(`Candidate at index ${i} is not an object.`);
        continue;
      }

      if (!c.id || typeof c.id !== 'string') {
        errors.push(`Candidate at index ${i} missing valid string id.`);
      } else {
        if (seenCandidateIds.has(c.id)) {
          errors.push(`Duplicate candidate ID detected: '${c.id}'.`);
        }
        seenCandidateIds.add(c.id);
      }

      if (!c.targetName || typeof c.targetName !== 'string') {
        errors.push(`Candidate '${c.id ?? i}' missing valid string targetName.`);
      }

      if (!VALID_STATUSES.has(c.status)) {
        errors.push(`Candidate '${c.id ?? i}' has invalid status '${String(c.status)}'.`);
      }

      if (!VALID_ASSESSMENT_LEVELS.has(c.assessmentLevel)) {
        errors.push(`Candidate '${c.id ?? i}' has invalid assessmentLevel '${String(c.assessmentLevel)}'.`);
      }

      // Confidence validation
      if (!c.confidence || typeof c.confidence !== 'object') {
        errors.push(`Candidate '${c.id ?? i}' missing confidence object.`);
      } else {
        const score = c.confidence.score;
        if (typeof score !== 'number' || isNaN(score) || score < 0.0 || score > 1.0) {
          errors.push(
            `Candidate '${c.id ?? i}' confidence score must be between 0.0 and 1.0; received '${String(score)}'.`
          );
        }
        if (!Array.isArray(c.confidence.signals)) {
          errors.push(`Candidate '${c.id ?? i}' confidence signals must be an array.`);
        }
      }

      // Evidence Links validation
      if (!Array.isArray(c.links)) {
        errors.push(`Candidate '${c.id ?? i}' links must be an array.`);
      } else {
        for (let j = 0; j < c.links.length; j++) {
          const l = c.links[j];
          if (!l || !VALID_SOURCE_TYPES.has(l.sourceType) || !VALID_SOURCE_TYPES.has(l.targetType)) {
            errors.push(`Candidate '${c.id ?? i}' link at index ${j} has invalid source or target type.`);
          }
          if (!l?.sourceRef || !l?.targetRef || !l?.relationship) {
            errors.push(`Candidate '${c.id ?? i}' link at index ${j} missing required reference fields.`);
          }
        }
      }
    }
  }

  // Assessments
  if (!Array.isArray(res.assessments)) {
    errors.push('Field assessments must be an array.');
  } else {
    for (let i = 0; i < res.assessments.length; i++) {
      const a = res.assessments[i];
      if (!a || typeof a !== 'object') {
        errors.push(`Assessment at index ${i} is not an object.`);
        continue;
      }

      if (!a.id || typeof a.id !== 'string') {
        errors.push(`Assessment at index ${i} missing valid string id.`);
      }
      if (!a.findingId || typeof a.findingId !== 'string') {
        errors.push(`Assessment at index ${i} missing valid string findingId.`);
      }
      if (!VALID_STATUSES.has(a.status)) {
        errors.push(`Assessment '${a.id ?? i}' has invalid status '${String(a.status)}'.`);
      }
      if (!VALID_ASSESSMENT_LEVELS.has(a.assessmentLevel)) {
        errors.push(`Assessment '${a.id ?? i}' has invalid assessmentLevel '${String(a.assessmentLevel)}'.`);
      }

      if (a.confidence) {
        const score = a.confidence.score;
        if (typeof score !== 'number' || isNaN(score) || score < 0.0 || score > 1.0) {
          errors.push(
            `Assessment '${a.id ?? i}' confidence score must be between 0.0 and 1.0; received '${String(score)}'.`
          );
        }
      }
    }
  }

  // Warnings
  if (!Array.isArray(res.warnings)) {
    errors.push('Field warnings must be an array.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
