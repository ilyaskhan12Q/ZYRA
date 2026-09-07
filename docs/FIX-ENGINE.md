# ZYRA — Fix Subsystem Specification

## 1. Overview & Architectural Mission

The **ZYRA Fix Subsystem** introduces the first controlled ability for ZYRA to move from empirical diagnosis to safe, evidence-backed code modifications.

```text
TARGET WEBSITE
      ↓
LIGHTHOUSE
      ↓
BROWSER EVIDENCE (src/evidence/)
      ↓
PERFORMANCE FINDINGS (src/rules/)
      ↓
CODEBASE EVIDENCE (src/codebase/)
      ↓
CORRELATION (src/correlation/)
      ↓
ROOT-CAUSE ASSESSMENT
      ↓
FIX PLANNER (src/fixes/planner.ts)
      ↓
SAFE MODIFICATION ENGINE (src/fixes/executor.ts)
      ↓
MODIFIED WORKSPACE
      ↓
PHASE 08 VERIFICATION LOOP
```

### Core Doctrine: A Proposed Fix Is Not Automatically a Successful Fix
Every modification planned or executed by ZYRA must strictly obey:
1. **Evidence-Backed:** Proposed changes must link directly to observed browser evidence, rule findings, and correlation candidates. Anonymous or speculative optimizations are strictly forbidden.
2. **Separation of Planning and Execution:** Fix planning (`zyra fix plan`) is 100% read-only and produces an immutable `FixPlan`. Modification occurs only via explicit execution (`zyra fix apply`).
3. **Optimistic Concurrency & Content Guard:** Every planned operation records the SHA-256 hash of the target file. If user changes occur between planning and application, execution stops immediately with `PLAN_STALE`.
4. **Transactional Rollback Safety:** Multi-file modifications execute within a transaction journal. If any operation fails validation or disk write, all modified files are atomically restored to their pre-operation state.
5. **Phase 08 Verification Boundary:** An applied code change only records `APPLIED`. Performance improvements must be empirically verified through post-fix re-measurement in Phase 08.

---

## 2. Core Contracts & Data Model (Schema v1.0)

### 2.1 FixPlan Contract
A structured, versioned, machine-readable specification of proposed modifications:

```typescript
export interface FixPlan {
  schemaVersion: '1.0';
  planId: string;
  createdAt: string;
  targetWorkspace: string;
  sourceFindingIds: string[];
  sourceCorrelationIds: string[];
  candidate: FixCandidate;
  strategy: {
    id: string;
    version: string;
    name: string;
  };
  operations: FixOperation[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  confidence: number;
  expectedImpact: FixExpectedImpact;
  preconditions: FixPrecondition[];
  safetyChecks: FixSafetyCheck[];
  rollbackInformation: FixRollbackInfo;
  status: FixPlanStatus;
}
```

### 2.2 FixOperation Contract
A minimal, surgical code edit targeting a specific file:

```typescript
export interface FixOperation {
  id: string;
  type: 'REPLACE_TEXT' | 'REMOVE_UNUSED_IMPORT' | 'EDIT_ATTRIBUTE' | 'INSERT_TEXT' | 'REPLACE_IMPORT' | 'NOOP_ADVICE';
  targetPath: string; // Workspace-relative POSIX path
  originalContentHash: string; // SHA-256 hash of original file content
  expectedOriginalContent?: string;
  replacementContent?: string;
  location?: {
    startLine?: number;
    endLine?: number;
    index?: number;
  };
  reason: string;
}
```

### 2.3 Non-Guaranteed Expected Impact
ZYRA never claims that a fix "will improve LCP by 800ms" prior to measurement. Expected impacts are strictly formulated as hypotheses:

```typescript
export interface FixExpectedImpact {
  targetMetric: string;
  estimatedDirection: 'improve' | 'neutral';
  description: string;
}
```

---

## 3. Built-in Fix Strategies

ZYRA registers 6 deterministic, versioned fix strategies in `FixStrategyRegistry`:

| Strategy ID | Version | Risk | Applicable Findings | Applicable Correlations | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FIX_IMAGE_OPTIMIZATION` | 1.0 | `LOW` | `LCP_CRITICAL`, `LCP_SLOW`, `LARGE_IMAGE`, `IMAGE_OPTIMIZATION_OPPORTUNITY` | `CORR_IMAGE_ASSET` | Adds `fetchpriority="high"` for LCP images, or `loading="lazy"` for offscreen images in markup. Binary transformations are safely constrained to avoid corruption. |
| `FIX_RENDER_BLOCKING_RESOURCE` | 1.0 | `LOW` | `RENDER_BLOCKING_RESOURCE` | `CORR_RENDER_BLOCKING` | Eliminates render-blocking scripts (`defer`) or stylesheets (`preload`) in entry HTML templates. |
| `FIX_LARGE_FONT` | 1.0 | `LOW` | `FONT_RESOURCE_LARGE` | `CORR_FONT_ASSET` | Inserts `font-display: swap;` into `@font-face` rules for large local font assets. |
| `FIX_UNUSED_IMPORT` | 1.0 | `LOW` | `UNUSED_JS_HIGH` | `CORR_SCRIPT_IMPORT` | Removes provably dead static imports when verified unused in the file body. |
| `FIX_SAFE_DYNAMIC_IMPORT` | 1.0 | `MEDIUM` | `UNUSED_JS_HIGH`, `LONG_TASK` | `CORR_SCRIPT_IMPORT` | Converts heavy non-critical components to dynamic imports (`React.lazy` / `next/dynamic`) when framework and boundaries are clean. |
| `FIX_RESOURCE_REFERENCE` | 1.0 | `LOW` | `LARGE_RESOURCE` | `CORR_RESOURCE_ASSET` | Adds `<link rel="preload">` hints for critical resources discovered during early load. |

---

## 4. Safety Architecture & Defense-in-Depth

### 4.1 Canonical Path Containment
All target file paths are resolved via `fs.realpath` and checked against the canonical workspace boundary:
- Path traversals (`../../`) are blocked before disk access.
- Symlinks resolving outside the workspace are blocked with `WORKSPACE_ESCAPE_DETECTED`.

### 4.2 Protected File Guard
ZYRA permanently protects sensitive, secret, and configuration files against automated modifications:
- Protected patterns: `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, credentials, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `tsconfig.json`.
- Any operation targeting a protected file is rejected with `PROTECTED_FILE_BLOCKED`.

### 4.3 Optimistic Concurrency Guard (`PLAN_STALE`)
Every modification operation records the SHA-256 hash of the target file at plan creation. Before applying changes:
1. Current file content is read from disk.
2. Current SHA-256 is computed.
3. If `currentHash !== originalContentHash`, execution halts immediately with `PLAN_STALE`.
4. User modifications are never overwritten.

### 4.4 Binary File Protection
Naive string replacements against binary files are strictly prohibited. Buffers are inspected for null bytes; any binary file targeted for text modification triggers `BINARY_FILE_BLOCKED`.

### 4.5 External Resource Exclusion
Resources served from third-party CDNs (e.g. `https://cdn.example.com/asset.js`) cannot be modified locally. Fix planning rejects external candidates to prevent invalid local file creation.

---

## 5. Transactional Modification & Rollback Journal

Multi-file modifications execute under an atomic transaction lifecycle:

```text
       PLAN
        ↓
    PRECHECK (Paths, Hashes, Binary, Preconditions)
        ↓
  RECORD JOURNAL (Original Contents & Hashes)
        ↓
  APPLY OPERATIONS (Write changes sequentially)
        ↓
     FAILURE? ───YES───► ROLLBACK ALL MODIFICATIONS FROM JOURNAL
        ↓ NO                          ↓
  EMIT AUDIT RECORD            RESTORED STATE
  STATUS: APPLIED              STATUS: ROLLED_BACK / FAILED
```

If an error occurs at step $N$, all modifications from steps $1 \dots N-1$ are restored from the in-memory journal, ensuring the workspace is never left partially modified.

---

## 6. Dry-Run Mode (`--dry-run`)

Dry-run simulation allows agents and developers to audit intended modifications without touching the filesystem:
- Performs complete schema validation.
- Validates path containment and protected file guards.
- Compares content hashes against disk.
- Calculates intended replacement diffs and new hashes.
- Makes **zero filesystem modifications** (verifiable via identical file mtime and hash).
- Returns `FixResult` with status `DRY_RUN`.

---

## 7. CLI Usage

```bash
# 1. View strategy catalog
zyra fix catalog
zyra fix catalog --json

# 2. Plan fixes from browser investigation and workspace correlation
zyra fix plan https://example.com --workspace ./target-app
zyra fix plan https://example.com --workspace ./target-app --json

# 3. Simulate fix application without changing files
zyra fix apply ./plan.json --workspace ./target-app --dry-run

# 4. Apply fix with transactional rollback protection
zyra fix apply ./plan.json --workspace ./target-app
```

---

## 8. Post-Fix Verification Boundary

After applying a fix, ZYRA explicitly outputs:

```text
Result:       APPLIED
Verification: NOT YET PERFORMED (Reserved for Phase 08)
```

Phase 07 does NOT claim performance improvements. Optimization validation requires post-fix re-measurement under identical lab conditions, which belongs strictly to **Phase 08 — Post-Fix Verification & Optimization Loop**.
