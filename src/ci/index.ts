/**
 * ZYRA CI / Regression Detection Subsystem
 *
 * Public API and Exports (Phase 09)
 */

export {
  CI_SCHEMA_VERSION,
  CI_EXIT_CODES,
  type CIExitStatus,
  type CIMetricBudget,
  type CIBudgetConfig,
  type CIBudgetEvaluation,
  type CIRegression,
  type CIBaseline,
  type CIRun,
  type CIPolicy,
  type CIComparisonSummary,
  type CIResult,
  type CIRunOptions
} from './types.js';

export {
  validateCIBaseline,
  validateCIResult,
  validateCIPolicy,
  validateCIBudgetConfig,
  CIValidationError
} from './validator.js';

export {
  createCIBaseline,
  loadCIBaseline,
  validateCIBaselineCompatibility,
  saveCIBaseline
} from './baseline.js';

export {
  SUPPORTED_BUDGET_METRICS,
  DEFAULT_BUDGET_CONFIG,
  normalizeMetricKey,
  parseBudgetConfig,
  evaluateBudgets
} from './budgets.js';

export {
  detectCIRegressions
} from './regression.js';

export {
  DEFAULT_CI_POLICY,
  evaluateCIPolicy,
  type PolicyEvaluationInput,
  type PolicyEvaluationResult
} from './policy.js';

export {
  formatCIReportTerminal,
  formatCIPRComment
} from './reporter.js';

export {
  runCI
} from './runner.js';
