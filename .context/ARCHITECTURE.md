# ZYRA — System Architecture

## 1. Conceptual Architecture Diagram

```text
                     AI CODING AGENT
                            │
                            ▼
                          /zyra
                            │
                            ▼
                    AGENT SKILL (SKILL.md)
                            │
                            ▼
                    ZYRA CLI (src/cli/)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      Lighthouse       Codebase        Correlation
        Evidence        Evidence         Engine
     (src/evidence/) (src/codebase/) (src/correlation/)
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                 Structured Diagnosis / JSON
                            │
                            ▼
                     AI CODING AGENT
                (Interprets & Reports Facts)
                            │
                    [PHASE 07 BOUNDARY]
                            │
                            ▼
                    Fix & Build (Phase 07)
                             │
                             ▼
                    Verification (Phase 08)
                             │
                             ▼
                    CI / Regression Gate (Phase 09)
```

---

## 2. Layer Responsibilities

### 1. Agent Skill & Interface Layer (`SKILL.md`, `docs/AGENT-SKILL.md`, CLI: `src/cli/` — Implemented)
- Exposes developer and agent commands: `zyra <url> [--mobile | --desktop] [--json]`, `zyra <url> --workspace <path>`, `zyra analyze <url> --workspace <path>`, `zyra codebase <path>`, `zyra rules [--json]`, `zyra context [--json]`.
- Implements `/zyra` command routing, environment execution resolution (`npm link`, `~/.local/bin/zyra`, `npx zyra`), and working-directory independence.
- Enforces strict target workspace safety (untrusted data isolation, zero script execution, read-only guarantee).
- Formulates 6-tier evidence interpretation hierarchy and conservative causality doctrine.
- Emits human-readable evidence summaries or structured machine-readable JSON.

### 2. Measurement Layer (`src/lighthouse/` — Implemented)
- **`runner.ts`:** Orchestrates Chrome/Chromium via `chrome-launcher` and runs Google Lighthouse.
- **`types.ts`:** Strongly typed options, device profiles (`mobile` | `desktop`), and execution metadata.
- **`errors.ts`:** Custom error hierarchy (`InvalidUrlError`, `ChromeLaunchError`, `LighthouseTimeoutError`, `LighthouseExecutionError`).
- **Strict Boundary:** Produces empirical runtime facts only. Does not speculate on cause.

### 3. Evidence Subsystem (`src/evidence/` — Implemented)
- **`normalizer.ts`:** Ingests raw Lighthouse JSON and maps metrics to uniform units (milliseconds for time metrics, unitless scores for CLS), preserves audit IDs, extracts network requests, resources, scripts, images, and fonts.
- **`validator.ts`:** Enforces contract invariants (valid URLs, non-negative timings, bounded scores, valid audit collections).
- **`collector.ts`:** High-level pipeline coordinating runner $\to$ normalizer $\to$ validator.
- **`types.ts`:** Formal `ZyraEvidence` schema (version `1.0`) with explicit source traceability.

### 4. Deterministic Rule Engine (`src/rules/` — Implemented)
- **`engine.ts`:** Central `RuleEngine` evaluating validated `ZyraEvidence` against registered `PerformanceRule` objects. Enforces fault-isolated execution, deduplication, and deterministic sorting (`CRITICAL` > `HIGH` > `WARNING` > `INFO`).
- **`registry.ts`:** Explicit `RuleRegistry` managing 16 built-in rules across metrics, JavaScript, network, rendering, images, and fonts, preventing duplicate IDs and exposing a structured catalog.
- **`thresholds.ts`:** Centralized, authoritative thresholds attributed to Google Web Vitals, Lighthouse distributions, and documented ZYRA heuristics.
- **`types.ts`:** Formal `Finding` contract (Schema v1.0) with controlled severities, deterministic confidence, and evidence reference paths.
- **Strict Boundary:** Interprets browser evidence into objective findings. Never diagnoses causal source files or proposes fixes.

### 5. Codebase Investigation Subsystem (`src/codebase/` — Implemented)
- **`traversal.ts`:** Safe, deterministic filesystem traversal with workspace containment, symlink escape protection, sensitive file exclusion (`.env*`, `*.pem`, `*.key`, `id_rsa`), and file size limits (512 KB in-memory limit).
- **`detector/`:** Static detection modules:
  - `framework.ts`: Detects Next.js (App/Pages), Nuxt, SvelteKit, Astro, Vite (React/Vue/Svelte), Angular, and reports confidence (`detected`, `probable`, `ambiguous`, `unknown`).
  - `packageManager.ts`: Detects npm, pnpm, yarn, bun, and flags lockfile conflicts.
  - `runtime.ts`: Identifies declared Node.js engines versions from `package.json`, `.nvmrc`, `.node-version`.
  - `routes.ts`: Maps static and dynamic routes for App Router, Pages Router, SvelteKit, and Astro.
  - `entryPoints.ts`: Identifies root layouts, client entry points, and main components.
- **`analyzer/`:** Static code and asset analysis:
  - `dependencies.ts`: Categorizes production, development, peer, and optional dependencies.
  - `assets.ts`: Classifies images, fonts, stylesheets, and media assets.
  - `imports.ts`: Deterministic regex/token analysis of static and dynamic imports without executing untrusted code.
  - `config.ts`: Safe inspection of build configs, tsconfig path aliases, and source maps.
- **`scanner.ts` & `validator.ts`:** Orchestrates the scan pipeline and enforces Schema v1.0 contract invariants.
- **Strict Boundary:** Read-only only. Never executes target code, modifies workspace files, calls AI, or makes causal root-cause claims.

### 6. Evidence Correlation & Root-Cause Analysis Subsystem (`src/correlation/` — Implemented)
- **`engine.ts` & `registry.ts`:** Orchestrates multi-signal evidence correlation linking browser findings to scanned codebase entities with candidate deduplication, fault isolation, and deterministic sorting.
- **`confidence.ts`:** Bounded deterministic confidence scoring model (`[0.0, 1.0]`) with transparent additive weights and contradiction/missing evidence penalties.
- **`matching/`:** Matching utilities: URL normalization with bundler hash stripping, asset served-path matching, framework dynamic route pattern matching (`[slug]`, `[...catchAll]`), and script/dependency matching.
- **`rules/`:** 6 deterministic correlation rules (`CORR_IMAGE_ASSET`, `CORR_FONT_ASSET`, `CORR_RENDER_BLOCKING`, `CORR_SCRIPT_IMPORT`, `CORR_RESOURCE_ASSET`, `CORR_ROUTE_ENTRY`).
- **`validator.ts`:** Formal `CorrelationResult` Schema v1.0 validation.
- **Strict Boundary:** Evaluates evidence correlations. Does not modify source code or claim causality without sufficient evidence.

### 7. Fix Subsystem (`src/fixes/` — Implemented)
- **`types.ts`:** Versioned contracts (`FixPlan`, `FixCandidate`, `FixStrategy`, `FixOperation`, `FixSafetyCheck`, `FixResult`, `FixAuditRecord`) adhering to Schema Version 1.0.
- **`safety.ts`:** Path traversal rejection, canonical workspace containment, symlink escape protection, sensitive file exclusion (`.env*`, `*.pem`, `*.key`, `id_rsa*`, credentials), optimistic concurrency content hash verification (SHA-256), and binary file guards.
- **`registry.ts`:** Explicit `FixStrategyRegistry` managing 6 built-in strategies across image loading, render-blocking deferral, font display swap, unused import removal, dynamic import conversion, and resource preloading.
- **`planner.ts`:** Deterministic, read-only `FixPlanner` transforming findings, codebase evidence, and correlation candidates into structured `FixPlan`s.
- **`executor.ts`:** Safe `FixExecutor` supporting simulation (`--dry-run`), preflight validation, optimistic concurrency verification (`PLAN_STALE` halt on drift), transactional modification journal, and automated rollback upon any failure.
- **Strict Boundary:** Modification engine only records `APPLIED` with an audit record. Performance verification is deferred to Phase 08.

### 8. Verification Layer (`src/verification/` — Implemented)
- **`types.ts`:** Versioned contracts (`VerificationResult`, `MeasurementSnapshot`, `ComparisonResult`, `MetricDelta`, `TargetVerification`, `VerificationProvenance`, `RepeatedRunSummary`) adhering to Schema Version 1.0.
- **`significance.ts`:** Deterministic significance policy filtering measurement noise and defining threshold boundaries for LCP, CLS, INP, FCP, TBT, and Speed Index.
- **`compatibility.ts`:** Validates URL matching and device profile consistency (`mobile` vs `desktop`) before allowing comparison.
- **`comparator.ts`:** Pure comparison engine calculating exact numeric deltas, percentage changes, and categorizing metrics into improvements, regressions, and unchanged.
- **`code-state.ts`:** Cryptographic SHA-256 hash checks validating workspace files against `FixResult.audit.newHashes` to prevent attributing measurements to drifted workspaces.
- **`verifier.ts`:** `VerificationEngine` synthesizing target-finding verification, global regression detection, and deterministic optimization decisions (`KEEP_FIX`, `ROLLBACK_RECOMMENDED`, `NO_ACTION`, `RETRY_NOT_RECOMMENDED`, `INCONCLUSIVE`), supporting bounded repeat runs ($1 \le n \le 5$).
- **Strict Boundary:** Verification is read-only; never mutates target files or applies autonomous fixes. `APPLIED != IMPROVED`.

### 9. CI / Regression Detection Subsystem (`src/ci/` — Implemented)
- **`baseline.ts`:** Creates, serializes, loads, and verifies provenance and compatibility of authoritative baselines.
- **`budgets.ts`:** Evaluates configurable Core Web Vitals performance budgets with official Good criteria defaults.
- **`regression.ts`:** Detects significant regressions and classifies severity (`CRITICAL` for CWV, `WARNING` for secondary).
- **`policy.ts`:** Pure deterministic policy resolution mapping results to controlled exit statuses (`PASS`, `WARN`, `FAIL`, `INCONCLUSIVE`, `MEASUREMENT_FAILED`) and stable exit codes (0–4).
- **`reporter.ts`:** Formats aligned terminal output and GitHub-flavored PR markdown comments.
- **`runner.ts`:** High-level orchestration pipeline supporting live measurements or offline pre-captured telemetry.
- **Strict Boundary:** Read-only CI performance gating; never applies code mutations or autonomous rollbacks.

---

## 3. Strict Architectural Separation

| Layer | Implementation | Input | Output | Primary Invariant |
| :--- | :--- | :--- | :--- | :--- |
| **Agent Skill / Interface** | `SKILL.md`, `docs/`, `src/cli/` | `/zyra` command, options | Structured JSON / summary | Instruction isolation; working-directory independent. |
| **Measurement** | `src/lighthouse/` | Target URL, Device | Raw LHR JSON | Facts only; zero speculation. |
| **Evidence Normalization** | `src/evidence/` | Raw LHR JSON | `ZyraEvidence` (v1.0) | Standard units (ms), validated. |
| **Rule Engine** | `src/rules/` | `ZyraEvidence` | Normalized Findings (v1.0) | Deterministic evaluation. |
| **Codebase** | `src/codebase/` | Workspace Path | `CodebaseEvidence` (v1.0) | Read-only; zero execution; safe traversal. |
| **Correlation / Diagnosis** | `src/correlation/` | Findings + Code Evidence | `CorrelationResult` (v1.0) | Multi-signal traceability; bounded confidence. |
| **Fix** | `src/fixes/` | Candidate Contributor | Modified Code + Status | Safe, minimal, reversible. |
| **Verification** | `src/verification/` | Baseline + Post-Fix Runs | `VerificationResult` (v1.0) | Empirical proof required (`APPLIED != IMPROVED`). |
| **CI / Regression Detection** | `src/ci/` | Target URL, Baseline, Budgets | `CIResult` (v1.0), Exit Code | Deterministic gating; stable exit codes (0-4); baseline compatibility required. |

