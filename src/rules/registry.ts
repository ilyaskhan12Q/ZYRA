import { type PerformanceRule, type RuleCatalogEntry } from './types.js';
import { FCP_SLOW_RULE, FCP_CRITICAL_RULE } from './evaluators/metrics/fcp.js';
import { LCP_SLOW_RULE, LCP_CRITICAL_RULE } from './evaluators/metrics/lcp.js';
import { TBT_HIGH_RULE, TBT_CRITICAL_RULE } from './evaluators/metrics/tbt.js';
import { CLS_POOR_RULE } from './evaluators/metrics/cls.js';
import { SPEED_INDEX_SLOW_RULE } from './evaluators/metrics/speedIndex.js';
import { INP_SLOW_RULE } from './evaluators/metrics/inp.js';
import { UNUSED_JS_HIGH_RULE } from './evaluators/javascript/unusedJs.js';
import { LONG_TASK_RULE } from './evaluators/javascript/longTasks.js';
import { RENDER_BLOCKING_RULE } from './evaluators/network/renderBlocking.js';
import { LARGE_RESOURCE_RULE } from './evaluators/network/largeResource.js';
import { IMAGE_OPTIMIZATION_RULE, LARGE_IMAGE_RULE } from './evaluators/images/imageOpt.js';
import { FONT_RESOURCE_LARGE_RULE } from './evaluators/fonts/fontResource.js';

/**
 * Built-in default ruleset for Phase 03.
 * Explicitly registered to prevent hidden filesystem discovery.
 */
export const DEFAULT_RULES: readonly PerformanceRule[] = [
  FCP_SLOW_RULE,
  FCP_CRITICAL_RULE,
  LCP_SLOW_RULE,
  LCP_CRITICAL_RULE,
  TBT_HIGH_RULE,
  TBT_CRITICAL_RULE,
  CLS_POOR_RULE,
  SPEED_INDEX_SLOW_RULE,
  INP_SLOW_RULE,
  UNUSED_JS_HIGH_RULE,
  LONG_TASK_RULE,
  RENDER_BLOCKING_RULE,
  LARGE_RESOURCE_RULE,
  IMAGE_OPTIMIZATION_RULE,
  LARGE_IMAGE_RULE,
  FONT_RESOURCE_LARGE_RULE
];

/**
 * Explicit registry managing registered performance rules.
 */
export class RuleRegistry {
  private rules = new Map<string, PerformanceRule>();

  constructor(initialRules: readonly PerformanceRule[] = DEFAULT_RULES) {
    for (const rule of initialRules) {
      this.register(rule);
    }
  }

  /**
   * Register a new performance rule. Throws if a rule with the same ID already exists.
   */
  register(rule: PerformanceRule): void {
    if (!rule || typeof rule.id !== 'string') {
      throw new Error('Invalid rule: Rule must have a valid string ID.');
    }
    if (this.rules.has(rule.id)) {
      throw new Error(`Duplicate rule registration: Rule with ID '${rule.id}' is already registered.`);
    }
    this.rules.set(rule.id, rule);
  }

  /**
   * Retrieve a rule by its ID.
   */
  get(id: string): PerformanceRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Check if a rule ID is registered.
   */
  has(id: string): boolean {
    return this.rules.has(id);
  }

  /**
   * Unregister a rule by its ID.
   */
  unregister(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Get all registered rules.
   */
  getAll(): PerformanceRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Total number of registered rules.
   */
  get size(): number {
    return this.rules.size;
  }

  /**
   * Return a structured catalog of all registered rules.
   */
  getRuleCatalog(): RuleCatalogEntry[] {
    return this.getAll().map((rule) => ({
      id: rule.id,
      version: rule.version,
      category: rule.category,
      severity: rule.defaultSeverity,
      title: rule.title,
      description: rule.description,
      evidenceConsumed: [...rule.evidenceConsumed],
      thresholdSummary: rule.thresholdSummary,
      thresholdSource: rule.thresholdSource
    }));
  }
}
