/**
 * ZYRA Evidence Correlation & Root-Cause Analysis Subsystem
 * Data Contracts & Types (Schema Version 1.0)
 */

import { type ZyraEvidence } from '../evidence/types.js';
import { type Finding, type FindingSeverity } from '../rules/types.js';
import { type CodebaseEvidence } from '../codebase/types.js';

export const CORRELATION_SCHEMA_VERSION = '1.0' as const;

/**
 * Controlled correlation statuses representing deterministic evidence strength.
 */
export type CorrelationStatus =
  | 'NO_CORRELATION'
  | 'POSSIBLE_CORRELATION'
  | 'SUPPORTED_CONTRIBUTOR'
  | 'STRONGLY_SUPPORTED'
  | 'INSUFFICIENT_EVIDENCE';

/**
 * Conservative root-cause assessment levels.
 * ZYRA never declares ABSOLUTE_ROOT_CAUSE without exhaustive empirical proof.
 */
export type AssessmentLevel =
  | 'OBSERVED'
  | 'CORRELATED'
  | 'SUPPORTED_CONTRIBUTOR'
  | 'STRONGLY_SUPPORTED_CONTRIBUTOR'
  | 'UNKNOWN';

/**
 * Permitted evidence source and target entities.
 */
export type EvidenceSourceType =
  | 'performanceFinding'
  | 'browserMetric'
  | 'lighthouseAudit'
  | 'networkResource'
  | 'script'
  | 'image'
  | 'font'
  | 'route'
  | 'entryPoint'
  | 'asset'
  | 'import'
  | 'dependency'
  | 'configuration'
  | 'externalResource';

export type EvidenceLinkStrength = 'weak' | 'moderate' | 'strong';

/**
 * Preserves exact traceability between two pieces of evidence.
 */
export interface EvidenceLink {
  sourceType: EvidenceSourceType;
  sourceRef: string;
  targetType: EvidenceSourceType;
  targetRef: string;
  relationship: string;
  strength: EvidenceLinkStrength;
  reason: string;
}

/**
 * Individual transparent signal contributing to confidence calculation.
 */
export interface ConfidenceSignal {
  name: string;
  weight: number; // Positive increases confidence, negative penalizes
  description: string;
}

/**
 * Deterministic, explainable confidence model.
 * 0.0 <= score <= 1.0
 */
export interface Confidence {
  score: number;
  signals: ConfidenceSignal[];
  rationale: string;
}

export type CandidateTargetType =
  | 'asset'
  | 'route'
  | 'entryPoint'
  | 'dependency'
  | 'configuration'
  | 'external_resource'
  | 'unknown';

/**
 * A code, resource, or configuration entity that plausibly contributes to an observed bottleneck.
 */
export interface CandidateContributor {
  id: string; // Deterministic identifier (e.g. 'candidate:asset:public/images/hero.webp')
  targetPath?: string; // Workspace-relative path if applicable
  targetType: CandidateTargetType;
  targetName: string; // Human-readable identifier (e.g. 'public/images/hero.webp')
  findingIds: string[]; // Finding IDs associated with this candidate
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

export type BottleneckType =
  | 'image_payload'
  | 'font_payload'
  | 'script_payload'
  | 'render_blocking'
  | 'main_thread_execution'
  | 'layout_instability'
  | 'unclassified';

/**
 * Synthesis for an individual performance finding.
 */
export interface RootCauseAssessment {
  id: string; // e.g. 'assessment:finding:lcp_critical'
  findingId: string;
  status: CorrelationStatus;
  assessmentLevel: AssessmentLevel;
  topCandidateId?: string;
  candidateIds: string[];
  confidence: Confidence;
  summary: string;
  primaryBottleneckType: BottleneckType;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingEvidence: string[];
}

export interface CorrelationSummary {
  totalFindings: number;
  correlatedFindings: number;
  stronglySupportedCandidates: number;
  supportedCandidates: number;
  possibleCandidates: number;
  insufficientEvidenceCount: number;
  noCorrelationCount: number;
}

export interface CorrelationWarning {
  code: string;
  message: string;
  ruleId?: string;
}

/**
 * Complete, versioned output contract of the Correlation Engine.
 */
export interface CorrelationResult {
  schemaVersion: typeof CORRELATION_SCHEMA_VERSION;
  evaluatedAt: string; // ISO 8601 string or deterministic placeholder
  correlatorVersion: string;
  summary: CorrelationSummary;
  candidates: CandidateContributor[];
  assessments: RootCauseAssessment[];
  warnings: CorrelationWarning[];
}

export interface CorrelationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CorrelationOptions {
  fixedTimestamp?: string; // For testing determinism
  strict?: boolean;
}

export interface CorrelationRuleContext {
  evidence: ZyraEvidence;
  findings: Finding[];
  codebase: CodebaseEvidence;
}

export interface CorrelationRuleMatch {
  candidate: CandidateContributor;
  assessment?: RootCauseAssessment;
}

export interface CorrelationRule {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly evidenceConsumed: string[];
  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[];
}
