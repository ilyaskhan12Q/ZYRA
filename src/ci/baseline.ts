/**
 * ZYRA CI Baseline Management
 *
 * Handles deterministic creation, validation, loading, saving, and compatibility
 * evaluation of performance baselines.
 */

import * as fs from 'node:fs/promises';
import { type DeviceType } from '../lighthouse/types.js';
import { type ZyraEvidence } from '../evidence/types.js';
import { normalizeEvidence } from '../evidence/normalizer.js';
import {
  createMeasurementSnapshot,
  normalizeUrlForComparison
} from '../verification/compatibility.js';
import {
  CI_SCHEMA_VERSION,
  type CIBaseline
} from './types.js';
import { validateCIBaseline, CIValidationError } from './validator.js';

const CURRENT_ZYRA_VERSION = '0.9.4';

/**
 * Creates an authoritative CIBaseline object from ZyraEvidence.
 */
export function createCIBaseline(
  evidence: ZyraEvidence,
  metadata?: Record<string, unknown>
): CIBaseline {
  if (!evidence || evidence.schemaVersion !== '1.0') {
    throw new CIValidationError('Evidence must be a valid ZyraEvidence object adhering to Schema 1.0.');
  }

  const snapshot = createMeasurementSnapshot(evidence);
  const normalizedUrl = normalizeUrlForComparison(evidence.target.url);

  const baseline: CIBaseline = {
    schemaVersion: CI_SCHEMA_VERSION,
    id: `base_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    url: evidence.target.url,
    normalizedUrl,
    device: evidence.target.device,
    timestamp: evidence.target.timestamp || new Date().toISOString(),
    zyraVersion: CURRENT_ZYRA_VERSION,
    metrics: {
      fcp: snapshot.metrics.fcp,
      lcp: snapshot.metrics.lcp,
      cls: snapshot.metrics.cls,
      tbt: snapshot.metrics.tbt,
      speedIndex: snapshot.metrics.speedIndex,
      inp: snapshot.metrics.inp
    },
    scores: {
      performance: snapshot.scores.performance
    },
    snapshot,
    metadata
  };

  return validateCIBaseline(baseline);
}

/**
 * Loads a baseline from disk. Flexibly accepts:
 * 1. Dedicated CIBaseline JSON (Schema 1.0)
 * 2. Raw ZyraEvidence JSON (Schema 1.0)
 * 3. MeasurementSnapshot JSON
 */
export async function loadCIBaseline(filePath: string): Promise<CIBaseline> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    throw new CIValidationError(`Failed to read baseline file at '${filePath}': ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new CIValidationError(`Malformed JSON in baseline file at '${filePath}': ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new CIValidationError(`Baseline file '${filePath}' must contain a valid JSON object.`);
  }

  const data = parsed as Record<string, any>;

  // Case 1: Standard CIBaseline object
  if (data.schemaVersion === CI_SCHEMA_VERSION && data.snapshot && data.normalizedUrl) {
    return validateCIBaseline(data);
  }

  // Case 2: Raw ZyraEvidence object
  if (data.schemaVersion === '1.0' && data.target && data.metrics) {
    return createCIBaseline(data as ZyraEvidence);
  }

  // Case 3: MeasurementSnapshot object
  if (data.url && data.device && data.metrics && data.evidence) {
    return createCIBaseline(data.evidence as ZyraEvidence);
  }

  // Case 4: Raw Lighthouse LHR JSON
  if (!data.schemaVersion && data.audits && (data.lighthouseVersion || data.categories)) {
    const finalUrl = data.finalDisplayedUrl || data.requestedUrl || 'https://example.com/';
    const norm = normalizeEvidence({
      metadata: {
        targetUrl: finalUrl,
        requestedUrl: data.requestedUrl || finalUrl,
        finalDisplayedUrl: finalUrl,
        device: data.configSettings?.formFactor === 'desktop' ? 'desktop' : 'mobile',
        timestamp: data.fetchTime || new Date().toISOString(),
        durationMs: data.timing?.total || 1000,
        lighthouseVersion: data.lighthouseVersion || '13.4.1'
      },
      rawLhr: data
    });
    return createCIBaseline(norm);
  }

  throw new CIValidationError(
    `Unrecognized baseline format in '${filePath}'. Expected CIBaseline (v1.0) or ZyraEvidence (v1.0).`
  );
}

/**
 * Validates compatibility between a baseline and the current measurement target.
 * Never silently allows comparisons across incompatible URLs or device profiles.
 */
export function validateCIBaselineCompatibility(
  baseline: CIBaseline,
  currentTargetUrl: string,
  currentDevice: DeviceType
): { compatible: boolean; reason?: string } {
  if (!baseline) {
    return {
      compatible: false,
      reason: 'No baseline provided for comparison.'
    };
  }

  if (baseline.schemaVersion !== CI_SCHEMA_VERSION) {
    return {
      compatible: false,
      reason: `Incompatible baseline schema version '${baseline.schemaVersion}'. Expected '${CI_SCHEMA_VERSION}'.`
    };
  }

  // Device profile compatibility
  if (baseline.device !== currentDevice) {
    return {
      compatible: false,
      reason: `Device profile mismatch: baseline was captured on '${baseline.device}' while current run is on '${currentDevice}'. Cross-profile comparison is invalid.`
    };
  }

  // URL origin and pathname compatibility
  const normCurrent = normalizeUrlForComparison(currentTargetUrl);
  if (baseline.normalizedUrl !== normCurrent) {
    return {
      compatible: false,
      reason: `Target URL mismatch: baseline was captured for '${baseline.url}' (normalized: '${baseline.normalizedUrl}'), while current run is for '${currentTargetUrl}' (normalized: '${normCurrent}'). Endpoints must match.`
    };
  }

  return {
    compatible: true
  };
}

/**
 * Serializes and saves a CIBaseline object to disk.
 */
export async function saveCIBaseline(baseline: CIBaseline, filePath: string): Promise<void> {
  const validated = validateCIBaseline(baseline);
  await fs.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8');
}
