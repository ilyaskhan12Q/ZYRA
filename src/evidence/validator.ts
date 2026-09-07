import {
  EVIDENCE_SCHEMA_VERSION,
  type ZyraEvidence,
  type EvidenceValidationResult
} from './types.js';

/**
 * Validate that an Evidence object adheres to the ZyraEvidence contract.
 */
export function validateEvidence(evidence: unknown): EvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!evidence || typeof evidence !== 'object') {
    return {
      isValid: false,
      errors: ['Evidence must be a non-null object.'],
      warnings: []
    };
  }

  const ev = evidence as Partial<ZyraEvidence>;

  // 1. Schema version
  if (ev.schemaVersion !== EVIDENCE_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion '${ev.schemaVersion}'. Expected '${EVIDENCE_SCHEMA_VERSION}'.`
    );
  }

  // 2. Target validation
  if (!ev.target || typeof ev.target !== 'object') {
    errors.push('Missing or invalid target metadata.');
  } else {
    if (!ev.target.url || typeof ev.target.url !== 'string') {
      errors.push('Target URL is missing or not a string.');
    } else {
      try {
        const parsed = new URL(ev.target.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errors.push(`Target URL protocol '${parsed.protocol}' must be 'http:' or 'https:'.`);
        }
      } catch {
        errors.push(`Target URL '${ev.target.url}' is not a valid URL.`);
      }
    }

    if (ev.target.device !== 'mobile' && ev.target.device !== 'desktop') {
      errors.push(`Invalid device '${ev.target.device}'. Must be 'mobile' or 'desktop'.`);
    }

    if (!ev.target.timestamp || isNaN(Date.parse(ev.target.timestamp))) {
      errors.push(`Invalid target timestamp '${ev.target.timestamp}'. Must be a valid ISO date.`);
    }
  }

  // 3. Run metadata
  if (!ev.run || typeof ev.run !== 'object') {
    errors.push('Missing or invalid run metadata.');
  } else {
    if (typeof ev.run.durationMs !== 'number' || ev.run.durationMs < 0) {
      errors.push(`Invalid run durationMs '${ev.run.durationMs}'. Must be a non-negative number.`);
    }
    if (!ev.run.lighthouseVersion || typeof ev.run.lighthouseVersion !== 'string') {
      errors.push('Missing or invalid lighthouseVersion.');
    }
  }

  // 4. Metrics validation
  if (!ev.metrics || typeof ev.metrics !== 'object') {
    errors.push('Missing or invalid metrics object.');
  } else {
    const timeMetrics: Array<{ name: string; detail: unknown }> = [
      { name: 'fcp', detail: ev.metrics.fcp },
      { name: 'lcp', detail: ev.metrics.lcp },
      { name: 'tbt', detail: ev.metrics.tbt },
      { name: 'speedIndex', detail: ev.metrics.speedIndex }
    ];

    for (const { name, detail } of timeMetrics) {
      if (!detail || typeof detail !== 'object') {
        errors.push(`Missing metric detail for '${name}'.`);
        continue;
      }
      const m = detail as { value: unknown; unit: unknown; score: unknown };
      if (m.unit !== 'ms') {
        errors.push(`Metric '${name}' unit must be 'ms', got '${m.unit}'.`);
      }
      if (m.value !== null && (typeof m.value !== 'number' || m.value < 0)) {
        errors.push(`Metric '${name}' value must be non-negative number or null, got '${m.value}'.`);
      }
      if (m.score !== null && (typeof m.score !== 'number' || m.score < 0 || m.score > 1)) {
        errors.push(`Metric '${name}' score must be between 0.0 and 1.0 or null.`);
      }
    }

    // CLS validation (unit is score, value >= 0)
    const cls = ev.metrics.cls;
    if (!cls || typeof cls !== 'object') {
      errors.push('Missing metric detail for CLS.');
    } else {
      if (cls.unit !== 'score') {
        errors.push(`CLS metric unit must be 'score', got '${cls.unit}'.`);
      }
      if (cls.value !== null && (typeof cls.value !== 'number' || cls.value < 0)) {
        errors.push(`CLS value must be non-negative number or null, got '${cls.value}'.`);
      }
    }

    // Optional INP
    if (ev.metrics.inp !== null && ev.metrics.inp !== undefined) {
      const inp = ev.metrics.inp;
      if (typeof inp !== 'object' || inp.unit !== 'ms') {
        errors.push(`Optional INP metric must have unit 'ms'.`);
      }
      if (inp.value !== null && (typeof inp.value !== 'number' || inp.value < 0)) {
        errors.push(`INP value must be non-negative number or null, got '${inp.value}'.`);
      }
    }
  }

  // 5. Scores validation
  if (!ev.scores || typeof ev.scores !== 'object') {
    errors.push('Missing scores object.');
  } else {
    const s = ev.scores.performance;
    if (s !== null && (typeof s !== 'number' || s < 0 || s > 1)) {
      errors.push(`Performance score must be between 0.0 and 1.0 or null, got '${s}'.`);
    }
  }

  // 6. Audits validation
  if (!Array.isArray(ev.audits)) {
    errors.push('Audits must be an array.');
  } else {
    for (let i = 0; i < Math.min(ev.audits.length, 50); i++) {
      const audit = ev.audits[i];
      if (!audit || typeof audit !== 'object' || !audit.id || typeof audit.title !== 'string') {
        errors.push(`Audit at index ${i} is missing an id or title.`);
        break;
      }
    }
  }

  // 7. Network requests validation
  if (!ev.network || !Array.isArray(ev.network.requests)) {
    errors.push('network.requests must be an array.');
  } else {
    for (let i = 0; i < Math.min(ev.network.requests.length, 50); i++) {
      const req = ev.network.requests[i];
      if (!req || typeof req !== 'object' || typeof req.url !== 'string') {
        errors.push(`Network request at index ${i} has invalid URL.`);
        break;
      }
      if (typeof req.transferSizeBytes !== 'number' || req.transferSizeBytes < 0) {
        errors.push(`Network request '${req.url}' has negative transfer size.`);
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
