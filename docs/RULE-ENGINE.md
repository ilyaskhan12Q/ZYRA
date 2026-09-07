# ZYRA Performance Rule Engine Subsystem

**Subsystem:** `src/rules/`  
**Current Version:** `1.0` (`zyra v0.3.0`)  
**Status:** Complete & Verified  

---

## 1. Purpose & Conceptual Role

The **ZYRA Performance Rule Engine** transforms factual, normalized browser telemetry (`ZyraEvidence` Schema v1.0) into deterministic, structured `Finding`s.

The core pipeline is:

```text
  WEBSITE
     ↓
  LIGHTHOUSE
     ↓
  RAW RESULT
     ↓
  EVIDENCE ENGINE (src/evidence/)
     ↓
  ZYRA EVIDENCE (Schema v1.0)
     ↓
  PERFORMANCE RULE ENGINE (src/rules/)
     ↓
  FINDINGS (Schema v1.0)
```

The Rule Engine answers:
> *"Does the collected browser evidence satisfy an objective, known performance problem rule?"*

---

## 2. Strict Architectural Boundaries (What Phase 03 Does NOT Do)

In strict obedience to the ZYRA Permanent Engineering Rules (especially Rule 1 *Evidence Before Speculation*, Rule 2 *Never Invent Measurements*, Rule 4 *Separate Facts from Hypotheses*, Rule 11 *Prefer Deterministic Analysis Over LLM Guesswork*, and Rule 12 *Keep Evidence Traceable to Its Source*):

1. **No Codebase Investigation:** Does NOT inspect application source code, configuration files, ASTs, or bundle manifests. (Reserved for Phase 04).
2. **No Root-Cause Diagnosis:** Does NOT claim which source file, component, or backend API caused a bottleneck. (Reserved for Phase 05).
3. **No AI/LLM Calls:** Uses 100% deterministic, programmatic rules. No AI models are invoked.
4. **No Code Modifications:** Does NOT propose or apply patches, refactors, or fixes. (Reserved for Phase 07).
5. **No Measurement Invention:** Never converts missing telemetry (`null`) into `0`. Missing data produces zero findings.
6. **No Side Effects:** Rules cannot make network requests, execute shell commands, or mutate evidence objects.

---

## 3. Data Contracts

### 3.1 The Finding Contract (`FINDING_SCHEMA_VERSION = '1.0'`)

```typescript
export type FindingSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type FindingConfidence = 'DETERMINISTIC';
export type RuleCategory =
  | 'metrics'
  | 'javascript'
  | 'network'
  | 'images'
  | 'fonts'
  | 'rendering'
  | 'resources';

export interface FindingObserved {
  value: number | string;
  unit?: string;
  displayValue?: string;
}

export interface FindingThreshold {
  value: number | string;
  unit?: string;
  condition: string;
  source: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
}

export interface Finding {
  id: string;                          // Deterministic unique finding identifier (e.g. 'finding:tbt_critical')
  ruleId: string;                      // Stable rule identifier (e.g. 'TBT_CRITICAL')
  ruleVersion: string;                 // Rule semantic version (e.g. '1.0')
  category: RuleCategory;              // Domain category
  severity: FindingSeverity;           // INFO | WARNING | HIGH | CRITICAL
  title: string;                       // Short descriptive title
  description: string;                 // Detailed description of the condition
  observed: FindingObserved;           // Empirical value measured
  threshold: FindingThreshold;         // Threshold boundary that was crossed
  evidenceRefs: string[];              // Exact paths to evidence (e.g. ['metrics.tbt'])
  confidence: FindingConfidence;       // Always 'DETERMINISTIC' in Phase 03
  nextInvestigation: string;           // High-level guidance for next phase without root-cause claims
}
```

### 3.2 The PerformanceRule Contract

```typescript
export interface PerformanceRule {
  readonly id: string;
  readonly version: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: FindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly evidenceConsumed: string[];
  readonly thresholdSummary: string;
  readonly thresholdSource: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
  evaluate(evidence: ZyraEvidence): Finding[];
}
```

---

## 4. Severity & Confidence Models

### Severity Scale

| Severity | Definition |
| :--- | :--- |
| `INFO` | Noteworthy condition; informative or minor observation. |
| `WARNING` | Noticeable performance concern; warrants developer review. |
| `HIGH` | Significant performance issue negatively affecting loading or interactivity. |
| `CRITICAL` | Severe issue materially degrading user experience. |

### Confidence Classification

All Phase 03 findings operate under **`DETERMINISTIC`** confidence:
- A metric exceeding an objective threshold is a mathematical certainty from lab telemetry.
- Phase 03 does **not** assert causal confidence (e.g., "Script X caused TBT"), preserving strict separation from Phase 05.

---

## 5. Threshold Strategy & Defensible Sourcing

Thresholds are centralized in `src/rules/thresholds.ts`. No magic numbers exist inside evaluators. Every threshold is attributed to an authoritative source:

| Rule ID | Category | Threshold Condition | Severity | Source Attribution | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FCP_SLOW` | `metrics` | `> 1800 ms` | `WARNING` | Google Web Vitals | Official 75th percentile boundary for Needs Improvement. |
| `FCP_CRITICAL` | `metrics` | `> 3000 ms` | `HIGH` | Google Web Vitals | Official 75th percentile boundary for Poor. |
| `LCP_SLOW` | `metrics` | `> 2500 ms` | `WARNING` | Google Web Vitals | Core Web Vitals boundary for Needs Improvement. |
| `LCP_CRITICAL` | `metrics` | `> 4000 ms` | `CRITICAL` | Google Web Vitals | Core Web Vitals boundary for Poor. |
| `TBT_HIGH` | `metrics` | `> 200 ms` | `WARNING` | Google Lighthouse | Lighthouse scoring distribution boundary for moderate blocking. |
| `TBT_CRITICAL` | `metrics` | `> 600 ms` | `CRITICAL` | Google Lighthouse | Lighthouse scoring distribution boundary for severe blocking. |
| `CLS_POOR` | `metrics` | `> 0.10` (<= 0.25) / `> 0.25` | `WARNING` / `CRITICAL` | Google Web Vitals | Core Web Vitals boundary for layout instability (`0` is valid/good). |
| `SPEED_INDEX_SLOW` | `metrics` | `> 3400 ms` / `> 5800 ms` | `WARNING` / `HIGH` | Google Lighthouse | Lighthouse scoring distribution for visual page population. |
| `INP_SLOW` | `metrics` | `> 200 ms` / `> 500 ms` | `WARNING` / `HIGH` | Google Web Vitals | Core Web Vitals boundary for interaction latency. *Never triggers on null.* |
| `UNUSED_JS_HIGH` | `javascript` | `> 100 KB unused` | `HIGH` | ZYRA Heuristic | Conservative threshold for dead code transfer overhead. |
| `LONG_TASK` | `javascript` | `> 200 ms single` or `> 500 ms total` | `HIGH` / `CRITICAL` | ZYRA Heuristic | Severe main-thread blocking tasks (baseline is 50ms). |
| `RENDER_BLOCKING_RESOURCE` | `rendering` | `> 0 ms wasted` | `HIGH` | ZYRA Heuristic | Identifies render-blocking stylesheets/scripts delaying paint. |
| `LARGE_RESOURCE` | `network` | `> 500 KB transfer` | `WARNING` / `HIGH` | ZYRA Heuristic | Single network payload impacting queueing and bandwidth. |
| `IMAGE_OPTIMIZATION_OPPORTUNITY` | `images` | `> 100 KB potential savings` | `WARNING` | ZYRA Heuristic | Detectable image compression or modern format savings. |
| `LARGE_IMAGE` | `images` | `> 500 KB transfer` | `WARNING` | ZYRA Heuristic | Unoptimized single image transfer size. |
| `FONT_RESOURCE_LARGE` | `fonts` | `> 100 KB transfer` | `WARNING` | ZYRA Heuristic | Font file payload exceeding reasonable WOFF2 subset budget. |

---

## 6. Deterministic Ordering & Deduplication

### Sorting Strategy
Findings emitted by `RuleEngine.evaluate()` are sorted with zero randomness:
1. **Severity Descending:** `CRITICAL` (4) > `HIGH` (3) > `WARNING` (2) > `INFO` (1)
2. **Category Weight:** `metrics` (1) > `javascript` (2) > `rendering` (3) > `network` (4) > `images` (5) > `fonts` (6) > `resources` (7)
3. **Rule ID Ascending:** Alphabetical order
4. **Finding ID Ascending:** Alphabetical order

### Deduplication Policy
Findings are strictly deduplicated by `finding.id`. If multiple rules or sources produce findings with identical IDs, only the first instance is retained.

---

## 7. Error Handling & Fault Isolation

- **Fault Isolation:** If an individual evaluator throws an unexpected exception, the `RuleEngine` captures the error in `RuleExecutionError` and proceeds with evaluating remaining rules. It **never** converts a rule failure into a fake finding.
- **Strict Mode:** When `options.strict = true` is passed to `evaluate()`, the engine re-throws collected rule errors, ensuring rigorous debugging during development.

---

## 8. Programmatic API

The Rule Engine does not require the CLI and can be imported and executed in any Node.js environment:

```typescript
import { RuleEngine, RuleRegistry, type ZyraEvidence } from 'zyra';

// Initialize with default ruleset
const engine = new RuleEngine();

// Evaluate normalized evidence
const findings = engine.evaluate(evidence);

for (const finding of findings) {
  console.log(`[${finding.severity}] ${finding.ruleId}: ${finding.title}`);
  console.log(`  Observed:  ${finding.observed.displayValue ?? finding.observed.value}`);
  console.log(`  Threshold: ${finding.threshold.condition}`);
  console.log(`  Evidence:  ${finding.evidenceRefs.join(', ')}`);
}
```

---

## 9. CLI Integration

### 9.1 Terminal Output
Running `zyra <url>` clearly separates **PERFORMANCE EVIDENCE** from **FINDINGS**:

```bash
zyra https://example.com --mobile
```

Output highlights:
- Target URL and run metadata
- Empirical measurements (FCP, LCP, TBT, CLS, Speed Index, INP)
- Audit counts and resource transfer breakdown
- Distinct **FINDINGS** section displaying severity badges, observed metrics, thresholds, evidence pointers, and next investigation steps.

### 9.2 Machine-Readable JSON Output
Running `zyra <url> --json` produces a backwards-compatible payload containing all `ZyraEvidence` fields, a self-contained `evidence` object, and a structured `findings` array (`findingSchemaVersion: '1.0'`).

### 9.3 Rule Catalog Inspection
Running `zyra rules` displays all 16 registered rules. Running `zyra rules --json` outputs the full catalog as machine-readable JSON.
