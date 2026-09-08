/**
 * ZYRA Performance Budgets Engine
 *
 * Configurable, deterministic evaluation of Core Web Vitals and lab metrics against budgets.
 */

import * as fs from 'node:fs/promises';
import {
  type CIBudgetConfig,
  type CIBudgetEvaluation
} from './types.js';
import { validateCIBudgetConfig, CIValidationError } from './validator.js';

export interface MetricDefinition {
  name: string;
  unit: 'ms' | 'score';
  defaultGood: number;
}

export const SUPPORTED_BUDGET_METRICS: Record<string, MetricDefinition> = {
  lcp: { name: 'Largest Contentful Paint', unit: 'ms', defaultGood: 2500 },
  fcp: { name: 'First Contentful Paint', unit: 'ms', defaultGood: 1800 },
  cls: { name: 'Cumulative Layout Shift', unit: 'score', defaultGood: 0.10 },
  inp: { name: 'Interaction to Next Paint', unit: 'ms', defaultGood: 200 },
  tbt: { name: 'Total Blocking Time', unit: 'ms', defaultGood: 200 },
  speedIndex: { name: 'Speed Index', unit: 'ms', defaultGood: 3400 }
};

/**
 * Normalizes user-supplied metric keys (e.g. 'LCP', 'SpeedIndex', 'speed_index') into canonical keys.
 */
export function normalizeMetricKey(rawKey: string): string {
  const norm = rawKey.trim().toLowerCase();
  if (norm === 'lcp') return 'lcp';
  if (norm === 'fcp') return 'fcp';
  if (norm === 'cls') return 'cls';
  if (norm === 'inp') return 'inp';
  if (norm === 'tbt') return 'tbt';
  if (norm === 'speedindex' || norm === 'speed_index' || norm === 'speed index') return 'speedIndex';
  return norm;
}

/**
 * Default Web Vitals "Good" performance budgets.
 */
export const DEFAULT_BUDGET_CONFIG: CIBudgetConfig = {
  budgets: {
    lcp: 2500,
    fcp: 1800,
    cls: 0.10,
    inp: 200,
    tbt: 200,
    speedIndex: 3400
  }
};

/**
 * Parses and validates budget configuration from an object, raw JSON string, or file path.
 */
export async function parseBudgetConfig(input: unknown): Promise<CIBudgetConfig> {
  if (!input) {
    return DEFAULT_BUDGET_CONFIG;
  }

  let configObj: unknown = input;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{')) {
      try {
        configObj = JSON.parse(trimmed);
      } catch (err) {
        throw new CIValidationError(`Failed to parse inline budget JSON: ${(err as Error).message}`);
      }
    } else {
      // Treat as file path
      try {
        const fileContent = await fs.readFile(trimmed, 'utf-8');
        configObj = JSON.parse(fileContent);
      } catch (err) {
        throw new CIValidationError(`Failed to read budget config file at '${trimmed}': ${(err as Error).message}`);
      }
    }
  }

  if (!configObj || typeof configObj !== 'object') {
    throw new CIValidationError('Budget configuration must be a valid JSON object.');
  }

  const raw = configObj as Record<string, any>;

  // Normalize structure: support either { budgets: { ... } } or direct { LCP: 2500, ... }
  const rawBudgets = raw.budgets && typeof raw.budgets === 'object' ? raw.budgets : raw;

  const normalizedBudgets: Record<string, number | { max: number; warn?: number }> = {};
  for (const [key, val] of Object.entries(rawBudgets)) {
    const normKey = normalizeMetricKey(key);
    normalizedBudgets[normKey] = val as any;
  }

  return validateCIBudgetConfig({ budgets: normalizedBudgets });
}

/**
 * Pure deterministic evaluation of metrics against configured budgets.
 */
export function evaluateBudgets(
  metrics: Record<string, number | null>,
  config: CIBudgetConfig = DEFAULT_BUDGET_CONFIG
): {
  passed: boolean;
  evaluations: CIBudgetEvaluation[];
  violations: CIBudgetEvaluation[];
  warnings: CIBudgetEvaluation[];
} {
  const evaluations: CIBudgetEvaluation[] = [];
  const violations: CIBudgetEvaluation[] = [];
  const warnings: CIBudgetEvaluation[] = [];

  for (const [rawKey, budgetDef] of Object.entries(config.budgets)) {
    const normKey = normalizeMetricKey(rawKey);
    const meta = SUPPORTED_BUDGET_METRICS[normKey] || {
      name: normKey.toUpperCase(),
      unit: 'ms',
      defaultGood: 0
    };

    let budgetMax: number;
    let budgetWarn: number | undefined;

    if (typeof budgetDef === 'number') {
      budgetMax = budgetDef;
    } else {
      budgetMax = budgetDef.max;
      budgetWarn = budgetDef.warn;
    }

    const actual = metrics[normKey] ?? null;

    if (actual === null || typeof actual !== 'number') {
      evaluations.push({
        metric: normKey,
        name: meta.name,
        actual: null,
        budgetMax,
        budgetWarn,
        unit: meta.unit,
        status: 'NOT_AVAILABLE',
        delta: null,
        percentageOfBudget: null
      });
      continue;
    }

    const delta = actual - budgetMax;
    const percentageOfBudget = budgetMax > 0 ? (actual / budgetMax) * 100 : null;

    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (actual > budgetMax) {
      status = 'FAIL';
    } else if (budgetWarn !== undefined && actual > budgetWarn) {
      status = 'WARN';
    }

    const evaluation: CIBudgetEvaluation = {
      metric: normKey,
      name: meta.name,
      actual,
      budgetMax,
      budgetWarn,
      unit: meta.unit,
      status,
      delta,
      percentageOfBudget
    };

    evaluations.push(evaluation);

    if (status === 'FAIL') {
      violations.push(evaluation);
    } else if (status === 'WARN') {
      warnings.push(evaluation);
    }
  }

  // Deterministic sorting: violations first, then warnings, then passes
  evaluations.sort((a, b) => {
    const order = { FAIL: 0, WARN: 1, PASS: 2, NOT_AVAILABLE: 3 };
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    return a.metric.localeCompare(b.metric);
  });

  return {
    passed: violations.length === 0,
    evaluations,
    violations,
    warnings
  };
}
