/**
 * ZYRA CI Contract Validator
 *
 * Validates Schema Version 1.0 CI objects and enforces schema invariants.
 */

import {
  CI_SCHEMA_VERSION,
  type CIBaseline,
  type CIResult,
  type CIPolicy,
  type CIBudgetConfig,
  type CIExitStatus
} from './types.js';

const VALID_STATUSES: Set<CIExitStatus> = new Set([
  'PASS',
  'WARN',
  'FAIL',
  'INCONCLUSIVE',
  'MEASUREMENT_FAILED'
]);

export class CIValidationError extends Error {
  constructor(message: string) {
    super(`CI Validation Error: ${message}`);
    this.name = 'CIValidationError';
  }
}

/**
 * Validates a CIBaseline object against Schema Version 1.0 invariants.
 */
export function validateCIBaseline(data: unknown): CIBaseline {
  if (!data || typeof data !== 'object') {
    throw new CIValidationError('Baseline must be a non-null object.');
  }

  const base = data as Record<string, any>;

  if (base.schemaVersion !== CI_SCHEMA_VERSION) {
    throw new CIValidationError(
      `Invalid schemaVersion: expected '${CI_SCHEMA_VERSION}', received '${base.schemaVersion}'.`
    );
  }

  if (typeof base.id !== 'string' || base.id.trim() === '') {
    throw new CIValidationError('Missing or invalid baseline id.');
  }

  if (typeof base.url !== 'string' || base.url.trim() === '') {
    throw new CIValidationError('Missing or invalid baseline url.');
  }

  if (typeof base.normalizedUrl !== 'string' || base.normalizedUrl.trim() === '') {
    throw new CIValidationError('Missing or invalid baseline normalizedUrl.');
  }

  if (base.device !== 'mobile' && base.device !== 'desktop') {
    throw new CIValidationError(`Invalid device: '${base.device}'. Expected 'mobile' | 'desktop'.`);
  }

  if (typeof base.timestamp !== 'string' || base.timestamp.trim() === '') {
    throw new CIValidationError('Missing or invalid baseline timestamp.');
  }

  if (typeof base.zyraVersion !== 'string' || base.zyraVersion.trim() === '') {
    throw new CIValidationError('Missing or invalid baseline zyraVersion.');
  }

  if (!base.metrics || typeof base.metrics !== 'object') {
    throw new CIValidationError('Missing or invalid baseline metrics.');
  }

  if (!base.scores || typeof base.scores !== 'object') {
    throw new CIValidationError('Missing or invalid baseline scores.');
  }

  if (!base.snapshot || typeof base.snapshot !== 'object') {
    throw new CIValidationError('Missing or invalid baseline snapshot.');
  }

  return base as CIBaseline;
}

/**
 * Validates a CIResult object against Schema Version 1.0 invariants.
 */
export function validateCIResult(data: unknown): CIResult {
  if (!data || typeof data !== 'object') {
    throw new CIValidationError('CI result must be a non-null object.');
  }

  const res = data as Record<string, any>;

  if (res.schemaVersion !== CI_SCHEMA_VERSION) {
    throw new CIValidationError(
      `Invalid schemaVersion: expected '${CI_SCHEMA_VERSION}', received '${res.schemaVersion}'.`
    );
  }

  if (typeof res.id !== 'string' || res.id.trim() === '') {
    throw new CIValidationError('Missing or invalid result id.');
  }

  if (typeof res.timestamp !== 'string' || res.timestamp.trim() === '') {
    throw new CIValidationError('Missing or invalid result timestamp.');
  }

  if (typeof res.targetUrl !== 'string' || res.targetUrl.trim() === '') {
    throw new CIValidationError('Missing or invalid targetUrl.');
  }

  if (res.device !== 'mobile' && res.device !== 'desktop') {
    throw new CIValidationError(`Invalid device: '${res.device}'. Expected 'mobile' | 'desktop'.`);
  }

  if (!VALID_STATUSES.has(res.status)) {
    throw new CIValidationError(
      `Unrecognized CI status '${res.status}'. Valid values: ${Array.from(VALID_STATUSES).join(', ')}.`
    );
  }

  if (typeof res.exitCode !== 'number' || res.exitCode < 0 || res.exitCode > 4) {
    throw new CIValidationError(`Invalid exitCode '${res.exitCode}'. Expected integer in range [0, 4].`);
  }

  if (!res.currentRun || typeof res.currentRun !== 'object') {
    throw new CIValidationError('Missing or invalid currentRun in CIResult.');
  }

  if (!res.budgets || typeof res.budgets !== 'object') {
    throw new CIValidationError('Missing or invalid budgets evaluation in CIResult.');
  }

  if (!Array.isArray(res.budgets.evaluations)) {
    throw new CIValidationError('budgets.evaluations must be an array.');
  }

  if (typeof res.summary !== 'string') {
    throw new CIValidationError('CIResult summary must be a string.');
  }

  return res as CIResult;
}

/**
 * Validates CIPolicy configuration.
 */
export function validateCIPolicy(data: unknown): CIPolicy {
  if (!data || typeof data !== 'object') {
    throw new CIValidationError('CIPolicy must be a non-null object.');
  }
  return data as CIPolicy;
}

/**
 * Validates CIBudgetConfig configuration.
 */
export function validateCIBudgetConfig(data: unknown): CIBudgetConfig {
  if (!data || typeof data !== 'object') {
    throw new CIValidationError('CIBudgetConfig must be a non-null object.');
  }

  const conf = data as Record<string, any>;
  if (!conf.budgets || typeof conf.budgets !== 'object') {
    throw new CIValidationError('CIBudgetConfig must contain a budgets object.');
  }

  for (const [key, val] of Object.entries(conf.budgets)) {
    if (typeof val === 'number') {
      if (val < 0) {
        throw new CIValidationError(`Budget for '${key}' must be non-negative.`);
      }
    } else if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, any>;
      if (typeof obj.max !== 'number' || obj.max < 0) {
        throw new CIValidationError(`Budget max for '${key}' must be a non-negative number.`);
      }
      if (obj.warn !== undefined && (typeof obj.warn !== 'number' || obj.warn < 0)) {
        throw new CIValidationError(`Budget warn for '${key}' must be a non-negative number.`);
      }
    } else {
      throw new CIValidationError(`Budget entry '${key}' has invalid format.`);
    }
  }

  return conf as CIBudgetConfig;
}
