import {
  CODEBASE_EVIDENCE_SCHEMA_VERSION,
  type CodebaseEvidence,
  type CodebaseValidationResult
} from './types.js';

export function validateCodebaseEvidence(evidence: unknown): CodebaseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!evidence || typeof evidence !== 'object') {
    return {
      isValid: false,
      errors: ['CodebaseEvidence must be a non-null object.'],
      warnings: []
    };
  }

  const ev = evidence as Partial<CodebaseEvidence>;

  // 1. Schema Version
  if (ev.schemaVersion !== CODEBASE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion '${ev.schemaVersion}'. Expected '${CODEBASE_EVIDENCE_SCHEMA_VERSION}'.`
    );
  }

  // 2. Workspace Validation
  if (!ev.workspace || typeof ev.workspace !== 'object') {
    errors.push('Missing or invalid workspace metadata.');
  } else {
    if (typeof ev.workspace.root !== 'string' || ev.workspace.root.trim() === '') {
      errors.push('workspace.root must be a non-empty string.');
    }
    if (typeof ev.workspace.scannerVersion !== 'string') {
      errors.push('workspace.scannerVersion must be a string.');
    }
    if (!ev.workspace.stats || typeof ev.workspace.stats !== 'object') {
      errors.push('workspace.stats is missing or not an object.');
    } else {
      const s = ev.workspace.stats;
      if (typeof s.filesScanned !== 'number' || s.filesScanned < 0) {
        errors.push('workspace.stats.filesScanned must be a non-negative number.');
      }
      if (typeof s.totalSizeBytes !== 'number' || s.totalSizeBytes < 0) {
        errors.push('workspace.stats.totalSizeBytes must be a non-negative number.');
      }
    }
  }

  // 3. Framework Validation
  if (!ev.framework || typeof ev.framework !== 'object') {
    errors.push('Missing or invalid framework evidence.');
  } else {
    if (typeof ev.framework.name !== 'string') {
      errors.push('framework.name must be a string.');
    }
    const validConfidences = ['detected', 'probable', 'ambiguous', 'unknown'];
    if (!validConfidences.includes(ev.framework.confidence)) {
      errors.push(`Invalid framework.confidence '${ev.framework.confidence}'.`);
    }
    if (!Array.isArray(ev.framework.evidenceRefs)) {
      errors.push('framework.evidenceRefs must be an array.');
    }
  }

  // 4. Package Manager Validation
  if (!ev.packageManager || typeof ev.packageManager !== 'object') {
    errors.push('Missing or invalid packageManager evidence.');
  } else {
    const validPMs = ['npm', 'pnpm', 'yarn', 'bun', 'unknown'];
    if (!validPMs.includes(ev.packageManager.name)) {
      errors.push(`Invalid packageManager.name '${ev.packageManager.name}'.`);
    }
    if (typeof ev.packageManager.hasConflict !== 'boolean') {
      errors.push('packageManager.hasConflict must be a boolean.');
    }
  }

  // 5. Dependencies Validation
  if (!Array.isArray(ev.dependencies)) {
    errors.push('dependencies must be an array.');
  } else {
    for (let i = 0; i < Math.min(ev.dependencies.length, 50); i++) {
      const d = ev.dependencies[i];
      if (!d || typeof d !== 'object' || typeof d.name !== 'string' || typeof d.versionRange !== 'string') {
        errors.push(`Dependency at index ${i} is missing name or versionRange.`);
        break;
      }
    }
  }

  // 6. Files Validation
  if (!Array.isArray(ev.files)) {
    errors.push('files must be an array.');
  } else {
    for (let i = 0; i < Math.min(ev.files.length, 50); i++) {
      const f = ev.files[i];
      if (!f || typeof f !== 'object' || typeof f.relativePath !== 'string') {
        errors.push(`File item at index ${i} has invalid relativePath.`);
        break;
      }
      if (typeof f.sizeBytes !== 'number' || f.sizeBytes < 0) {
        errors.push(`File '${f.relativePath}' has invalid sizeBytes.`);
        break;
      }
    }
  }

  // 7. Routes Validation
  if (!Array.isArray(ev.routes)) {
    errors.push('routes must be an array.');
  }

  // 8. Entry Points Validation
  if (!Array.isArray(ev.entryPoints)) {
    errors.push('entryPoints must be an array.');
  }

  // 9. Assets Validation
  if (!Array.isArray(ev.assets)) {
    errors.push('assets must be an array.');
  }

  // 10. Imports Validation
  if (!Array.isArray(ev.imports)) {
    errors.push('imports must be an array.');
  }

  // 11. Configuration Validation
  if (!ev.configuration || typeof ev.configuration !== 'object') {
    errors.push('Missing configuration evidence.');
  }

  // 12. Warnings Validation
  if (!Array.isArray(ev.warnings)) {
    errors.push('warnings must be an array.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
