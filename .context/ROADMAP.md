# ZYRA — Development Roadmap

This document outlines the sequential phases of development for ZYRA. In accordance with Rule 5 (*Do Not Overbuild*) and Rule 19 (*Do Not Skip Ahead*), phases must be executed in order. Future phases are marked as planned.

---

## Phase 01 — Foundation
* **Status:** Complete
* **Objective:** Establish the TypeScript/Node.js project foundation, strict engineering rules, complete persistent context system, initial CLI skeleton, and automated test suite.
* **Major Components:**
  - Persistent `.context/` memory system.
  - Context loader (`src/context/`).
  - Initial CLI command (`zyra context`).
  - Core developer documentation (`FOUNDATION.md`, `README.md`, `SKILL.md`).
  - Strict TypeScript & testing harness.
* **Dependencies:** None.
* **Exit Criteria:** All 10 context documents exist and validate; `zyra context` CLI functions; tests pass; clean typecheck and build.

---

## Phase 02 — Evidence Engine
* **Status:** Complete
* **Objective:** Build the local browser measurement and raw evidence normalization pipeline.
* **Major Components:**
  - Headless Chrome/Chromium runner.
  - Lighthouse execution harness.
  - Raw JSON extraction (Core Web Vitals, metrics, audits, network records).
  - Normalized evidence schema parser.
* **Dependencies:** Phase 01.
* **Exit Criteria:** Reliable headless execution against local/remote URLs producing validated normalized evidence without synthetic data.

---

## Phase 03 — Performance Rule Engine
* **Status:** Complete
* **Objective:** Implement deterministic performance analysis rules to evaluate normalized browser evidence.
* **Major Components:**
  - 16 Authoritative Registered Performance Rules across 7 categories:
    - Metrics: `FCP_SLOW`, `FCP_CRITICAL`, `LCP_SLOW`, `LCP_CRITICAL`, `TBT_HIGH`, `TBT_CRITICAL`, `CLS_POOR`, `SPEED_INDEX_SLOW`, `INP_SLOW`.
    - JavaScript: `UNUSED_JS_HIGH`, `LONG_TASK`.
    - Rendering & Network: `RENDER_BLOCKING_RESOURCE`, `LARGE_RESOURCE`.
    - Images & Fonts: `IMAGE_OPTIMIZATION_OPPORTUNITY`, `LARGE_IMAGE`, `FONT_RESOURCE_LARGE`.
  - Finding and PerformanceRule contracts (v1.0) with explicit source attribution and zero magic numbers (`src/rules/thresholds.ts`).
  - CLI and JSON integration (`zyra <url>`, `zyra rules`).
* **Dependencies:** Phase 02.
* **Exit Criteria:** Deterministic rules emit structured findings with clear severity, explicit thresholds, and factual backing.

---

## Phase 04 — Codebase Investigation
* **Status:** Complete
* **Objective:** Inspect target workspace source code, configuration files, and assets to locate performance-relevant patterns without executing untrusted code or modifying files.
* **Major Components:**
  - Safe workspace traversal with symlink containment, path normalization, and secret exclusion.
  - Multi-signal framework detection (Next.js, Vite, React, Vue, SvelteKit, Nuxt, Astro, Angular).
  - Package manager and lockfile conflict detector.
  - Runtime Node engine detector.
  - Route extraction (App Router, Pages Router, SvelteKit, Astro).
  - Entry point detector (layouts, client entry points).
  - Dependency, asset, import, and configuration analyzers.
  - Schema v1.0 `CodebaseEvidence` contract and validator.
  - CLI commands `zyra codebase <path>` and `zyra inspect <path>`.
* **Dependencies:** Phase 01.
* **Exit Criteria:** Codebase scanner reliably detects project type, routes, entry points, dependencies, and assets, outputting validated Schema v1.0 CodebaseEvidence.

---

## Phase 05 — Evidence Correlation & Root-Cause Analysis
* **Status:** Complete
* **Objective:** Correlate browser-observed runtime evidence and deterministic findings with codebase inspection facts to identify evidence-backed candidate contributors and conservative root-cause assessments.
* **Major Components:**
  - Correlation Schema v1.0 contracts (`CorrelationResult`, `CandidateContributor`, `EvidenceLink`, `RootCauseAssessment`).
  - Matching utilities: URL/path normalizer with bundler hash stripping, asset served-path mapping, static and dynamic route pattern matching (`[slug]`, `[...catchAll]`), script-to-codebase matching.
  - Deterministic confidence model: Additive signals, contradiction penalties (cached 0-byte transfers), missing evidence penalties, bounded in `[0.0, 1.0]`.
  - 6 Built-in correlation rules: `CORR_IMAGE_ASSET`, `CORR_FONT_ASSET`, `CORR_RENDER_BLOCKING`, `CORR_SCRIPT_IMPORT`, `CORR_RESOURCE_ASSET`, `CORR_ROUTE_ENTRY`.
  - Correlation engine: Candidate deduplication, fault isolation, strict deterministic ordering.
  - CLI integration: `zyra <url> --workspace <path>`, `zyra analyze <url> --workspace <path>`, and backward-compatible `--json`.
* **Dependencies:** Phase 03, Phase 04.
* **Exit Criteria:** Produces verifiable, traceable diagnoses linking runtime bottlenecks to specific workspace assets, routes, and entry points with explicit confidence metrics and anti-hallucination boundaries.

---

## Phase 06 — Agent Skill + `/zyra`
* **Status:** Complete
* **Objective:** Package ZYRA as an autonomous agent skill with interactive slash command `/zyra`, working-directory independence, and clear anti-hallucination and security boundaries.
* **Major Components:**
  - Standardized Agent Skill specification (`SKILL.md` Skill Version 1.0) and technical guide (`docs/AGENT-SKILL.md`).
  - Command routing and `/zyra` slash command interface supporting all empirical measurement, codebase inspection, and correlation capabilities.
  - Package binary distribution configuration (`package.json` bin, postbuild chmod, files whitelist).
  - Working-directory independence with package root fallback for persistent context discovery from `/tmp`.
  - Strict read-only invariants and untrusted data boundaries protecting target workspaces from accidental mutation or script execution.
  - 6-tier evidence interpretation hierarchy and conservative causality doctrine.
  - Comprehensive automated test suite (`tests/agent/skill.test.ts`).
* **Dependencies:** Phase 05.
* **Exit Criteria:** AI coding agents can discover, understand, safely invoke `/zyra`, and consume structured diagnostic evidence without hallucinating causes or fixes.

---

## Phase 07 — Fix Engine
* **Status:** Complete
* **Objective:** Safely propose and apply surgical, reversible source code fixes based on validated diagnoses.
* **Major Components:**
  - Targeted patch generator (images, dynamic imports, font loading, script deferral, resource preloading).
  - Optimistic concurrency content guard (SHA-256) preventing clobbering of user edits (`PLAN_STALE`).
  - Strict separation of fix planning (`zyra fix plan`) and execution (`zyra fix apply`).
  - Simulation mode (`--dry-run`) verifying safety with zero filesystem modifications.
  - Reversibility and transactional rollback manager.
  - Verification boundary: modification recorded without unverified performance claims.
* **Dependencies:** Phase 06.
* **Exit Criteria:** Safe, evidence-backed modification of target files with automated rollback upon any operation failure.

---

## Phase 08 — Verification Engine
* **Status:** Complete
* **Objective:** Re-run browser measurements after fixes to verify actual performance improvements.
* **Major Components:**
  - Before/after metric comparison engine (`src/verification/comparator.ts`).
  - Statistical noise evaluator & significance boundaries (`src/verification/significance.ts`).
  - Comprehensive regression detection and target-finding verification (`src/verification/verifier.ts`).
  - Cryptographic code state validation (`src/verification/code-state.ts`).
  - Bounded repeated measurement support ($1 \le n \le 5$, `src/verification/verifier.ts`).
  - Verification report generator and CLI (`zyra verify`, `zyra fix verify`).
* **Dependencies:** Phase 02, Phase 07.
* **Exit Criteria:** Accurately calculates delta; flags regressions or inconclusive results; confirms verified improvements.


---

## Phase 09 — CI / Regression Detection
* **Status:** Planned
* **Objective:** Enable ZYRA to run in continuous integration pipelines for automated performance regression gating.
* **Major Components:**
  - Headless CI execution mode.
  - Performance budgeting rules.
  - Pull request comment formatting.
* **Dependencies:** Phase 08.
* **Exit Criteria:** Deterministic exit codes and markdown summary suitable for GitHub Actions / CI.

---

## Phase 10 — Advanced Browser & DevTools Integration
* **Status:** Planned
* **Objective:** Deepen runtime telemetry using Chrome DevTools Protocol (CDP) traces and advanced profiling.
* **Major Components:**
  - CDP trace recording and timeline parsing.
  - Detailed main-thread flamechart analysis.
  - Memory leak and layout shift visual attribution.
* **Dependencies:** Phase 09.
* **Exit Criteria:** High-fidelity trace profiling directly integrated into the correlation engine.
