/**
 * ZYRA Fix Contract & Schema Validators (Schema Version 1.0)
 */

import {
  FIX_SCHEMA_VERSION,
  type FixPlan,
  type FixResult,
  type FixValidationResult
} from './types.js';

const VALID_RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'BLOCKED']);
const VALID_PLAN_STATUSES = new Set(['READY_FOR_REVIEW', 'BLOCKED', 'APPLIED', 'ROLLED_BACK']);
const VALID_EXECUTION_STATUSES = new Set(['PLANNED', 'DRY_RUN', 'APPLIED', 'BLOCKED', 'FAILED', 'ROLLED_BACK']);
const VALID_OPERATION_TYPES = new Set([
  'REPLACE_TEXT',
  'REMOVE_UNUSED_IMPORT',
  'EDIT_ATTRIBUTE',
  'INSERT_TEXT',
  'REPLACE_IMPORT',
  'NOOP_ADVICE'
]);

/**
 * Validates that a candidate object adheres to Schema v1.0 invariants.
 */
export function validateFixPlan(plan: unknown): FixValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!plan || typeof plan !== 'object') {
    return {
      isValid: false,
      errors: ['FixPlan must be a non-null object.'],
      warnings: []
    };
  }

  const p = plan as Partial<FixPlan>;

  if (p.schemaVersion !== FIX_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion: expected '${FIX_SCHEMA_VERSION}', got '${p.schemaVersion}'.`
    );
  }

  if (!p.planId || typeof p.planId !== 'string' || p.planId.trim() === '') {
    errors.push('Missing or invalid planId: must be a non-empty string.');
  }

  if (!p.createdAt || typeof p.createdAt !== 'string') {
    errors.push('Missing or invalid createdAt: must be a timestamp string.');
  }

  if (!p.targetWorkspace || typeof p.targetWorkspace !== 'string') {
    errors.push('Missing or invalid targetWorkspace: must be a string path.');
  }

  if (!p.risk || !VALID_RISK_LEVELS.has(p.risk)) {
    errors.push(
      `Missing or invalid risk: must be one of ${Array.from(VALID_RISK_LEVELS).join(', ')}.`
    );
  }

  if (!p.status || !VALID_PLAN_STATUSES.has(p.status)) {
    errors.push(
      `Missing or invalid status: must be one of ${Array.from(VALID_PLAN_STATUSES).join(', ')}.`
    );
  }

  // Validate Candidate
  if (!p.candidate || typeof p.candidate !== 'object') {
    errors.push('Missing or invalid candidate: must be an object.');
  } else {
    if (!p.candidate.candidateId || typeof p.candidate.candidateId !== 'string') {
      errors.push('candidate.candidateId must be a non-empty string.');
    }
    if (!p.candidate.targetPath || typeof p.candidate.targetPath !== 'string') {
      errors.push('candidate.targetPath must be a string.');
    }
    if (!p.candidate.targetType || typeof p.candidate.targetType !== 'string') {
      errors.push('candidate.targetType must be a string.');
    }
    if (!p.candidate.reason || typeof p.candidate.reason !== 'string') {
      errors.push('candidate.reason must be a string.');
    }
  }

  // Validate Strategy
  if (!p.strategy || typeof p.strategy !== 'object') {
    errors.push('Missing or invalid strategy: must be an object.');
  } else {
    if (!p.strategy.id || typeof p.strategy.id !== 'string') {
      errors.push('strategy.id must be a non-empty string.');
    }
    if (!p.strategy.version || typeof p.strategy.version !== 'string') {
      errors.push('strategy.version must be a non-empty string.');
    }
    if (!p.strategy.name || typeof p.strategy.name !== 'string') {
      errors.push('strategy.name must be a non-empty string.');
    }
  }

  // Validate Expected Impact
  if (!p.expectedImpact || typeof p.expectedImpact !== 'object') {
    errors.push('Missing or invalid expectedImpact: must be an object.');
  } else {
    if (!p.expectedImpact.targetMetric || typeof p.expectedImpact.targetMetric !== 'string') {
      errors.push('expectedImpact.targetMetric must be a non-empty string.');
    }
    if (
      p.expectedImpact.estimatedDirection !== 'improve' &&
      p.expectedImpact.estimatedDirection !== 'neutral'
    ) {
      errors.push("expectedImpact.estimatedDirection must be 'improve' or 'neutral'.");
    }
    if (!p.expectedImpact.description || typeof p.expectedImpact.description !== 'string') {
      errors.push('expectedImpact.description must be a string.');
    }
  }

  // Validate Operations
  if (!Array.isArray(p.operations)) {
    errors.push('Missing or invalid operations: must be an array.');
  } else {
    for (let i = 0; i < p.operations.length; i++) {
      const op = p.operations[i];
      if (!op || typeof op !== 'object') {
        errors.push(`operations[${i}] must be an object.`);
        continue;
      }
      if (!op.id || typeof op.id !== 'string') {
        errors.push(`operations[${i}].id must be a string.`);
      }
      if (!op.type || !VALID_OPERATION_TYPES.has(op.type)) {
        errors.push(
          `operations[${i}].type must be one of ${Array.from(VALID_OPERATION_TYPES).join(', ')}.`
        );
      }
      if (!op.targetPath || typeof op.targetPath !== 'string') {
        errors.push(`operations[${i}].targetPath must be a string.`);
      }
      if (!op.originalContentHash || typeof op.originalContentHash !== 'string') {
        errors.push(`operations[${i}].originalContentHash must be a non-empty string.`);
      }
      if (!op.reason || typeof op.reason !== 'string') {
        errors.push(`operations[${i}].reason must be a string.`);
      }
    }
  }

  // Validate Rollback Info
  if (!p.rollbackInformation || typeof p.rollbackInformation !== 'object') {
    errors.push('Missing or invalid rollbackInformation: must be an object.');
  } else {
    if (typeof p.rollbackInformation.available !== 'boolean') {
      errors.push('rollbackInformation.available must be a boolean.');
    }
    if (!Array.isArray(p.rollbackInformation.operations)) {
      errors.push('rollbackInformation.operations must be an array.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates that a FixResult object adheres to Schema v1.0 invariants.
 */
export function validateFixResult(result: unknown): FixValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result || typeof result !== 'object') {
    return {
      isValid: false,
      errors: ['FixResult must be a non-null object.'],
      warnings: []
    };
  }

  const r = result as Partial<FixResult>;

  if (!r.status || !VALID_EXECUTION_STATUSES.has(r.status)) {
    errors.push(
      `Missing or invalid status: must be one of ${Array.from(VALID_EXECUTION_STATUSES).join(', ')}.`
    );
  }

  if (!r.planId || typeof r.planId !== 'string') {
    errors.push('planId must be a non-empty string.');
  }

  if (!r.strategyId || typeof r.strategyId !== 'string') {
    errors.push('strategyId must be a non-empty string.');
  }

  if (!r.strategyVersion || typeof r.strategyVersion !== 'string') {
    errors.push('strategyVersion must be a non-empty string.');
  }

  if (!r.workspace || typeof r.workspace !== 'string') {
    errors.push('workspace must be a string.');
  }

  if (!r.timestamp || typeof r.timestamp !== 'string') {
    errors.push('timestamp must be a string.');
  }

  if (!Array.isArray(r.operations)) {
    errors.push('operations must be an array.');
  }

  if (!r.audit || typeof r.audit !== 'object') {
    errors.push('audit must be an object.');
  } else {
    if (!r.audit.timestamp || typeof r.audit.timestamp !== 'string') {
      errors.push('audit.timestamp must be a string.');
    }
    if (!r.audit.planId || typeof r.audit.planId !== 'string') {
      errors.push('audit.planId must be a string.');
    }
    if (!Array.isArray(r.audit.filesChanged)) {
      errors.push('audit.filesChanged must be an array.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
