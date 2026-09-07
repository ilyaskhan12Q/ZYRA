# ZYRA — Post-Fix Verification & Optimization Loop

**Subsystem:** Verification Engine  
**Phase:** Phase 08  
**Status:** Complete / Operational  
**Contract Version:** Schema Version 1.0 (`VERIFICATION_SCHEMA_VERSION = '1.0'`)  

---

## 1. Mission & Philosophy

The foundational principle of Phase 08 is:

> **A successful code modification is NOT evidence of a successful performance optimization. Only post-fix measurement and empirical comparison can establish whether performance actually improved.**

When a code change is applied in Phase 07, the system records:
```text
FixResult:
  status = APPLIED
```
Phase 08 introduces the first-class verification model:
```text
VerificationResult:
  status = VERIFIED_IMPROVEMENT | VERIFIED_NO_IMPROVEMENT | REGRESSION_DETECTED | INCONCLUSIVE
  decision = KEEP_FIX | ROLLBACK_RECOMMENDED | NO_ACTION | RETRY_NOT_RECOMMENDED | INCONCLUSIVE
```

Under no circumstances does ZYRA equate `APPLIED == IMPROVED`.

```text
┌──────────────┐
│  SAFE APPLY  │ (Phase 07)
└──────┬───────┘
       │
       ▼
┌───────────────────────┐
│   POST-FIX MEASURE    │ (Lighthouse / Chrome Engine)
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│ COMPATIBILITY CHECK   │ (Origin, Pathname, Device Profile)
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│ DETERMINISTIC DELTAS  │ (Pure Mathematical Comparison)
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│ SIGNIFICANCE FILTER   │ (Noise & Jitter Boundary Evaluation)
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│  TARGET VERIFICATION  │ (Did the targeted bottleneck improve?)
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│   REGRESSION CHECK    │ (Did any other metric worsen?)
└──────┬────────────────┘
       │
       ▼
┌───────────────────────┐
│ OPTIMIZATION DECISION │ (KEEP_FIX | ROLLBACK_RECOMMENDED | NO_ACTION)
└───────────────────────┘
```

---

## 2. Core Contracts & Schema v1.0

The Verification Subsystem operates under `VERIFICATION_SCHEMA_VERSION = '1.0'`.

### `VerificationResult`
```typescript
export interface VerificationResult {
  schemaVersion: '1.0';
  verificationId: string;
  timestamp: string;
  targetUrl: string;
  device: 'mobile' | 'desktop';
  status: VerificationStatus;
  decision: OptimizationDecision;
  baseline: MeasurementSnapshot;
  postFix: MeasurementSnapshot;
  comparison: ComparisonResult;
  targetVerification?: TargetVerification;
  regressions: MetricDelta[];
  provenance: VerificationProvenance;
  repeatedRuns?: RepeatedRunSummary;
  summary: string;
}
```

### Controlled Statuses & Decisions
* **`VerificationStatus`**:
  - `VERIFIED_IMPROVEMENT`: Target metric improved with zero regressions across all other metrics.
  - `VERIFIED_NO_IMPROVEMENT`: Target metric showed no material improvement and no regressions occurred.
  - `REGRESSION_DETECTED`: One or more performance metrics worsened beyond noise boundaries.
  - `INCONCLUSIVE`: Measurement conditions differed (device mismatch, URL mismatch) or repeated runs yielded contradictory results.
  - `MEASUREMENT_FAILED`: Telemetry collection failed.
* **`OptimizationDecision`**:
  - `KEEP_FIX`: Keep the code modification in the workspace.
  - `ROLLBACK_RECOMMENDED`: Performance worsened; execute rollback using Phase 07 rollback journal to restore pre-fix code.
  - `NO_ACTION`: The modification produced negligible impact; review manually before taking further action.
  - `RETRY_NOT_RECOMMENDED`: The strategy produced no benefit and re-applying is unlikely to succeed.
  - `INCONCLUSIVE`: Re-measurement required under clean conditions.

---

## 3. Significance & Noise Filtering Policy

Browser lab runs naturally exhibit runtime jitter due to OS thread scheduling, garbage collection, and CPU throttling. ZYRA enforces deterministic, documented significance thresholds before classifying a change:

| Metric | Minimum Absolute Delta | Minimum Percentage Delta | Rationale |
| :--- | :--- | :--- | :--- |
| **LCP** | 100 ms | 3.0% | Variance under 100ms represents network/render jitter. |
| **CLS** | 0.015 | 5.0% | Variance under 0.015 represents layout coordinate rounding jitter. |
| **INP** | 25 ms | 5.0% | Variance under 25ms represents event dispatch jitter. |
| **FCP** | 50 ms | 3.0% | Variance under 50ms is routine browser painting jitter. |
| **TBT** | 30 ms | 5.0% | Variance under 30ms reflects background task scheduling jitter. |
| **Speed Index** | 100 ms | 3.0% | Variance under 100ms is frame capture jitter. |

* A change that fails to meet both minimum criteria is classified as `UNCHANGED` (`direction = 'unchanged'`, `isSignificant = false`).
* Missing or null metrics are explicitly preserved as `NOT_AVAILABLE` (`direction = 'unavailable'`).

---

## 4. Comprehensive Regression Safety

A modification may optimize one metric while degrading another (e.g. deferring a script might improve FCP/LCP while introducing Cumulative Layout Shift).

ZYRA evaluates all metrics comprehensively:
1. If the target metric improves, BUT any other metric regresses beyond threshold:
   - `status = 'REGRESSION_DETECTED'`
   - `decision = 'ROLLBACK_RECOMMENDED'`
2. ZYRA never declares overall success merely because the primary metric improved if collateral damage was observed.

---

## 5. Cryptographic Code State Validation

Before attributing post-fix measurements to an applied fix, `verifyWorkspaceCodeState` validates that the workspace files on disk match the expected SHA-256 hashes recorded in `FixResult.audit.newHashes`.

If files were edited, reverted, or corrupted out-of-band:
- `codeStateValid = false`
- `status = 'INCONCLUSIVE'`
- Verification stops before drawing false conclusions from drifted code.

---

## 6. Bounded Repeated Measurements

To evaluate noisy environments, ZYRA supports bounded repeat measurements (`--runs <n>`):
- Hard constraint: $1 \le n \le 5$.
- Infinite measurement loops are strictly prohibited.
- If repeated runs disagree (e.g. run 1 improves, run 2 regresses):
  - `outcome = 'MIXED_RESULTS'`
  - `status = 'INCONCLUSIVE'`
  - `decision = 'INCONCLUSIVE'`
- Success requires `CONSISTENT_IMPROVEMENT` across all bounded runs.

---

## 7. CLI Commands & Examples

### Empirically Verify Against Baseline Evidence
```bash
zyra verify https://example.com/ --workspace ./my-app --baseline baseline-evidence.json
```

### Verify Using Pre-Captured Post-Fix Evidence
```bash
zyra verify https://example.com/ --workspace ./my-app --baseline baseline.json --post-fix postfix.json
```

### Verify After Applying Fix Result
```bash
zyra fix verify fix-result.json --url https://example.com/ --workspace ./my-app --baseline baseline.json
```

### Multi-Run Bounded Repeat Verification
```bash
zyra verify https://example.com/ --workspace ./my-app --baseline baseline.json --runs 3
```

### Machine-Readable JSON Export
```bash
zyra verify https://example.com/ --workspace ./my-app --baseline baseline.json --json --output verification-report.json
```
