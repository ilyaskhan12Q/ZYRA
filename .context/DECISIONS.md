# ZYRA — Architecture Decision Records (ADR)

This document tracks all significant architectural decisions made for ZYRA.

---

## ADR-001: Use Lighthouse as Primary Lab Measurement Engine
* **Status:** Accepted
* **Context:** We need a reliable, industry-standard browser lab measurement tool that provides Core Web Vitals, performance scores, network traces, and diagnostic audits.
* **Decision:** Use Google Lighthouse (orchestrated via Chrome/Chromium) as the foundational measurement engine.
* **Consequences:** Provides standardized metrics (LCP, CLS, TBT, FCP, Speed Index) and rich JSON artifacts. Avoids inventing custom lab measurement runners from scratch.

---

## ADR-002: Keep ZYRA Local-First in V1
* **Status:** Accepted
* **Context:** Developers and AI coding agents operate locally inside code repositories and developer machines.
* **Decision:** Build ZYRA as a local-first CLI and agent skill without requiring external cloud backends, hosted databases, or remote SaaS services.
* **Consequences:** Zero infrastructure dependencies, instant developer iteration, privacy preservation for proprietary source code, and offline-capable workflow.

---

## ADR-003: AI Must Never Generate Raw Performance Measurements
* **Status:** Accepted
* **Context:** Large Language Models are prone to hallucinating plausible-sounding metrics and benchmarks.
* **Decision:** The AI reasoning layer is strictly forbidden from manufacturing or inventing performance numbers. All measurements must originate from browser execution and deterministic parsers.
* **Consequences:** Ensures scientific integrity. If a metric cannot be measured, it must be marked `UNKNOWN` or `NOT YET MEASURED`.

---

## ADR-004: Automatic Fixes Require Empirical Verification
* **Status:** Accepted
* **Context:** Applying a code change that "should" improve performance frequently causes regressions, breaks functional tests, or produces negligible improvement.
* **Decision:** Any proposed or applied fix must undergo automated build/test verification followed by re-measurement under identical test parameters to compute the empirical delta.
* **Consequences:** Eliminates false claims of performance improvements. Preserves code stability.

---

## ADR-005: Persistent Project Context is Mandatory
* **Status:** Accepted
* **Context:** AI coding agents operate across discrete sessions and context windows, risking loss of architectural direction, rules, and task state.
* **Decision:** Maintain a dedicated `.context/` directory within the repository containing explicit specifications, rules, contracts, and task trackers.
* **Consequences:** Every agent session starts by reading `.context/` to maintain continuous alignment and prevent architectural drift.

---

## ADR-006: Framework-Specific Rules Require Prior Framework Detection
* **Status:** Accepted
* **Context:** Performance advice tailored for one framework (e.g. Next.js image optimization) is invalid or counterproductive in another (e.g. static Vite SPA or Astro).
* **Decision:** Deterministic analysis and codebase inspection must positively identify the active framework and bundler before enabling framework-specific inspection rules.
* **Consequences:** Eliminates irrelevant or erroneous diagnostic recommendations.

---

## ADR-007: Standardize Time-Based Metrics to Milliseconds in Normalized Evidence
* **Status:** Accepted
* **Context:** Lighthouse audit displays alternate between seconds (e.g. `2.4 s`) and milliseconds (`240 ms`), causing unit confusion in automated consumers.
* **Decision:** All time-based metrics in `ZyraEvidence` (FCP, LCP, TBT, Speed Index, INP) must strictly normalize to numeric milliseconds (`ms`). Cumulative Layout Shift (CLS) remains a unitless numeric score.
* **Consequences:** Predictable, deterministic unit calculations across all future rule engines and before/after delta comparisons.

---

## ADR-008: Explicit Null Representation for Missing or Non-Applicable Telemetry
* **Status:** Accepted
* **Context:** When a metric cannot be measured (e.g. INP on a page with no user interaction, or failed network audits), coercing the value to `0` introduces critical errors (e.g. `CLS = 0` is perfection, but `0ms` INP implies instantaneous interaction).
* **Decision:** Represent unmeasured, missing, or non-applicable metrics explicitly as `null`. Reserve numeric zero strictly for genuine zero measurements.
* **Consequences:** Prevents false positives and preserves empirical fidelity.

---

## ADR-009: Require Node.js 22+ for ZYRA Engine Runtime
* **Status:** Accepted
* **Context:** Lighthouse v13+ leverages modern V8 features and ECMAScript module capabilities available in Node.js 22+.
* **Decision:** Require Node.js `>=22.0.0` for ZYRA's own runtime and dependencies while maintaining strict isolation from the analyzed project's runtime.
* **Consequences:** Ensures full compatibility with modern Lighthouse while allowing target repositories to run any arbitrary Node version.

---

## ADR-010: Deterministic Performance Rule Engine Architecture
* **Status:** Accepted
* **Context:** Interpreting browser evidence into performance issues must be reproducible, fast, and scientific. Relying on AI/LLM models for rule evaluation risks nondeterministic outputs, hallucinations, high latency, and cloud API dependencies.
* **Decision:** Build the Performance Rule Engine as a 100% deterministic, side-effect free programmatic layer (`src/rules/`). Rules accept validated `ZyraEvidence` and emit structured `Finding`s. AI/LLM models are strictly forbidden from this layer.
* **Consequences:** Absolute reproducibility: identical evidence always produces identical findings. Unit tests run offline in milliseconds without network or API keys.

---

## ADR-011: Stable Rule Identifiers, Explicit Sourcing, and Rule Versioning
* **Status:** Accepted
* **Context:** Changing rule IDs or silently adjusting thresholds breaks automated tooling, CI pipelines, and historical comparisons. Unattributed heuristics confuse developers regarding whether a boundary is an industry standard or a tool opinion.
* **Decision:** Every rule has an immutable, uppercase snake_case identifier (e.g. `TBT_CRITICAL`, `LCP_SLOW`), a semantic version (`1.0`), and explicit threshold source labeling (`Google Web Vitals`, `Google Lighthouse`, or `ZYRA Heuristic`).
* **Consequences:** Full transparency for developers and agents. Downstream systems can reliably filter and key off stable rule IDs across versions.

---

## ADR-012: Finding Traceability via Evidence References
* **Status:** Accepted
* **Context:** Duplicating large evidence payloads into every finding inflates memory, bloats JSON output, and obscures the specific data point that caused a trigger.
* **Decision:** Findings must store pointer paths (`evidenceRefs: string[]`) citing the exact evidence fields (e.g. `['metrics.tbt']`, `['audits.render-blocking-resources']`) instead of duplicating full data structures.
* **Consequences:** Findings remain lightweight, verifiable, and directly traceable back to empirical browser telemetry.

---

## ADR-013: Read-Only Target Workspace Scanning & Secret Exclusion
* **Status:** Accepted
* **Context:** Scanning user codebases introduces security and safety risks: accidental code modification, running untrusted build scripts, traversing malicious symlinks escaping the project root, or reading secrets (`.env`, private keys) into memory.
* **Decision:** The Codebase Scanner (`src/codebase/`) must be strictly read-only, execute zero untrusted code, enforce canonical path containment, skip symlinks pointing outside workspace boundaries, exclude sensitive files (`.env*`, `*.pem`, `*.key`, `id_rsa`) from memory, and enforce a 512 KB per-file in-memory reading limit.
* **Consequences:** Guarantees zero risk of workspace corruption, zero execution of untrusted scripts, and prevents credential leakage into memory or JSON outputs.

---

## ADR-014: Deterministic Framework Confidence & Multi-Signal Detection
* **Status:** Accepted
* **Context:** Projects often contain lingering dependencies or polyglot configurations (e.g. Next.js with old Vite configs, or multi-framework monorepos). Naive single-file checks produce false positives or misclassify frameworks.
* **Decision:** Framework detection computes multi-signal evidence combining dependencies, config files, and directory conventions. Confidence is explicitly scored (`detected` for $\ge 2$ signals, `probable` for 1 signal, `ambiguous` when conflicting meta-frameworks coexist, and `unknown` when unclassified).
* **Consequences:** Prevents false framework assumptions in downstream diagnosis while giving developers full visibility into detection signals.

---

## ADR-015: Browser Long Tasks Definition vs. ZYRA Severity Thresholds
* **Status:** Accepted
* **Context:** A historical ambiguity existed between the browser W3C/Lighthouse definition of a "Long Task" (any main-thread task exceeding 50 ms) and when ZYRA flags a `LONG_TASK` performance finding.
* **Decision:** Explicitly distinguish the two concepts:
  1. *Browser Telemetry Collection:* In `ZyraEvidence.scripts.longTasks`, any task exceeding $50\text{ ms}$ is recorded factually.
  2. *Performance Rule Evaluation:* ZYRA triggers the `LONG_TASK` finding only when main-thread blocking crosses severe thresholds ($>200\text{ ms}$ single task or $>500\text{ ms}$ cumulative execution time for `HIGH` severity; $>500\text{ ms}$ single or $>1500\text{ ms}$ cumulative for `CRITICAL` severity). Normal tasks between $50\text{ ms}$ and $200\text{ ms}$ are preserved as evidence facts but do not trigger noisy findings unless total duration is severe.
* **Consequences:** Eliminates confusion across documentation and downstream analysis while preserving empirical telemetry.

---

## ADR-016: Deterministic Multi-Signal Evidence Correlation & Conservative Causality
* **Status:** Accepted
* **Context:** Correlating browser runtime bottlenecks with codebase entities risks speculative leaps (e.g. claiming `App.tsx` caused high TBT merely because it is the root component, or blaming an unreferenced large image).
* **Decision:** Build the Evidence Correlation Engine (`src/correlation/`) as a pure, deterministic, multi-signal evaluator. Causality is never claimed solely from file existence. Confidence is calculated additively from explicit, transparent signals (exact served asset path match, LCP audit attribution, route match, size corroboration) and penalized by contradictions (cached 0-byte transfers, multiple ambiguous asset matches) and missing data (external CDNs, missing source maps). When evidence is insufficient, the system explicitly returns `INSUFFICIENT_EVIDENCE` or `NO_CORRELATION`.
* **Consequences:** Enforces scientific integrity. Precludes AI hallucinations, prevents false root-cause attributions, and produces reproducible diagnoses.

---

## ADR-017: Agent Skill Packaging and `/zyra` Command Interface Layer
* **Status:** Accepted
* **Context:** AI coding agents operating across diverse developer workflows need a standardized, discoverable, and secure contract to invoke ZYRA without modifying core engines or hallucinating capabilities.
* **Decision:** Implement `SKILL.md` (Skill Version 1.0) as an instructional contract and interface specification exposing the `/zyra` command mapping directly to the ZYRA CLI. The skill establishes strict read-only guarantees on target projects, treats target source code as untrusted input data, excludes secret credentials, and codifies a 6-tier evidence hierarchy (`OBSERVED FACT`, `DETERMINISTIC FINDING`, `CORRELATION`, `CANDIDATE CONTRIBUTOR`, `ROOT-CAUSE ASSESSMENT`, `HYPOTHESIS`).
* **Consequences:** Ensures AI agents operate within verified boundaries, avoids prompt injection or script execution from target projects, and strictly defers automated code rewriting to Phase 07.

---

## ADR-018: Working-Directory Independence & CLI Executable Resolution
* **Status:** Accepted
* **Context:** AI agents and developers execute CLI commands from arbitrary directories (e.g. `/tmp`, user home, or different target project workspaces). In previous tests, running outside the repo produced `zyra: command not found` or failed context discovery when looking for `.context/` in `process.cwd()`.
* **Decision:** 
  1. Formalize package binary distribution in `package.json` (`"bin": { "zyra": "./dist/src/cli/index.js" }`), ensure executable shebang (`#!/usr/bin/env node`), and enforce execute permissions via `postbuild: chmod +x`.
  2. Implement dual-mode context discovery in `findProjectRoot`: walk upwards from `startDir`, and if not found, fall back to the bundled package installation directory via `fileURLToPath(import.meta.url)`.
  3. Support multiple resolution strategies: `npm link`, local user bin (`~/.local/bin/zyra`), and `npx zyra`.
* **Consequences:** Enables seamless execution of `zyra` and `zyra context` from any location on the system without requiring `process.cwd()` to be the ZYRA repository.

---

## ADR-019: Fix Planning Separated from Execution
* **Status:** Accepted
* **Context:** Conflating performance investigation and automated code modification creates severe risk of unwanted, unreviewed mutations in user codebases.
* **Decision:** Strictly decouple planning (`zyra fix plan`) from execution (`zyra fix apply`). Planning is 100% read-only, producing an immutable, serializable `FixPlan` Schema v1.0. Code mutation requires an explicit execution invocation. All existing analysis commands (`zyra <url>`, `zyra analyze`, `zyra codebase`) remain strictly read-only.
* **Consequences:** Developers and AI coding agents can review proposed changes, inspect risk, verify supporting evidence, and simulate execution via dry-run before any byte on disk is altered.

---

## ADR-020: Content Hash Guard & Optimistic Concurrency for Safe Modifications
* **Status:** Accepted
* **Context:** Users or background processes may edit source files between the time a fix plan is generated and the time it is applied. Blindly writing replacements would clobber newer user changes.
* **Decision:** Every `FixOperation` records the SHA-256 cryptographic hash of the target file at plan creation time (`originalContentHash`). Before modifying any file, the execution engine reads the current file content, computes its SHA-256 hash, and compares it with the planned hash. Any discrepancy aborts execution immediately with `PLAN_STALE`.
* **Consequences:** Guarantees that ZYRA never overwrites newer user changes or acts on stale repository state.

---

## ADR-021: Transactional Modification Journal and Rollback Safety
* **Status:** Accepted
* **Context:** Multi-file fixes can experience partial failures (e.g. pattern not found in file 2, or disk write error). Leaving the workspace in a half-modified state breaks builds and functional tests.
* **Decision:** Execute multi-operation fixes within a transactional rollback journal. Preflight checks validate all paths and hashes before any file is written. If any operation fails during execution, the rollback journal restores all previously modified files to their exact pre-operation state and verifies restoration integrity.
* **Consequences:** Prevents corrupted or partially modified workspaces. Guarantees clean state upon failure.

---

## ADR-022: Explicit Strategy Registry and Deterministic Preconditions
* **Status:** Accepted
* **Context:** Allowing generic or arbitrary LLM patch generation introduces hallucinations, syntax breaks, and unpredictable code quality.
* **Decision:** Fix strategies must be explicitly defined, versioned, and registered in `FixStrategyRegistry`. Each strategy defines explicit applicability rules, risk classification (`LOW`, `MEDIUM`, `HIGH`, `BLOCKED`), and mandatory preconditions (unambiguous occurrence, framework support, target containment). Binary optimizations without verified lossless compressors are safely constrained.
* **Consequences:** Prevents speculative rewrites. Constrains automated modifications strictly to narrow, evidence-backed, low-risk operations.

---

## ADR-023: Phase 07 Verification Boundary (No Unverified Claims)
* **Status:** Accepted
* **Context:** Developers and AI tools frequently declare victory ("Fix applied! LCP improved by 1.2s") immediately after changing source code, without running any subsequent measurement.
* **Decision:** The Phase 07 modification engine is strictly forbidden from claiming performance improvements. The execution result states only `APPLIED` and records `VERIFICATION: NOT YET PERFORMED`. Verification of performance deltas belongs exclusively to Phase 08.
* **Consequences:** Enforces scientific integrity and prevents false optimization claims.

---

## ADR-024: Empirical Before/After Verification Required for Optimization Claims
* **Status:** Accepted
* **Context:** Code modifications cannot be assumed to improve performance merely because syntax changes were executed. Changes may be offset by bundler overhead, third-party network variations, or layout side effects.
* **Decision:** Establish `VerificationResult` Schema v1.0 as the authoritative performance outcome. An applied fix only reaches `VERIFIED_IMPROVEMENT` when post-fix browser measurement demonstrates a statistically significant reduction in the target metric compared to the baseline under compatible test conditions.
* **Consequences:** Strictly enforces `APPLIED != IMPROVED`. Prevents false positive optimization claims and ensures decisions are evidence-backed.

---

## ADR-025: Deterministic Significance & Noise Boundaries for Metric Deltas
* **Status:** Accepted
* **Context:** Browser lab environments experience minor timing jitter (10–30ms) due to thread scheduling, garbage collection, and CPU frequency scaling. Treating small fluctuations as improvements or regressions produces false alerts.
* **Decision:** Codify deterministic significance rules per metric in `METRIC_SIGNIFICANCE_RULES`. Timing metrics require a minimum absolute delta (e.g. >= 100ms for LCP, >= 50ms for FCP, >= 30ms for TBT) AND a relative percentage change (>= 3% to 5%). CLS requires a delta >= 0.015. Deltas failing both tests are marked `UNCHANGED`.
* **Consequences:** Filters out measurement noise and provides reliable, repeatable conclusions without artificial statistical hallucinations.

---

## ADR-026: Comprehensive Regression Safety & Optimization Decision Matrix
* **Status:** Accepted
* **Context:** A fix can optimize a target metric (e.g. LCP) while severely damaging another metric (e.g. introducing layout shifts or blocking the main thread). Declaring victory on isolated metrics compromises overall user experience.
* **Decision:** The verification engine evaluates all metrics concurrently. If the target metric improves but any other metric exhibits a significant regression, the status is flagged as `REGRESSION_DETECTED` and the decision is `ROLLBACK_RECOMMENDED`. Only runs with verified improvement and zero regressions receive `KEEP_FIX`.
* **Consequences:** Prevents local optima that degrade global site performance. Protects web applications against unintended collateral regressions.

---

## ADR-027: Bounded Measurement Repetition without Infinite Loops
* **Status:** Accepted
* **Context:** High-variance environments benefit from repeated runs to assess consistency, but autonomous agents risk looping indefinitely while waiting for an elusive improvement.
* **Decision:** Support bounded repeat measurements (`--runs <n>`) with a hard upper bound ($1 \le n \le 5$). If repeated runs produce mixed results (e.g. one run improves and another regresses), the outcome is declared `MIXED_RESULTS` and status becomes `INCONCLUSIVE`. ZYRA never executes loops past the configured bound or applies recursive automatic fixes without developer intervention.
* **Consequences:** Guarantees deterministic termination, prevents infinite loops, and surfaces environmental instability transparently.

---

## ADR-028: Deterministic CI Performance Budgets and Regression Detection Policy
* **Status:** Accepted
* **Context:** Running performance checks in CI pipelines requires objective, repeatable gating. Subjective assessments or unconfigured rules cause pipeline instability or flaky builds.
* **Decision:** Decouple performance budgets from baseline regression comparison. Budgets enforce absolute bounds (defaulting to Google Core Web Vitals Good thresholds: LCP $\le$ 2500ms, CLS $\le$ 0.10, INP $\le$ 200ms), while regression detection evaluates relative deltas against an authoritative baseline filtered by Phase 08 noise boundaries.
* **Consequences:** Changes that degrade performance are caught even if absolute budgets are met, and changes exceeding absolute budgets fail even if performance stayed flat relative to baseline.

---

## ADR-029: Stable Controlled CI Exit Codes and Status Model
* **Status:** Accepted
* **Context:** CI orchestrators (GitHub Actions, GitLab CI) require predictable process exit codes to pass or fail jobs, flag warnings, or retry failed runs.
* **Decision:** Standardize controlled status strings (`PASS`, `FAIL`, `WARN`, `INCONCLUSIVE`, `MEASUREMENT_FAILED`) mapped to fixed numeric exit codes (`0`, `1`, `2`, `3`, `4`). Provide `--fail-on-warn` to optionally elevate warnings (`2`) to hard failures (`1`) for zero-tolerance release branches.
* **Consequences:** CI pipelines can cleanly distinguish between genuine performance regressions (`1`), non-blocking warnings (`2`), configuration/target mismatches (`3`), and environment/browser launch errors (`4`).

---

## ADR-030: PR-Oriented Reporting and Baseline Provenance Invariants
* **Status:** Accepted
* **Context:** Developers and AI agents reviewing pull requests need concise, actionable feedback directly in comments or job summaries rather than parsing raw telemetry. Silently comparing different endpoints or device profiles produces false regression alarms.
* **Decision:** Require strict compatibility validation (origin, pathname, and device profile matching). Generate deterministic, aligned terminal tables and GitHub-flavored Markdown reports with explicit badges (`REGRESSION`, `VIOLATION`, `IMPROVED`, `PASS`).
* **Consequences:** Prevents false comparisons between desktop baselines and mobile PR runs. Delivers rich, scannable PR comments directly inside CI workflows.

---

## ADR-031: Polymorphic Baseline Ingestion & Invariant Validation for Verification Subsystem
* **Status:** Accepted
* **Context:** `zyra ci baseline` persists authoritative baselines wrapped in `CIBaseline` (`snapshot.evidence`), whereas raw runs produce `ZyraEvidence` or `MeasurementSnapshot`. Passing a `CIBaseline` file to `zyra verify` previously caused a crash because the CLI did not unwrap `snapshot.evidence` before delegating to the verification engine (BUG-001).
* **Decision:** Implement polymorphic payload extraction (`extractEvidenceFromPayload`) in the CLI ingestion boundary to unwrap evidence from `CIBaseline` (`snapshot.evidence`), `MeasurementSnapshot` (`evidence`), or raw `ZyraEvidence`. Enforce schema validation (`validateEvidence`) prior to comparison. Add defensive null-guards to `createMeasurementSnapshot` and `validateMeasurementCompatibility` so malformed inputs fail safely with informative diagnostic messages and exit code `1` rather than throwing uncaught `TypeError`s.
* **Consequences:** Unifies baseline consumption across CI and verification subsystems without creating redundant baseline schemas or weakening validation rules. Ensures 100% interoperability between `zyra ci baseline` and `zyra verify`.


