# ZYRA — Project Specification

## 1. Project Identity

| Attribute | Value |
| :--- | :--- |
| **Project Name** | ZYRA |
| **Type** | Agent-native web performance investigation tool |
| **Primary Language** | TypeScript |
| **Target Runtime** | Node.js 22+ (Engine compatibility `>=22.0.0`) |
| **Package Manager** | npm |
| **Core Lab Engine** | Lighthouse 13.4.1 (Operational) |
| **Browser Engine** | Chrome / Chromium |
| **Primary Slash Command** | `/zyra` |
| **Context Slash Command** | `/context` |
| **Local CLI Command** | `zyra` |
| **Execution Model** | Local-first |
| **Primary Users** | Developers and AI coding agents |

---

## 2. Current Project State

| Attribute | Value |
| :--- | :--- |
| **Current Phase** | **Phase 08 — Post-Fix Verification & Optimization Loop** |
| **Current Status** | Complete / Operational (Verification Subsystem v1.0) |
| **Next Phase** | Phase 09 — CI / Regression Detection |

> [!NOTE]
> ZYRA's runtime environment is completely independent from the target project being analyzed. The analyzed project may run any Node.js version or non-Node runtime. ZYRA never forces target projects to adopt its runtime.
