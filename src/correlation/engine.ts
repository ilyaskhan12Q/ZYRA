/**
 * ZYRA Evidence Correlation Engine
 *
 * Orchestrates deterministic correlation across browser evidence, performance findings,
 * and scanned codebase evidence.
 */

import { type ZyraEvidence } from '../evidence/types.js';
import { type Finding, type FindingSeverity } from '../rules/types.js';
import { type CodebaseEvidence } from '../codebase/types.js';
import {
  CORRELATION_SCHEMA_VERSION,
  type CorrelationResult,
  type CorrelationOptions,
  type CandidateContributor,
  type RootCauseAssessment,
  type CorrelationSummary,
  type CorrelationWarning,
  type CorrelationStatus,
  type AssessmentLevel,
  type ConfidenceSignal,
  type EvidenceLink
} from './types.js';
import { CorrelationRegistry } from './registry.js';
import { calculateConfidence, resolveCorrelationStatus } from './confidence.js';

const STATUS_RANK: Record<CorrelationStatus, number> = {
  STRONGLY_SUPPORTED: 5,
  SUPPORTED_CONTRIBUTOR: 4,
  POSSIBLE_CORRELATION: 3,
  INSUFFICIENT_EVIDENCE: 2,
  NO_CORRELATION: 1
};

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  WARNING: 2,
  INFO: 1
};

export class CorrelationEngine {
  private registry: CorrelationRegistry;
  private version = '1.0';

  constructor(registry: CorrelationRegistry = new CorrelationRegistry()) {
    this.registry = registry;
  }

  /**
   * Correlates browser evidence, performance findings, and codebase evidence.
   */
  correlate(
    evidence: ZyraEvidence,
    findings: Finding[],
    codebase: CodebaseEvidence,
    options?: CorrelationOptions
  ): CorrelationResult {
    const rawCandidates: CandidateContributor[] = [];
    const rawAssessments: RootCauseAssessment[] = [];
    const warnings: CorrelationWarning[] = [];

    const context = { evidence, findings, codebase };

    // Execute all registered correlation rules with fault isolation
    for (const rule of this.registry.getAll()) {
      try {
        const matches = rule.evaluate(context);
        for (const match of matches) {
          if (match.candidate) {
            rawCandidates.push(match.candidate);
          }
          if (match.assessment) {
            rawAssessments.push(match.assessment);
          }
        }
      } catch (err) {
        const error = err as Error;
        warnings.push({
          code: 'CORRELATION_RULE_ERROR',
          message: error.message || 'Unknown error occurred during rule evaluation.',
          ruleId: rule.id
        });
        if (options?.strict) {
          throw err;
        }
      }
    }

    // Merge and deduplicate candidates by ID
    const mergedCandidates = this.mergeCandidates(rawCandidates, findings);

    // Merge and deduplicate assessments by ID (findingId)
    const mergedAssessments = this.mergeAssessments(rawAssessments, mergedCandidates);

    // If findings have no candidates, create un-correlated / insufficient evidence assessments
    for (const finding of findings) {
      const existing = mergedAssessments.find((a) => a.findingId === finding.id);
      if (!existing) {
        mergedAssessments.push({
          id: `assessment:${finding.id}`,
          findingId: finding.id,
          status: 'NO_CORRELATION',
          assessmentLevel: 'UNKNOWN',
          candidateIds: [],
          confidence: {
            score: 0,
            signals: [],
            rationale: 'No codebase entities or resources could be correlated with this finding.'
          },
          summary: `Finding '${finding.ruleId}' has no correlated codebase entities.`,
          primaryBottleneckType: 'unclassified',
          supportingEvidence: [],
          contradictingEvidence: [],
          missingEvidence: ['No matching resources or source files identified in workspace.']
        });
      }
    }

    // Deterministic Sorting for candidates
    mergedCandidates.sort((a, b) => {
      // 1. Status rank descending
      const statusDiff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
      if (statusDiff !== 0) return statusDiff;

      // 2. Confidence score descending
      const confDiff = b.confidence.score - a.confidence.score;
      if (confDiff !== 0) return confDiff;

      // 3. Highest associated finding severity descending
      const maxSevA = this.getMaxFindingSeverity(a.findingIds, findings);
      const maxSevB = this.getMaxFindingSeverity(b.findingIds, findings);
      const sevDiff = SEVERITY_RANK[maxSevB] - SEVERITY_RANK[maxSevA];
      if (sevDiff !== 0) return sevDiff;

      // 4. Alphabetical by candidate ID
      return a.id.localeCompare(b.id);
    });

    // Deterministic Sorting for assessments
    mergedAssessments.sort((a, b) => {
      const findingA = findings.find((f) => f.id === a.findingId);
      const findingB = findings.find((f) => f.id === b.findingId);
      const sevA = findingA ? SEVERITY_RANK[findingA.severity] : 0;
      const sevB = findingB ? SEVERITY_RANK[findingB.severity] : 0;
      const sevDiff = sevB - sevA;
      if (sevDiff !== 0) return sevDiff;

      const statusDiff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
      if (statusDiff !== 0) return statusDiff;

      const confDiff = b.confidence.score - a.confidence.score;
      if (confDiff !== 0) return confDiff;

      return a.id.localeCompare(b.id);
    });

    // Compute summary
    const summary: CorrelationSummary = {
      totalFindings: findings.length,
      correlatedFindings: mergedAssessments.filter((a) => a.candidateIds.length > 0).length,
      stronglySupportedCandidates: mergedCandidates.filter((c) => c.status === 'STRONGLY_SUPPORTED').length,
      supportedCandidates: mergedCandidates.filter((c) => c.status === 'SUPPORTED_CONTRIBUTOR').length,
      possibleCandidates: mergedCandidates.filter((c) => c.status === 'POSSIBLE_CORRELATION').length,
      insufficientEvidenceCount: mergedCandidates.filter((c) => c.status === 'INSUFFICIENT_EVIDENCE').length,
      noCorrelationCount: mergedAssessments.filter((a) => a.status === 'NO_CORRELATION').length
    };

    return {
      schemaVersion: CORRELATION_SCHEMA_VERSION,
      evaluatedAt: options?.fixedTimestamp ?? new Date().toISOString(),
      correlatorVersion: this.version,
      summary,
      candidates: mergedCandidates,
      assessments: mergedAssessments,
      warnings
    };
  }

  private mergeCandidates(
    candidates: CandidateContributor[],
    findings: Finding[]
  ): CandidateContributor[] {
    const map = new Map<string, CandidateContributor>();

    for (const c of candidates) {
      const existing = map.get(c.id);
      if (!existing) {
        map.set(c.id, {
          ...c,
          findingIds: [...c.findingIds],
          links: [...c.links],
          supportingEvidence: [...c.supportingEvidence],
          contradictingEvidence: [...c.contradictingEvidence],
          missingEvidence: [...c.missingEvidence],
          confidence: {
            score: c.confidence.score,
            signals: [...c.confidence.signals],
            rationale: c.confidence.rationale
          }
        });
        continue;
      }

      // Merge finding IDs
      for (const fid of c.findingIds) {
        if (!existing.findingIds.includes(fid)) {
          existing.findingIds.push(fid);
        }
      }
      existing.findingIds.sort();

      // Merge links (deduplicate by sourceRef + targetRef + relationship)
      for (const l of c.links) {
        const linkKey = `${l.sourceRef}:${l.targetRef}:${l.relationship}`;
        const hasLink = existing.links.some(
          (el) => `${el.sourceRef}:${el.targetRef}:${el.relationship}` === linkKey
        );
        if (!hasLink) {
          existing.links.push(l);
        }
      }

      // Merge evidence strings
      for (const sup of c.supportingEvidence) {
        if (!existing.supportingEvidence.includes(sup)) {
          existing.supportingEvidence.push(sup);
        }
      }
      for (const con of c.contradictingEvidence) {
        if (!existing.contradictingEvidence.includes(con)) {
          existing.contradictingEvidence.push(con);
        }
      }
      for (const mis of c.missingEvidence) {
        if (!existing.missingEvidence.includes(mis)) {
          existing.missingEvidence.push(mis);
        }
      }

      // Merge signals (deduplicate by signal name)
      for (const sig of c.confidence.signals) {
        const hasSig = existing.confidence.signals.some((s) => s.name === sig.name);
        if (!hasSig) {
          existing.confidence.signals.push(sig);
        }
      }

      // Recalculate confidence
      existing.confidence = calculateConfidence(existing.confidence.signals);

      // Select highest status
      if (STATUS_RANK[c.status] > STATUS_RANK[existing.status]) {
        existing.status = c.status;
        existing.assessmentLevel = c.assessmentLevel;
      }

      // If existing had no targetPath but candidate has targetPath, accept it
      if (!existing.targetPath && c.targetPath) {
        existing.targetPath = c.targetPath;
        existing.targetType = c.targetType;
      }
    }

    return Array.from(map.values());
  }

  private mergeAssessments(
    assessments: RootCauseAssessment[],
    candidates: CandidateContributor[]
  ): RootCauseAssessment[] {
    const map = new Map<string, RootCauseAssessment>();

    for (const a of assessments) {
      const existing = map.get(a.findingId);
      if (!existing) {
        map.set(a.findingId, {
          ...a,
          candidateIds: [...a.candidateIds],
          supportingEvidence: [...a.supportingEvidence],
          contradictingEvidence: [...a.contradictingEvidence],
          missingEvidence: [...a.missingEvidence]
        });
        continue;
      }

      // Merge candidate IDs
      for (const cid of a.candidateIds) {
        if (!existing.candidateIds.includes(cid)) {
          existing.candidateIds.push(cid);
        }
      }

      // Determine top candidate
      let topCand: CandidateContributor | undefined;
      for (const cid of existing.candidateIds) {
        const cand = candidates.find((c) => c.id === cid);
        if (cand && (!topCand || cand.confidence.score > topCand.confidence.score)) {
          topCand = cand;
        }
      }

      if (topCand) {
        existing.topCandidateId = topCand.id;
        existing.confidence = topCand.confidence;
        existing.status = topCand.status;
        existing.assessmentLevel = topCand.assessmentLevel;
      }

      // Merge evidence strings
      for (const sup of a.supportingEvidence) {
        if (!existing.supportingEvidence.includes(sup)) {
          existing.supportingEvidence.push(sup);
        }
      }
      for (const con of a.contradictingEvidence) {
        if (!existing.contradictingEvidence.includes(con)) {
          existing.contradictingEvidence.push(con);
        }
      }
      for (const mis of a.missingEvidence) {
        if (!existing.missingEvidence.includes(mis)) {
          existing.missingEvidence.push(mis);
        }
      }
    }

    return Array.from(map.values());
  }

  private getMaxFindingSeverity(findingIds: string[], findings: Finding[]): FindingSeverity {
    let maxSev: FindingSeverity = 'INFO';
    for (const fid of findingIds) {
      const f = findings.find((item) => item.id === fid);
      if (f && SEVERITY_RANK[f.severity] > SEVERITY_RANK[maxSev]) {
        maxSev = f.severity;
      }
    }
    return maxSev;
  }
}

/**
 * Pure helper function to execute correlation.
 */
export function correlate(
  evidence: ZyraEvidence,
  findings: Finding[],
  codebase: CodebaseEvidence,
  options?: CorrelationOptions
): CorrelationResult {
  const engine = new CorrelationEngine();
  return engine.correlate(evidence, findings, codebase, options);
}
