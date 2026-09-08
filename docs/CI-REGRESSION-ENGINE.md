# ZYRA — CI & Regression Detection Engine

**Subsystem:** CI / Regression Detection Engine  
**Phase:** Phase 09  
**Status:** Complete / Operational  
**Contract Version:** Schema Version 1.0 (`CI_SCHEMA_VERSION = '1.0'`)  

---

## 1. Mission & Objective

The primary objective of the **CI / Regression Detection Subsystem** is to provide automated, deterministic performance gating for web applications in Continuous Integration (CI) pipelines and Pull Request (PR) workflows.

ZYRA CI answers two critical engineering questions before code merges into production:
1. **Regression Gate:** Did this code change degrade any Core Web Vital or lab metric beyond allowable statistical noise compared to the authoritative baseline?
2. **Budget Gate:** Does the application violate absolute performance budgets (e.g. LCP $\le$ 2500 ms, CLS $\le$ 0.10, INP $\le$ 200 ms)?

```text
       Pull Request / Commit
                 ↓
      ZYRA CI MEASUREMENT (Live or Pre-Captured)
                 ↓
           EVIDENCE (v1.0)
                 ↓
      BASELINE COMPATIBILITY CHECK
                 ↓
       DETERMINISTIC COMPARISON
   (Significance Filter & Noise Boundaries)
                 ↓
        BUDGET ENFORCEMENT
                 ↓
      POLICY RESOLUTION ENGINE
                 ↓
   ┌─────────────┴─────────────┐
   ↓                           ↓
Terminal Report / PR Comment   Exit Code (0 | 1 | 2 | 3 | 4)
```

---

## 2. Core Architecture & Layer Flow

ZYRA CI orchestrates existing core subsystems without reinventing measurement or comparison engines:
* **Evidence Engine (`src/evidence/`):** Collects and normalizes browser telemetry to milliseconds and unitless layout shift scores.
* **Verification Engine (`src/verification/`):** Evaluates mathematical deltas and filters routine laboratory timing jitter.
* **CI Subsystem (`src/ci/`):**
  * `baseline.ts`: Baseline persistence, extraction, and compatibility verification.
  * `budgets.ts`: Parsing and deterministic evaluation of performance budgets.
  * `regression.ts`: Severity classification of metric regressions.
  * `policy.ts`: Pure mapping of telemetry, budgets, and regressions to controlled statuses and exit codes.
  * `reporter.ts`: Human-readable terminal tables and GitHub-flavored PR comments.
  * `runner.ts`: High-level orchestration pipeline.

---

## 3. Data Contracts & Schema Version 1.0

The subsystem operates under `CI_SCHEMA_VERSION = '1.0'`.

### `CIResult` Contract

```typescript
export interface CIResult {
  schemaVersion: '1.0';
  id: string;
  timestamp: string;
  targetUrl: string;
  device: 'mobile' | 'desktop';
  status: CIExitStatus;
  exitCode: number;
  policy: CIPolicy;
  currentRun: {
    url: string;
    device: 'mobile' | 'desktop';
    metrics: Record<string, number | null>;
    scores: Record<string, number | null>;
    evidenceTimestamp: string;
  };
  baseline?: {
    id: string;
    url: string;
    device: 'mobile' | 'desktop';
    timestamp: string;
    metrics: Record<string, number | null>;
    scores: Record<string, number | null>;
    compatible: boolean;
    incompatibilityReason?: string;
  };
  comparison?: CIComparisonSummary;
  budgets: {
    passed: boolean;
    evaluations: CIBudgetEvaluation[];
    violations: CIBudgetEvaluation[];
    warnings: CIBudgetEvaluation[];
  };
  summary: string;
  prComment?: string;
}
```

### Controlled Exit Statuses & Exit Codes

CI exit codes must be stable and deterministic across all execution environments:

| Status | Exit Code | Condition |
| :--- | :---: | :--- |
| **`PASS`** | `0` | All budgets satisfied; zero significant regressions detected. |
| **`FAIL`** | `1` | One or more hard performance budgets violated, or significant regression detected. |
| **`WARN`** | `2` | Warning-level budget exceeded, or non-blocking minor regression detected. |
| **`INCONCLUSIVE`** | `3` | Incompatible baseline (different URL or device profile), or baseline missing when required. |
| **`MEASUREMENT_FAILED`** | `4` | Browser launch failure, connection timeout, or invalid target URL. |

> [!TIP]
> Use `--fail-on-warn` in strict release pipelines to elevate exit code `2` (`WARN`) to `1` (`FAIL`).

---

## 4. Baseline Management & Compatibility Invariant

A baseline represents the accepted performance standard for a specific endpoint under a specific device profile.

### Baseline Provenance Contract (`CIBaseline`)

```typescript
export interface CIBaseline {
  schemaVersion: '1.0';
  id: string;
  url: string;
  normalizedUrl: string;
  device: 'mobile' | 'desktop';
  timestamp: string;
  zyraVersion: string;
  metrics: {
    fcp: number | null;
    lcp: number | null;
    cls: number | null;
    tbt: number | null;
    speedIndex: number | null;
    inp: number | null;
  };
  scores: {
    performance: number | null;
  };
  snapshot: MeasurementSnapshot;
  metadata?: Record<string, unknown>;
}
```

### Compatibility Invariant

ZYRA strictly prohibits comparing measurements taken under incompatible parameters. A comparison is rejected as `INCONCLUSIVE` if:
1. **Target URL Mismatch:** The origin or normalized pathname differs (e.g. `https://example.com/` vs `https://example.com/checkout`).
2. **Device Profile Mismatch:** One run used `mobile` emulation while the other used `desktop`.
3. **Schema Incompatibility:** Baseline schema version does not equal `'1.0'`.
4. **Malformed Baseline:** File is empty, missing, or corrupted JSON.

---

## 5. Performance Budgets

Performance budgets define maximum acceptable limits for Core Web Vitals and lab metrics.

### Configuration Format

Budgets can be configured via a JSON file, inline JSON string, or configuration object:

```json
{
  "budgets": {
    "LCP": 2500,
    "FCP": 1800,
    "CLS": 0.10,
    "INP": 200,
    "TBT": 200,
    "SpeedIndex": 3400
  }
}
```

Detailed threshold objects supporting warning limits are also supported:

```json
{
  "budgets": {
    "LCP": { "max": 2500, "warn": 2200 },
    "CLS": { "max": 0.10, "warn": 0.08 }
  }
}
```

### Authoritative Default Budgets (Google Web Vitals Good Thresholds)

When no explicit configuration is provided, ZYRA CI defaults to the official Google Core Web Vitals "Good" criteria:
* **Largest Contentful Paint (LCP):** $\le 2500\text{ ms}$
* **First Contentful Paint (FCP):** $\le 1800\text{ ms}$
* **Cumulative Layout Shift (CLS):** $\le 0.10$
* **Interaction to Next Paint (INP):** $\le 200\text{ ms}$
* **Total Blocking Time (TBT):** $\le 200\text{ ms}$
* **Speed Index:** $\le 3400\text{ ms}$

---

## 6. Regression Detection & Noise Filtering

Browser performance measurements naturally exhibit minor runtime fluctuations due to OS thread scheduling, garbage collection, and network variability.

ZYRA CI reuses the conservative noise boundaries codified in Phase 08:

| Metric | Minimum Absolute Delta | Minimum Percentage Delta | Classification Below Boundary |
| :--- | :--- | :--- | :--- |
| **LCP** | $100\text{ ms}$ | $3.0\%$ | `UNCHANGED` (Laboratory jitter) |
| **CLS** | $0.015$ | $5.0\%$ | `UNCHANGED` (Layout rounding jitter) |
| **INP** | $25\text{ ms}$ | $5.0\%$ | `UNCHANGED` (Dispatch jitter) |
| **FCP** | $50\text{ ms}$ | $3.0\%$ | `UNCHANGED` (Paint jitter) |
| **TBT** | $30\text{ ms}$ | $5.0\%$ | `UNCHANGED` (Scheduling jitter) |
| **Speed Index** | $100\text{ ms}$ | $3.0\%$ | `UNCHANGED` (Frame capture jitter) |

### Regression Severity
* **`CRITICAL`:** Any significant regression in a Core Web Vital (LCP, CLS, INP) or any metric that simultaneously breaches its performance budget.
* **`WARNING`:** Any significant regression in secondary diagnostic metrics (FCP, TBT, Speed Index) while budgets remain intact.

---

## 7. Policy Engine

The CI policy engine deterministically resolves status and exit code based on the following precedence hierarchy:

```text
1. Did the measurement fail?
   → YES: MEASUREMENT_FAILED (Exit 4)

2. Is the baseline incompatible or missing (when required)?
   → YES: INCONCLUSIVE (Exit 3)

3. Are there hard budget violations or critical regressions?
   → YES: FAIL (Exit 1)

4. Are there warning-level budget thresholds crossed or minor regressions?
   → YES: WARN (Exit 2, or Exit 1 if --fail-on-warn)

5. All budgets satisfied and zero regressions?
   → YES: PASS (Exit 0)
```

---

## 8. CLI Usage & Commands

### 1. Capture and Persist a Baseline
```bash
# Capture live mobile baseline
zyra ci baseline https://example.com/ --output baseline.json

# Capture baseline from pre-existing evidence file (offline mode)
zyra ci baseline https://example.com/ --current measurement.json --output baseline.json
```

### 2. Run CI Performance Check
```bash
# Check against baseline with default budgets
zyra ci https://example.com/ --baseline baseline.json

# Check with custom budgets file
zyra ci https://example.com/ --baseline baseline.json --budget budgets.json

# Check with inline budget JSON
zyra ci https://example.com/ --baseline baseline.json --budget '{"budgets":{"LCP":2200}}'

# Emit machine-readable JSON (Schema v1.0)
zyra ci https://example.com/ --baseline baseline.json --json

# Save JSON result and PR Markdown comment to files
zyra ci https://example.com/ \
  --baseline baseline.json \
  --output zyra-result.json \
  --markdown-output pr-comment.md

# Enforce strict policy (elevating warnings to failure)
zyra ci https://example.com/ --baseline baseline.json --fail-on-warn
```

---

## 9. GitHub Actions Integration

ZYRA includes a production-quality GitHub Actions workflow in `.github/workflows/zyra-ci.yml`.

### Example Workflow Configuration

```yaml
name: ZYRA CI

on:
  pull_request:
    branches: [main, master]

jobs:
  performance-gate:
    name: Performance Regression Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install & Build
        run: |
          npm ci
          npm run build

      - name: Run ZYRA CI Performance Gate
        run: |
          node dist/src/cli/index.js ci https://example.com/ \
            --baseline .ci/zyra-baseline.json \
            --budget .ci/zyra-budgets.json \
            --output zyra-ci-result.json \
            --markdown-output zyra-ci-summary.md
          if [ -n "$GITHUB_STEP_SUMMARY" ]; then
            cat zyra-ci-summary.md >> $GITHUB_STEP_SUMMARY
          fi

      - name: Upload CI Report Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zyra-performance-report
          path: |
            zyra-ci-result.json
            zyra-ci-summary.md
```

---

## 10. Security Boundaries

CI runners frequently execute untrusted pull-request inputs. ZYRA enforces strict security boundaries:
1. **Untrusted Input Isolation:** Baseline and budget JSON files are treated as untrusted data; parsed through strict schema validators.
2. **Zero Arbitrary Execution:** ZYRA CI never executes scripts (`eval`, `npm run`, or shell commands) supplied by the measured application or baseline files.
3. **Secret Protection:** Automatic exclusion of secret file paths (`.env*`, `*.pem`, `*.key`, `id_rsa*`).
4. **Workspace Containment:** Read-only analysis guarantee; zero file mutation of target workspaces during CI checks.

---

## 11. Known Limitations

* **Lab vs. Field Data:** ZYRA CI measures laboratory performance using headless Chrome and Lighthouse. Field real-user metrics (RUM / CrUX) reflect varied user devices and network conditions and remain separate from lab CI regression gates.
* **Controlled Environment Requirements:** For highest consistency in CI runners, ensure the runner host has consistent CPU and network allocations.
