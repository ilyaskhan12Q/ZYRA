/**
 * High-Level Codebase Scanner Orchestrator
 */

import * as path from 'node:path';
import {
  CODEBASE_EVIDENCE_SCHEMA_VERSION,
  type CodebaseEvidence,
  type ScanWarning
} from './types.js';
import { traverseWorkspace, type TraversalOptions } from './traversal.js';
import { detectPackageManager } from './detector/packageManager.js';
import { detectRuntime } from './detector/runtime.js';
import { detectFramework } from './detector/framework.js';
import { detectEntryPoints } from './detector/entryPoints.js';
import { detectRoutes } from './detector/routes.js';
import { extractDependencies } from './analyzer/dependencies.js';
import { extractAssets } from './analyzer/assets.js';
import { analyzeImports } from './analyzer/imports.js';
import { inspectConfiguration } from './analyzer/config.js';
import { validateCodebaseEvidence } from './validator.js';

export interface ScannerOptions extends TraversalOptions {
  scannerVersion?: string;
  skipValidation?: boolean;
}

export const CURRENT_SCANNER_VERSION = '0.4.0';

/**
 * Executes a deterministic, read-only scan of the target workspace,
 * producing structured CodebaseEvidence.
 */
export async function scanCodebase(
  workspaceRoot: string,
  options: ScannerOptions = {}
): Promise<CodebaseEvidence> {
  const scannedAt = new Date().toISOString();
  const scannerVersion = options.scannerVersion ?? CURRENT_SCANNER_VERSION;

  // 1. Safe traversal
  const traversal = await traverseWorkspace(workspaceRoot, options);
  const { files, readableFiles, warnings } = traversal;

  // Derive sanitized root name (basename of workspace directory)
  const rootName = path.basename(traversal.canonicalRoot) || 'workspace';

  // 2. Parse package.json safely if available
  let packageJsonParsed: Record<string, unknown> | null = null;
  const packageJsonContent = readableFiles.get('package.json');
  if (packageJsonContent) {
    try {
      packageJsonParsed = JSON.parse(packageJsonContent);
    } catch (err) {
      warnings.push({
        code: 'MALFORMED_PACKAGE_JSON',
        message: `Failed to parse package.json as valid JSON: ${(err as Error).message}`,
        targetPath: 'package.json'
      });
    }
  }

  // 3. Package Manager Detection
  const packageManager = detectPackageManager(files, packageJsonParsed);
  if (packageManager.hasConflict) {
    warnings.push({
      code: 'LOCKFILE_CONFLICT',
      message: `Multiple conflicting lockfiles detected: ${packageManager.conflicts?.join(', ')}.`,
      targetPath: 'package.json'
    });
  }

  // 4. Runtime Detection
  const runtime = detectRuntime(readableFiles, packageJsonParsed);

  // 5. Dependency Analysis
  const dependencies = extractDependencies(packageJsonParsed);

  // 6. Framework Detection
  const framework = detectFramework(files, dependencies);

  // 7. Entry Point Detection
  const entryPoints = detectEntryPoints(files, framework.name);

  // 8. Route Detection
  const routes = detectRoutes(files);

  // 9. Asset Inventory
  const assets = extractAssets(files);

  // 10. Static & Dynamic Import Analysis
  const imports = analyzeImports(readableFiles, files);

  // 11. Configuration & Source Maps
  const configuration = inspectConfiguration(files, readableFiles, framework.name);

  // 12. Sort warnings deterministically
  warnings.sort((a, b) => {
    const c = a.code.localeCompare(b.code);
    if (c !== 0) return c;
    return (a.targetPath ?? '').localeCompare(b.targetPath ?? '');
  });

  // 13. Assemble CodebaseEvidence
  const evidence: CodebaseEvidence = {
    schemaVersion: CODEBASE_EVIDENCE_SCHEMA_VERSION,
    workspace: {
      root: rootName,
      scannedAt,
      scannerVersion,
      stats: traversal.stats
    },
    framework,
    packageManager,
    runtime,
    dependencies,
    files,
    routes,
    entryPoints,
    assets,
    imports,
    configuration,
    warnings
  };

  // 14. Contract validation
  if (!options.skipValidation) {
    const validation = validateCodebaseEvidence(evidence);
    if (!validation.isValid) {
      throw new Error(
        `CodebaseEvidence validation failed:\n- ${validation.errors.join('\n- ')}`
      );
    }
  }

  return evidence;
}
