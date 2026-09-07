import { type ZyraEvidence } from '../evidence/types.js';
import {
  type Finding,
  type FindingSeverity,
  type RuleCategory,
  type RuleExecutionError
} from './types.js';
import { RuleRegistry } from './registry.js';

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  WARNING: 2,
  INFO: 1
};

const CATEGORY_WEIGHTS: Record<RuleCategory, number> = {
  metrics: 1,
  javascript: 2,
  rendering: 3,
  network: 4,
  images: 5,
  fonts: 6,
  resources: 7
};

export interface EvaluateOptions {
  /**
   * If true, throws if any individual rule encounters an execution error.
   * Defaults to false (records structured error without crashing the engine).
   */
  strict?: boolean;
}

export interface DetailedEvaluationResult {
  findings: Finding[];
  errors: RuleExecutionError[];
}

/**
 * Deterministic Performance Rule Engine.
 *
 * Evaluates ZyraEvidence models against registered PerformanceRules to produce
 * structured, reproducible Findings.
 */
export class RuleEngine {
  private registry: RuleRegistry;
  private lastErrors: RuleExecutionError[] = [];

  constructor(registry?: RuleRegistry) {
    this.registry = registry ?? new RuleRegistry();
  }

  /**
   * Get the underlying rule registry.
   */
  getRegistry(): RuleRegistry {
    return this.registry;
  }

  /**
   * Retrieve any errors recorded during the most recent evaluation.
   */
  getLastErrors(): readonly RuleExecutionError[] {
    return this.lastErrors;
  }

  /**
   * Evaluates evidence against all registered rules.
   * Returns a deterministically sorted, deduplicated array of Findings.
   */
  evaluate(evidence: ZyraEvidence, options?: EvaluateOptions): Finding[] {
    const { findings, errors } = this.evaluateDetailed(evidence, options);
    if (options?.strict && errors.length > 0) {
      throw new Error(
        `Rule engine evaluation failed with ${errors.length} rule error(s):\n${errors.map((e) => `[${e.ruleId}] ${e.message}`).join('\n')}`
      );
    }
    return findings;
  }

  /**
   * Detailed evaluation returning both findings and any isolated rule execution errors.
   */
  evaluateDetailed(
    evidence: ZyraEvidence,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: EvaluateOptions
  ): DetailedEvaluationResult {
    this.lastErrors = [];
    const collectedFindings: Finding[] = [];
    const seenFindingIds = new Set<string>();
    const rules = this.registry.getAll();

    for (const rule of rules) {
      try {
        const results = rule.evaluate(evidence);
        if (Array.isArray(results)) {
          for (const finding of results) {
            if (!finding || typeof finding !== 'object' || !finding.id) {
              continue;
            }
            if (!seenFindingIds.has(finding.id)) {
              seenFindingIds.add(finding.id);
              collectedFindings.push(finding);
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        this.lastErrors.push({
          ruleId: rule.id,
          message,
          stack
        });
      }
    }

    // Deterministic sorting strategy:
    // 1. Severity: CRITICAL > HIGH > WARNING > INFO
    // 2. Category: metrics > javascript > rendering > network > images > fonts > resources
    // 3. Rule ID (alphabetical)
    // 4. Finding ID (alphabetical)
    collectedFindings.sort((a, b) => {
      const sevA = SEVERITY_WEIGHTS[a.severity] ?? 0;
      const sevB = SEVERITY_WEIGHTS[b.severity] ?? 0;
      if (sevA !== sevB) {
        return sevB - sevA; // higher severity first
      }

      const catA = CATEGORY_WEIGHTS[a.category] ?? 99;
      const catB = CATEGORY_WEIGHTS[b.category] ?? 99;
      if (catA !== catB) {
        return catA - catB; // lower category weight first
      }

      const ruleCmp = a.ruleId.localeCompare(b.ruleId);
      if (ruleCmp !== 0) {
        return ruleCmp;
      }

      return a.id.localeCompare(b.id);
    });

    return {
      findings: collectedFindings,
      errors: [...this.lastErrors]
    };
  }
}
