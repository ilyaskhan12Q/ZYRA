# Contributing to ZYRA

Welcome! We are thrilled that you are interested in contributing to **ZYRA**.

ZYRA is an agent-native, local-first web performance investigation and optimization tool designed to bridge real-world browser telemetry with actual source code. Whether you're reporting a bug, proposing a new deterministic performance rule, improving documentation, or submitting code, we welcome your contributions.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please review our full [Code of Conduct](CODE_OF_CONDUCT.md) for expected standards and enforcement procedures.

---

## Guiding Principles

When contributing code or rules to ZYRA, keep these core principles in mind:

1. **Evidence First:** Real browser measurements and deterministic rules provide empirical facts. We never guess or hallucinate bottlenecks.
2. **Local-First & Independent:** ZYRA runs directly on the developer's machine or in CI pipelines without relying on proprietary cloud backends.
3. **Safe & Non-Destructive:** Target workspaces being analyzed are treated as untrusted input data. Code scanning is strictly read-only. Fix modifications must always be evidence-backed, minimal, reversible, and guarded by optimistic concurrency checks (SHA-256).
4. **Deterministic Evaluation:** Given the same evidence and configuration, rules and policies must always produce the same structured findings and exit codes.
5. **Rigorous Empirical Verification:** A code modification is never assumed to be an optimization based on intent (`APPLIED != IMPROVED`). Every fix requires before/after verification against empirical baseline evidence.

---

## Getting Started

### Prerequisites

* **Node.js:** `>=22.0.0`
* **Google Chrome or Chromium:** Installed locally (for headless Lighthouse runs)
* **Git**

### Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/your-username/zyra.git
cd zyra

# 2. Install dependencies
npm install

# 3. Build TypeScript to dist/
npm run build

# 4. Link CLI globally for local testing
npm link
```

### Verification Scripts

Before submitting changes, make sure all verification gates pass cleanly:

```bash
# Type check TypeScript without emitting
npm run typecheck

# Run full test suite (all unit and integration tests)
npm test

# Run unit tests only
npm run test:unit
```

---

## How to Contribute

### 1. Reporting Bugs

If you discover an issue:
* Search the [GitHub Issues](https://github.com/username/zyra/issues) to ensure it hasn't already been reported.
* Open a new issue with a clear title, reproduction steps, expected vs. actual behavior, and environment details (Node version, OS, Chrome version).

### 2. Suggesting Heuristics & Rules

ZYRA's performance rule catalog is deterministic and grounded in established web performance standards (Core Web Vitals, Chrome DevTools metrics, Lighthouse audits). When proposing a new rule:
* Provide authoritative industry references (web.dev, W3C, RFCs).
* Define unambiguous thresholds for warning and critical severities.
* Ensure the rule can be evaluated purely from normalized evidence with zero LLM guesswork.

### 3. Submitting Pull Requests

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Write clean, modular TypeScript with strict typing enabled.
3. Add comprehensive automated tests in the `tests/` directory covering sunny paths, edge cases, and failure modes.
4. Ensure documentation (`docs/`, `README.md`, `SKILL.md` if applicable) is updated to reflect your changes.
5. Run `npm run typecheck` and `npm test` locally.
6. Submit your pull request with a concise summary of changes, rationale, and verification output.

---

## Documentation References

* **Architecture Overview:** [`.context/ARCHITECTURE.md`](.context/ARCHITECTURE.md)
* **Deterministic Rule Engine:** [`docs/RULE-ENGINE.md`](docs/RULE-ENGINE.md)
* **Codebase Investigation:** [`docs/CODEBASE-INVESTIGATION.md`](docs/CODEBASE-INVESTIGATION.md)
* **Correlation Engine:** [`docs/CORRELATION-ENGINE.md`](docs/CORRELATION-ENGINE.md)
* **Fix Planning & Safety:** [`docs/FIX-ENGINE.md`](docs/FIX-ENGINE.md)
* **Verification Engine:** [`docs/VERIFICATION-ENGINE.md`](docs/VERIFICATION-ENGINE.md)
* **CI & Regression Gating:** [`docs/CI-REGRESSION-ENGINE.md`](docs/CI-REGRESSION-ENGINE.md)
* **Agent Skill Guide:** [`SKILL.md`](SKILL.md)

---

## License

By contributing to ZYRA, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
