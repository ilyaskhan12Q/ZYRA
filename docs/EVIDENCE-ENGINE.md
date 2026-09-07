# ZYRA — Evidence Engine Documentation

> **Phase 02 Subsystem Reference**

The Evidence Engine is ZYRA's empirical measurement and data-normalization subsystem. It orchestrates real browser runs via Lighthouse, captures authoritative runtime telemetry, normalizes disparate audit data into a deterministic model, and validates the result.

```text
    Target URL + Options
              │
              ▼
    Lighthouse Runner (src/lighthouse/runner.ts)
              │
              ▼
    Chrome Process (Headless Chrome / DevTools)
              │
              ▼
    Authoritative Raw LHR (Lighthouse Result)
              │
              ▼
    Evidence Normalizer (src/evidence/normalizer.ts)
              │
              ▼
    Evidence Validator (src/evidence/validator.ts)
              │
              ▼
    Validated ZyraEvidence Model (Schema v1.0)
              │
              ▼
    CLI Output / Agent JSON Pipeline
```

---

## 1. Architectural Responsibility & Boundaries

* **Phase 02 Scope:** Collects and standardizes empirical browser evidence.
* **Phase 03 Scope (Future):** Analyzes and interprets evidence through deterministic performance rules.
* **Phase 04 Scope (Future):** Correlates browser evidence with workspace source code.

> [!IMPORTANT]
> The Evidence Engine answers: **"What happened in the browser?"**
> It does not diagnose *why* it happened, propose code modifications, or assign blame to source components.

---

## 2. Lighthouse Integration & Runner

The runner abstraction (`src/lighthouse/runner.ts`) provides isolated, lifecycle-managed execution of Google Lighthouse:
* **Headless Browser:** Spawns Chrome via `chrome-launcher` using isolated flags (`--headless=new`, `--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`).
* **Process Lifecycle:** Guarantees that Chrome processes are terminated even in timeout or failure scenarios.
* **Device Profiles:**
  * **`mobile` (Default):** Mobile viewport emulation (412x823, scale factor 1.75) and simulated 4G mobile network/CPU throttling (4x CPU slowdown).
  * **`desktop`:** Desktop viewport emulation (1350x940, scale factor 1.0) and desktop-grade throttling.
* **Timeout Protection:** Configurable timeout (default 60s) preventing hangs on unresponsive endpoints.

---

## 3. Normalized Evidence Model (Schema v1.0)

All measurements conform to the `ZyraEvidence` contract (`src/evidence/types.ts`):

```typescript
interface ZyraEvidence {
  schemaVersion: '1.0';
  target: EvidenceTarget;
  run: EvidenceRun;
  scores: EvidenceScores;
  metrics: EvidenceMetrics;
  audits: NormalizedAudit[];
  resources: {
    summary: ResourceSummaryItem[];
    items: NetworkRequestEvidence[];
  };
  network: {
    requests: NetworkRequestEvidence[];
  };
  scripts: {
    items: ScriptEvidence[];
    longTasks: LongTaskEvidence[];
  };
  images: {
    items: ImageEvidence[];
  };
  fonts: {
    items: FontEvidence[];
  };
  traceability: Record<string, string>;
}
```

### Deterministic Metric Units
To eliminate ambiguity across tools:
* **All time-based metrics** are normalized strictly to **milliseconds (ms)**:
  * First Contentful Paint (`fcp`)
  * Largest Contentful Paint (`lcp`)
  * Total Blocking Time (`tbt`)
  * Speed Index (`speedIndex`)
  * Interaction to Next Paint (`inp` - only present if captured by browser; otherwise `null`)
* **Cumulative Layout Shift (`cls`)** is recorded as a unitless numeric score.
* Missing or non-applicable metrics remain explicitly `null`—never coerced to zero. Zero (`0`) is reserved for genuine zero measurements (e.g. `CLS = 0`).

---

## 4. Source Traceability

Every metric and extracted category maintains documented traceability back to its authoritative Lighthouse audit source:

| Normalized Field | Authoritative Lighthouse Source |
| :--- | :--- |
| `metrics.fcp` | `audits['first-contentful-paint'].numericValue` |
| `metrics.lcp` | `audits['largest-contentful-paint'].numericValue` |
| `metrics.cls` | `audits['cumulative-layout-shift'].numericValue` |
| `metrics.tbt` | `audits['total-blocking-time'].numericValue` |
| `metrics.speedIndex` | `audits['speed-index'].numericValue` |
| `metrics.inp` | `audits['interaction-to-next-paint'].numericValue` |
| `scores.performance` | `categories.performance.score` |
| `resources.summary` | `audits['resource-summary'].details.items` |
| `network.requests` | `audits['network-requests'].details.items` |
| `scripts.longTasks` | `audits['long-tasks'].details.items` |
| `scripts.items` | `audits['network-requests']` filtered by `Script` + `unused-javascript` |
| `images.items` | `audits['network-requests']` filtered by `Image` + optimization audits |

---

## 5. Evidence Validation

The validator (`src/evidence/validator.ts`) enforces contract integrity before evidence can be consumed by the CLI or future subsystems:
1. Validates `schemaVersion === '1.0'`.
2. Validates target URL validity (`http:` or `https:`) and device type.
3. Enforces that time metrics are non-negative numbers or `null`.
4. Enforces that scores are normalized between `0.0` and `1.0`.
5. Rejects impossible negative durations or malformed audit collections.

---

## 6. CLI Usage

### Basic Measurement (Mobile Default)
```bash
zyra https://example.com
```

### Desktop Measurement
```bash
zyra https://example.com --desktop
```

### Machine-Readable JSON Output
```bash
zyra https://example.com --json
zyra https://example.com --desktop --json
```

### Custom Timeout
```bash
zyra https://example.com --timeout 45000
```

---

## 7. Testing Strategy

1. **Unit Tests (`tests/evidence/`, `tests/lighthouse/`):**
   * Execute entirely offline against synthetic fixtures (`fixtures/lighthouse/synthetic-mobile.json`, `fixtures/lighthouse/synthetic-desktop.json`).
   * Test metric conversion, null handling, audit preservation, and edge cases.
2. **Integration Tests (`tests/lighthouse/runner.integration.test.ts`, `tests/cli/cli.test.ts`):**
   * Spin up local HTTP servers on ephemeral ports (`127.0.0.1`).
   * Launch real headless Chrome and execute Lighthouse end-to-end without external internet dependencies.
