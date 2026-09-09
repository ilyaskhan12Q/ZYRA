/**
 * ZYRA Measurement Compatibility & Snapshot Evaluator
 *
 * Ensures baseline and post-fix measurements are strictly comparable before
 * allowing delta calculation.
 */

import { type ZyraEvidence } from '../evidence/types.js';
import { type MeasurementSnapshot } from './types.js';

export interface CompatibilityCheckResult {
  compatible: boolean;
  reason?: string;
}

/**
 * Creates an authoritative MeasurementSnapshot from raw ZyraEvidence.
 */
export function createMeasurementSnapshot(evidence: ZyraEvidence): MeasurementSnapshot {
  return {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: evidence?.target?.timestamp || new Date().toISOString(),
    url: evidence?.target?.url || '',
    device: evidence?.target?.device || 'mobile',
    metrics: {
      fcp: evidence?.metrics?.fcp?.value ?? null,
      lcp: evidence?.metrics?.lcp?.value ?? null,
      cls: evidence?.metrics?.cls?.value ?? null,
      tbt: evidence?.metrics?.tbt?.value ?? null,
      speedIndex: evidence?.metrics?.speedIndex?.value ?? null,
      inp: evidence?.metrics?.inp?.value ?? null
    },
    scores: {
      performance: evidence?.scores?.performance ?? null
    },
    evidence
  };
}

/**
 * Normalizes a URL for comparison purposes (origin + pathname).
 */
export function normalizeUrlForComparison(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    let pathname = parsed.pathname;
    if (pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Validates whether baseline and post-fix evidence are comparable.
 */
export function validateMeasurementCompatibility(
  baseline: ZyraEvidence,
  postFix: ZyraEvidence
): CompatibilityCheckResult {
  if (!baseline || !postFix) {
    return {
      compatible: false,
      reason: 'Both baseline and post-fix evidence must be provided.'
    };
  }

  if (baseline.schemaVersion !== '1.0' || postFix.schemaVersion !== '1.0') {
    return {
      compatible: false,
      reason: `Incompatible evidence schema versions: baseline (${baseline.schemaVersion}), postFix (${postFix.schemaVersion}). Schema 1.0 required.`
    };
  }

  if (!baseline.target || !postFix.target) {
    return {
      compatible: false,
      reason: 'Both baseline and post-fix evidence must include valid target metadata.'
    };
  }

  // Device profile check (Mobile vs Desktop)
  if (baseline.target.device !== postFix.target.device) {
    return {
      compatible: false,
      reason: `Device profile mismatch: baseline was measured on '${baseline.target.device}' while post-fix was measured on '${postFix.target.device}'. Cross-profile comparison is invalid.`
    };
  }

  // URL comparability check
  const normBase = normalizeUrlForComparison(baseline.target.url);
  const normPost = normalizeUrlForComparison(postFix.target.url);

  if (normBase !== normPost) {
    return {
      compatible: false,
      reason: `Target URL mismatch: baseline was '${baseline.target.url}' while post-fix was '${postFix.target.url}'. Comparable measurements must target the same endpoint.`
    };
  }

  return {
    compatible: true
  };
}
