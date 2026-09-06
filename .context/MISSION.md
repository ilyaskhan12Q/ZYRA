# ZYRA — Mission & North Star

## 1. What is ZYRA?

**ZYRA** is an installable AI-agent skill and developer tool for web-performance investigation and optimization.

It operates directly inside the developer's workspace to bridge the gap between real-world browser performance measurements and actual application source code.

ZYRA is **NOT** a clone of Google PageSpeed Insights.
ZYRA is **NOT** merely a raw Lighthouse JSON wrapper.
ZYRA is **NOT** a generic AI chatbot that guesses performance problems.
ZYRA is **NOT** a tool that claims performance fixes without verification.

---

## 2. Why ZYRA Exists

Traditional performance tooling stops at reporting lab scores and generic audits. Developers receive advice such as *"Reduce unused JavaScript"* or *"Avoid large layout shifts"*, but are left to manually decipher which bundled component, third-party script, or state change caused the issue in their specific repository.

Conversely, generic AI coding assistants hallucinate potential performance bottlenecks by reading source code in isolation without any empirical runtime telemetry, resulting in speculative or ineffective changes.

ZYRA exists to unite **empirical browser evidence** with **repository-level code analysis**, creating an autonomous, verifiable loop for web performance engineering.

---

## 3. The Core Loop

ZYRA executes a rigorous, closed-loop investigation cycle:

```text
    MEASURE
       ↓
    COLLECT EVIDENCE
       ↓
    ANALYZE
       ↓
    TRACE TO CODE
       ↓
    DIAGNOSE
       ↓
    FIX
       ↓
    BUILD / TEST
       ↓
    RE-MEASURE
       ↓
    VERIFY
```

1. **Measure:** Run browser-based lab tests (e.g., Lighthouse / Chrome DevTools).
2. **Collect Evidence:** Extract structured runtime facts (metrics, network timings, resource sizes, long tasks, render-blocking resources).
3. **Analyze:** Run deterministic rules against the normalized evidence.
4. **Trace to Code:** Inspect the target workspace (configs, components, routes, bundle manifests, imports).
5. **Diagnose:** Correlate browser findings with specific source code locations and calculate confidence.
6. **Fix:** Propose or apply targeted, safe, and reversible code modifications.
7. **Build / Test:** Verify the project still builds and passes automated tests.
8. **Re-measure:** Re-run the performance test under identical device/network conditions.
9. **Verify:** Calculate the actual delta between before and after measurements to prove improvement.

---

## 4. Primary Principle: Evidence Before Speculation

ZYRA adheres strictly to the **Evidence First** doctrine:
- Raw browser measurements and deterministic rules provide factual evidence.
- AI reasoning operates exclusively on observed facts and inspected codebase artifacts.
- The AI must **never** manufacture or hallucinate raw measurements.
- A proposed fix is never declared successful until an actual re-measurement confirms it.

---

## 5. Long-Term Objective

To give AI coding agents and human engineers the ability to autonomously investigate, diagnose, and optimize web applications with scientific rigor, high confidence, and verifiable results directly within their development workflows.
