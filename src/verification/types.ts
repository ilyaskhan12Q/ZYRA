/**
 * ZYRA Post-Fix Verification & Optimization Subsystem
 * Data Contracts & Types (Schema Version 1.0)
 */

import { type DeviceType } from '../lighthouse/types.js';
import { type ZyraEvidence } from '../evidence/types.js';

export const VERIFICATION_SCHEMA_VERSION = '1.0' as const;

/**
 * Top-level outcome status of a verification run.
 * Follows the invariant: APPLIED != IMPROVED.
 */
export type VerificationStatus =
  | 'VERIFIED_IMPROVEMENT'
  | 'VERIFIED_NO_IMPROVEMENT'
  | 'REGRESSION_DETECTED'
  | 'INCONCLUSIVE'
  | 'MEASUREMENT_FAILED';

/**
 * Deterministic optimization decision based on empirical verification.
 * ZYRA never applies changes automatically in an infinite loop.
 */
export type OptimizationDecision =
  | 'KEEP_FIX'
  | 'ROLLBACK_RECOMMENDED'
  | 'NO_ACTION'
  | 'RETRY_NOT_RECOMMENDED'
  | 'INCONCLUSIVE';

/**
 * Directional status of a single metric delta.
 */
export type MetricStatus =
  | 'IMPROVED'
  | 'UNCHANGED'
  | 'REGRESSED'
  | 'NOT_AVAILABLE'
  | 'INCONCLUSIVE';

/**
 * Direction of movement relative to performance optimization (lower is better for web vitals).
 */
export type MetricDirection = 'improved' | 'regressed' | 'unchanged' | 'unavailable';

/**
 * Detailed comparison for a single performance metric.
 */
export interface MetricDelta {
  metric: string;
  name: string;
  before: number | null;
  after: number | null;
  absoluteDelta: number | null;
  percentageDelta: number | null;
  direction: MetricDirection;
  status: MetricStatus;
  unit: 'ms' | 'score';
  threshold: number | string;
  isSignificant: boolean;
}

/**
 * Snapshot of authoritative browser/Lighthouse measurement evidence.
 */
export interface MeasurementSnapshot {
  id: string;
  timestamp: string;
  url: string;
  device: DeviceType;
  metrics: {
    fcp: number | null;
    lcp: number | null;
    cls: number | null;
    tbt: number | null;
    speedIndex: number | null;
    inp: number | null;
  };
  scores: {
    performance: number | null;
  };
  evidence: ZyraEvidence;
}

/**
 * Structured comparison between two comparable measurement snapshots.
 */
export interface ComparisonResult {
  compatible: boolean;
  incompatibilityReason?: string;
  metrics: Record<string, MetricDelta>;
  overallStatus: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED' | 'INCONCLUSIVE';
  regressions: MetricDelta[];
  improvements: MetricDelta[];
  unchanged: MetricDelta[];
}

/**
 * Targeted verification of the specific bottleneck addressed by a fix.
 */
export interface TargetVerification {
  targetMetric: string;
  expectedDirection: 'improve' | 'neutral';
  observedDelta: MetricDelta;
  targetImproved: boolean;
  findingId?: string;
  evidenceCheckPassed: boolean;
  details: string;
}

/**
 * File hash verification record comparing workspace state with applied fix audit.
 */
export interface FileHashVerification {
  path: string;
  expectedHash: string;
  currentHash: string;
  matches: boolean;
}

/**
 * Provenance tracking linking verification back to fix result, plan, and code state.
 */
export interface VerificationProvenance {
  fixResultId?: string;
  planId?: string;
  strategyId?: string;
  workspace: string;
  filesVerified: FileHashVerification[];
  codeStateValid: boolean;
}

/**
 * Summary for repeated measurements across multiple bounded runs.
 */
export interface RepeatedRunSummary {
  totalRuns: number;
  completedRuns: number;
  consistent: boolean;
  outcome: 'CONSISTENT_IMPROVEMENT' | 'CONSISTENT_REGRESSION' | 'MIXED_RESULTS' | 'INCONCLUSIVE';
  metricAverages: Record<string, { beforeMean: number; afterMean: number; deltaMean: number }>;
}

/**
 * Complete, authoritative verification result (Schema Version 1.0).
 */
export interface VerificationResult {
  schemaVersion: typeof VERIFICATION_SCHEMA_VERSION;
  verificationId: string;
  timestamp: string;
  targetUrl: string;
  device: DeviceType;
  status: VerificationStatus;
  decision: OptimizationDecision;
  baseline: MeasurementSnapshot;
  postFix: MeasurementSnapshot;
  comparison: ComparisonResult;
  targetVerification?: TargetVerification;
  regressions: MetricDelta[];
  provenance: VerificationProvenance;
  repeatedRuns?: RepeatedRunSummary;
  summary: string;
}
