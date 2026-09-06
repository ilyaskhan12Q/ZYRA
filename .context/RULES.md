# ZYRA — Permanent Engineering Rules

All contributors, engineers, and AI coding agents working on or with ZYRA must strictly obey these 15 rules at all times.

---

### Rule 1 — Evidence Before Speculation
Always ground analysis in empirical data. Never speculate on a bottleneck without supporting browser or codebase evidence.

### Rule 2 — Never Invent Measurements
Never fabricate Lighthouse scores, timings, transfer sizes, or benchmarks. Unmeasured items must be labeled `UNKNOWN` or `NOT YET MEASURED`.

### Rule 3 — Never Claim Unverified Improvements
A code change is an expectation, not a result. Only claim an improvement after a verified before/after re-measurement confirms it.

### Rule 4 — Separate Facts from Hypotheses
Strictly categorize findings into:
- **OBSERVED FACT** (directly measured or inspected)
- **INFERENCE** (logical deduction from facts)
- **HYPOTHESIS** (plausible explanation requiring validation)
- **RECOMMENDATION** (proposed action)
- **VERIFIED RESULT** (confirmed post-fix measurement delta)

### Rule 5 — Preserve Existing Project Behavior
Performance optimizations must never break application functionality, business logic, or styling.

### Rule 6 — Never Modify a Target Project Blindly
Do not apply bulk or blanket refactoring. Changes must be surgical and targeted specifically to confirmed bottlenecks.

### Rule 7 — Inspect Before Editing
Always inspect the relevant source code, configuration files, and dependencies before proposing or writing modifications.

### Rule 8 — Test After Modifying
After applying any fix, execute the project's build and automated test suites to ensure zero functional regressions.

### Rule 9 — Re-measure After Performance Fixes
Run a fresh performance measurement under identical environment conditions to evaluate the actual effect of a change.

### Rule 10 — Framework-Specific Rules Require Prior Framework Detection
Never apply Next.js, React, Nuxt, or Vite rules unless the corresponding framework is positively detected in the project.

### Rule 11 — Prefer Deterministic Analysis Over LLM Guesswork
Use programmatic rules, AST analysis, and deterministic parsers for audits. Reserve LLM reasoning for high-level correlation and synthesis.

### Rule 12 — Keep Evidence Traceable to Its Source
Every finding must cite its origin (e.g. audit ID, network request URL, source file line number, or trace timestamp).

### Rule 13 — Keep Fixes Reversible
Every automated change must be tracked and easily rolled back if compilation fails, tests break, or performance regresses.

### Rule 14 — Do Not Hide Uncertainty
If an analysis is noisy, ambiguous, or inconclusive, explicitly state the level of uncertainty. Never present assumptions as certainty.

### Rule 15 — Do Not Skip Context Updates
Every meaningful implementation session must update `.context/CURRENT_STATE.md`, `.context/TASKS.md`, and `.context/CHANGELOG.md` before stopping.
