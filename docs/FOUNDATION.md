# ZYRA — Architectural Foundation & Philosophy

This document articulates the foundational principles, design decisions, and scientific rationale underpinning ZYRA.

---

## 1. Why ZYRA Exists

Modern web performance optimization is hindered by a disconnect between measurement and remediation:
- **Lab audit tools** (e.g. Google Lighthouse, WebPageTest) measure runtime degradation accurately, but operate outside the application source code. Their recommendations are generic advice (e.g., *"Reduce JavaScript execution time by 1.2s"*), leaving developers to guess which bundle, library, or component is responsible.
- **AI coding assistants** can read source code, but possess no runtime visibility. When asked to "speed up this page", they speculate, recommending premature memoization, micro-optimizations, or unnecessary library swaps without knowing where the actual browser bottleneck lies.

ZYRA bridges this chasm. By running browser measurements and correlating runtime facts directly with repository source code, ZYRA equips developers and AI coding agents with empirical diagnosis and verified remediation.

---

## 2. Foundational Design Decisions

### Why Lighthouse?
Google Lighthouse is the de facto industry standard for synthetic lab performance testing. It provides standardized implementations of Core Web Vitals (LCP, CLS, TBT, FCP, Speed Index), well-documented audits, and structured diagnostic logs. Rather than reinventing browser instrumentation, ZYRA builds on Lighthouse as an empirical measurement foundation while addressing its key deficiency: lack of source code correlation.

### Why Local-First?
In Phase 01 and V1, ZYRA operates entirely within the developer's local workspace. Local-first execution provides several critical benefits:
1. **Zero Cloud Dependencies:** Operates without hosted servers, API subscriptions, or external latency.
2. **Codebase Privacy:** Proprietary code, bundler configurations, and local environments never leave the developer machine.
3. **Instant Developer Feedback:** Directly tests local development servers (`localhost`), staging builds, and local changes before commits.

### Why Node.js 22+ for ZYRA's Runtime?
Modern Lighthouse (v13+) requires Node.js 22+ for native V8 features, modern web standards, and ESM capabilities. ZYRA enforces this runtime for its own engine while keeping its execution environment strictly isolated from target projects. Target projects analyzed by ZYRA may run any Node.js version or non-Node stack.

### Why Persistent Context is Mandatory
AI agents operate across discrete sessions and context windows. Without an explicit persistent memory system, successive agent runs forget architectural boundaries, revert deliberate decisions, or violate project constraints. The `.context/` directory provides durable memory that grounds every agent interaction in established rules, contracts, and task states.

### Why Deterministic Evidence Must Be Separated From AI Reasoning
LLMs excel at pattern recognition, synthesis, and code generation, but are prone to hallucinating quantitative data and misinterpreting nested metrics. ZYRA strictly decouples:
- **Fact Generation:** Produced exclusively by browser engines, DevTools traces, and deterministic AST parsers.
- **Reasoning:** Carried out by AI models that operate strictly over verified facts.

### Why Verification is Mandatory
A code change designed to improve performance is merely an unverified hypothesis. In practice, code optimizations frequently have unintended consequences:
- Inlining resources can bloat initial HTML and degrade TTFB.
- Lazy-loading images can push the LCP candidate further down the critical path.
- Offloading work to web workers can introduce postMessage serialization overhead.

Therefore, no fix in ZYRA is declared successful until an automated build/test passes and an empirical re-measurement under identical conditions confirms an improvement delta.

### Why Root-Cause Attribution is Harder Than Measurement
Measuring that Largest Contentful Paint took 4.2 seconds is straightforward; identifying *why* requires tracing across multiple system boundaries:
1. Was the server slow to respond (TTFB)?
2. Was the LCP image discovered late in the HTML parser?
3. Did a synchronous client bundle block rendering?
4. Did dynamic client-side hydration delay paint?

Attribution requires cross-referencing network waterfalls, DOM element timelines, bundler chunks, and framework lifecycle hooks.

### Why ZYRA Does Not Simply Dump Lighthouse JSON Into an LLM
A raw Lighthouse JSON output often exceeds 10,000 lines of deeply nested telemetry. Dumping this entire blob into an LLM context window causes:
- Context exhaustion and high token cost.
- Attention dilution and hallucination of non-existent issues.
- Superficial summaries that parrot top-level scores rather than pinpointing code-level causes.

ZYRA filters, normalizes, and extracts structured evidence before presenting distilled, relevant facts to reasoning models.

---

## 3. The Accuracy Model

ZYRA distinguishes between different tiers of empirical certainty. Never claim absolute certainty when probabilistic reasoning is involved.

| Tier | Concept | Nature | Certainty Level | Description |
| :---: | :--- | :---: | :---: | :--- |
| **Tier 1** | **Measurement Accuracy** | Empirical Fact | High / Quantitative | Exact values recorded by browser instrumentation (e.g. LCP = 3120ms, JS transfer = 840 KB). Subject only to run-to-run lab variance. |
| **Tier 2** | **Finding Accuracy** | Deterministic Heuristic | High / Logical | Programmatic detection of established anti-patterns (e.g., render-blocking script tag without `defer` or `async`). |
| **Tier 3** | **Root-Cause Confidence** | Correlative Inference | Probabilistic (0.0 – 1.0) | The degree of confidence that a specific code artifact is the primary contributor to a measured bottleneck. |
| **Tier 4** | **Fix Confidence** | Predictive Hypothesis | Probabilistic | The estimated likelihood that a proposed code modification will remediate the root cause without side effects. |
| **Tier 5** | **Verification Certainty** | Empirical Comparison | High / Delta-Based | The factual delta calculated by re-measuring the application post-fix under identical conditions. |

### Confidence Terminology

When communicating with users and agents, ZYRA strictly uses standardized terminology:
- **Observed Fact:** Directly extracted from runtime telemetry or source files.
- **High Confidence ($\ge 0.85$):** Multiple corroborating evidence sources directly point to a single source entity.
- **Medium Confidence ($0.60 – 0.84$):** Clear evidence of bottleneck, but multiple potential code contributors exist.
- **Low Confidence ($< 0.60$):** Telemetry suggests a bottleneck, but attribution to code is ambiguous.
- **Inconclusive:** Run-to-run variance exceeds observed delta.
