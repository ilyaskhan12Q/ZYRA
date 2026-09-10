import { runLighthouse } from '../lighthouse/runner.js';
import { type LighthouseRunnerOptions } from '../lighthouse/types.js';
import { normalizeEvidence } from './normalizer.js';
import { validateEvidence } from './validator.js';
import { type ZyraEvidence } from './types.js';

export interface CollectorResult {
  evidence: ZyraEvidence;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawLhr?: Record<string, any>;
}

export interface CollectorOptions extends LighthouseRunnerOptions {
  includeRawLhr?: boolean;
}

/**
 * High-level orchestration function to execute Lighthouse, extract raw data,
 * normalize it into a ZyraEvidence model, and validate the result.
 */
export async function collectEvidence(
  options: CollectorOptions
): Promise<CollectorResult> {
  // 1. Run Lighthouse
  const runResult = await runLighthouse(options);

  // 2. Normalize raw results into ZYRA Evidence contract
  options.onProgress?.('Processing & validating evidence...');
  const evidence = normalizeEvidence(runResult);

  // 3. Validate normalized evidence
  const validation = validateEvidence(evidence);
  if (!validation.isValid) {
    throw new Error(
      `Evidence validation failed after run:\n- ${validation.errors.join('\n- ')}`
    );
  }

  return {
    evidence,
    rawLhr: options.includeRawLhr ? runResult.rawLhr : undefined
  };
}
