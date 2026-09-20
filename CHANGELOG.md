# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.4] - 2026-09-20

### Changed
- **Increased Default Measurement Timeout**: Raised default timeout from 60s (`60000ms`) to 90s (`90000ms`) across Lighthouse runner, progress renderer, CI subsystem, and all CLI subcommands (`zyra <url>`, `zyra fix plan`, `zyra verify`, `zyra ci`, `zyra ci baseline`).
- **Enhanced Timeout Diagnostics**: `LighthouseTimeoutError` now provides actionable guidance suggesting `--desktop` (unthrottled profiling) or expanding `--timeout <ms>` when testing heavy applications under mobile 4G/CPU emulation.
- **Documentation**: Updated `README.md`, `SKILL.md`, and `docs/EVIDENCE-ENGINE.md` to reflect the 90s timeout default and guidance options.

### Fixed
- **Packaging Test Invariants**: Aligned test assertions in `tests/agent/skill.test.ts` with `package.json` package configuration and files array.

---

## [0.9.3] - 2026-09-08

### Added
- **Phase 09 CI / Regression Detection Subsystem**: Automated performance regression gating, Web Vitals budget evaluation, and GitHub PR comment generation.
- **Phase 08 Verification Layer**: Noise-filtered metric deltas and empirical before-and-after proof.
- **Phase 07 Fix Engine**: Automated, reversible performance fix planning and transactional rollback protection.
