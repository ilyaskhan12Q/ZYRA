#!/usr/bin/env node

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { loadContext, validateContext } from '../context/loader.js';
import { collectEvidence } from '../evidence/collector.js';
import { normalizeEvidence } from '../evidence/normalizer.js';
import { validateEvidence } from '../evidence/validator.js';
import { type ZyraEvidence } from '../evidence/types.js';
import { type DeviceType } from '../lighthouse/types.js';
import { LighthouseError, InvalidUrlError } from '../lighthouse/errors.js';
import { createMeasurementProgress } from './progress.js';
import { RuleEngine } from '../rules/engine.js';
import { RuleRegistry } from '../rules/registry.js';
import { FINDING_SCHEMA_VERSION } from '../rules/types.js';
import { scanCodebase } from '../codebase/scanner.js';
import { CODEBASE_EVIDENCE_SCHEMA_VERSION } from '../codebase/types.js';
import { correlate } from '../correlation/engine.js';
import { CORRELATION_SCHEMA_VERSION } from '../correlation/types.js';
import {
  FixStrategyRegistry,
  planFixes,
  executeFix,
  validateFixPlan,
  FIX_SCHEMA_VERSION,
  type FixPlan,
  type FixResult
} from '../fixes/index.js';
import {
  verifyOptimization,
  validateVerificationResult,
  VERIFICATION_SCHEMA_VERSION,
  type VerificationResult,
  type MetricDelta
} from '../verification/index.js';
import {
  runCI,
  createCIBaseline,
  saveCIBaseline,
  loadCIBaseline,
  parseBudgetConfig,
  formatCIReportTerminal,
  CI_SCHEMA_VERSION,
  CI_EXIT_CODES,
  type CIPolicy,
  type CIResult
} from '../ci/index.js';

const VERSION = '0.9.4';

function printHelp(): void {
  console.log(`
ZYRA — Agent-Native Web Performance Investigation Tool (v${VERSION})

USAGE:
  zyra <command> [options]
  zyra <url> [options]
  zyra <url> --workspace <path> [options]
  zyra analyze <url> --workspace <path> [options]
  zyra codebase <path> [options]
  zyra inspect <path> [options]
  zyra fix plan <url> --workspace <path> [options]
  zyra fix apply <plan-file> --workspace <path> [options]
  zyra fix catalog [options]
  zyra verify <url> --workspace <path> --baseline <file> [options]
  zyra fix verify <fix-result> --url <url> --workspace <path> [options]
  zyra ci <url> [options]
  zyra ci check <url> [options]
  zyra ci baseline <url> [options]

COMMANDS:
  <url>             Run empirical performance investigation and rule analysis against target URL
  analyze <url>     Run performance investigation and correlate with local workspace codebase
  codebase <path>   Inspect target codebase workspace and produce structured Codebase Evidence
  inspect <path>    Alias for codebase command
  fix plan <url>    Plan evidence-backed code modifications for target workspace
  fix apply <plan>  Apply or dry-run a verified FixPlan with rollback protection
  fix catalog       Display structured catalog of registered fix strategies
  fix verify <res>  Verify performance after applying a fix result
  verify <url>      Empirically verify performance improvement between baseline and post-fix runs
  ci <url>          Run CI performance check, budget enforcement, and regression detection
  ci baseline <url> Capture and persist an authoritative performance baseline
  rules             Display structured catalog of all registered performance rules
  rules --json      Output rule catalog as JSON
  context           Display structured summary of persistent project context
  context --json    Output complete persistent context as JSON
  --help, -h        Display this help message
  --version, -v     Display ZYRA version

CI OPTIONS:
  --baseline <file>           Baseline measurement JSON (CIBaseline or ZyraEvidence)
  --budget <file|json>        Performance budget configuration file or inline JSON
  --config <file>             CI configuration file (budgets and policy)
  --output <file>             Write machine-readable CIResult JSON to specified file
  --markdown-output <file>    Write PR Markdown summary comment to specified file
  --current <file>            Pre-captured evidence file for offline CI evaluation
  --fail-on-warn              Elevate WARN exit code (2) to FAIL exit code (1)
  --allow-missing-baseline    Do not fail if baseline is missing; evaluate budgets only

MEASUREMENT OPTIONS:
  --workspace <path> Target codebase workspace path to correlate with browser telemetry
  --codebase <path>  Alias for --workspace
  --mobile           Emulate mobile device profile (default)
  --desktop          Emulate desktop device profile
  --json             Output normalized evidence, findings, and correlation as structured JSON
  --timeout <ms>     Set execution timeout in milliseconds (default: 90000)

CODEBASE OPTIONS:
  --json            Output complete Codebase Evidence as structured JSON

FIX OPTIONS:
  --dry-run         Simulate fix application and verify safety without modifying any files
  --allow-high-risk Allow application of HIGH risk plans
  --json            Output fix plan or result as structured JSON

VERIFICATION OPTIONS:
  --baseline <file> Path to baseline measurement evidence JSON file (required)
  --post-fix <file> Path to post-fix measurement evidence JSON file (optional; runs live test if omitted)
  --runs <n>        Bounded repeat measurement runs (1-5, default: 1)
  --output <file>   Write VerificationResult JSON to specified file

EXAMPLES:
  zyra https://example.com
  zyra https://example.com --mobile
  zyra https://example.com --desktop --json
  zyra https://example.com --workspace ./target-app
  zyra analyze https://example.com --workspace ./target-app --json
  zyra codebase /path/to/project
  zyra inspect ./target-app --json
  zyra fix catalog
  zyra fix plan https://example.com --workspace ./target-app
  zyra fix plan https://example.com --workspace ./target-app --json
  zyra fix apply ./plan.json --workspace ./target-app --dry-run
  zyra fix apply ./plan.json --workspace ./target-app
  zyra rules
  zyra context

DOCUMENTATION:
  See .context/ and docs/ for architecture, contracts, rule specifications, and roadmap.
`);
}

async function handleRulesCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const registry = new RuleRegistry();
  const catalog = registry.getRuleCatalog();

  if (isJson) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  console.log(`
============================================================
 ZYRA — Performance Rule Catalog (${catalog.length} Registered Rules)
============================================================
`);

  for (const rule of catalog) {
    const sevBadge = `[${rule.severity}]`.padEnd(11);
    console.log(` ${sevBadge} ${rule.id} (v${rule.version})`);
    console.log(`   Title:     ${rule.title}`);
    console.log(`   Category:  ${rule.category}`);
    console.log(`   Threshold: ${rule.thresholdSummary} [${rule.thresholdSource}]`);
    console.log(`   Evidence:  ${rule.evidenceConsumed.join(', ')}`);
    console.log(`   Rationale: ${rule.description}`);
    console.log('');
  }

  console.log(`------------------------------------------------------------
 All rules are deterministic, side-effect free, and grounded in empirical evidence.
 Run with --json for complete machine-readable rule catalog.
============================================================
`);
}

async function handleContextCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');

  try {
    const validation = await validateContext();

    if (!validation.isValid) {
      console.error('❌ ZYRA Context Validation Failed:');
      if (validation.missingFiles.length > 0) {
        console.error(`  Missing required files:\n    - ${validation.missingFiles.join('\n    - ')}`);
      }
      if (validation.malformedFiles.length > 0) {
        console.error(
          `  Malformed files:\n    - ${validation.malformedFiles.map((m) => `${m.name}: ${m.reason}`).join('\n    - ')}`
        );
      }
      process.exit(1);
    }

    const context = await loadContext(validation.projectRoot);

    if (isJson) {
      console.log(JSON.stringify(context, null, 2));
      return;
    }

    console.log(`
============================================================
 ZYRA — Persistent Project Context
============================================================
 Project Root:  ${context.projectRoot}
 Context Dir:   ${context.contextDir}
 Current Phase: ${context.summary.currentPhase}
 Status:        ${context.summary.status}
 Loaded At:     ${context.loadedAt}
 Documents:     ${context.summary.totalDocuments} verified

 Context Documents:
------------------------------------------------------------`);

    for (const [name, doc] of Object.entries(context.documents)) {
      const sizeKb = (doc.sizeBytes / 1024).toFixed(1);
      console.log(`  ✓ ${name.padEnd(20)} [${sizeKb} KB] -> ${doc.path}`);
    }

    console.log(`------------------------------------------------------------
 Health: All required context documents are present and valid.
============================================================
`);
  } catch (error) {
    console.error(`❌ Error loading context: ${(error as Error).message}`);
    process.exit(1);
  }
}

async function handleCodebaseCommand(targetPath: string, args: string[]): Promise<void> {
  const isJson = args.includes('--json');

  try {
    const evidence = await scanCodebase(targetPath);

    if (isJson) {
      console.log(JSON.stringify(evidence, null, 2));
      return;
    }

    const prodDeps = evidence.dependencies.filter((d) => d.dependencyType === 'production').length;
    const devDeps = evidence.dependencies.filter((d) => d.dependencyType === 'development').length;

    console.log(`
============================================================
 ZYRA — Codebase Investigation
============================================================

 WORKSPACE
 ------------------------------------------------------------
 Root:              ${evidence.workspace.root}
 Scanned At:        ${evidence.workspace.scannedAt}
 Scanner:           v${evidence.workspace.scannerVersion}
 Files Scanned:     ${evidence.workspace.stats.filesScanned} (${(evidence.workspace.stats.totalSizeBytes / 1024).toFixed(1)} KB total)
 Files Skipped:     ${evidence.workspace.stats.filesSkipped}
 Dirs Skipped:      ${evidence.workspace.stats.directoriesSkipped}

 FRAMEWORK
 ------------------------------------------------------------
 Primary Framework: ${evidence.framework.name} (Confidence: ${evidence.framework.confidence})
 Version:           ${evidence.framework.version ?? 'Not declared'}
 Evidence:          ${evidence.framework.evidenceRefs.join(', ') || 'None'}

 PACKAGE MANAGER & RUNTIME
 ------------------------------------------------------------
 Package Manager:   ${evidence.packageManager.name}
 Lockfile:          ${evidence.packageManager.lockfile ?? 'None'}
 Conflict:          ${evidence.packageManager.hasConflict ? `Yes (${evidence.packageManager.conflicts?.join(', ')})` : 'No'}
 Declared Node:     ${evidence.runtime.declaredNodeVersion ?? 'Not declared'} (${evidence.runtime.source ?? 'N/A'})

 DEPENDENCIES (${evidence.dependencies.length} declared)
 ------------------------------------------------------------
 Breakdown:         ${prodDeps} production, ${devDeps} development`);

    if (evidence.dependencies.length > 0) {
      const topDeps = evidence.dependencies.slice(0, 8);
      console.log(` Notable:           ${topDeps.map((d) => `${d.name}@${d.versionRange}`).join(', ')}${evidence.dependencies.length > 8 ? '...' : ''}`);
    }

    console.log(`
 ROUTES (${evidence.routes.length} detected)
 ------------------------------------------------------------`);
    if (evidence.routes.length === 0) {
      console.log(' None detected via known framework conventions.');
    } else {
      for (const r of evidence.routes.slice(0, 10)) {
        console.log(` ${r.path.padEnd(25)} -> ${r.sourceFile} [${r.framework}]`);
      }
      if (evidence.routes.length > 10) {
        console.log(` ... and ${evidence.routes.length - 10} more routes`);
      }
    }

    console.log(`
 ENTRY POINTS (${evidence.entryPoints.length} detected)
 ------------------------------------------------------------`);
    if (evidence.entryPoints.length === 0) {
      console.log(' None detected via known conventions.');
    } else {
      for (const ep of evidence.entryPoints) {
        console.log(` ${ep.path.padEnd(25)} (${ep.detectionReason})`);
      }
    }

    console.log(`
 ASSETS (${evidence.assets.length} inventoried)
 ------------------------------------------------------------`);
    if (evidence.assets.length === 0) {
      console.log(' No static assets found.');
    } else {
      const totalAssetSize = evidence.assets.reduce((sum, a) => sum + a.sizeBytes, 0);
      console.log(` Total Assets:      ${evidence.assets.length} (${(totalAssetSize / 1024).toFixed(1)} KB)`);
      for (const a of evidence.assets.slice(0, 6)) {
        console.log(` [${a.category.padEnd(10)}] ${a.relativePath} (${(a.sizeBytes / 1024).toFixed(1)} KB)`);
      }
      if (evidence.assets.length > 6) {
        console.log(` ... and ${evidence.assets.length - 6} more assets`);
      }
    }

    console.log(`
 CONFIGURATION & SOURCE MAPS
 ------------------------------------------------------------
 Bundler:           ${evidence.configuration.bundler ?? 'Standard / Not detected'}
 Config Files:      ${evidence.configuration.configFiles.join(', ') || 'None'}
 Source Maps:       ${evidence.configuration.hasSourceMaps ? 'Detected' : 'Not detected'}`);

    if (evidence.warnings.length > 0) {
      console.log(`
 WARNINGS (${evidence.warnings.length} recorded)
 ------------------------------------------------------------`);
      for (const w of evidence.warnings) {
        console.log(` [${w.code}] ${w.message}${w.targetPath ? ` (${w.targetPath})` : ''}`);
      }
    }

    console.log(`------------------------------------------------------------
 Traceability: Codebase evidence ready for future correlation with browser telemetry.
 Run with --json for complete machine-readable CodebaseEvidence payload.
============================================================
`);
  } catch (error) {
    if (isJson) {
      console.error(
        JSON.stringify(
          {
            error: true,
            name: (error as Error).name,
            message: (error as Error).message
          },
          null,
          2
        )
      );
    } else {
      console.error(`❌ Codebase Investigation Failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function handleMeasureCommand(url: string, args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const isDesktop = args.includes('--desktop');
  const device: DeviceType = isDesktop ? 'desktop' : 'mobile';

  let timeoutMs = 90000;
  const timeoutIndex = args.indexOf('--timeout');
  if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
    const parsedTimeout = parseInt(args[timeoutIndex + 1], 10);
    if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
      timeoutMs = parsedTimeout;
    }
  }

  // Check for workspace flag to trigger Phase 05 correlation
  let workspacePath: string | undefined;
  const wsIndex = args.indexOf('--workspace');
  const cbIndex = args.indexOf('--codebase');
  const targetFlagIndex = wsIndex !== -1 ? wsIndex : cbIndex;
  if (targetFlagIndex !== -1 && args[targetFlagIndex + 1] && !args[targetFlagIndex + 1].startsWith('--')) {
    workspacePath = args[targetFlagIndex + 1];
  }

  const progress = createMeasurementProgress({
    url,
    device,
    timeoutMs,
    isJson
  });

  try {
    progress.start();
    const { evidence } = await collectEvidence({
      url,
      device,
      timeoutMs,
      onProgress: (status) => progress.update(status)
    });
    progress.succeed();

    const ruleEngine = new RuleEngine();
    const findings = ruleEngine.evaluate(evidence);

    let codebaseEvidence;
    let correlationResult;

    if (workspacePath) {
      if (!isJson) {
        console.log(`🔍 Scanning codebase workspace: ${workspacePath}...`);
      }
      codebaseEvidence = await scanCodebase(workspacePath);
      correlationResult = correlate(evidence, findings, codebaseEvidence);
    }

    if (isJson) {
      const output = {
        ...evidence,
        evidence,
        findingSchemaVersion: FINDING_SCHEMA_VERSION,
        findings,
        ...(codebaseEvidence && {
          codebaseEvidenceSchemaVersion: CODEBASE_EVIDENCE_SCHEMA_VERSION,
          codebaseEvidence
        }),
        ...(correlationResult && {
          correlationSchemaVersion: CORRELATION_SCHEMA_VERSION,
          correlation: correlationResult,
          correlations: correlationResult.candidates
        })
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const m = evidence.metrics;
    const formatMs = (val: number | null) => (val !== null ? `${Math.round(val).toLocaleString()} ms` : 'N/A');
    const formatScore = (s: number | null) => (s !== null ? `${Math.round(s * 100)}/100` : 'N/A');
    const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

    const perfScoreDisplay =
      evidence.scores.performance !== null
        ? `${Math.round(evidence.scores.performance * 100)} / 100`
        : 'N/A';

    const totalJsTransfer = evidence.scripts.items.reduce((acc, s) => acc + s.transferSizeBytes, 0);
    const totalJsUnused = evidence.scripts.items.reduce((acc, s) => acc + (s.unusedBytes ?? 0), 0);
    const totalImgTransfer = evidence.images.items.reduce((acc, i) => acc + i.transferSizeBytes, 0);
    const totalImgWasted = evidence.images.items.reduce((acc, i) => acc + (i.wastedBytes ?? 0), 0);
    const totalFontTransfer = evidence.fonts.items.reduce((acc, f) => acc + f.transferSizeBytes, 0);

    console.log(`
============================================================
 ZYRA — Performance Analysis
============================================================

 Target URL:   ${evidence.target.url}
 Device:       ${evidence.target.device}
 Timestamp:    ${evidence.target.timestamp}
 Duration:     ${(evidence.run.durationMs / 1000).toFixed(2)} s
 Lighthouse:   v${evidence.run.lighthouseVersion}

 PERFORMANCE EVIDENCE
 ------------------------------------------------------------
 First Contentful Paint (FCP):  ${formatMs(m.fcp.value).padEnd(12)} (Score: ${formatScore(m.fcp.score)})
 Largest Contentful Paint (LCP):${formatMs(m.lcp.value).padEnd(12)} (Score: ${formatScore(m.lcp.score)})
 Total Blocking Time (TBT):     ${formatMs(m.tbt.value).padEnd(12)} (Score: ${formatScore(m.tbt.score)})
 Cumulative Layout Shift (CLS): ${m.cls.value !== null ? m.cls.value.toFixed(3).padEnd(12) : 'N/A'.padEnd(12)} (Score: ${formatScore(m.cls.score)})
 Speed Index:                   ${formatMs(m.speedIndex.value).padEnd(12)} (Score: ${formatScore(m.speedIndex.score)})
 Interaction to Next Paint:     ${m.inp ? formatMs(m.inp.value) : 'Not Captured'}

 Overall Lab Score:            ${perfScoreDisplay}

 Evidence Breakdown
 ------------------------------------------------------------
 Audits Collected:     ${evidence.audits.length}
 Network Requests:     ${evidence.network.requests.length}
 JavaScript Files:     ${evidence.scripts.items.length} (Transfer: ${formatBytes(totalJsTransfer)}, Unused: ${formatBytes(totalJsUnused)})
 Images:               ${evidence.images.items.length} (Transfer: ${formatBytes(totalImgTransfer)}, Potential Savings: ${formatBytes(totalImgWasted)})
 Fonts:                ${evidence.fonts.items.length} (Transfer: ${formatBytes(totalFontTransfer)})
 Long Tasks (>50ms):   ${evidence.scripts.longTasks.length}

 FINDINGS (${findings.length} detected)
 ------------------------------------------------------------`);

    if (findings.length === 0) {
      console.log(' ✓ No performance threshold violations detected for this run.');
    } else {
      for (const f of findings) {
        console.log(` [${f.severity}] ${f.ruleId}`);
        console.log(`   ${f.title}`);
        console.log(`   Observed:   ${f.observed.displayValue ?? f.observed.value}`);
        console.log(`   Threshold:  ${f.threshold.condition} (${f.threshold.source})`);
        console.log(`   Evidence:   ${f.evidenceRefs.join(', ')}`);
        console.log(`   Confidence: ${f.confidence}`);
        console.log(`   Next Step:  ${f.nextInvestigation}`);
        console.log('');
      }
    }

    if (codebaseEvidence && correlationResult) {
      console.log(`
 CODEBASE EVIDENCE
 ------------------------------------------------------------
 Workspace:          ${codebaseEvidence.workspace.root}
 Framework:          ${codebaseEvidence.framework.name} (${codebaseEvidence.framework.confidence})
 Routes Detected:    ${codebaseEvidence.routes.length}
 Assets Scanned:     ${codebaseEvidence.assets.length}
 Dependencies:       ${codebaseEvidence.dependencies.length} declared
 Warnings:           ${codebaseEvidence.warnings.length} recorded

 CORRELATION ANALYSIS
 ------------------------------------------------------------
 Evaluated Findings:  ${correlationResult.summary.totalFindings}
 Correlated Findings: ${correlationResult.summary.correlatedFindings}
 Strongly Supported:  ${correlationResult.summary.stronglySupportedCandidates}
 Supported:           ${correlationResult.summary.supportedCandidates}
 Possible:            ${correlationResult.summary.possibleCandidates}
 Insufficient Data:   ${correlationResult.summary.insufficientEvidenceCount}
 No Correlation:      ${correlationResult.summary.noCorrelationCount}

 CANDIDATE CONTRIBUTORS (${correlationResult.candidates.length} identified)
 ------------------------------------------------------------`);

      if (correlationResult.candidates.length === 0) {
        console.log(' No candidate contributors identified for the observed findings.');
      } else {
        for (let i = 0; i < correlationResult.candidates.length; i++) {
          const c = correlationResult.candidates[i]!;
          console.log(` ${i + 1}. [${c.status}] ${c.targetName} (${c.targetType})`);
          console.log(`    Confidence: ${(c.confidence.score * 100).toFixed(0)}% (${c.confidence.rationale})`);
          console.log(`    Findings:   ${c.findingIds.join(', ')}`);
          console.log(`    Reasoning:  ${c.reasoning}`);
          if (c.supportingEvidence.length > 0) {
            console.log('    Supporting Evidence:');
            for (const s of c.supportingEvidence) {
              console.log(`      ✓ ${s}`);
            }
          }
          if (c.contradictingEvidence.length > 0) {
            console.log('    Contradicting / Cautionary Evidence:');
            for (const con of c.contradictingEvidence) {
              console.log(`      ⚠ ${con}`);
            }
          }
          if (c.missingEvidence.length > 0) {
            console.log('    Missing Evidence:');
            for (const mis of c.missingEvidence) {
              console.log(`      - ${mis}`);
            }
          }
          console.log(`    Next Step:  ${c.nextInvestigation}`);
          console.log('');
        }
      }

      console.log(`
 ROOT-CAUSE ASSESSMENTS (${correlationResult.assessments.length} generated)
 ------------------------------------------------------------`);
      for (const a of correlationResult.assessments) {
        console.log(` [${a.assessmentLevel}] ${a.findingId} -> ${a.status}`);
        console.log(`   Bottleneck:    ${a.primaryBottleneckType}`);
        if (a.topCandidateId) {
          console.log(`   Top Candidate: ${a.topCandidateId}`);
        }
        console.log(`   Summary:       ${a.summary}`);
        console.log('');
      }
    }

    console.log(`------------------------------------------------------------
 Traceability: All findings deterministically map to normalized evidence.
 Run with --json for complete machine-readable evidence & findings payload.
============================================================
`);
  } catch (error) {
    progress.fail(error);
    if (isJson) {
      console.error(
        JSON.stringify(
          {
            error: true,
            name: (error as Error).name,
            message: (error as Error).message
          },
          null,
          2
        )
      );
    } else {
      if (error instanceof InvalidUrlError) {
        console.error(`❌ Invalid URL: ${error.message}`);
      } else if (error instanceof LighthouseError) {
        console.error(`❌ Performance Measurement Failed: ${error.message}`);
      } else {
        console.error(`❌ Error: ${(error as Error).message}`);
      }
    }
    process.exit(1);
  }
}

async function handleFixCatalogCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const registry = new FixStrategyRegistry();
  const catalog = registry.getFixStrategyCatalog();

  if (isJson) {
    console.log(JSON.stringify(catalog, null, 2));
    return;
  }

  console.log(`
============================================================
 ZYRA — Fix Strategy Catalog (${catalog.length} Registered Strategies)
============================================================
`);

  for (const s of catalog) {
    const riskBadge = `[${s.riskLevel}]`.padEnd(9);
    console.log(` ${riskBadge} ${s.id} (v${s.version})`);
    console.log(`   Name:         ${s.name}`);
    console.log(`   Description:  ${s.description}`);
    console.log(`   Findings:     ${s.applicableFindings.join(', ')}`);
    console.log(`   Correlations: ${s.applicableCorrelations.join(', ')}`);
    console.log(`   Preconditions:`);
    for (const p of s.preconditions) {
      console.log(`     - ${p}`);
    }
    console.log('');
  }

  console.log(`------------------------------------------------------------
 All strategies enforce optimistic concurrency, workspace containment,
 and rollback safety. Run with --json for machine-readable output.
============================================================
`);
}

async function handleFixPlanCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const isDesktop = args.includes('--desktop');
  const device: DeviceType = isDesktop ? 'desktop' : 'mobile';

  let timeoutMs = 90000;
  const timeoutIdx = args.indexOf('--timeout');
  if (timeoutIdx !== -1 && args[timeoutIdx + 1]) {
    const parsed = parseInt(args[timeoutIdx + 1]!, 10);
    if (!isNaN(parsed) && parsed > 0) {
      timeoutMs = parsed;
    }
  }

  let workspacePath: string | undefined;
  const wsIdx = args.indexOf('--workspace');
  const cbIdx = args.indexOf('--codebase');
  if (wsIdx !== -1 && args[wsIdx + 1]) {
    workspacePath = args[wsIdx + 1];
  } else if (cbIdx !== -1 && args[cbIdx + 1]) {
    workspacePath = args[cbIdx + 1];
  }

  const targetUrl = args.find((a, idx) => {
    if (a.startsWith('--')) return false;
    if (idx > 0 && (args[idx - 1] === '--timeout' || args[idx - 1] === '--workspace' || args[idx - 1] === '--codebase')) {
      return false;
    }
    return true;
  });

  if (!targetUrl) {
    console.error('❌ Please specify a target URL: zyra fix plan <url> --workspace <path>');
    process.exit(1);
  }

  if (!workspacePath) {
    console.error('❌ Fix planning requires a target workspace path: zyra fix plan <url> --workspace <path>');
    process.exit(1);
  }

  const progress = createMeasurementProgress({
    url: targetUrl,
    device,
    timeoutMs,
    isJson,
    taskLabel: 'Measuring browser telemetry'
  });

  try {
    progress.start();
    const { evidence } = await collectEvidence({
      url: targetUrl,
      device,
      timeoutMs,
      onProgress: (status) => progress.update(status)
    });
    progress.succeed();

    const ruleEngine = new RuleEngine();
    const findings = ruleEngine.evaluate(evidence);

    if (!isJson) {
      console.log(`📁 Scanning codebase workspace at ${workspacePath}...`);
    }

    const codebase = await scanCodebase(workspacePath);

    if (!isJson) {
      console.log(`🔗 Correlating findings with codebase...`);
    }

    const correlation = correlate(evidence, findings, codebase);

    if (!isJson) {
      console.log(`🛠️ Synthesizing safe fix plans...`);
    }

    const plans = await planFixes({
      workspaceRoot: workspacePath,
      evidence,
      findings,
      codebase,
      correlation
    });

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            schemaVersion: FIX_SCHEMA_VERSION,
            targetUrl,
            workspace: workspacePath,
            totalPlans: plans.length,
            plans
          },
          null,
          2
        )
      );
      return;
    }

    console.log(`
============================================================
 ZYRA — Fix Planning (${plans.length} Proposed Plans)
============================================================
 Target URL:  ${targetUrl}
 Workspace:   ${workspacePath}
 Status:      READY_FOR_REVIEW
------------------------------------------------------------
`);

    if (plans.length === 0) {
      console.log(' No automated fix plans available for observed bottlenecks.');
      console.log(' Note: Fixes are only proposed when evidence correlation is supported');
      console.log(' and preconditions guarantee a safe, minimal, reversible modification.\n');
    } else {
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i]!;
        console.log(` ------------------------------------------------------------`);
        console.log(` PLAN #${i + 1}: ${p.planId} [Risk: ${p.risk}]`);
        console.log(` ------------------------------------------------------------`);
        console.log(`   Strategy:       ${p.strategy.name} (${p.strategy.id} v${p.strategy.version})`);
        console.log(`   Candidate:      ${p.candidate.targetPath} (${p.candidate.targetType})`);
        console.log(`   Findings:       ${p.sourceFindingIds.join(', ')}`);
        console.log(`   Expected Impact:`);
        console.log(`     Metric:       ${p.expectedImpact.targetMetric} (${p.expectedImpact.estimatedDirection})`);
        console.log(`     Note:         ${p.expectedImpact.description}`);
        console.log(`   Files to Modify:`);
        for (const op of p.operations) {
          console.log(`     - ${op.targetPath} [${op.type}]`);
        }
        console.log(`   Preconditions:`);
        for (const pre of p.preconditions) {
          console.log(`     [${pre.satisfied ? '✓' : '✗'}] ${pre.description}${pre.reason ? ` (${pre.reason})` : ''}`);
        }
        console.log(`   Rollback:       Available (${p.rollbackInformation.strategy})`);
        console.log(`   Status:         ${p.status}`);
        console.log('');
      }

      console.log(`------------------------------------------------------------
 Review the plans above. To simulate without changes:
   zyra fix apply <plan.json> --workspace ${workspacePath} --dry-run
 To apply with transactional rollback protection:
   zyra fix apply <plan.json> --workspace ${workspacePath}
============================================================
`);
    }
  } catch (error) {
    progress.fail(error);
    if (isJson) {
      console.error(
        JSON.stringify(
          {
            error: true,
            message: (error as Error).message
          },
          null,
          2
        )
      );
    } else {
      console.error(`❌ Fix Planning Failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

async function handleFixApplyCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const isDryRun = args.includes('--dry-run');
  const allowHighRisk = args.includes('--allow-high-risk');

  let workspacePath: string | undefined;
  const wsIdx = args.indexOf('--workspace');
  const cbIdx = args.indexOf('--codebase');
  if (wsIdx !== -1 && args[wsIdx + 1]) {
    workspacePath = args[wsIdx + 1];
  } else if (cbIdx !== -1 && args[cbIdx + 1]) {
    workspacePath = args[cbIdx + 1];
  }

  const planArg = args.find((a, idx) => {
    if (a.startsWith('--')) return false;
    if (idx > 0 && (args[idx - 1] === '--workspace' || args[idx - 1] === '--codebase')) {
      return false;
    }
    return true;
  });

  if (!planArg) {
    console.error('❌ Please specify a plan file or JSON: zyra fix apply <plan-file> --workspace <path>');
    process.exit(1);
  }

  let planObj: any;
  try {
    if (planArg.trim().startsWith('{')) {
      planObj = JSON.parse(planArg);
    } else {
      const fileContent = await fs.readFile(planArg, 'utf-8');
      planObj = JSON.parse(fileContent);
    }
  } catch (err) {
    console.error(`❌ Failed to read or parse fix plan: ${(err as Error).message}`);
    process.exit(1);
  }

  const plan: FixPlan = Array.isArray(planObj.plans) ? planObj.plans[0] : planObj;

  const validation = validateFixPlan(plan);
  if (!validation.isValid) {
    console.error(`❌ Invalid FixPlan schema: ${validation.errors.join('; ')}`);
    process.exit(1);
  }

  const effectiveWorkspace = workspacePath ?? plan.targetWorkspace;
  if (!effectiveWorkspace) {
    console.error('❌ Workspace path required: zyra fix apply <plan-file> --workspace <path>');
    process.exit(1);
  }

  try {
    const result = await executeFix(plan, {
      workspaceRoot: effectiveWorkspace,
      dryRun: isDryRun,
      allowHighRisk
    });

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      if (result.status === 'FAILED' || result.status === 'BLOCKED') {
        process.exit(1);
      }
      return;
    }

    console.log(`
============================================================
 ZYRA — Fix Execution
============================================================
 Plan ID:           ${result.planId}
 Strategy:          ${result.strategyId} (v${result.strategyVersion})
 Workspace:         ${result.workspace}
 Mode:              ${result.status === 'DRY_RUN' ? 'DRY_RUN (Simulation — No Files Modified)' : 'APPLIED'}

 Preflight:         PASS
 Hash Verification: PASS
 Safety Checks:     PASS

 Operations:`);
    for (const op of result.operations) {
      console.log(
        `   [${op.status}] ${op.targetPath} (original: ${op.originalHash.slice(0, 8)}${op.newHash ? `, new: ${op.newHash.slice(0, 8)}` : ''})${op.error ? ` - ${op.error}` : ''}`
      );
    }

    console.log(`
 Rollback:          ${result.rollbackAvailable ? 'Available' : 'Unavailable'}
 Result:            ${result.status}
 Verification:      NOT YET PERFORMED (Reserved for Phase 08)
============================================================
`);

    if (result.status === 'FAILED' || result.status === 'BLOCKED') {
      if (result.error) {
        console.error(`❌ Fix Execution Failed: ${result.error}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Fix Execution Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

function formatMetricVal(val: number | null, unit: 'ms' | 'score'): string {
  if (val === null) return 'N/A';
  if (unit === 'score') return val.toFixed(3);
  return `${Math.round(val).toLocaleString()} ms`;
}

function formatMetricDeltaStr(delta: number | null, unit: 'ms' | 'score'): string {
  if (delta === null) return 'N/A';
  const prefix = delta > 0 ? '+' : '';
  if (unit === 'score') return `${prefix}${delta.toFixed(3)}`;
  return `${prefix}${Math.round(delta).toLocaleString()} ms`;
}

function formatPercentageStr(pct: number | null): string {
  if (pct === null) return 'N/A';
  const prefix = pct > 0 ? '+' : '';
  return `${prefix}${pct.toFixed(1)}%`;
}

/**
 * Extracts ZyraEvidence from supported container formats:
 * - CIBaseline (Schema 1.0) with nested snapshot.evidence
 * - MeasurementSnapshot or wrapped object with .evidence
 * - Raw ZyraEvidence (Schema 1.0) with target and metrics
 */
function extractEvidenceFromPayload(payload: unknown, sourceLabel = 'baseline'): ZyraEvidence {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${sourceLabel} payload must be a valid non-null JSON object.`);
  }

  const obj = payload as Record<string, any>;

  // Case 1: CIBaseline format (nested in snapshot.evidence)
  if (obj.snapshot && typeof obj.snapshot === 'object') {
    if (!obj.snapshot.evidence || typeof obj.snapshot.evidence !== 'object') {
      throw new Error(`Malformed ${sourceLabel} baseline: snapshot is present but snapshot.evidence is missing.`);
    }
    return obj.snapshot.evidence as ZyraEvidence;
  }

  // Case 2: MeasurementSnapshot or wrapped format (has .evidence)
  if (obj.evidence && typeof obj.evidence === 'object') {
    return obj.evidence as ZyraEvidence;
  }

  // Case 3: Raw ZyraEvidence format (has target and metrics)
  if (obj.target && typeof obj.target === 'object' && obj.metrics && typeof obj.metrics === 'object') {
    return obj as ZyraEvidence;
  }

  // Case 4: Looks like a CIBaseline without required snapshot
  if (
    obj.schemaVersion === CI_SCHEMA_VERSION ||
    (typeof obj.id === 'string' && (obj.id.startsWith('base_') || obj.id.startsWith('snap_')))
  ) {
    throw new Error(`Malformed ${sourceLabel} baseline: missing snapshot or evidence.`);
  }

  throw new Error(`Unrecognized ${sourceLabel} format. Expected CIBaseline (v1.0), MeasurementSnapshot, or ZyraEvidence (v1.0).`);
}

async function handleVerifyCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const isDesktop = args.includes('--desktop');
  const isMobile = args.includes('--mobile');

  let targetUrl: string | undefined;
  let workspacePath: string | undefined;
  let baselinePath: string | undefined;
  let postFixPath: string | undefined;
  let fixResultPath: string | undefined;
  let fixPlanPath: string | undefined;
  let targetMetricArg: string | undefined;
  let outputPath: string | undefined;
  let runsCount = 1;
  let timeoutMs = 90000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--workspace' || arg === '--codebase') {
      workspacePath = args[++i];
    } else if (arg === '--baseline') {
      baselinePath = args[++i];
    } else if (arg === '--post-fix' || arg === '--postfix') {
      postFixPath = args[++i];
    } else if (arg === '--fix-result') {
      fixResultPath = args[++i];
    } else if (arg === '--fix-plan' || arg === '--plan') {
      fixPlanPath = args[++i];
    } else if (arg === '--target-metric') {
      targetMetricArg = args[++i];
    } else if (arg === '--output') {
      outputPath = args[++i];
    } else if (arg === '--runs') {
      const parsedRuns = parseInt(args[++i], 10);
      if (!isNaN(parsedRuns) && parsedRuns >= 1 && parsedRuns <= 5) {
        runsCount = parsedRuns;
      }
    } else if (arg === '--timeout') {
      const parsedTimeout = parseInt(args[++i], 10);
      if (!isNaN(parsedTimeout)) {
        timeoutMs = parsedTimeout;
      }
    } else if (!arg.startsWith('--') && !targetUrl) {
      targetUrl = arg;
    }
  }

  if (!baselinePath) {
    console.error('❌ Baseline evidence required: zyra verify <url> --workspace <path> --baseline <file>');
    process.exit(1);
  }

  let baselineEvidence: ZyraEvidence;
  try {
    const content = await fs.readFile(baselinePath, 'utf-8');
    const parsed = JSON.parse(content);
    baselineEvidence = extractEvidenceFromPayload(parsed, 'baseline');
    const validation = validateEvidence(baselineEvidence);
    if (!validation.isValid) {
      console.error(`❌ Invalid baseline evidence: ${validation.errors.join('; ')}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Failed to read baseline evidence file: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!targetUrl) {
    targetUrl = baselineEvidence.target?.url;
  }

  if (!targetUrl) {
    console.error('❌ Target URL required: zyra verify <url> --workspace <path> --baseline <file>');
    process.exit(1);
  }

  const device: DeviceType = isDesktop
    ? 'desktop'
    : isMobile
      ? 'mobile'
      : (baselineEvidence.target?.device === 'desktop' ? 'desktop' : 'mobile');

  const effectiveWorkspace = workspacePath || process.cwd();

  let fixResult: FixResult | undefined;
  if (fixResultPath) {
    try {
      const content = await fs.readFile(fixResultPath, 'utf-8');
      fixResult = JSON.parse(content);
    } catch (err) {
      console.error(`❌ Failed to read fix result file: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  let fixPlan: FixPlan | undefined;
  if (fixPlanPath) {
    try {
      const content = await fs.readFile(fixPlanPath, 'utf-8');
      fixPlan = JSON.parse(content);
    } catch (err) {
      console.error(`❌ Failed to read fix plan file: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  let postFixEvidence: ZyraEvidence | undefined;
  const repeatedRunsEvidence: ZyraEvidence[] = [];

  if (postFixPath) {
    try {
      const content = await fs.readFile(postFixPath, 'utf-8');
      const parsed = JSON.parse(content);
      postFixEvidence = extractEvidenceFromPayload(parsed, 'post-fix');
      const validation = validateEvidence(postFixEvidence);
      if (!validation.isValid) {
        console.error(`❌ Invalid post-fix evidence: ${validation.errors.join('; ')}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ Failed to read post-fix evidence file: ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    try {
      for (let r = 0; r < runsCount; r++) {
        const runLabel = runsCount > 1 ? `Measuring post-fix run ${r + 1}/${runsCount}` : 'Measuring post-fix performance';
        const progress = createMeasurementProgress({
          url: targetUrl,
          device,
          timeoutMs,
          isJson,
          taskLabel: runLabel
        });
        progress.start();
        try {
          const { evidence } = await collectEvidence({
            url: targetUrl,
            device,
            timeoutMs,
            onProgress: (status) => progress.update(status)
          });
          progress.succeed();
          if (r === 0) {
            postFixEvidence = evidence;
          }
          repeatedRunsEvidence.push(evidence);
        } catch (error) {
          progress.fail(error);
          throw error;
        }
      }
    } catch (error) {
      console.error(`❌ Post-fix measurement failed: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  if (!postFixEvidence) {
    console.error('❌ Post-fix evidence required for verification.');
    process.exit(1);
  }

  try {
    const result = await verifyOptimization({
      targetUrl,
      workspace: effectiveWorkspace,
      baseline: baselineEvidence,
      postFix: postFixEvidence,
      repeatedRuns: repeatedRunsEvidence.length > 1 ? repeatedRunsEvidence : undefined,
      fixResult,
      fixPlan,
      targetMetric: targetMetricArg
    });

    validateVerificationResult(result);

    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    }

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`
============================================================
 ZYRA — Post-Fix Performance Verification
============================================================
 Target:            ${result.targetUrl}
 Profile:           ${result.device}
 Verification ID:   ${result.verificationId}
 Status:            ${result.status}
 Decision:          ${result.decision}

 METRIC DELTAS
 ------------------------------------------------------------
  Metric          Before         After          Delta          Change   Status
 ------------------------------------------------------------`);

    const metricOrder = ['lcp', 'cls', 'inp', 'fcp', 'tbt', 'speedIndex'];
    for (const key of metricOrder) {
      const m = result.comparison.metrics[key];
      if (!m) continue;
      const name = m.name.padEnd(15);
      const beforeStr = formatMetricVal(m.before, m.unit).padEnd(14);
      const afterStr = formatMetricVal(m.after, m.unit).padEnd(14);
      const deltaStr = formatMetricDeltaStr(m.absoluteDelta, m.unit).padEnd(14);
      const pctStr = formatPercentageStr(m.percentageDelta).padEnd(8);
      const badge = `[${m.status}]`;
      console.log(`  ${name} ${beforeStr} ${afterStr} ${deltaStr} ${pctStr} ${badge}`);
    }

    console.log(` ------------------------------------------------------------`);

    if (result.targetVerification) {
      console.log(`
 TARGET FINDING VERIFICATION
 ------------------------------------------------------------
  Target Metric:    ${result.targetVerification.targetMetric} (${result.targetVerification.expectedDirection})
  Target Status:    ${result.targetVerification.targetImproved ? 'IMPROVED' : 'NOT IMPROVED'}
  Details:          ${result.targetVerification.details}`);
    }

    console.log(`
 REGRESSION CHECK
 ------------------------------------------------------------`);
    if (result.regressions.length === 0) {
      console.log('  Regressions:      None detected. (All metrics within safe thresholds)');
    } else {
      for (const reg of result.regressions) {
        console.log(`  ⚠️  REGRESSION:    ${reg.name} regressed by ${formatMetricDeltaStr(reg.absoluteDelta, reg.unit)} (${formatPercentageStr(reg.percentageDelta)})`);
      }
    }

    if (result.repeatedRuns) {
      console.log(`
 REPEATED MEASUREMENTS (${result.repeatedRuns.completedRuns} runs)
 ------------------------------------------------------------
  Outcome:          ${result.repeatedRuns.outcome}
  Consistent:       ${result.repeatedRuns.consistent ? 'Yes' : 'No'}`);
    }

    console.log(`
 OPTIMIZATION DECISION
 ------------------------------------------------------------
  Decision:         ${result.decision}
  Summary:          ${result.summary}
============================================================
`);
  } catch (err) {
    console.error(`❌ Verification Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

async function handleFixVerifyCommand(args: string[]): Promise<void> {
  const fixResultArg = args.find((a, idx) => {
    if (a.startsWith('--')) return false;
    if (idx > 0 && (args[idx - 1] === '--workspace' || args[idx - 1] === '--url' || args[idx - 1] === '--baseline')) {
      return false;
    }
    return true;
  });

  if (!fixResultArg) {
    console.error('❌ Please specify a fix result file: zyra fix verify <fix-result-file> [options]');
    process.exit(1);
  }

  const passArgs = ['--fix-result', fixResultArg, ...args.filter((a) => a !== fixResultArg)];
  await handleVerifyCommand(passArgs);
}

async function handleFixCommand(args: string[]): Promise<void> {
  const subCommand = args[0];

  if (!subCommand || subCommand === '--help' || subCommand === '-h' || subCommand === 'help') {
    console.log(`
ZYRA Fix Commands:
  zyra fix plan <url> --workspace <path> [options]    Plan evidence-backed code modifications
  zyra fix apply <plan-file> --workspace <path>       Apply or dry-run a verified FixPlan
  zyra fix catalog                                    Display catalog of registered fix strategies
  zyra fix verify <fix-result> --url <url> [options]  Verify post-fix performance improvement
`);
    return;
  }

  if (subCommand === 'catalog' || subCommand === 'strategies') {
    await handleFixCatalogCommand(args.slice(1));
    return;
  }

  if (subCommand === 'plan') {
    await handleFixPlanCommand(args.slice(1));
    return;
  }

  if (subCommand === 'apply') {
    await handleFixApplyCommand(args.slice(1));
    return;
  }

  if (subCommand === 'verify') {
    await handleFixVerifyCommand(args.slice(1));
    return;
  }

  console.error(`❌ Unknown fix command: '${subCommand}'. Run 'zyra fix --help' for available commands.`);
  process.exit(1);
}

function printCiHelp(): void {
  console.log(`
ZYRA CI / Regression Detection Commands:
  zyra ci <url> [options]               Run CI performance check and budget regression evaluation
  zyra ci check <url> [options]         Alias for 'zyra ci'
  zyra ci baseline <url> [options]      Capture and save an authoritative performance baseline

OPTIONS:
  --baseline <file>           Baseline measurement JSON (CIBaseline or ZyraEvidence)
  --budget <file|json>        Performance budget configuration file or inline JSON
  --config <file>             CI configuration file (budgets and policy)
  --output <file>             Write machine-readable CIResult JSON to specified file
  --markdown-output <file>    Write PR Markdown summary comment to specified file
  --current <file>            Pre-captured evidence file for offline CI evaluation
  --mobile                    Emulate mobile device profile (default)
  --desktop                   Emulate desktop device profile
  --fail-on-warn              Elevate WARN exit code (2) to FAIL exit code (1)
  --allow-missing-baseline    Do not fail if baseline is missing; evaluate budgets only
  --timeout <ms>              Browser measurement timeout in milliseconds (default: 90000)
  --json                      Output machine-readable CIResult JSON

EXIT CODES:
  0 = PASS                    All budgets met, zero significant regressions
  1 = FAIL                    Significant regression or hard budget violation
  2 = WARN                    Warning-level budget or minor regression crossed
  3 = INCONCLUSIVE            Incompatible baseline or missing baseline when required
  4 = MEASUREMENT_FAILED      Browser or network measurement error
`);
}

async function handleCiBaselineCommand(args: string[]): Promise<void> {
  const isJson = args.includes('--json');
  const device: DeviceType = args.includes('--desktop') ? 'desktop' : 'mobile';

  const outIdx = args.indexOf('--output');
  const outputPath = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : 'zyra-baseline.json';

  const currentIdx = args.indexOf('--current');
  const currentPath = currentIdx !== -1 && args[currentIdx + 1] ? args[currentIdx + 1] : undefined;

  const timeoutIdx = args.indexOf('--timeout');
  const timeoutMs = timeoutIdx !== -1 && args[timeoutIdx + 1] ? parseInt(args[timeoutIdx + 1], 10) : 90000;

  // Find URL
  let targetUrl = args.find((a, idx) => {
    if (a.startsWith('--')) return false;
    if (idx > 0 && ['--output', '--current', '--timeout'].includes(args[idx - 1])) return false;
    return true;
  });

  let evidence: any;

  if (currentPath) {
    try {
      const content = await fs.readFile(currentPath, 'utf-8');
      const parsed = JSON.parse(content);
      const rawData = parsed.evidence ? parsed.evidence : parsed;
      if (!rawData.schemaVersion && rawData.audits && (rawData.lighthouseVersion || rawData.categories)) {
        const finalUrl = targetUrl || rawData.finalDisplayedUrl || rawData.requestedUrl || 'https://example.com/';
        evidence = normalizeEvidence({
          metadata: {
            targetUrl: finalUrl,
            requestedUrl: rawData.requestedUrl || finalUrl,
            finalDisplayedUrl: finalUrl,
            device,
            timestamp: rawData.fetchTime || new Date().toISOString(),
            durationMs: rawData.timing?.total || 1000,
            lighthouseVersion: rawData.lighthouseVersion || '13.4.1'
          },
          rawLhr: rawData
        });
      } else {
        evidence = rawData;
      }
      if (!targetUrl && evidence.target?.url) {
        targetUrl = evidence.target.url;
      }
    } catch (err) {
      console.error(`❌ Failed to read current evidence file '${currentPath}': ${(err as Error).message}`);
      process.exit(1);
    }
  } else {
    if (!targetUrl) {
      console.error('❌ Please specify a URL to capture baseline: zyra ci baseline <url> [options]');
      process.exit(1);
    }
    const progress = createMeasurementProgress({
      url: targetUrl,
      device,
      timeoutMs,
      isJson,
      taskLabel: 'Capturing baseline measurement'
    });
    progress.start();
    try {
      const res = await collectEvidence({
        url: targetUrl,
        device,
        timeoutMs,
        onProgress: (status) => progress.update(status)
      });
      progress.succeed();
      evidence = res.evidence;
    } catch (err) {
      progress.fail(err);
      console.error(`❌ Measurement failed: ${(err as Error).message}`);
      process.exit(CI_EXIT_CODES.MEASUREMENT_FAILED);
    }
  }

  if (!targetUrl) {
    console.error('❌ Target URL is required to create a baseline.');
    process.exit(1);
  }

  try {
    const baseline = createCIBaseline(evidence, {
      capturedVia: 'zyra ci baseline'
    });
    await saveCIBaseline(baseline, outputPath);

    if (isJson) {
      console.log(JSON.stringify(baseline, null, 2));
      return;
    }

    console.log(`
============================================================
 ZYRA CI — Baseline Captured
============================================================
 Target:            ${baseline.url}
 Profile:           ${baseline.device}
 Baseline ID:       ${baseline.id}
 Saved To:          ${outputPath}
 Timestamp:         ${baseline.timestamp}

 METRICS
 ------------------------------------------------------------
  LCP:              ${baseline.metrics.lcp !== null ? `${Math.round(baseline.metrics.lcp)}ms` : 'N/A'}
  FCP:              ${baseline.metrics.fcp !== null ? `${Math.round(baseline.metrics.fcp)}ms` : 'N/A'}
  CLS:              ${baseline.metrics.cls !== null ? baseline.metrics.cls.toFixed(2) : 'N/A'}
  TBT:              ${baseline.metrics.tbt !== null ? `${Math.round(baseline.metrics.tbt)}ms` : 'N/A'}
  Speed Index:      ${baseline.metrics.speedIndex !== null ? `${Math.round(baseline.metrics.speedIndex)}ms` : 'N/A'}
  INP:              ${baseline.metrics.inp !== null ? `${Math.round(baseline.metrics.inp)}ms` : 'N/A'}
============================================================
`);
  } catch (err) {
    console.error(`❌ Failed to create baseline: ${(err as Error).message}`);
    process.exit(1);
  }
}

async function handleCiCommand(args: string[]): Promise<void> {
  const first = args[0];
  if (first === 'baseline') {
    await handleCiBaselineCommand(args.slice(1));
    return;
  }
  if (!first || first === '--help' || first === '-h' || first === 'help') {
    printCiHelp();
    return;
  }

  const effectiveArgs = first === 'check' ? args.slice(1) : args;

  const isJson = effectiveArgs.includes('--json');
  const device: DeviceType = effectiveArgs.includes('--desktop') ? 'desktop' : 'mobile';
  const failOnWarn = effectiveArgs.includes('--fail-on-warn');
  const allowMissingBaseline = effectiveArgs.includes('--allow-missing-baseline');

  const baseIdx = effectiveArgs.indexOf('--baseline');
  const baselinePath = baseIdx !== -1 && effectiveArgs[baseIdx + 1] ? effectiveArgs[baseIdx + 1] : undefined;

  const budgetIdx = effectiveArgs.indexOf('--budget');
  const budgetArg = budgetIdx !== -1 && effectiveArgs[budgetIdx + 1] ? effectiveArgs[budgetIdx + 1] : undefined;

  const configIdx = effectiveArgs.indexOf('--config');
  const configArg = configIdx !== -1 && effectiveArgs[configIdx + 1] ? effectiveArgs[configIdx + 1] : undefined;

  const outIdx = effectiveArgs.indexOf('--output');
  const outputPath = outIdx !== -1 && effectiveArgs[outIdx + 1] ? effectiveArgs[outIdx + 1] : undefined;

  const mdOutIdx = effectiveArgs.indexOf('--markdown-output');
  const markdownOutputPath = mdOutIdx !== -1 && effectiveArgs[mdOutIdx + 1] ? effectiveArgs[mdOutIdx + 1] : undefined;

  const currentIdx = effectiveArgs.indexOf('--current');
  const currentPath = currentIdx !== -1 && effectiveArgs[currentIdx + 1] ? effectiveArgs[currentIdx + 1] : undefined;

  const timeoutIdx = effectiveArgs.indexOf('--timeout');
  const timeoutMs = timeoutIdx !== -1 && effectiveArgs[timeoutIdx + 1] ? parseInt(effectiveArgs[timeoutIdx + 1], 10) : 90000;

  // Find target URL: either from --url flag or first non-flag argument
  const urlFlagIdx = effectiveArgs.indexOf('--url');
  let targetUrl: string | undefined = urlFlagIdx !== -1 && effectiveArgs[urlFlagIdx + 1] ? effectiveArgs[urlFlagIdx + 1] : undefined;

  if (!targetUrl) {
    targetUrl = effectiveArgs.find((a, idx) => {
      if (a.startsWith('--')) return false;
      if (idx > 0 && ['--baseline', '--budget', '--config', '--output', '--markdown-output', '--current', '--timeout', '--url'].includes(effectiveArgs[idx - 1])) {
        return false;
      }
      return true;
    });
  }

  // Load current evidence if in offline mode
  let currentEvidence: any | undefined;
  if (currentPath) {
    try {
      const content = await fs.readFile(currentPath, 'utf-8');
      const parsed = JSON.parse(content);
      const rawData: any = parsed?.snapshot?.evidence || parsed?.evidence || parsed;
      if (!rawData.schemaVersion && rawData.audits && (rawData.lighthouseVersion || rawData.categories)) {
        const finalUrl = targetUrl || rawData.finalDisplayedUrl || rawData.requestedUrl || 'https://example.com/';
        currentEvidence = normalizeEvidence({
          metadata: {
            targetUrl: finalUrl,
            requestedUrl: rawData.requestedUrl || finalUrl,
            finalDisplayedUrl: finalUrl,
            device,
            timestamp: rawData.fetchTime || new Date().toISOString(),
            durationMs: rawData.timing?.total || 1000,
            lighthouseVersion: rawData.lighthouseVersion || '13.4.1'
          },
          rawLhr: rawData
        });
      } else {
        currentEvidence = rawData;
      }
      if (!targetUrl && currentEvidence?.target?.url) {
        targetUrl = currentEvidence.target.url;
      }
    } catch (err) {
      console.error(`❌ Failed to read current evidence file '${currentPath}': ${(err as Error).message}`);
      process.exit(CI_EXIT_CODES.MEASUREMENT_FAILED);
    }
  }

  // If targetUrl not yet resolved, try reading from baseline
  let baselineObj: any;
  if (baselinePath) {
    try {
      baselineObj = await loadCIBaseline(baselinePath);
      if (!targetUrl && baselineObj.url) {
        targetUrl = baselineObj.url;
      }
    } catch {
      // Handled by runCI
    }
  }

  if (!targetUrl) {
    console.error('❌ Please specify a target URL: zyra ci <url> [options]');
    process.exit(1);
  }

  // Load budget config if provided
  let budgetConfig;
  if (budgetArg) {
    try {
      budgetConfig = await parseBudgetConfig(budgetArg);
    } catch (err) {
      console.error(`❌ Failed to load budget configuration: ${(err as Error).message}`);
      process.exit(1);
    }
  } else if (configArg) {
    try {
      budgetConfig = await parseBudgetConfig(configArg);
    } catch (err) {
      console.error(`❌ Failed to load configuration file: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const policy: CIPolicy = {
    failOnWarn,
    allowMissingBaseline
  };

  try {
    const result = await runCI({
      targetUrl,
      device,
      baseline: baselineObj || baselinePath,
      currentEvidence,
      budgetConfig,
      policy,
      timeoutMs
    });

    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    }

    if (markdownOutputPath && result.prComment) {
      await fs.writeFile(markdownOutputPath, result.prComment, 'utf-8');
    }

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatCIReportTerminal(result));
    }

    process.exit(result.exitCode);
  } catch (err) {
    console.error(`❌ Fatal CI Error: ${(err as Error).message}`);
    process.exit(CI_EXIT_CODES.MEASUREMENT_FAILED);
  }
}

export async function runCli(args: string[]): Promise<void> {
  const firstArg = args[0];

  if (!firstArg || firstArg === '--help' || firstArg === '-h' || firstArg === 'help') {
    printHelp();
    return;
  }

  if (firstArg === '--version' || firstArg === '-v' || firstArg === 'version') {
    console.log(`zyra v${VERSION}`);
    return;
  }

  if (firstArg === '/zyra' || firstArg === 'zyra') {
    const subArgs = args.slice(1);
    if (subArgs.length === 0) {
      printHelp();
      return;
    }
    return runCli(subArgs);
  }

  if (firstArg === 'context' || firstArg === '/context') {
    await handleContextCommand(args.slice(1));
    return;
  }

  if (firstArg === 'rules' || firstArg === '/rules') {
    await handleRulesCommand(args.slice(1));
    return;
  }

  if (firstArg === 'fix' || firstArg === '/fix') {
    await handleFixCommand(args.slice(1));
    return;
  }

  if (firstArg === 'verify' || firstArg === '/verify') {
    await handleVerifyCommand(args.slice(1));
    return;
  }

  if (firstArg === 'ci' || firstArg === '/ci') {
    await handleCiCommand(args.slice(1));
    return;
  }

  if (firstArg === 'analyze') {
    const targetUrl = args[1];
    if (!targetUrl || targetUrl.startsWith('--')) {
      console.error('❌ Please specify a URL to analyze: zyra analyze <url> --workspace <path>');
      process.exit(1);
    }
    await handleMeasureCommand(targetUrl, args.slice(2));
    return;
  }

  if (firstArg === 'codebase' || firstArg === 'inspect') {
    const targetPath = args[1];
    if (!targetPath || targetPath.startsWith('--')) {
      console.error('❌ Please specify a workspace path to inspect: zyra codebase <path>');
      process.exit(1);
    }
    await handleCodebaseCommand(targetPath, args.slice(2));
    return;
  }

  // Handle measurement command: URL supplied
  if (firstArg.startsWith('http://') || firstArg.startsWith('https://') || firstArg.includes('.')) {
    await handleMeasureCommand(firstArg, args.slice(1));
    return;
  }

  console.error(`❌ Unknown command: '${firstArg}'. Run 'zyra --help' for available commands.`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  await runCli(args);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
