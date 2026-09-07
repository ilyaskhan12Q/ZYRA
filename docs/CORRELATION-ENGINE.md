# ZYRA Correlation & Root-Cause Analysis Subsystem

**Subsystem:** `src/correlation/`  
**Current Version:** `1.0` (`zyra v0.5.0`)  
**Status:** Complete & Verified  

---

## 1. Purpose & Conceptual Role

The **Evidence Correlation & Root-Cause Analysis Subsystem** bridges the gap between empirical browser telemetry and local application source code.

It takes:
1. **Empirical Browser Evidence** (`ZyraEvidence`, Schema v1.0 from Phase 02)
2. **Deterministic Performance Findings** (`Finding[]`, Schema v1.0 from Phase 03)
3. **Target Codebase Evidence** (`CodebaseEvidence`, Schema v1.0 from Phase 04)

and produces:
- **Candidate Contributors** (`CandidateContributor[]`)
- **Evidence Links** (`EvidenceLink[]`) with bidirectional traceability
- **Root-Cause Assessments** (`RootCauseAssessment[]`)
- **Deterministic Confidence** (`Confidence` score $0.0 \le \text{score} \le 1.0$ with explicit signals)

```text
Performance Finding
        ↓
Relevant Browser Evidence
        ↓
Relevant Resource / Audit / Script Evidence
        ↓
Codebase Evidence
        ↓
Route / Entry Point / Import / Asset Correlation
        ↓
Candidate Contributor
        ↓
Supporting Evidence
        ↓
Contradicting / Missing Evidence
        ↓
Confidence Scoring
        ↓
Root-Cause Assessment
```

---

## 2. Core Doctrine: Correlation Is Not Causation

ZYRA strictly adheres to the principle that **a file's presence is not proof of causality**:

### Invalid Reasoning
```text
TBT is high (800ms) + src/App.tsx exists = App.tsx caused TBT
LCP is poor (5000ms) + react is in package.json = React is the root cause
```

### Valid Reasoning
```text
Finding: LCP_CRITICAL (4,800ms)
  ↓
Browser Evidence: Largest Contentful Paint element = image (/images/hero.webp)
  ↓
Network Evidence: 870 KB transfer size for /images/hero.webp
  ↓
Codebase Evidence: Asset public/images/hero.webp exists (870 KB on disk)
  ↓
Route Correlation: Target URL / matches route / (src/app/page.tsx)
  ↓
Candidate: public/images/hero.webp
  ↓
Confidence: 0.85 (Supported by EXACT_ASSET_MATCH, LCP_ELEMENT_AUDIT_MATCH, METADATA_CORROBORATION, MULTIPLE_INDEPENDENT_SIGNALS)
  ↓
Assessment: STRONGLY_SUPPORTED_CONTRIBUTOR
```

If the evidence is incomplete, third-party, or unmapped, ZYRA returns:
```text
INSUFFICIENT_EVIDENCE
```
or
```text
NO_CORRELATION
```
Never a fabricated diagnosis.

---

## 3. Strict Architectural Boundaries (What Phase 05 Does NOT Do)

In accordance with ZYRA Permanent Engineering Rules:
1. **Zero Target Code Modification:** Does NOT write, patch, or alter user codebase files. (Reserved for Phase 07).
2. **Zero Code Execution:** Does NOT run user build scripts, test suites, or target node processes.
3. **Zero AI/LLM Invocations:** The correlation engine is 100% deterministic and programmatic.
4. **Zero Measurement Invention:** Uses only empirical browser data from Phase 02 and static codebase facts from Phase 04.
5. **Zero Speculative Causality:** Never converts `possible` into `confirmed` without corroborating multi-source evidence.

---

## 4. Data Contracts (Schema Version 1.0)

### 4.1 Controlled Correlation Statuses
- `NO_CORRELATION`: No deterministic relationship found between finding and codebase.
- `POSSIBLE_CORRELATION`: Weak or single-source association.
- `SUPPORTED_CONTRIBUTOR`: Substantial evidence linking resource to candidate.
- `STRONGLY_SUPPORTED`: Multiple independent signals confirm direct attribution with zero contradictions.
- `INSUFFICIENT_EVIDENCE`: Required data missing (e.g. external third-party script or unmapped bundle).

### 4.2 Conservative Assessment Levels
- `OBSERVED`: Empirical measurement present.
- `CORRELATED`: Meaningful link established.
- `SUPPORTED_CONTRIBUTOR`: Evidence supports plausible contribution.
- `STRONGLY_SUPPORTED_CONTRIBUTOR`: Multiple independent signals corroborate primary contributor.
- `UNKNOWN`: Insufficient evidence to assess causality.

### 4.3 Evidence Link Contract
```typescript
export interface EvidenceLink {
  sourceType: EvidenceSourceType;
  sourceRef: string;
  targetType: EvidenceSourceType;
  targetRef: string;
  relationship: string;
  strength: 'weak' | 'moderate' | 'strong';
  reason: string;
}
```

---

## 5. Deterministic Confidence Model

Confidence scores are earned additively from explicit signals and penalized subtractively:

| Signal Name | Weight | Category | Rationale |
| :--- | :--- | :--- | :--- |
| `EXACT_ASSET_MATCH` | `+0.35` | Asset | Served path matches workspace file relative path exactly. |
| `LCP_ELEMENT_AUDIT_MATCH` | `+0.25` | Audit | Lighthouse LCP audit explicitly named this resource. |
| `EXACT_ROUTE_MATCH` | `+0.20` | Route | Target URL exactly matches a declared static route. |
| `PROBABLE_ASSET_MATCH` | `+0.20` | Asset | Unique filename match across workspace assets. |
| `DYNAMIC_ROUTE_MATCH` | `+0.15` | Route | Target URL matches a framework dynamic route pattern. |
| `RELEVANT_AUDIT_MATCH` | `+0.15` | Audit | Diagnostic audit (render-blocking, unused JS) cited resource. |
| `METADATA_CORROBORATION` | `+0.10` | Metadata | Transfer size matches disk size within 25% tolerance. |
| `ENTRY_POINT_RELATIONSHIP`| `+0.10` | Architecture | Script bundle associates with application entry point. |
| `MULTIPLE_INDEPENDENT_SIGNALS` | `+0.10` | Corroboration | Two or more independent evidence tiers corroborate. |
| `CONTRADICTING_CACHED_TRANSFER` | `-0.25` | Contradiction | Resource was cached (0 bytes transferred). |
| `AMBIGUOUS_MATCH_PENALTY` | `-0.30` | Ambiguity | Multiple conflicting workspace files match same name. |
| `UNRESOLVED_BUNDLE_PENALTY` | `-0.35` | Missing Data | Bundle lacks source maps for component tracing. |
| `MISSING_LOCAL_SOURCE_PENALTY` | `-0.40` | Missing Data | External third-party resource with no local file. |

Calculation:
$$\text{score} = \max\left(0.0, \min\left(1.0, \sum \text{weights}\right)\right)$$

---

## 6. Correlation Rules Catalog

The subsystem includes 6 specialized deterministic correlation rules:

1. **`CORR_IMAGE_ASSET` (v1.0):** Correlates `LCP_CRITICAL`, `LCP_SLOW`, `LARGE_IMAGE`, and `IMAGE_OPTIMIZATION_OPPORTUNITY` with scanned image assets, routes, and LCP element audits.
2. **`CORR_FONT_ASSET` (v1.0):** Correlates `FONT_RESOURCE_LARGE` with scanned font assets and identifies external font CDNs.
3. **`CORR_RENDER_BLOCKING` (v1.0):** Correlates `RENDER_BLOCKING_RESOURCE` and paint delays (`FCP_SLOW`, `FCP_CRITICAL`) with stylesheets, scripts, and entry points.
4. **`CORR_SCRIPT_IMPORT` (v1.0):** Correlates JavaScript execution bottlenecks (`UNUSED_JS_HIGH`, `LONG_TASK`, `TBT_HIGH`, `TBT_CRITICAL`) with entry points, imports, and dependencies while checking source map availability.
5. **`CORR_RESOURCE_ASSET` (v1.0):** Correlates generic large payloads (`LARGE_RESOURCE`) with static assets.
6. **`CORR_ROUTE_ENTRY` (v1.0):** Correlates target URL with static and dynamic framework routes as non-causal supporting context.

---

## 7. Deterministic Ordering & Deduplication

### Deduplication Policy
When multiple rules identify the same candidate entity:
- Findings are merged and sorted.
- Traceability links are deduplicated by `sourceRef + targetRef + relationship`.
- Supporting, contradicting, and missing evidence lists are merged.
- Confidence is recalculated from the combined signal profile.
- The highest correlation status is assigned.

### Candidate Sorting Policy
1. **Status Strength:** `STRONGLY_SUPPORTED` > `SUPPORTED_CONTRIBUTOR` > `POSSIBLE_CORRELATION` > `INSUFFICIENT_EVIDENCE` > `NO_CORRELATION`
2. **Confidence Score:** Descending
3. **Highest Finding Severity:** `CRITICAL` > `HIGH` > `WARNING` > `INFO`
4. **Candidate ID:** Alphabetical ascending

---

## 8. CLI Usage

### Running Measurement with Codebase Correlation
```bash
# Correlate target website with local workspace
zyra https://example.com --workspace ./target-app

# Explicit analyze command
zyra analyze https://example.com --workspace ./target-app

# Machine-readable JSON output
zyra analyze https://example.com --workspace ./target-app --json
```

---

## 9. Verification & Invariants

- **Determinism:** `JSON.stringify(run1) === JSON.stringify(run2)` across identical runs.
- **Security:** Read-only analysis. Workspace files are never modified.
- **Coverage:** Tested across 7 synthetic scenarios (strong LCP, ambiguous matches, external scripts, irrelevant assets, dynamic routes, and cached transfers).
