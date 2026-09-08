# Current State

**Last Updated:** 2026-09-08  
**Current Phase:** Phase 09 — CI / Regression Detection  
**Current Task:** Phase 09 Completed — CI / Regression Detection Subsystem Implemented & Verified  
**Status:** Complete / Operational (CI Subsystem v1.0)  

---

## Completed
- **CI Contracts & Schema v1.0 (`src/ci/types.ts`):**
  - Formalized Schema Version 1.0 contracts: `CIResult`, `CIBaseline`, `CIPolicy`, `CIMetricBudget`, `CIBudgetConfig`, `CIBudgetEvaluation`, `CIRegression`, `CIExitStatus`, `CI_EXIT_CODES`.
  - Codified standard pipeline exit code mappings: `0 = PASS`, `1 = FAIL`, `2 = WARN`, `3 = INCONCLUSIVE`, `4 = MEASUREMENT_FAILED`.
  - Defined regression severity classifications: `CRITICAL` vs `WARNING`.
- **Deterministic Schema Validation (`src/ci/validator.ts`):**
  - Robust runtime type-checking and structural verification for `CIResult`, `CIBaseline`, `CIPolicy`, `CIBudgetConfig`.
  - Defined explicit `CIValidationError` with descriptive violation paths.
- **Baseline Creation, Storage & Compatibility (`src/ci/baseline.ts`):**
  - Creation of immutable `CIBaseline` snapshots containing raw evidence, findings, and metadata.
  - Safe persistence via atomic atomic file writes (`saveCIBaseline`).
  - Polymorphic loading supporting `CIBaseline`, `ZyraEvidence`, and raw Lighthouse LHR JSON (`loadCIBaseline`).
  - Strict compatibility validation enforcing URL origin/pathname alignment and identical device profiles (`mobile` vs `desktop`).
- **Performance Budget Engine (`src/ci/budgets.ts`):**
  - Metric budget evaluation with configurable `warnThreshold` and `failThreshold`.
  - Built-in defaults aligned with official Google Web Vitals "Good" criteria (LCP 2500ms, CLS 0.10, INP 200ms, FCP 1800ms, TBT 200ms).
  - Configurable budget configs supporting multiple metric rules with zero LLM guesswork.
- **Noise-Filtered Regression Detection (`src/ci/regression.ts`):**
  - Reuses Phase 08 empirical significance boundaries to prevent lab jitter false alarms.
  - Categorizes degraded metrics into `CRITICAL` (>2x significance threshold) and `WARNING` regressions.
  - Formats human-readable explanations including absolute delta and percentage degradation.
- **Deterministic Policy Engine (`src/ci/policy.ts`):**
  - Evaluates regressions, budget breaches, measurement errors, and baseline validity.
  - Deterministically computes `CIExitStatus` and exit code.
  - Evaluates `--fail-on-warn` and `--allow-missing-baseline` policy flags.
- **Dual Reporting Engine (`src/ci/reporter.ts`):**
  - Terminal formatted report with ASCII tables, color-coded badges, and clear exit codes (`formatCIReportTerminal`).
  - Rich GitHub PR comment markdown generation (`formatCIPRComment`) with status tables, budget evaluations, and next-action guidance.
- **High-Level CI Runner (`src/ci/runner.ts`):**
  - Complete orchestration pipeline (`runCI`) integrating baseline loading, live measurement or current snapshot analysis, budget evaluation, regression detection, policy enforcement, and reporting.
  - Safe error trapping mapping runtime exceptions to standard exit statuses.
- **CLI Commands (`src/cli/index.ts`):**
  - `zyra ci <url>`: Full CI check pipeline with `--baseline`, `--budget`, `--config`, `--output`, `--markdown-output`, `--fail-on-warn`, `--allow-missing-baseline`.
  - `zyra ci check <url>`: Alias for `zyra ci`.
  - `zyra ci baseline <url>`: Authoritative baseline capture with `--output`, `--mobile`, `--desktop`.
  - Process exit code routing matching CI specification (0, 1, 2, 3, 4).
- **GitHub Actions Workflow (`.github/workflows/zyra-ci.yml`):**
  - Reusable CI workflow running lint, typecheck, build, test, and baseline regression check.
  - Automatic `$GITHUB_STEP_SUMMARY` posting and artifact uploading.
- **Authoritative Documentation & Architecture:**
  - Full subsystem guide: `docs/CI-REGRESSION-ENGINE.md`.
  - Architecture decisions recorded in `.context/DECISIONS.md`: ADR-028 (CI Schema v1.0 & Exit Code Contracts), ADR-029 (Baseline Architecture & Compatibility Invariant), ADR-030 (Performance Budgeting Engine & Web Vitals Defaults).
  - Formalized Section 8 in `.context/CONTRACTS.md`.
  - Skill and CLI documentation in `SKILL.md` and `README.md`.
- **Automated Test Suite (320 passing tests across 87 suites):**
  - 51 dedicated Phase 09 CI tests across 10 suites in `tests/ci/`:
    - `contracts.test.ts`: Schema v1.0 validation and invariant rejection (7 tests).
    - `baseline.test.ts`: Baseline creation, saving, polymorphic loading, and compatibility checks (6 tests).
    - `budgets.test.ts`: Default Web Vitals budgets, custom budgets, warn/fail evaluation (5 tests).
    - `regression.test.ts`: Noise filtering, critical vs warning regression classification (4 tests).
    - `policy.test.ts`: Pure policy mapping, exit codes, fail-on-warn, allow-missing-baseline (5 tests).
    - `reporter.test.ts`: Terminal formatting and PR comment markdown output (5 tests).
    - `runner.test.ts`: End-to-end runner orchestration, mock and live paths (5 tests).
    - `cli.test.ts`: CLI argument parsing, flags, file generation, process exit codes (5 tests).
    - `security.test.ts`: Read-only execution, path traversal guards, corrupt JSON handling (4 tests).
    - `determinism.test.ts`: Purity, reproducibility, zero external network dependencies (5 tests).
  - Preserved all 269 Phase 01–08 tests without regression.

## In Progress
- None. Phase 09 is complete.

## Next
- **Phase 10 — Advanced CDP & Trace Profiling:** Chrome DevTools Protocol tracing, CPU flame graphs, main-thread long task breakdown, and memory leak analysis.

## Blocked
- None.

## Known Limitations
- Lab measurements run in controlled local environments (Lighthouse); field Core Web Vitals (RUM/CrUX) require real-user monitoring.
- Phase 09 provides non-destructive gating and PR reporting; automated fix rollbacks in CI must be invoked explicitly via Phase 07 rollback mechanisms.

## Last Verification
- `npm run typecheck`: Passed (0 errors)
- `npm run build`: Passed (Clean build in `dist/`)
- `npm test`: Passed (320 tests passing, 0 failing, 87 suites)
