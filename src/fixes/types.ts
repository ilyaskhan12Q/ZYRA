/**
 * ZYRA Automated Fix Planning & Safe Code Modifications Subsystem
 * Data Contracts & Types (Schema Version 1.0)
 */

export const FIX_SCHEMA_VERSION = '1.0' as const;

/**
 * Controlled risk levels for proposed code modifications.
 */
export type FixRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

/**
 * Lifecycle status of a fix plan.
 */
export type FixPlanStatus =
  | 'READY_FOR_REVIEW'
  | 'BLOCKED'
  | 'APPLIED'
  | 'ROLLED_BACK';

/**
 * Execution outcome status of a fix operation or plan.
 */
export type FixExecutionStatus =
  | 'PLANNED'
  | 'DRY_RUN'
  | 'APPLIED'
  | 'BLOCKED'
  | 'FAILED'
  | 'ROLLED_BACK';

/**
 * Specific modification operation types.
 */
export type FixOperationType =
  | 'REPLACE_TEXT'
  | 'REMOVE_UNUSED_IMPORT'
  | 'EDIT_ATTRIBUTE'
  | 'INSERT_TEXT'
  | 'REPLACE_IMPORT'
  | 'NOOP_ADVICE';

/**
 * Identification of a specific codebase entity identified for modification.
 */
export interface FixCandidate {
  candidateId: string;
  targetPath: string; // Workspace-relative POSIX path
  targetName?: string;
  targetType: string; // 'asset' | 'route' | 'entryPoint' | 'source' | 'stylesheet' | 'config'
  reason: string;
  evidenceRefs: string[];
  findingRefs: string[];
  correlationRefs: string[];
}

/**
 * An individual, surgical modification operation within a file.
 */
export interface FixOperation {
  id: string;
  type: FixOperationType;
  targetPath: string; // Workspace-relative POSIX path
  originalContentHash: string; // SHA-256 hash of original file content
  expectedOriginalContent?: string;
  replacementContent?: string;
  location?: {
    startLine?: number;
    endLine?: number;
    index?: number;
  };
  reason: string;
}

/**
 * Safety check record evaluated before or during modification.
 */
export interface FixSafetyCheck {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  details: string;
}

/**
 * Precondition required for a strategy to be safely applicable.
 */
export interface FixPrecondition {
  description: string;
  satisfied: boolean;
  reason?: string;
}

/**
 * Non-guaranteed expected impact description.
 * Adheres to Rule 3 (Never Claim Unverified Improvements).
 */
export interface FixExpectedImpact {
  targetMetric: string;
  estimatedDirection: 'improve' | 'neutral';
  description: string;
}

/**
 * Information necessary to revert a modified file.
 */
export interface FixRollbackItem {
  targetPath: string;
  originalHash: string;
  originalContent?: string;
}

export interface FixRollbackInfo {
  strategy: 'JOURNAL' | 'IN_MEMORY';
  available: boolean;
  operations: FixRollbackItem[];
}

/**
 * Complete, versioned fix plan contract (Schema Version 1.0).
 */
export interface FixPlan {
  schemaVersion: typeof FIX_SCHEMA_VERSION;
  planId: string;
  createdAt: string; // ISO 8601 string or deterministic placeholder
  targetWorkspace: string;
  sourceFindingIds: string[];
  sourceCorrelationIds: string[];
  candidate: FixCandidate;
  strategy: {
    id: string;
    version: string;
    name: string;
  };
  operations: FixOperation[];
  risk: FixRiskLevel;
  confidence: number;
  expectedImpact: FixExpectedImpact;
  preconditions: FixPrecondition[];
  safetyChecks: FixSafetyCheck[];
  rollbackInformation: FixRollbackInfo;
  status: FixPlanStatus;
}

/**
 * Audit trail record produced upon fix execution.
 */
export interface FixAuditRecord {
  timestamp: string;
  planId: string;
  strategyId: string;
  strategyVersion: string;
  workspace: string;
  filesChanged: string[];
  operationsCount: number;
  originalHashes: Record<string, string>;
  newHashes: Record<string, string>;
  result: FixExecutionStatus;
  rollbackAvailable: boolean;
}

/**
 * Individual operation execution result.
 */
export interface FixOperationResult {
  operationId: string;
  targetPath: string;
  status: 'APPLIED' | 'FAILED' | 'SKIPPED';
  originalHash: string;
  newHash?: string;
  error?: string;
}

/**
 * Complete execution result returned by the fix executor.
 */
export interface FixResult {
  status: FixExecutionStatus;
  planId: string;
  strategyId: string;
  strategyVersion: string;
  workspace: string;
  timestamp: string;
  operations: FixOperationResult[];
  audit: FixAuditRecord;
  rollbackAvailable: boolean;
  error?: string;
}

/**
 * Fix planning context passed to strategies and planner.
 */
export interface FixPlanningContext {
  workspaceRoot: string;
  evidence: import('../evidence/types.js').ZyraEvidence;
  findings: import('../rules/types.js').Finding[];
  codebase: import('../codebase/types.js').CodebaseEvidence;
  correlation: import('../correlation/types.js').CorrelationResult;
  fixedTimestamp?: string;
}

/**
 * Fix strategy public definition interface.
 */
export interface FixStrategy {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly applicableFindings: string[];
  readonly applicableCorrelations: string[];
  readonly preconditions: string[];
  readonly riskLevel: FixRiskLevel;
  canApply(candidate: FixCandidate, context: FixPlanningContext): Promise<boolean> | boolean;
  plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> | FixPlan | null;
}

/**
 * Machine-readable strategy catalog item.
 */
export interface FixStrategyCatalogItem {
  id: string;
  version: string;
  name: string;
  description: string;
  riskLevel: FixRiskLevel;
  applicableFindings: string[];
  applicableCorrelations: string[];
  preconditions: string[];
}

/**
 * Execution options for applying a fix plan.
 */
export interface FixExecutionOptions {
  workspaceRoot: string;
  dryRun?: boolean;
  allowHighRisk?: boolean;
  fixedTimestamp?: string;
}

/**
 * Validation result contract for FixPlan and FixResult.
 */
export interface FixValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
