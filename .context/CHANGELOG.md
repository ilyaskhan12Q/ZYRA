# ZYRA — Changelog

All notable changes to the ZYRA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.9.3] - 2026-09-08

### Added
- Open-source contributor guide ([`CONTRIBUTING.md`](CONTRIBUTING.md)) with development setup and PR guidelines.
- Contributor Covenant Code of Conduct ([`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)) version 2.1.
- Documentation and architecture index in `README.md`.

### Changed
- Refactored `README.md` for production readiness, removing internal milestone tracking.
- Bumped version to `0.9.3`.

## [0.9.0] - 2026-09-08

### Added
- **CI / Regression Detection Subsystem (`src/ci/`):**
  - Formalized Schema Version 1.0 contracts: `CIResult`, `CIBaseline`, `CIPolicy`, `CIMetricBudget`, `CIBudgetConfig`, `CIBudgetEvaluation`, `CIRegression`, and `CIExitStatus` (`src/ci/types.ts`).
  - Defined controlled exit statuses (`PASS`, `WARN`, `FAIL`, `INCONCLUSIVE`, `MEASUREMENT_FAILED`) mapped to stable exit codes (`0`, `1`, `2`, `3`, `4`).
  - Implemented schema validator `validateCIResult()`, `validateCIBaseline()`, `validateCIPolicy()`, `validateCIBudgetConfig()` (`src/ci/validator.ts`).
  - Implemented baseline management engine (`src/ci/baseline.ts`):
    - Authoritative baseline persistence (`createCIBaseline`, `saveCIBaseline`).
    - Flexible baseline loading supporting `CIBaseline`, raw `ZyraEvidence`, and raw Lighthouse LHR JSON (`loadCIBaseline`).
    - Strict compatibility validation enforcing URL origin/pathname and device profile consistency (`validateCIBaselineCompatibility`).
  - Implemented configurable performance budgets engine (`src/ci/budgets.ts`):
    - Official Google Web Vitals "Good" criteria defaults (LCP: 2500ms, FCP: 1800ms, CLS: 0.10, INP: 200ms, TBT: 200ms, SpeedIndex: 3400ms).
    - Supports numeric thresholds and detailed objects with warning limits.
    - Deterministic evaluation computing absolute and percentage budget deltas.
  - Implemented regression detection engine (`src/ci/regression.ts`):
    - Reuses Phase 08 noise boundaries and significance policy to eliminate lab jitter false alarms.
    - Classifies regressions into `CRITICAL` (Core Web Vitals or budget-breaching metrics) and `WARNING` (secondary metrics).
  - Implemented deterministic policy engine (`src/ci/policy.ts`):
    - Maps measurement failures, incompatible baselines, budget violations, and regressions directly to exit codes.
    - Supports `--fail-on-warn` escalation and `--allow-missing-baseline`.
  - Implemented CI reporter (`src/ci/reporter.ts`):
    - Aligned human-readable terminal summary table.
    - GitHub-flavored PR Markdown comment table with status emojis and badge summaries.
  - Implemented high-level CI runner (`src/ci/runner.ts`):
    - Coordinates live headless browser measurements or offline pre-captured telemetry (`--current`).
- **CLI Commands & Flags (`src/cli/index.ts`):**
  - Added `zyra ci <url> [options]`, alias `zyra ci check <url> [options]`.
  - Added `zyra ci baseline <url> [options]`.
  - Added flags: `--baseline`, `--budget`, `--config`, `--output`, `--markdown-output`, `--current`, `--fail-on-warn`, `--allow-missing-baseline`.
  - Exits with deterministic exit codes matching CI status (0, 1, 2, 3, 4).
- **GitHub Actions Integration:**
  - Added production-ready workflow `.github/workflows/zyra-ci.yml` running lint, build, test, and automated CI performance check with artifact upload and `$GITHUB_STEP_SUMMARY` reporting.
- **Documentation & Architecture Decisions:**
  - Added comprehensive subsystem guide `docs/CI-REGRESSION-ENGINE.md`.
  - Added ADR-028 (*Deterministic CI Performance Budgets and Regression Detection Policy*), ADR-029 (*Stable Controlled CI Exit Codes and Status Model*), and ADR-030 (*PR-Oriented Reporting and Baseline Provenance Invariants*) in `.context/DECISIONS.md`.
  - Added Section 8 in `.context/CONTRACTS.md`.
- **Automated Test Suite (320 passing tests across 87 suites):**
  - Added 51 new automated tests across contracts, baseline, budgets, regression, policy, reporter, runner, CLI, security, and determinism.
  - Preserved 100% regression stability across all 269 Phase 01–08 tests.

## [0.8.0] - 2026-09-06

### Added
- **Post-Fix Verification & Optimization Loop Subsystem (`src/verification/`):**
  - Formalized Schema Version 1.0 contracts: `VerificationResult`, `MeasurementSnapshot`, `ComparisonResult`, `MetricDelta`, `TargetVerification`, `VerificationProvenance`, and `RepeatedRunSummary` (`src/verification/types.ts`).
  - Defined controlled verification statuses (`VERIFIED_IMPROVEMENT`, `VERIFIED_NO_IMPROVEMENT`, `REGRESSION_DETECTED`, `INCONCLUSIVE`, `MEASUREMENT_FAILED`).
  - Defined deterministic optimization decisions (`KEEP_FIX`, `ROLLBACK_RECOMMENDED`, `NO_ACTION`, `RETRY_NOT_RECOMMENDED`, `INCONCLUSIVE`).
  - Codified the central architectural invariant: `APPLIED != IMPROVED` (code changes do not constitute proof of performance gains).
  - Implemented schema validator `validateVerificationResult()` (`src/verification/validator.ts`).
  - Implemented deterministic significance & noise filtering policy (`src/verification/significance.ts`):
    - Established explicit jitter boundaries for Core Web Vitals (LCP, CLS, INP, FCP, TBT, Speed Index).
    - Filters routine lab variance (e.g. LCP deltas under 100ms or 3%) as `UNCHANGED`.
  - Implemented measurement compatibility validator (`src/verification/compatibility.ts`):
    - Validates matching origins and normalized pathnames.
    - Strictly rejects cross-profile comparisons (mobile vs desktop).
  - Implemented pure deterministic metric comparator (`src/verification/comparator.ts`):
    - Pure calculation of absolute deltas and percentage changes.
    - Categorizes metrics into improvements, regressions, and unchanged.
    - Preserves unmeasured metrics as `NOT_AVAILABLE` without fabrication.
  - Implemented cryptographic code state validator (`src/verification/code-state.ts`):
    - Verifies workspace files match SHA-256 hashes from `FixResult.audit.newHashes`.
    - Detects code drift and surfaces inconclusive status when files differ.
  - Implemented Verification Engine (`src/verification/verifier.ts`):
    - Target-finding specific verification (evaluating bottleneck addressed by fix).
    - Comprehensive regression detection across all metrics.
    - Recommends `ROLLBACK_RECOMMENDED` upon any detected regression.
    - Supports bounded repeated measurements ($1 \le n \le 5$, no infinite loops).
- **CLI Commands (`src/cli/index.ts`):**
  - Added `zyra verify <url> --workspace <path> --baseline <file> [options]`.
  - Added `zyra fix verify <fix-result-file> --url <url> --workspace <path> [options]`.
  - Formatted human terminal comparison table and machine-readable `--json` Schema v1.0 output.
- **Documentation & Architecture Decision Records:**
  - Added comprehensive subsystem guide: `docs/VERIFICATION-ENGINE.md`.
  - Added Architecture Decision Records in `.context/DECISIONS.md`:
    - ADR-024 (*Empirical Before/After Verification Required for Optimization Claims*).
    - ADR-025 (*Deterministic Significance & Noise Boundaries for Metric Deltas*).
    - ADR-026 (*Comprehensive Regression Safety & Optimization Decision Matrix*).
    - ADR-027 (*Bounded Measurement Repetition without Infinite Loops*).
  - Formalized Section 7 in `.context/CONTRACTS.md`.
- **Automated Test Suite (269 passing tests across 77 suites):**
  - 44 new tests added across contracts, compatibility, significance, comparator, code state, lifecycle fixtures, repeated runs, and CLI.
  - Preserved 100% regression stability across all 225 Phase 01–07 tests.

## [0.7.0] - 2026-09-06

### Added
- **Automated Fix Planning & Safe Code Modifications Subsystem (`src/fixes/`):**
  - Formalized Schema Version 1.0 fix contracts: `FixPlan`, `FixCandidate`, `FixStrategy`, `FixOperation`, `FixSafetyCheck`, `FixPrecondition`, `FixRollbackInfo`, `FixResult`, and `FixAuditRecord` (`src/fixes/types.ts`).
  - Defined controlled risk levels (`LOW`, `MEDIUM`, `HIGH`, `BLOCKED`) and non-guaranteed expected impact descriptions.
  - Implemented schema validator `validateFixPlan()` and `validateFixResult()` (`src/fixes/validator.ts`).
  - Implemented multi-layered safety guards (`src/fixes/safety.ts`):
    - Path traversal rejection and canonical workspace containment.
    - Symlink escape detection.
    - Protected file exclusion (`.env*`, `*.pem`, `*.key`, `id_rsa*`, credentials, lockfiles, `tsconfig.json`).
    - Optimistic concurrency content guard (SHA-256) halting execution on `PLAN_STALE`.
    - Binary file detection and protection prohibiting naive text replacements on binary assets.
  - Implemented explicit, versioned `FixStrategyRegistry` (`src/fixes/registry.ts`) and 6 built-in strategies (`src/fixes/strategies/`):
    - `FIX_IMAGE_OPTIMIZATION` (v1.0, LOW): Prioritizes LCP image loading with `fetchpriority="high"` and markup hints; safely constrains binary operations.
    - `FIX_RENDER_BLOCKING_RESOURCE` (v1.0, LOW): Defers non-critical scripts (`defer`) or preloads stylesheets in entry HTML.
    - `FIX_LARGE_FONT` (v1.0, LOW): Injects `font-display: swap;` into matching `@font-face` rules.
    - `FIX_UNUSED_IMPORT` (v1.0, LOW): Surgically removes provably unused static imports in source code.
    - `FIX_SAFE_DYNAMIC_IMPORT` (v1.0, MEDIUM): Converts heavy non-critical components to dynamic imports (`React.lazy` / `next/dynamic`).
    - `FIX_RESOURCE_REFERENCE` (v1.0, LOW): Inserts `<link rel="preload">` hints for critical early resources.
  - Implemented deterministic `FixPlanner` (`src/fixes/planner.ts`):
    - Synthesizes evidence-backed `FixPlan`s from browser findings, codebase evidence, and correlation candidates.
    - Automatically filters out external CDN resources (no local modifications for external assets).
    - Enforces 100% determinism across repeated planning runs.
  - Implemented transactional `FixExecutor` (`src/fixes/executor.ts`):
    - Simulation mode (`--dry-run`): validates and calculates proposed replacements with zero filesystem modifications.
    - Preflight validation of all operations, paths, and content hashes.
    - Transactional rollback journal: restores all modified files to pre-operation state if any operation fails.
    - Emits tamper-evident `FixAuditRecord` logging original and new content hashes.
    - Enforces strict verification boundary: outputs `VERIFICATION: NOT YET PERFORMED` (Phase 08 boundary).
- **CLI Commands (`src/cli/index.ts`):**
  - Added `zyra fix catalog [--json]`.
  - Added `zyra fix plan <url> --workspace <path> [--json]`.
  - Added `zyra fix apply <plan-file> --workspace <path> [--dry-run] [--json] [--allow-high-risk]`.
  - Formatted human terminal summaries adhering to specifications.
- **Documentation & Architecture Decision Records:**
  - Added comprehensive subsystem guide: `docs/FIX-ENGINE.md`.
  - Added Architecture Decision Records in `.context/DECISIONS.md`:
    - ADR-019 (*Fix Planning Separated from Execution*).
    - ADR-020 (*Content Hash Guard & Optimistic Concurrency for Safe Modifications*).
    - ADR-021 (*Transactional Modification Journal and Rollback Safety*).
    - ADR-022 (*Explicit Strategy Registry and Deterministic Preconditions*).
    - ADR-023 (*Phase 07 Verification Boundary: No Unverified Claims*).
  - Updated `SKILL.md` and `docs/AGENT-SKILL.md`.
- **Automated Test Suite (225 passing tests across 69 suites):**
  - 45 new tests added across contracts, safety, registry, planner, executor, strategies, and CLI.
  - Verified 100% regression stability preserving all 180 previous tests.

## [0.6.0] - 2026-09-06

### Added
- **Agent Skill Specification (`SKILL.md`):**
  - Released ZYRA Skill Version 1.0 packaged with YAML frontmatter conforming to AI agent skill specifications.
  - Formulated full 9-stage Core Loop availability matrix: stages 1–5 (Measure, Evidence, Analyze, Trace, Diagnose) operational; Stage 6 (Fix) strictly deferred to Phase 07.
  - Documented `/zyra` command interface and semantics for empirical measurement, codebase scanning, and correlation analysis.
  - Defined explicit boundaries prohibiting unsupported future commands (`--fix`, `--patch`, `--rollback`, `--compare`).
  - Defined Command Routing, PATH resolution (`npm link`, `~/.local/bin/zyra`, `npx zyra`), and troubleshooting for `zyra: command not found`.
  - Formalized Workspace Discovery separating the ZYRA tool repository from user target application workspaces.
  - Codified Target Workspace Safety: untrusted data boundary, zero code execution inside target, and strict read-only guarantee.
  - Reinforced Secret Protection excluding `.env*`, `*.pem`, `*.key`, `id_rsa*`.
  - Codified 6-tier Evidence Interpretation hierarchy (`OBSERVED FACT`, `DETERMINISTIC FINDING`, `CORRELATION`, `CANDIDATE CONTRIBUTOR`, `ROOT-CAUSE ASSESSMENT`, `HYPOTHESIS`).
  - Outlined Deep Investigation Workflow and standardized Agent Response Template.
- **Agent Skill Technical Specification (`docs/AGENT-SKILL.md`):**
  - Detailed system architecture showing the AI Coding Agent $\to$ `/zyra` $\to$ Agent Skill $\to$ ZYRA CLI $\to$ Core Engines integration flow.
  - Documented execution resolution, environment contracts, and structured JSON contracts.
- **CLI Packaging & Working-Directory Independence:**
  - Extended CLI in `src/cli/index.ts` with extracted `runCli()` and `/zyra` command prefix handling.
  - Updated `src/context/loader.ts` (`findProjectRoot`) with `getPackageRoot()` fallback when executed from `/tmp` or target workspaces.
  - Configured `package.json` with version `0.6.0`, `bin` mapping (`"zyra": "./dist/src/cli/index.js"`), `files` whitelist including `docs`, and `postbuild` script ensuring `chmod +x`.
- **Automated Test Suite (`tests/agent/skill.test.ts`):**
  - Added 17 automated tests across 6 suites verifying skill integrity, mandatory sections, no phantom commands, working-directory independence from `/tmp`, and target workspace read-only safety.
  - Total repository tests increased to 180 passing tests across 46 suites.
- **Decisions:**
  - Added ADR-017 (*Agent Skill Packaging and `/zyra` Command Interface Layer*).
  - Added ADR-018 (*Working-Directory Independence & CLI Executable Resolution*).

---

## [0.5.0] - 2026-09-06

### Added
- **Evidence Correlation & Root-Cause Analysis Subsystem (`src/correlation/`):**
  - Formalized `CorrelationResult`, `CandidateContributor`, `EvidenceLink`, and `RootCauseAssessment` contracts adhering to Schema v1.0 (`src/correlation/types.ts`).
  - Implemented controlled correlation statuses (`NO_CORRELATION`, `POSSIBLE_CORRELATION`, `SUPPORTED_CONTRIBUTOR`, `STRONGLY_SUPPORTED`, `INSUFFICIENT_EVIDENCE`) and conservative assessment levels (`OBSERVED`, `CORRELATED`, `SUPPORTED_CONTRIBUTOR`, `STRONGLY_SUPPORTED_CONTRIBUTOR`, `UNKNOWN`).
  - Implemented URL/path normalizer with bundler hash stripping (`src/correlation/matching/urlMatcher.ts`).
  - Implemented asset served-path matcher with exact, probable, ambiguous, and unmatched handling (`src/correlation/matching/assetMatcher.ts`).
  - Implemented framework static and dynamic route pattern matcher (`src/correlation/matching/routeMatcher.ts`).
  - Implemented script, entry point, and dependency matcher (`src/correlation/matching/scriptMatcher.ts`).
  - Implemented deterministic confidence model (`src/correlation/confidence.ts`) with bounded scores (`[0.0, 1.0]`), transparent additive signals, contradiction penalties (e.g. cached transfers), and missing evidence penalties.
  - Implemented 6 deterministic correlation rules (`src/correlation/rules/`):
    - `CORR_IMAGE_ASSET` (v1.0): LCP element audit and image payload correlation.
    - `CORR_FONT_ASSET` (v1.0): Font transfer and font CDN correlation.
    - `CORR_RENDER_BLOCKING` (v1.0): Render-blocking delay and stylesheet/script correlation.
    - `CORR_SCRIPT_IMPORT` (v1.0): Script and execution correlation with source map availability checks.
    - `CORR_RESOURCE_ASSET` (v1.0): Generic large network payload correlation.
    - `CORR_ROUTE_ENTRY` (v1.0): Non-causal active route and entry-point hierarchy context.
  - Implemented `CorrelationRegistry` with duplicate ID prevention (`src/correlation/registry.ts`).
  - Implemented `CorrelationEngine` with candidate deduplication, fault-isolated rule execution, and strict deterministic sorting (`src/correlation/engine.ts`).
  - Implemented Schema v1.0 validator `validateCorrelationResult()` (`src/correlation/validator.ts`).
- **CLI & Output Integration (`src/cli/index.ts`):**
  - Added support for `--workspace <path>` and `--codebase <path>` flags on `zyra <url>`.
  - Added explicit command `zyra analyze <url> --workspace <path>`.
  - Added structured human terminal sections for `PERFORMANCE EVIDENCE`, `FINDINGS`, `CODEBASE EVIDENCE`, and `CORRELATION ANALYSIS` (Candidate Contributors and Root-Cause Assessments).
  - Extended `--json` output with backward-compatible schema containing `codebaseEvidence`, `correlation`, and `correlations`.
- **Test Suite & Scenarios (`tests/correlation/`):**
  - 52 new tests added across 7 test suites: matching, confidence, rules, negative, determinism, validator, and realistic scenario fixtures (Fixtures A–F).
  - Total passing tests across repository increased to 163/163 across 40 suites.
- **Documentation & Decisions:**
  - Added comprehensive subsystem guide: `docs/CORRELATION-ENGINE.md`.
  - Added Architecture Decision Records: ADR-015 (*Browser Long Tasks Definition vs. ZYRA Severity Thresholds*) and ADR-016 (*Deterministic Multi-Signal Evidence Correlation & Conservative Causality*).
  - Updated `README.md`, `SKILL.md`, and all `.context/` documents.

---

## [0.4.0] - 2026-09-06

### Added
- **Codebase Investigation Subsystem (`src/codebase/`):**
  - Formalized `CodebaseEvidence` contract (`src/codebase/types.ts`) adhering to Schema v1.0.
  - Implemented safe, deterministic workspace traversal (`src/codebase/traversal.ts`) with canonical path containment, POSIX normalization, symlink escape protection (`SYMLINK_OUTSIDE_WORKSPACE`), secret file exclusion (`.env*`, `*.pem`, `*.key`, `id_rsa`), and a 512 KB per-file in-memory limit (`FILE_SIZE_LIMIT_EXCEEDED`).
  - Implemented multi-signal framework detection (`src/codebase/detector/framework.ts`) covering Next.js (App & Pages Routers), Vite pairings (React, Vue, Svelte), Nuxt, SvelteKit, Astro, Angular, with confidence scoring (`detected`, `probable`, `ambiguous`, `unknown`).
  - Implemented package manager detector (`src/codebase/detector/packageManager.ts`) identifying npm, pnpm, yarn, bun, and detecting lockfile conflicts (`LOCKFILE_CONFLICT`).
  - Implemented runtime detector (`src/codebase/detector/runtime.ts`) identifying declared Node engines from `package.json`, `.nvmrc`, `.node-version`.
  - Implemented deterministic route extraction (`src/codebase/detector/routes.ts`) for App Router (stripping route groups), Pages Router, SvelteKit, and Astro.
  - Implemented entry point detector (`src/codebase/detector/entryPoints.ts`) locating root layouts, client entry points, and main components.
  - Implemented dependency analyzer (`src/codebase/analyzer/dependencies.ts`) categorizing production, development, peer, and optional dependencies.
  - Implemented static asset inventory (`src/codebase/analyzer/assets.ts`) classifying images, fonts, stylesheets, and media.
  - Implemented deterministic import analyzer (`src/codebase/analyzer/imports.ts`) extracting static imports, side-effect imports, dynamic imports, and unresolved specifiers without code execution.
  - Implemented build configuration inspector (`src/codebase/analyzer/config.ts`) supporting string-aware JSONC parsing of `tsconfig.json` path aliases and build config source map inspection.
  - Implemented schema validator (`src/codebase/validator.ts`) and scanner orchestrator (`src/codebase/scanner.ts`).
- **CLI & Output Integration (`src/cli/index.ts`):**
  - Added `zyra codebase <path>` and alias `zyra inspect <path>` commands.
  - Built structured human-readable terminal summary covering workspace stats, framework, package manager, dependencies, routes, entry points, assets, build config, and warnings.
  - Extended `--json` support for codebase commands emitting valid `CodebaseEvidence` JSON.
- **Synthetic Fixtures & Testing (`tests/codebase/`, `fixtures/codebase/`):**
  - Created 5 synthetic project fixtures: `next-app`, `vite-react`, `vue-app`, `ambiguous-fixture`, `security-fixture`.
  - Added 25 unit and security tests across 4 test suites verifying traversal safety, secrets exclusion, framework detection, route extraction, determinism, and contract validation.
  - Updated CLI tests in `tests/cli/cli.test.ts`. Total passing tests across repo increased to 111/111 across 26 suites.
- **Documentation:**
  - Added comprehensive subsystem guide: `docs/CODEBASE-INVESTIGATION.md`.
  - Added Architecture Decision Records: ADR-013 (*Read-Only Target Workspace Scanning & Secret Exclusion*) and ADR-014 (*Deterministic Framework Confidence & Multi-Signal Detection*).
  - Updated `README.md`, `SKILL.md`, and all `.context/` documents.

---

## [0.3.0] - 2026-09-06

### Added
- **Finding & PerformanceRule Contracts (`src/rules/types.ts`):**
  - Formalized `Finding` (Schema v1.0) and `PerformanceRule` interfaces.
  - Implemented controlled severities (`INFO`, `WARNING`, `HIGH`, `CRITICAL`) and deterministic confidence (`DETERMINISTIC`).
  - Added exact evidence references (`evidenceRefs`) mapping findings back to empirical browser facts.
- **Centralized Threshold Definitions (`src/rules/thresholds.ts`):**
  - Sourced and documented all thresholds from authoritative standards: Google Web Vitals, Lighthouse distributions, and explicit ZYRA heuristics.
  - Zero magic numbers across evaluator logic.
- **16 Deterministic Performance Rules (`src/rules/evaluators/`):**
  - Metrics: `FCP_SLOW`, `FCP_CRITICAL`, `LCP_SLOW`, `LCP_CRITICAL`, `TBT_HIGH`, `TBT_CRITICAL`, `CLS_POOR` (with strict `CLS = 0` valid handling), `SPEED_INDEX_SLOW`, `INP_SLOW` (with strict null safety).
  - JavaScript: `UNUSED_JS_HIGH` (>100 KB wasted code), `LONG_TASK` (>200ms single or >500ms total main-thread duration).
  - Rendering & Network: `RENDER_BLOCKING_RESOURCE` (>0ms paint delay), `LARGE_RESOURCE` (>500 KB payload).
  - Images & Fonts: `IMAGE_OPTIMIZATION_OPPORTUNITY` (>100 KB potential savings), `LARGE_IMAGE` (>500 KB transfer), `FONT_RESOURCE_LARGE` (>100 KB transfer).
- **Rule Registry (`src/rules/registry.ts`):**
  - Explicit registry with duplicate rule ID rejection.
  - Exposes machine-readable rule catalog via `getRuleCatalog()`.
- **Deterministic Rule Engine (`src/rules/engine.ts`):**
  - Pure, side-effect free evaluation.
  - Automatic finding deduplication by ID.
  - Strict deterministic sorting: `CRITICAL` > `HIGH` > `WARNING` > `INFO` -> category weight -> rule ID -> finding ID.
  - Fault-isolated execution protecting engine stability if any single evaluator throws.
- **CLI & Output Integration (`src/cli/index.ts`):**
  - Extended `zyra <url>` to render distinct `PERFORMANCE EVIDENCE` and `FINDINGS` sections.
  - Extended `--json` output with backwards-compatible schema containing `findings` and `findingSchemaVersion: "1.0"`.
  - Added `zyra rules` and `zyra rules --json` commands to inspect the active rule catalog.
- **Comprehensive Test Harness (`tests/rules/`):**
  - 82/82 passing tests across 22 suites (unit, boundary, determinism, registry, CLI integration).
  - Verified 100% deterministic output across repeated runs on identical evidence.
- **Documentation:**
  - Added complete subsystem guide: `docs/RULE-ENGINE.md`.
  - Updated `README.md`, `SKILL.md`, and `.context/` (ADR-010, ADR-011, ADR-012).

---

## [0.2.0] - 2026-09-05

### Added
- **Node 22+ Runtime:** Configured Node.js `>=22.0.0` engine requirement for Lighthouse v13 compatibility while preserving target project isolation.
- **Lighthouse Subsystem (`src/lighthouse/`):**
  - Integrated `lighthouse` (13.4.1) and `chrome-launcher` (1.2.1).
  - Implemented `runLighthouse` with lifecycle management ensuring Chrome termination in all scenarios.
  - Added support for `mobile` (412x823, 4G throttling, default) and `desktop` (1350x940) device profiles.
  - Implemented custom error hierarchy: `InvalidUrlError`, `ChromeLaunchError`, `LighthouseTimeoutError`, `LighthouseExecutionError`.
- **Evidence Engine (`src/evidence/`):**
  - Implemented deterministic normalizer (`normalizer.ts`) standardizing all time-based metrics strictly into milliseconds (`ms`) and layout shift into unitless score.
  - Preserved unmeasured metrics explicitly as `null` without zero coercion (especially for INP).
  - Preserved complete audit collections with stable audit IDs and source traceability mappings.
  - Extracted structured network requests, resource summary, scripts (with unused bytes), images (with potential savings), fonts, and long tasks.
  - Implemented contract validator (`validator.ts`) enforcing non-negative timings, bounded scores, and schema integrity.
  - Implemented `collectEvidence` pipeline coordinating runner, normalizer, and validator.
- **CLI Enhancement (`src/cli/`):**
  - Extended CLI to support empirical measurement: `zyra <url> [--mobile | --desktop] [--json] [--timeout]`.
  - Implemented clean, user-friendly human-readable evidence summary.
  - Implemented machine-readable JSON output (Schema v1.0).
  - Added graceful, descriptive error handling without raw stack traces.
- **Fixtures & Tests:**
  - Added synthetic test fixtures: `fixtures/lighthouse/synthetic-mobile.json`, `synthetic-desktop.json`.
  - Added offline unit tests for normalizer, validator, and runner.
  - Added end-to-end integration tests running real headless Chrome against local HTTP servers.
  - 30/30 tests passing across 6 test suites.
- **Documentation:**
  - Added subsystem guide: `docs/EVIDENCE-ENGINE.md`.
  - Updated `README.md`, `SKILL.md`, `docs/FOUNDATION.md`.
  - Updated `.context/` architecture, contracts, decisions (ADR-007, ADR-008, ADR-009), tasks, and current state.

---

## [0.1.0] - 2026-09-05

### Added
- **Project Foundation:** Initialized repository for ZYRA as an agent-native web performance investigation tool.
- **Persistent Context System:** Established and verified the complete `.context/` memory architecture:
  - `MISSION.md`: North star, evidence-first doctrine, core loop, and non-goals.
  - `PROJECT.md`: Identity, runtime, package manager, and phase status.
  - `ARCHITECTURE.md`: Layer responsibilities and strict boundaries.
  - `CURRENT_STATE.md`: Standard tracking schema for session continuity.
  - `ROADMAP.md`: Sequential roadmap across Phases 01 to 10.
  - `DECISIONS.md`: Initial Architecture Decision Records (ADR-001 through ADR-006).
  - `RULES.md`: 15 permanent engineering rules.
  - `CONTRACTS.md`: Data contracts separating facts, hypotheses, actions, and verification.
  - `TASKS.md`: Phase 01 task board.
  - `CHANGELOG.md`: Chronological development tracking.
- **Configuration & Scaffolding:** Strict TypeScript configuration (`tsconfig.json`), npm package definition (`package.json`), hygiene rules (`.gitignore`), and MIT license (`LICENSE`).
- **Context Loader:** Filesystem-based discovery, document integrity validation, and structured parser (`src/context/loader.ts`, `src/context/types.ts`).
- **CLI Skeleton:** Initial executable CLI with `zyra context` (formatted terminal summary) and `zyra context --json` (`src/cli/index.ts`).
- **Documentation & Skills:** Detailed foundation rationale and 5-tier Accuracy Model (`docs/FOUNDATION.md`), public guide (`README.md`), and AI agent operating instructions (`SKILL.md`).
- **Automated Test Suite:** Comprehensive test harness covering discovery, validation, error handling, and CLI execution (`tests/context/loader.test.ts`, `tests/cli/cli.test.ts`). 12/12 tests passing.
