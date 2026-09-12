# ZYRA — Phase Task Board

## PHASE 01 — Foundation & Persistent Context System
- [x] Inspect workspace repository and runtime environment
- [x] Create `.context/` directory and all 10 core documents
- [x] Initialize Node/TypeScript package configuration (`package.json`, `tsconfig.json`, `.gitignore`, `LICENSE`)
- [x] Implement context loader library (`src/context/`)
- [x] Implement initial CLI skeleton with `zyra context` command (`src/cli/`)
- [x] Create foundation document (`docs/FOUNDATION.md` with Accuracy Model)
- [x] Create agent instructions (`SKILL.md`)
- [x] Create project README (`README.md`)
- [x] Implement unit & integration test suite (`tests/`)
- [x] Verify TypeScript typecheck (`npm run typecheck`)
- [x] Verify build artifacts (`npm run build`)
- [x] Verify test suite execution (`npm test`)
- [x] Mark Phase 01 complete

---

## PHASE 02 — Evidence Engine
- [x] Configure Node 22+ runtime requirement (`>=22.0.0`)
- [x] Install and integrate `lighthouse` (13.4.1) and `chrome-launcher` (1.2.1)
- [x] Create Lighthouse runner abstraction (`src/lighthouse/runner.ts`, `types.ts`, `errors.ts`)
- [x] Support `mobile` and `desktop` device emulation and throttling profiles
- [x] Implement timeout protection and reliable Chrome lifecycle teardown
- [x] Implement deterministic Evidence normalizer (`src/evidence/normalizer.ts`)
  - [x] Time metrics normalized strictly to milliseconds (FCP, LCP, TBT, Speed Index, INP)
  - [x] CLS normalized as unitless numeric score
  - [x] Unmeasured metrics explicitly preserved as `null` (never coerced to zero)
  - [x] Full audit collection preserved with stable audit IDs
  - [x] Network requests and resource summary extracted
  - [x] Specialized extraction for scripts (with unused bytes), images (with wasted bytes), fonts, and long tasks
  - [x] Source traceability mapping established
- [x] Implement Evidence validator (`src/evidence/validator.ts`)
- [x] Implement high-level collector orchestration (`src/evidence/collector.ts`)
- [x] Create synthetic test fixtures (`fixtures/lighthouse/synthetic-mobile.json`, `synthetic-desktop.json`)
- [x] Implement unit tests for normalizer, validator, and runner
- [x] Implement integration tests for real Lighthouse browser runs against local servers
- [x] Connect CLI commands: `zyra <url> [--mobile | --desktop] [--json] [--timeout]`
- [x] Implement human-readable evidence summary output
- [x] Implement machine-readable JSON output (Schema v1.0)
- [x] Implement robust error handling without raw stack traces
- [x] Author subsystem documentation (`docs/EVIDENCE-ENGINE.md`)
- [x] Update project documentation (`README.md`, `SKILL.md`, `docs/FOUNDATION.md`)
- [x] Update persistent context (`.context/`)
- [x] Verify typecheck, build, and test suite (30/30 tests passing)
- [x] Mark Phase 02 complete

---

## PHASE 03 — Performance Rule Engine
- [x] Inspect Phase 02 contracts & Evidence schema
- [x] Define Finding contract (`FINDING_SCHEMA_VERSION = '1.0'`)
- [x] Define Rule contract (`PerformanceRule`)
- [x] Define severity model (`INFO`, `WARNING`, `HIGH`, `CRITICAL`)
- [x] Define confidence model (`DETERMINISTIC`)
- [x] Define threshold strategy with authoritative sourcing (`src/rules/thresholds.ts`)
- [x] Implement deterministic Rule Engine (`src/rules/engine.ts`)
- [x] Implement explicit Rule Registry (`src/rules/registry.ts`)
- [x] Metric rules:
  - [x] FCP (`FCP_SLOW`, `FCP_CRITICAL`)
  - [x] LCP (`LCP_SLOW`, `LCP_CRITICAL`)
  - [x] CLS (`CLS_POOR`, valid zero handling)
  - [x] TBT (`TBT_HIGH`, `TBT_CRITICAL`)
  - [x] Speed Index (`SPEED_INDEX_SLOW`)
  - [x] INP (`INP_SLOW`, explicit null safety)
- [x] Browser evidence rules:
  - [x] JavaScript (`UNUSED_JS_HIGH`, `LONG_TASK`)
  - [x] Rendering & Network (`RENDER_BLOCKING_RESOURCE`, `LARGE_RESOURCE`)
  - [x] Images (`IMAGE_OPTIMIZATION_OPPORTUNITY`, `LARGE_IMAGE`)
  - [x] Fonts (`FONT_RESOURCE_LARGE`)
- [x] CLI integration (`zyra <url>`, `zyra rules`)
- [x] JSON integration (`zyra <url> --json`, `zyra rules --json`)
- [x] Comprehensive test suite (82/82 passing tests, 22 suites)
- [x] Boundary tests (`threshold - eps`, `threshold`, `threshold + eps`)
- [x] Determinism tests (identical findings across repeated evaluations)
- [x] Subsystem documentation (`docs/RULE-ENGINE.md`)
- [x] Project documentation (`README.md`, `SKILL.md`)
- [x] Persistent context updates (`.context/`)
- [x] Mark Phase 03 complete

---

## PHASE 04 — Codebase Investigation
- [x] Define CodebaseEvidence contract (`CODEBASE_EVIDENCE_SCHEMA_VERSION = '1.0'`)
- [x] Implement safe workspace traversal with containment and path normalization (`src/codebase/traversal.ts`)
- [x] Symlink escape protection and broken symlink detection
- [x] Sensitive file exclusion (`.env*`, `*.pem`, `*.key`, `id_rsa`) from memory
- [x] File size guard limits (512 KB in-memory limit)
- [x] Package manager detection (npm, pnpm, yarn, bun) & lockfile conflict detection
- [x] Runtime Node.js version detection (`package.json engines.node`, `.nvmrc`, `.node-version`)
- [x] Framework detection engine (Next.js App/Pages, Vite+React/Vue, Nuxt, SvelteKit, Astro, Angular)
- [x] Multi-signal framework confidence scoring (`detected`, `probable`, `ambiguous`, `unknown`)
- [x] Route extraction engine (App Router, Pages Router, SvelteKit, Astro)
- [x] Entry point identification (root layouts, client entry points, root components)
- [x] Dependency analyzer (production, development, peer, optional)
- [x] Asset inventory & classification (images, fonts, stylesheets, media)
- [x] Import graph analyzer (static imports, side-effect imports, dynamic imports, unresolved imports)
- [x] Build configuration inspector (bundler detection, string-aware tsconfig paths, source maps)
- [x] Schema v1.0 validator (`validateCodebaseEvidence`)
- [x] CLI integration (`zyra codebase <path>`, `zyra inspect <path>`, `--json`)
- [x] Synthetic test fixtures (Next.js app, Vite React app, Vue app, ambiguous fixture, security fixture)
- [x] Full test suite (25 new codebase tests, 111 total repository tests passing)
- [x] Subsystem documentation (`docs/CODEBASE-INVESTIGATION.md`)
- [x] Persistent context updates (`.context/`)
- [x] Mark Phase 04 complete

---

## PHASE 05 — Evidence Correlation & Root-Cause Analysis
- [x] Define Correlation Schema v1.0 contracts (`CorrelationResult`, `CandidateContributor`, `EvidenceLink`, `RootCauseAssessment`)
- [x] Implement deterministic URL normalizer and bundler hash stripper (`src/correlation/matching/urlMatcher.ts`)
- [x] Implement asset served-path matcher with exact, probable, ambiguous, and unmatched handling (`src/correlation/matching/assetMatcher.ts`)
- [x] Implement static and dynamic route matcher supporting framework conventions (`src/correlation/matching/routeMatcher.ts`)
- [x] Implement script and codebase matcher with entry point and dependency association (`src/correlation/matching/scriptMatcher.ts`)
- [x] Implement deterministic confidence scoring model with explicit signals and contradiction penalties (`src/correlation/confidence.ts`)
- [x] Implement 6 built-in correlation rules:
  - [x] `CORR_IMAGE_ASSET`: LCP and image payload correlation
  - [x] `CORR_FONT_ASSET`: Font payload correlation
  - [x] `CORR_RENDER_BLOCKING`: Early paint delay correlation
  - [x] `CORR_SCRIPT_IMPORT`: Script and execution correlation with source map checks
  - [x] `CORR_RESOURCE_ASSET`: Generic payload correlation
  - [x] `CORR_ROUTE_ENTRY`: Active route and entry point supporting context
- [x] Implement Correlation Registry with duplicate ID protection (`src/correlation/registry.ts`)
- [x] Implement Correlation Engine with candidate deduplication, fault isolation, and deterministic sorting (`src/correlation/engine.ts`)
- [x] Implement Schema v1.0 validator (`src/correlation/validator.ts`)
- [x] Extend CLI: `zyra <url> --workspace <path>`, `zyra analyze <url> --workspace <path>`, `--json` (`src/cli/index.ts`)
- [x] Test harness: 52 new tests across 7 suites (matching, confidence, rules, negative, determinism, validator, fixtures)
- [x] Author subsystem documentation (`docs/CORRELATION-ENGINE.md`)
- [x] Add ADR-015 (*Browser Long Tasks Definition vs. ZYRA Severity Thresholds*)
- [x] Add ADR-016 (*Deterministic Multi-Signal Evidence Correlation Architecture*)
- [x] Update project documentation (`README.md`, `SKILL.md`)
- [x] Update persistent context (`.context/`)
- [x] Mark Phase 05 complete

---

## PHASE 06 — Agent Skill + `/zyra`
- [x] Authorize and package `SKILL.md` as ZYRA Skill Version 1.0
- [x] Create comprehensive Agent Skill specification (`docs/AGENT-SKILL.md`)
- [x] Implement `/zyra` command routing, options, and dispatch in CLI (`src/cli/index.ts`)
- [x] Document 9-stage Core Loop availability matrix (Measure, Evidence, Analyze, Trace, Diagnose available; Fix in Phase 07)
- [x] Define Workspace Discovery protocol separating ZYRA project from Target application workspace
- [x] Enforce Target Workspace Safety: untrusted data boundary, zero script execution, read-only guarantee
- [x] Maintain Secret Protection: exclude `.env*`, `*.pem`, `*.key`, `id_rsa*`
- [x] Codify 6-tier Evidence Interpretation hierarchy and conservative causality doctrine
- [x] Ensure working-directory independence (`findProjectRoot` package root fallback in `src/context/loader.ts`)
- [x] Formalize npm packaging in `package.json` (version `0.6.0`, `bin`, `files`, `postbuild`)
- [x] Verify executable resolution from `/tmp` (`zyra --version`, `zyra --help`, `zyra context`, `npx zyra`)
- [x] Author automated test suite (`tests/agent/skill.test.ts` — 17 passing tests across 6 suites)
- [x] Document ADR-017 and ADR-018 in `.context/DECISIONS.md`
- [x] Update project documentation (`README.md`, `SKILL.md`, `.context/`)
- [x] Mark Phase 06 complete (180 passing tests across 46 suites)

---

## PHASE 07 — Fix Engine
- [x] Define Schema Version 1.0 fix contracts (`FixPlan`, `FixCandidate`, `FixStrategy`, `FixOperation`, `FixResult`, `FixAuditRecord`)
- [x] Implement schema validator for fix plans and execution results (`src/fixes/validator.ts`)
- [x] Implement safety layer: workspace containment, path traversal rejection, symlink escape protection, and protected file exclusion (`src/fixes/safety.ts`)
- [x] Implement optimistic concurrency guard via SHA-256 content hashing (`verifyContentHash` halting on `PLAN_STALE`)
- [x] Implement binary file detection and protection (`isBinaryContent`)
- [x] Implement Fix Strategy Registry (`src/fixes/registry.ts`) and catalog generator
- [x] Implement 6 built-in fix strategies (`src/fixes/strategies/`):
  - [x] `FIX_IMAGE_OPTIMIZATION`: LCP image attribute optimization (`fetchpriority="high"`, `loading="eager"`) and safe markup advice
  - [x] `FIX_RENDER_BLOCKING_RESOURCE`: Script deferral (`defer`) and stylesheet preloading in entry HTML
  - [x] `FIX_LARGE_FONT`: Injects `font-display: swap;` into matching `@font-face` rules
  - [x] `FIX_UNUSED_IMPORT`: Removes provably unused static imports from source code
  - [x] `FIX_SAFE_DYNAMIC_IMPORT`: Converts heavy non-critical components to dynamic imports (`React.lazy` / `next/dynamic`)
  - [x] `FIX_RESOURCE_REFERENCE`: Injects `<link rel="preload">` hints for critical resources
- [x] Implement deterministic Fix Planner (`src/fixes/planner.ts`)
- [x] Filter out external CDN candidates from fix planning (no local fix for external assets)
- [x] Implement safe Fix Executor (`src/fixes/executor.ts`):
  - [x] Simulation mode (`--dry-run`) verifying safety with zero filesystem modifications
  - [x] Preflight validation of all operations, paths, and hashes
  - [x] Transactional rollback journal restoring all modified files upon any operation failure
  - [x] Audit trail logging with original and new content hashes
  - [x] Enforce post-fix verification boundary (`VERIFICATION: NOT YET PERFORMED`)
- [x] Integrate fix commands into CLI (`src/cli/index.ts`):
  - [x] `zyra fix catalog [--json]`
  - [x] `zyra fix plan <url> --workspace <path> [--json]`
  - [x] `zyra fix apply <plan-file> --workspace <path> [--dry-run] [--json] [--allow-high-risk]`
- [x] Create comprehensive subsystem documentation (`docs/FIX-ENGINE.md`)
- [x] Document ADR-019 through ADR-023 in `.context/DECISIONS.md`
- [x] Update `SKILL.md` and `docs/AGENT-SKILL.md`
- [x] Create comprehensive test suite across contracts, safety, registry, planner, executor, strategies, and CLI (45 new tests, 225 total passing tests across 69 suites)
- [x] Mark Phase 07 complete

---

## PHASE 08 — Post-Fix Verification & Optimization Loop
- [x] Define Schema Version 1.0 verification contracts (`VerificationResult`, `MeasurementSnapshot`, `ComparisonResult`, `MetricDelta`, `TargetVerification`, `VerificationProvenance`, `RepeatedRunSummary`)
- [x] Implement schema validator `validateVerificationResult()` (`src/verification/validator.ts`)
- [x] Implement deterministic significance policy & noise filter (`src/verification/significance.ts`)
  - [x] LCP threshold: 100ms & 3%
  - [x] CLS threshold: 0.015 & 5%
  - [x] INP threshold: 25ms & 5%
  - [x] FCP threshold: 50ms & 3%
  - [x] TBT threshold: 30ms & 5%
  - [x] Speed Index threshold: 100ms & 3%
- [x] Implement measurement compatibility validator (`src/verification/compatibility.ts`)
  - [x] Validate matching origins and normalized pathnames
  - [x] Reject cross-profile comparisons (mobile vs desktop)
  - [x] Check schema version consistency
- [x] Implement deterministic metric comparator (`src/verification/comparator.ts`)
  - [x] Pure mathematical comparison with zero division protection
  - [x] Detect improvements, regressions, and unchanged metrics
  - [x] Preserves missing metrics as NOT_AVAILABLE (never fabricated)
- [x] Implement cryptographic code state validator (`src/verification/code-state.ts`)
  - [x] Verify files on disk match expected post-fix hashes (`FixResult.audit.newHashes`)
  - [x] Halt with inconclusive status upon code drift
- [x] Implement Verification Engine (`src/verification/verifier.ts`)
  - [x] Target-finding specific verification (evaluating bottleneck addressed by fix)
  - [x] Comprehensive regression detection across all metrics
  - [x] Optimization decision synthesis (`KEEP_FIX`, `ROLLBACK_RECOMMENDED`, `NO_ACTION`, `RETRY_NOT_RECOMMENDED`, `INCONCLUSIVE`)
  - [x] Bounded repeated measurement support ($1 \le n \le 5$, no infinite loops)
- [x] Integrate verification commands into CLI (`src/cli/index.ts`):
  - [x] `zyra verify <url> --workspace <path> --baseline <file> [options]`
  - [x] `zyra fix verify <fix-result-file> --url <url> --workspace <path> [options]`
  - [x] Formatted human terminal table and machine-readable `--json` Schema v1.0 output
- [x] Author comprehensive subsystem documentation (`docs/VERIFICATION-ENGINE.md`)
- [x] Document ADR-024 through ADR-027 in `.context/DECISIONS.md`
- [x] Update `CONTRACTS.md` Section 7 with implemented contracts
- [x] Author test suites covering contracts, compatibility, significance, comparator, code state, lifecycle fixtures, repeated runs, and CLI (44 new tests, 269 total passing tests across 77 suites)
- [x] Mark Phase 08 complete

---

## PHASE 09 — CI / Regression Detection
- [x] Define Schema Version 1.0 CI contracts (`CIRun`, `CIBaseline`, `CIPolicy`, `CIMetricBudget`, `CIRegression`, `CIResult`, `CIReport`, `CIExitStatus`)
- [x] Define controlled exit statuses (`PASS`, `WARN`, `FAIL`, `INCONCLUSIVE`, `MEASUREMENT_FAILED`) and stable exit codes (0, 1, 2, 3, 4)
- [x] Implement schema validator `validateCIResult()`, `validateCIBaseline()`, `validateCIPolicy()`, `validateCIBudgetConfig()` (`src/ci/validator.ts`)
- [x] Implement deterministic baseline management (`src/ci/baseline.ts`):
  - [x] Baseline creation and serialization with full provenance (`createCIBaseline`, `saveCIBaseline`)
  - [x] Flexible baseline loading supporting `CIBaseline`, raw `ZyraEvidence`, and raw Lighthouse LHR (`loadCIBaseline`)
  - [x] Strict compatibility validation rejecting URL origin/pathname mismatch, device profile mismatch, and schema mismatch
- [x] Implement performance budgets engine (`src/ci/budgets.ts`):
  - [x] Config parser supporting simple numbers, detailed objects with warning limits, inline JSON, and file paths
  - [x] Official Web Vitals "Good" criteria default budgets (LCP 2500ms, FCP 1800ms, CLS 0.10, INP 200ms, TBT 200ms, SpeedIndex 3400ms)
  - [x] Deterministic evaluation with delta and percentageOfBudget calculations
- [x] Implement regression detection engine (`src/ci/regression.ts`):
  - [x] Reuse Phase 08 noise filtering and significance boundaries
  - [x] Severity classification (`CRITICAL` for Core Web Vitals and budget-violating metrics, `WARNING` for secondary metrics)
- [x] Implement CI policy evaluation engine (`src/ci/policy.ts`):
  - [x] Pure deterministic resolution of status and exit codes
  - [x] Missing baseline handling (configurable via `allowMissingBaseline`)
  - [x] Configurable `--fail-on-warn` escalation
- [x] Implement report generator (`src/ci/reporter.ts`):
  - [x] Clean, aligned terminal summary table
  - [x] Markdown PR comment table with badges and details
- [x] Implement end-to-end CI runner orchestration (`src/ci/runner.ts`)
- [x] Integrate CI commands into CLI (`src/cli/index.ts`):
  - [x] `zyra ci <url> [options]`
  - [x] `zyra ci check <url> [options]`
  - [x] `zyra ci baseline <url> [options]`
  - [x] Support `--baseline`, `--budget`, `--config`, `--mobile`, `--desktop`, `--json`, `--output`, `--markdown-output`, `--current`, `--fail-on-warn`
- [x] Implement production GitHub Actions workflow (`.github/workflows/zyra-ci.yml`)
- [x] Document ADR-028, ADR-029, ADR-030 in `.context/DECISIONS.md`
- [x] Update `CONTRACTS.md` with Section 8
- [x] Create comprehensive subsystem documentation (`docs/CI-REGRESSION-ENGINE.md`)
- [x] Author test suites covering contracts, baseline, budgets, regression, policy, reporter, runner, CLI, security, and determinism (51 new tests, 320 total passing tests across 87 suites)
- [x] Bump package version to `0.9.0`
- [x] Mark Phase 09 complete

---

## BUG FIX & REVALIDATION (Post-Phase 09)
- [x] Reproduce BUG-001 (`zyra verify` crash with `TypeError: Cannot read properties of undefined (reading 'timestamp')`)
- [x] Inspect contracts between `CIBaseline`, `MeasurementSnapshot`, `ZyraEvidence`, and `VerificationResult`
- [x] Implement `extractEvidenceFromPayload` in `src/cli/index.ts` to unwrap `snapshot.evidence` from `CIBaseline`
- [x] Add schema validation via `validateEvidence` before verification execution
- [x] Add defensive guards to `createMeasurementSnapshot` and `validateMeasurementCompatibility` in `src/verification/compatibility.ts`
- [x] Add 8 regression tests in `tests/verification/cli.test.ts` covering valid CIBaseline, formatting, and all failure modes without `TypeError`
- [x] Re-run complete verification flow and explicitly confirm `APPLIED != IMPROVED`
- [x] Revalidate Phases 01–09 core workflows against real websites and fixtures
- [x] Measure and record CLI startup performance timings (~1.4s)
- [x] Verify CI exit codes (0, 1, 2, 3, 4) and regression gating stability
- [x] Recheck security constraints (read-only, secret exclusion, path traversal, symlink escapes)
- [x] Execute full test suite (328/328 passing across 88 suites), typecheck, and build
- [x] Update `docs/REAL-USER-VALIDATION-REPORT.md` with BUG-001 resolution and updated readiness score (88/100)
- [x] Update persistent context (`.context/`)

---

## UX & RELIABILITY IMPROVEMENTS
- [x] **Improvement 1: Loading/Progress UX for long Lighthouse runs**
  - [x] Implement deterministic terminal progress experience (`src/cli/progress.ts`)
  - [x] Connect `onProgress` callbacks in `runLighthouse` and `collectEvidence`
  - [x] Real status transitions (Chrome launch -> Lighthouse audit -> Evidence normalization)
  - [x] Real wall-clock elapsed time ticker in TTY mode and non-TTY fallback
  - [x] Explicit success, failure, and timeout completion states
  - [x] Zero fake percentages or invented progress
  - [x] Strict zero-interference with `--json`
  - [x] Focused tests in `tests/cli/progress.test.ts` and `tests/cli/cli.test.ts` (337/337 tests passing)


