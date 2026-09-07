/**
 * ZYRA Verification Contract Validator
 *
 * Validates Schema Version 1.0 VerificationResult objects and enforces invariants.
 */

import {
  VERIFICATION_SCHEMA_VERSION,
  type VerificationResult,
  type VerificationStatus,
  type OptimizationDecision
} from './types.js';

const VALID_STATUSES: Set<VerificationStatus> = new Set([
  'VERIFIED_IMPROVEMENT',
  'VERIFIED_NO_IMPROVEMENT',
  'REGRESSION_DETECTED',
  'INCONCLUSIVE',
  'MEASUREMENT_FAILED'
]);

const VALID_DECISIONS: Set<OptimizationDecision> = new Set([
  'KEEP_FIX',
  'ROLLBACK_RECOMMENDED',
  'NO_ACTION',
  'RETRY_NOT_RECOMMENDED',
  'INCONCLUSIVE'
]);

export class VerificationValidationError extends Error {
  constructor(message: string) {
    super(`Verification Validation Error: ${message}`);
    this.name = 'VerificationValidationError';
  }
}

/**
 * Validates a VerificationResult object against Schema Version 1.0 invariants.
 */
export function validateVerificationResult(data: unknown): VerificationResult {
  if (!data || typeof data !== 'object') {
    throw new VerificationValidationError('Verification result must be a non-null object.');
  }

  const res = data as Record<string, any>;

  if (res.schemaVersion !== VERIFICATION_SCHEMA_VERSION) {
    throw new VerificationValidationError(
      `Invalid schemaVersion: expected '${VERIFICATION_SCHEMA_VERSION}', received '${res.schemaVersion}'.`
    );
  }

  if (typeof res.verificationId !== 'string' || res.verificationId.trim() === '') {
    throw new VerificationValidationError('Missing or invalid verificationId.');
  }

  if (typeof res.timestamp !== 'string' || res.timestamp.trim() === '') {
    throw new VerificationValidationError('Missing or invalid timestamp.');
  }

  if (typeof res.targetUrl !== 'string' || res.targetUrl.trim() === '') {
    throw new VerificationValidationError('Missing or invalid targetUrl.');
  }

  if (!VALID_STATUSES.has(res.status)) {
    throw new VerificationValidationError(`Invalid verification status: '${res.status}'.`);
  }

  if (!VALID_DECISIONS.has(res.decision)) {
    throw new VerificationValidationError(`Invalid optimization decision: '${res.decision}'.`);
  }

  if (!res.baseline || typeof res.baseline !== 'object') {
    throw new VerificationValidationError('Missing or invalid baseline measurement snapshot.');
  }

  if (!res.postFix || typeof res.postFix !== 'object') {
    throw new VerificationValidationError('Missing or invalid postFix measurement snapshot.');
  }

  if (!res.comparison || typeof res.comparison !== 'object') {
    throw new VerificationValidationError('Missing or invalid comparison result.');
  }

  if (!Array.isArray(res.regressions)) {
    throw new VerificationValidationError('regressions must be an array.');
  }

  if (!res.provenance || typeof res.provenance !== 'object') {
    throw new VerificationValidationError('Missing or invalid verification provenance.');
  }

  return res as VerificationResult;
}
