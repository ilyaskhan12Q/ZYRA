/**
 * ZYRA CI / Regression Detection Subsystem
 * Data Contracts & Types (Schema Version 1.0)
 */

import { type DeviceType } from '../lighthouse/types.js';
import { type ZyraEvidence } from '../evidence/types.js';
import {
  type MeasurementSnapshot,
  type MetricDelta,
  type MetricDirection,
  type MetricStatus
} from '../verification/types.js';

export const CI_SCHEMA_VERSION = '1.0' as const;

/**
 * Controlled exit statuses for ZYRA CI runs.
 */
export type CIExitStatus =
  | 'PASS'
  | 'WARN'
  | 'FAIL'
  | 'INCONCLUSIVE'
  | 'MEASUREMENT_FAILED';

/**
 * Authoritative, stable exit codes for CI pipelines.
 */
export const CI_EXIT_CODES: Record<CIExitStatus, number> = {
  PASS: 0,
  FAIL: 1,
  WARN: 2,
  INCONCLUSIVE: 3,
  MEASUREMENT_FAILED: 4
} as const;

/**
 * Representation of a single metric's performance budget definition.
 */
export interface CIMetricBudget {
  metric: string;
  name: string;
  max: number;
  warnThreshold?: number;
  unit: 'ms' | 'score';
}

/**
 * Configuration for performance budgets.
 * Supports simple numeric mappings or detailed threshold objects.
 */
export interface CIBudgetConfig {
  budgets: Record<string, number | { max: number; warn?: number }>;
}

/**
 * Result of evaluating a metric against its configured budget.
 */
export interface CIBudgetEvaluation {
  metric: string;
  name: string;
  actual: number | null;
  budgetMax: number;
  budgetWarn?: number;
  unit: 'ms' | 'score';
  status: 'PASS' | 'WARN' | 'FAIL' | 'NOT_AVAILABLE';
  delta: number | null;
  percentageOfBudget: number | null;
}

/**
 * Deterministic regression entry linking delta comparison with severity and budget status.
 */
export interface CIRegression {
  metric: string;
  name: string;
  baseline: number | null;
  current: number | null;
  absoluteDelta: number | null;
  percentageDelta: number | null;
  direction: MetricDirection;
  status: MetricStatus;
  isSignificant: boolean;
  unit: 'ms' | 'score';
  severity: 'CRITICAL' | 'WARNING' | 'NONE';
  budgetViolation?: boolean;
  details: string;
}

/**
 * Baseline provenance and measurement snapshot.
 */
export interface CIBaseline {
  schemaVersion: typeof CI_SCHEMA_VERSION;
  id: string;
  url: string;
  normalizedUrl: string;
  device: DeviceType;
  timestamp: string;
  zyraVersion: string;
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
  snapshot: MeasurementSnapshot;
  metadata?: {
    commitSha?: string;
    branch?: string;
    buildNumber?: string;
    environment?: string;
    lighthouseVersion?: string;
    durationMs?: number;
    [key: string]: unknown;
  };
}

/**
 * Provenance of the current CI measurement run.
 */
export interface CIRun {
  id: string;
  timestamp: string;
  targetUrl: string;
  device: DeviceType;
  zyraVersion: string;
  evidence: ZyraEvidence;
  snapshot: MeasurementSnapshot;
  ciEnvironment?: {
    platform?: string;
    branch?: string;
    commitSha?: string;
    prNumber?: string | number;
    actor?: string;
    runId?: string;
  };
}

/**
 * Configurable policy governing CI pass/warn/fail evaluation.
 */
export interface CIPolicy {
  failOnRegression?: boolean;
  failOnBudgetViolation?: boolean;
  warnOnBudgetViolation?: boolean;
  warnOnMinorRegression?: boolean;
  allowMissingBaseline?: boolean;
  failOnWarn?: boolean;
  strictMetrics?: string[];
  maxAllowedRegressionPercent?: Record<string, number>;
}

/**
 * Comparison summary between baseline and current measurement.
 */
export interface CIComparisonSummary {
  compatible: boolean;
  incompatibilityReason?: string;
  overallStatus: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED' | 'INCONCLUSIVE';
  metrics: Record<string, MetricDelta>;
  regressions: CIRegression[];
  improvements: MetricDelta[];
  unchanged: MetricDelta[];
}

/**
 * Complete, authoritative result emitted by the CI subsystem (Schema Version 1.0).
 */
export interface CIResult {
  schemaVersion: typeof CI_SCHEMA_VERSION;
  id: string;
  timestamp: string;
  targetUrl: string;
  device: DeviceType;
  status: CIExitStatus;
  exitCode: number;
  policy: CIPolicy;
  currentRun: {
    url: string;
    device: DeviceType;
    metrics: Record<string, number | null>;
    scores: Record<string, number | null>;
    evidenceTimestamp: string;
  };
  baseline?: {
    id: string;
    url: string;
    device: DeviceType;
    timestamp: string;
    metrics: Record<string, number | null>;
    scores: Record<string, number | null>;
    compatible: boolean;
    incompatibilityReason?: string;
  };
  comparison?: CIComparisonSummary;
  budgets: {
    passed: boolean;
    evaluations: CIBudgetEvaluation[];
    violations: CIBudgetEvaluation[];
    warnings: CIBudgetEvaluation[];
  };
  summary: string;
  prComment?: string;
}

/**
 * Options for executing a CI check.
 */
export interface CIRunOptions {
  targetUrl: string;
  device?: DeviceType;
  baseline?: CIBaseline | ZyraEvidence | string;
  currentEvidence?: ZyraEvidence;
  budgetConfig?: CIBudgetConfig;
  policy?: CIPolicy;
  timeoutMs?: number;
  ciEnvironment?: CIRun['ciEnvironment'];
  id?: string;
  timestamp?: string;
}
