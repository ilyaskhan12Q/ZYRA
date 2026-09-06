# ZYRA — System Contracts & Conceptual Boundaries

This document defines the data contracts across ZYRA's core layers. These boundaries ensure clean separation between facts, hypotheses, actions, and verification.

---

## 1. PerformanceRun & Evidence Contract (Schema v1.0 — Implemented)

Represents a single execution and normalized evidence model produced by the Evidence Engine.

```typescript
export const EVIDENCE_SCHEMA_VERSION = '1.0' as const;

export interface ZyraEvidence {
  schemaVersion: '1.0';
  target: EvidenceTarget;
  run: EvidenceRun;
  scores: EvidenceScores;
  metrics: EvidenceMetrics;
  audits: NormalizedAudit[];
  resources: {
    summary: ResourceSummaryItem[];
    items: NetworkRequestEvidence[];
  };
  network: {
    requests: NetworkRequestEvidence[];
  };
  scripts: {
    items: ScriptEvidence[];
    longTasks: LongTaskEvidence[];
  };
  images: {
    items: ImageEvidence[];
  };
  fonts: {
    items: FontEvidence[];
  };
  traceability: Record<string, string>;
}

export interface EvidenceTarget {
  url: string;
  requestedUrl?: string;
  finalUrl?: string;
  device: 'mobile' | 'desktop';
  timestamp: string; // ISO 8601
}

export interface EvidenceRun {
  durationMs: number;
  lighthouseVersion: string;
  benchmarkIndex?: number;
  userAgent?: string;
}

export interface MetricDetail {
  value: number | null;
  unit: 'ms' | 'score';
  score: number | null;
  displayValue?: string;
}

export interface EvidenceMetrics {
  fcp: MetricDetail;        // Milliseconds
  lcp: MetricDetail;        // Milliseconds
  cls: MetricDetail;        // Unitless score
  tbt: MetricDetail;        // Milliseconds
  speedIndex: MetricDetail; // Milliseconds
  inp: MetricDetail | null; // Milliseconds (null if unavailable, never invented)
}

export interface EvidenceScores {
  performance: number | null; // 0.0 to 1.0
}

export interface NormalizedAudit {
  id: string; // Stable audit identifier
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
}

export interface NetworkRequestEvidence {
  url: string;
  protocol?: string;
  resourceType?: string;
  mimeType?: string;
  statusCode?: number;
  transferSizeBytes: number;
  resourceSizeBytes?: number;
  priority?: string;
  requestTimeMs?: number;
  endTimeMs?: number;
  durationMs?: number;
}
```

---

## 2. Finding & PerformanceRule Contract (Schema v1.0 — Implemented)

A specific, objective performance condition surfaced by the deterministic rule engine from normalized evidence.

```typescript
export const FINDING_SCHEMA_VERSION = '1.0' as const;

export type FindingSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type FindingConfidence = 'DETERMINISTIC';
export type RuleCategory =
  | 'metrics'
  | 'javascript'
  | 'network'
  | 'images'
  | 'fonts'
  | 'rendering'
  | 'resources';

export interface FindingObserved {
  value: number | string;
  unit?: string;
  displayValue?: string;
}

export interface FindingThreshold {
  value: number | string;
  unit?: string;
  condition: string;
  source: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
}

export interface Finding {
  id: string;                          // Deterministic unique identifier (e.g. 'finding:tbt_critical')
  ruleId: string;                      // Stable rule identifier (e.g. 'TBT_CRITICAL')
  ruleVersion: string;                 // Rule version (e.g. '1.0')
  category: RuleCategory;              // Domain category
  severity: FindingSeverity;           // INFO | WARNING | HIGH | CRITICAL
  title: string;                       // Short descriptive title
  description: string;                 // Detailed description of the condition
  observed: FindingObserved;           // Empirical value measured
  threshold: FindingThreshold;         // Threshold boundary that was crossed
  evidenceRefs: string[];              // Exact paths to evidence (e.g. ['metrics.tbt'])
  confidence: FindingConfidence;       // 'DETERMINISTIC'
  nextInvestigation: string;           // High-level guidance for next phase without root-cause claims
}

export interface PerformanceRule {
  readonly id: string;
  readonly version: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: FindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly evidenceConsumed: string[];
  readonly thresholdSummary: string;
  readonly thresholdSource: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
  evaluate(evidence: ZyraEvidence): Finding[];
}
```

---

## 3. CodebaseEvidence Contract (Schema v1.0 — Implemented)

Represents a deterministic, read-only factual snapshot of the target workspace codebase produced by the Codebase Scanner (`src/codebase/`).

```typescript
export const CODEBASE_EVIDENCE_SCHEMA_VERSION = '1.0' as const;

export type FrameworkConfidence = 'detected' | 'probable' | 'ambiguous' | 'unknown';
export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
export type DependencyType = 'production' | 'development' | 'peer' | 'optional';
export type FileCategory =
  | 'source'
  | 'config'
  | 'manifest'
  | 'stylesheet'
  | 'asset'
  | 'test'
  | 'documentation'
  | 'other';

export type AssetCategory =
  | 'image'
  | 'font'
  | 'stylesheet'
  | 'script'
  | 'media'
  | 'document'
  | 'other';

export interface CodebaseEvidence {
  schemaVersion: '1.0';
  workspace: WorkspaceEvidence;
  framework: FrameworkEvidence;
  packageManager: PackageManagerEvidence;
  runtime: RuntimeEvidence;
  dependencies: DependencyEvidence[];
  files: FileInventoryItem[];
  routes: RouteEvidence[];
  entryPoints: EntryPointEvidence[];
  assets: AssetEvidence[];
  imports: FileImportSummary[];
  configuration: BuildConfigurationEvidence;
  warnings: ScanWarning[];
}

export interface WorkspaceStats {
  filesScanned: number;
  filesSkipped: number;
  directoriesSkipped: number;
  totalSizeBytes: number;
}

export interface WorkspaceEvidence {
  root: string;
  scannedAt: string; // ISO 8601
  scannerVersion: string;
  stats: WorkspaceStats;
}

export interface FrameworkEvidence {
  name: string;
  confidence: FrameworkConfidence;
  version?: string;
  evidenceRefs: string[];
  details?: Record<string, unknown>;
}

export interface PackageManagerEvidence {
  name: PackageManagerName;
  lockfile?: string;
  hasConflict: boolean;
  conflicts?: string[];
  evidenceRefs: string[];
}

export interface RuntimeEvidence {
  declaredNodeVersion?: string;
  source?: string;
  evidenceRefs: string[];
}

export interface DependencyEvidence {
  name: string;
  versionRange: string;
  dependencyType: DependencyType;
  sourceManifest: string;
}

export interface FileInventoryItem {
  relativePath: string;
  extension: string;
  category: FileCategory;
  sizeBytes: number;
}

export interface RouteEvidence {
  path: string;
  sourceFile: string;
  framework: string;
  detectionMethod: string;
  isDynamic: boolean;
  evidenceRefs: string[];
}

export interface EntryPointEvidence {
  path: string;
  detectionReason: string;
  framework?: string;
  evidenceRefs: string[];
}

export interface AssetEvidence {
  relativePath: string;
  extension: string;
  category: AssetCategory;
  sizeBytes: number;
}

export interface FileImportSummary {
  sourceFile: string;
  staticImports: string[];
  dynamicImports: string[];
  unresolvedImports: string[];
}

export interface BuildConfigurationEvidence {
  bundler?: string;
  configFiles: string[];
  hasSourceMaps: boolean;
  aliases?: Record<string, string>;
  evidenceRefs: string[];
}

export interface ScanWarning {
  code: string;
  message: string;
  targetPath?: string;
}
```

---

## 4. Correlation & Root-Cause Assessment Contract (Schema v1.0 — Implemented)

Represents deterministic evidence-backed correlation between browser performance findings and scanned codebase entities produced by the Correlation Engine (`src/correlation/`).

```typescript
export const CORRELATION_SCHEMA_VERSION = '1.0' as const;

export type CorrelationStatus =
  | 'NO_CORRELATION'
  | 'POSSIBLE_CORRELATION'
  | 'SUPPORTED_CONTRIBUTOR'
  | 'STRONGLY_SUPPORTED'
  | 'INSUFFICIENT_EVIDENCE';

export type AssessmentLevel =
  | 'OBSERVED'
  | 'CORRELATED'
  | 'SUPPORTED_CONTRIBUTOR'
  | 'STRONGLY_SUPPORTED_CONTRIBUTOR'
  | 'UNKNOWN';

export interface EvidenceLink {
  sourceType: EvidenceSourceType;
  sourceRef: string;
  targetType: EvidenceSourceType;
  targetRef: string;
  relationship: string;
  strength: 'weak' | 'moderate' | 'strong';
  reason: string;
}

export interface ConfidenceSignal {
  name: string;
  weight: number;
  description: string;
}

export interface Confidence {
  score: number; // 0.0 <= score <= 1.0
  signals: ConfidenceSignal[];
  rationale: string;
}

export interface CandidateContributor {
  id: string; // e.g. 'candidate:asset:public/images/hero.webp'
  targetPath?: string;
  targetType: 'asset' | 'route' | 'entryPoint' | 'dependency' | 'configuration' | 'external_resource' | 'unknown';
  targetName: string;
  findingIds: string[];
  status: CorrelationStatus;
  assessmentLevel: AssessmentLevel;
  confidence: Confidence;
  links: EvidenceLink[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingEvidence: string[];
  reasoning: string;
  nextInvestigation: string;
}

export interface RootCauseAssessment {
  id: string; // e.g. 'assessment:finding:lcp_critical'
  findingId: string;
  status: CorrelationStatus;
  assessmentLevel: AssessmentLevel;
  topCandidateId?: string;
  candidateIds: string[];
  confidence: Confidence;
  summary: string;
  primaryBottleneckType: 'image_payload' | 'font_payload' | 'script_payload' | 'render_blocking' | 'main_thread_execution' | 'layout_instability' | 'unclassified';
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingEvidence: string[];
}

export interface CorrelationResult {
  schemaVersion: '1.0';
  evaluatedAt: string;
  correlatorVersion: string;
  summary: CorrelationSummary;
  candidates: CandidateContributor[];
  assessments: RootCauseAssessment[];
  warnings: CorrelationWarning[];
}
```

---

## 5. Agent Skill & Invocation Contract (Skill Version 1.0 — Implemented)

Defines the protocol between AI coding agents and ZYRA via `SKILL.md` and the `/zyra` command.

```typescript
export const SKILL_VERSION = '1.0' as const;

export interface AgentInvocationOptions {
  url: string;
  workspacePath?: string;
  device?: 'mobile' | 'desktop';
  json?: boolean;
  timeoutMs?: number;
}

export type EvidenceTier =
  | 'OBSERVED_FACT'
  | 'DETERMINISTIC_FINDING'
  | 'CORRELATION'
  | 'CANDIDATE_CONTRIBUTOR'
  | 'ROOT_CAUSE_ASSESSMENT'
  | 'HYPOTHESIS';

export interface StructuredAgentResponse {
  targetUrl: string;
  device: 'mobile' | 'desktop';
  workspacePath?: string;
  performanceScore: number | null;
  coreWebVitals: {
    lcp: number | null;
    fcp: number | null;
    tbt: number | null;
    cls: number | null;
    speedIndex: number | null;
    inp: number | null;
  };
  findings: Array<{
    id: string;
    severity: string;
    observed: string | number;
    threshold: string;
    evidenceRefs: string[];
  }>;
  correlation?: {
    primaryBottleneckType: string;
    assessmentLevel: string;
    topCandidate?: {
      targetName: string;
      targetPath?: string;
      confidence: number;
      status: string;
    };
  };
  evidenceGaps: string[];
}
```

---

## 6. Fix Subsystem Contracts (Schema Version 1.0 — Implemented)

Represents evidence-backed, surgical code modifications planned and executed by the Fix Subsystem (`src/fixes/`).

```typescript
export const FIX_SCHEMA_VERSION = '1.0' as const;

export type FixRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type FixPlanStatus = 'READY_FOR_REVIEW' | 'BLOCKED' | 'APPLIED' | 'ROLLED_BACK';
export type FixExecutionStatus = 'PLANNED' | 'DRY_RUN' | 'APPLIED' | 'BLOCKED' | 'FAILED' | 'ROLLED_BACK';
export type FixOperationType =
  | 'REPLACE_TEXT'
  | 'REMOVE_UNUSED_IMPORT'
  | 'EDIT_ATTRIBUTE'
  | 'INSERT_TEXT'
  | 'REPLACE_IMPORT'
  | 'NOOP_ADVICE';

export interface FixCandidate {
  candidateId: string;
  targetPath: string;
  targetName?: string;
  targetType: string;
  reason: string;
  evidenceRefs: string[];
  findingRefs: string[];
  correlationRefs: string[];
}

export interface FixOperation {
  id: string;
  type: FixOperationType;
  targetPath: string;
  originalContentHash: string; // SHA-256
  expectedOriginalContent?: string;
  replacementContent?: string;
  location?: {
    startLine?: number;
    endLine?: number;
    index?: number;
  };
  reason: string;
}

export interface FixPlan {
  schemaVersion: '1.0';
  planId: string;
  createdAt: string;
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
  expectedImpact: {
    targetMetric: string;
    estimatedDirection: 'improve' | 'neutral';
    description: string;
  };
  preconditions: FixPrecondition[];
  safetyChecks: FixSafetyCheck[];
  rollbackInformation: FixRollbackInfo;
  status: FixPlanStatus;
}

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
```

> [!IMPORTANT]
> **Expected Impact vs. Measured Impact:** A `FixPlan` only contains an *expected* impact. It must never be recorded as a confirmed improvement until empirically measured in Phase 08.

---

## 7. VerificationResult (Schema Version 1.0 — Implemented)

The empirical comparison between pre-fix and post-fix measurements produced by the Verification Subsystem (`src/verification/`).

```typescript
export const VERIFICATION_SCHEMA_VERSION = '1.0' as const;

export type VerificationStatus =
  | 'VERIFIED_IMPROVEMENT'
  | 'VERIFIED_NO_IMPROVEMENT'
  | 'REGRESSION_DETECTED'
  | 'INCONCLUSIVE'
  | 'MEASUREMENT_FAILED';

export type OptimizationDecision =
  | 'KEEP_FIX'
  | 'ROLLBACK_RECOMMENDED'
  | 'NO_ACTION'
  | 'RETRY_NOT_RECOMMENDED'
  | 'INCONCLUSIVE';

export type MetricStatus =
  | 'IMPROVED'
  | 'UNCHANGED'
  | 'REGRESSED'
  | 'NOT_AVAILABLE'
  | 'INCONCLUSIVE';

export interface MetricDelta {
  metric: string;
  name: string;
  before: number | null;
  after: number | null;
  absoluteDelta: number | null;
  percentageDelta: number | null;
  direction: 'improved' | 'regressed' | 'unchanged' | 'unavailable';
  status: MetricStatus;
  unit: 'ms' | 'score';
  threshold: number | string;
  isSignificant: boolean;
}

export interface VerificationResult {
  schemaVersion: '1.0';
  verificationId: string;
  timestamp: string;
  targetUrl: string;
  device: 'mobile' | 'desktop';
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
```

> [!IMPORTANT]
> **Authoritative Invariant:** `APPLIED != IMPROVED`. A code modification recorded as `APPLIED` by Phase 07 only represents an unverified change. Only a `VerificationResult` with status `VERIFIED_IMPROVEMENT` based on empirical re-measurement confirms a performance optimization.

