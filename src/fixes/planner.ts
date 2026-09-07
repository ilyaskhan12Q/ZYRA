/**
 * ZYRA Fix Planner
 * Deterministically synthesizes evidence-backed FixPlans from Findings, CodebaseEvidence,
 * and Correlation candidates without modifying files.
 */

import {
  type FixCandidate,
  type FixPlan,
  type FixPlanningContext
} from './types.js';
import { FixStrategyRegistry } from './registry.js';
import { validateFixPlan } from './validator.js';
import { isProtectedFile } from './safety.js';

const RISK_WEIGHTS: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  BLOCKED: 4
};

export class FixPlanner {
  private readonly registry: FixStrategyRegistry;

  constructor(registry?: FixStrategyRegistry) {
    this.registry = registry ?? new FixStrategyRegistry();
  }

  /**
   * Plans all applicable fixes for the given investigation context.
   */
  async planFixes(context: FixPlanningContext): Promise<FixPlan[]> {
    const plans: FixPlan[] = [];
    const candidates = context.correlation.candidates;

    for (const candidate of candidates) {
      // 1. Skip external resources: No local modifications for external CDNs
      if (candidate.targetType === 'external_resource' || !candidate.targetPath) {
        continue;
      }

      // 2. Reject protected or sensitive files
      if (isProtectedFile(candidate.targetPath)) {
        continue;
      }

      // 3. Candidate must have supported status (SUPPORTED_CONTRIBUTOR or STRONGLY_SUPPORTED or POSSIBLE_CORRELATION)
      if (candidate.status === 'NO_CORRELATION' || candidate.status === 'INSUFFICIENT_EVIDENCE') {
        continue;
      }

      // Convert CandidateContributor to FixCandidate
      const fixCandidate: FixCandidate = {
        candidateId: candidate.id,
        targetPath: candidate.targetPath,
        targetName: candidate.targetName,
        targetType: candidate.targetType,
        reason: candidate.reasoning,
        evidenceRefs: [...candidate.supportingEvidence],
        findingRefs: [...candidate.findingIds],
        correlationRefs: candidate.links.map((l) => l.targetRef)
      };

      // 4. Evaluate registered strategies
      for (const strategy of this.registry.getAll()) {
        try {
          const canApply = await strategy.canApply(fixCandidate, context);
          if (!canApply) continue;

          const plan = await strategy.plan(fixCandidate, context);
          if (plan) {
            const validation = validateFixPlan(plan);
            if (validation.isValid) {
              plans.push(plan);
            }
          }
        } catch {
          // Fault-isolated execution: a failing strategy does not crash the planner
          continue;
        }
      }
    }

    // Deterministic sorting:
    // 1. Risk weight (LOW < MEDIUM < HIGH < BLOCKED)
    // 2. Candidate confidence score (descending)
    // 3. Plan ID (ascending)
    plans.sort((a, b) => {
      const riskA = RISK_WEIGHTS[a.risk] ?? 99;
      const riskB = RISK_WEIGHTS[b.risk] ?? 99;
      if (riskA !== riskB) {
        return riskA - riskB;
      }

      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      return a.planId.localeCompare(b.planId);
    });

    return plans;
  }
}

/**
 * High-level helper to plan fixes.
 */
export async function planFixes(context: FixPlanningContext): Promise<FixPlan[]> {
  const planner = new FixPlanner();
  return planner.planFixes(context);
}
