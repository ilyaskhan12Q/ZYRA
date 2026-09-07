/**
 * ZYRA Safe Fix Executor
 * Enforces preflight safety, optimistic concurrency content guards, dry-run mode,
 * transactional multi-file modifications, automated rollback, and audit trail generation.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type FixAuditRecord,
  type FixExecutionOptions,
  type FixOperationResult,
  type FixPlan,
  type FixResult
} from './types.js';
import {
  computeSha256,
  isBinaryContent,
  isProtectedFile,
  validateWorkspacePath,
  verifyContentHash,
  normalizePosixPath
} from './safety.js';
import { validateFixPlan } from './validator.js';

interface JournalEntry {
  canonicalPath: string;
  relativePath: string;
  originalContent: string;
  originalHash: string;
  modified: boolean;
}

export class FixExecutor {
  /**
   * Executes or dry-runs a FixPlan with transactional rollback guarantees.
   */
  async execute(plan: FixPlan, options: FixExecutionOptions): Promise<FixResult> {
    const timestamp = options.fixedTimestamp ?? new Date().toISOString();
    const isDryRun = options.dryRun ?? false;

    // 1. Validate FixPlan schema integrity
    const planValidation = validateFixPlan(plan);
    if (!planValidation.isValid) {
      return this.createFailureResult(
        plan,
        options,
        timestamp,
        'FAILED',
        `INVALID_PLAN: Plan validation failed: ${planValidation.errors.join('; ')}`
      );
    }

    // 2. Check if plan is marked BLOCKED
    if (plan.status === 'BLOCKED' || plan.risk === 'BLOCKED') {
      return this.createFailureResult(
        plan,
        options,
        timestamp,
        'BLOCKED',
        'PLAN_BLOCKED: This plan is marked as BLOCKED and cannot be applied automatically.'
      );
    }

    // Check risk level guard
    if (plan.risk === 'HIGH' && !options.allowHighRisk) {
      return this.createFailureResult(
        plan,
        options,
        timestamp,
        'BLOCKED',
        'HIGH_RISK_BLOCKED: Plan carries HIGH risk. Application requires explicit allowHighRisk flag.'
      );
    }

    // 3. Preflight Phase: Validate all operations, paths, hashes, and binary guards before mutating anything
    const journal: Map<string, JournalEntry> = new Map();
    const operationResults: FixOperationResult[] = [];

    for (const op of plan.operations) {
      // Skip informational advice operations
      if (op.type === 'NOOP_ADVICE') {
        operationResults.push({
          operationId: op.id,
          targetPath: op.targetPath,
          status: 'SKIPPED',
          originalHash: op.originalContentHash,
          error: 'Informational advice only; no code changes performed.'
        });
        continue;
      }

      // Check path containment & protected file guard
      const pathValidation = await validateWorkspacePath(op.targetPath, options.workspaceRoot);
      if (!pathValidation.valid || !pathValidation.canonicalPath) {
        return this.createFailureResult(
          plan,
          options,
          timestamp,
          'BLOCKED',
          `PATH_SAFETY_VIOLATION: ${pathValidation.error}`
        );
      }

      const canonicalPath = pathValidation.canonicalPath;
      const relativePath = pathValidation.relativePath!;

      // Check protected file guard
      if (isProtectedFile(relativePath)) {
        return this.createFailureResult(
          plan,
          options,
          timestamp,
          'BLOCKED',
          `PROTECTED_FILE_VIOLATION: File '${relativePath}' is protected against automated modifications.`
        );
      }

      // Read file and check binary guard
      let buffer: Buffer;
      try {
        buffer = await fs.readFile(canonicalPath);
      } catch (err) {
        return this.createFailureResult(
          plan,
          options,
          timestamp,
          'FAILED',
          `FILE_READ_FAILED: Cannot read target file '${relativePath}': ${(err as Error).message}`
        );
      }

      if (isBinaryContent(buffer)) {
        return this.createFailureResult(
          plan,
          options,
          timestamp,
          'BLOCKED',
          `BINARY_FILE_BLOCKED: Target file '${relativePath}' is a binary file; text modifications are forbidden.`
        );
      }

      // Optimistic Concurrency Content Guard: compare SHA-256
      const hashCheck = await verifyContentHash(canonicalPath, op.originalContentHash);
      if (!hashCheck.matches) {
        return this.createFailureResult(
          plan,
          options,
          timestamp,
          'FAILED',
          hashCheck.error ?? `PLAN_STALE: Content hash mismatch on '${relativePath}'.`
        );
      }

      // Verify that expectedOriginalContent matches if supplied
      const currentContent = hashCheck.currentContent ?? buffer.toString('utf-8');
      if (op.expectedOriginalContent && !currentContent.includes(op.expectedOriginalContent)) {
        return this.createFailureResult(
          plan,
          options,
          timestamp,
          'FAILED',
          `PATTERN_NOT_FOUND: Expected content pattern not found in '${relativePath}'.`
        );
      }

      // Store in rollback journal
      if (!journal.has(canonicalPath)) {
        journal.set(canonicalPath, {
          canonicalPath,
          relativePath,
          originalContent: currentContent,
          originalHash: op.originalContentHash,
          modified: false
        });
      }
    }

    // 4. Dry-Run Check: If dry-run requested, complete successfully WITHOUT modifying any files
    if (isDryRun) {
      for (const op of plan.operations) {
        if (op.type === 'NOOP_ADVICE') continue;
        operationResults.push({
          operationId: op.id,
          targetPath: op.targetPath,
          status: 'SKIPPED',
          originalHash: op.originalContentHash,
          newHash: op.replacementContent
            ? computeSha256(op.replacementContent)
            : op.originalContentHash
        });
      }

      return {
        status: 'DRY_RUN',
        planId: plan.planId,
        strategyId: plan.strategy.id,
        strategyVersion: plan.strategy.version,
        workspace: normalizePosixPath(options.workspaceRoot),
        timestamp,
        operations: operationResults,
        audit: {
          timestamp,
          planId: plan.planId,
          strategyId: plan.strategy.id,
          strategyVersion: plan.strategy.version,
          workspace: normalizePosixPath(options.workspaceRoot),
          filesChanged: [],
          operationsCount: plan.operations.length,
          originalHashes: Object.fromEntries(
            Array.from(journal.values()).map((j) => [j.relativePath, j.originalHash])
          ),
          newHashes: {},
          result: 'DRY_RUN',
          rollbackAvailable: true
        },
        rollbackAvailable: true
      };
    }

    // 5. Transactional Modification Phase
    const modifiedFiles: string[] = [];
    const originalHashes: Record<string, string> = {};
    const newHashes: Record<string, string> = {};

    try {
      for (const op of plan.operations) {
        if (op.type === 'NOOP_ADVICE') continue;

        const pathValidation = await validateWorkspacePath(op.targetPath, options.workspaceRoot);
        const canonicalPath = pathValidation.canonicalPath!;
        const journalItem = journal.get(canonicalPath)!;

        originalHashes[journalItem.relativePath] = journalItem.originalHash;

        let contentToModify = journalItem.modified
          ? await fs.readFile(canonicalPath, 'utf-8')
          : journalItem.originalContent;

        let newContent: string;

        if (op.type === 'REMOVE_UNUSED_IMPORT') {
          // Remove the exact import line
          const lines = contentToModify.split('\n');
          const filteredLines = lines.filter((line) => line !== op.expectedOriginalContent);
          newContent = filteredLines.join('\n');
        } else if (op.type === 'REPLACE_TEXT' || op.type === 'EDIT_ATTRIBUTE' || op.type === 'REPLACE_IMPORT') {
          if (!op.expectedOriginalContent || op.replacementContent === undefined) {
            throw new Error(`Operation '${op.id}' missing expectedOriginalContent or replacementContent.`);
          }
          newContent = contentToModify.replace(op.expectedOriginalContent, op.replacementContent);
        } else if (op.type === 'INSERT_TEXT') {
          if (!op.expectedOriginalContent || op.replacementContent === undefined) {
            throw new Error(`Operation '${op.id}' missing expectedOriginalContent or replacementContent.`);
          }
          newContent = contentToModify.replace(op.expectedOriginalContent, op.replacementContent);
        } else {
          throw new Error(`Unsupported operation type: ${op.type}`);
        }

        // Write to file
        await fs.writeFile(canonicalPath, newContent, 'utf-8');
        journalItem.modified = true;
        if (!modifiedFiles.includes(journalItem.relativePath)) {
          modifiedFiles.push(journalItem.relativePath);
        }

        const newHash = computeSha256(newContent);
        newHashes[journalItem.relativePath] = newHash;

        operationResults.push({
          operationId: op.id,
          targetPath: op.targetPath,
          status: 'APPLIED',
          originalHash: op.originalContentHash,
          newHash
        });
      }

      // All operations succeeded!
      const audit: FixAuditRecord = {
        timestamp,
        planId: plan.planId,
        strategyId: plan.strategy.id,
        strategyVersion: plan.strategy.version,
        workspace: normalizePosixPath(options.workspaceRoot),
        filesChanged: modifiedFiles,
        operationsCount: operationResults.filter((o) => o.status === 'APPLIED').length,
        originalHashes,
        newHashes,
        result: 'APPLIED',
        rollbackAvailable: true
      };

      return {
        status: 'APPLIED',
        planId: plan.planId,
        strategyId: plan.strategy.id,
        strategyVersion: plan.strategy.version,
        workspace: normalizePosixPath(options.workspaceRoot),
        timestamp,
        operations: operationResults,
        audit,
        rollbackAvailable: true
      };
    } catch (err) {
      // 6. Transaction Rollback Phase: Restore all modified files from journal
      let rollbackError: string | undefined;
      try {
        for (const entry of journal.values()) {
          if (entry.modified) {
            await fs.writeFile(entry.canonicalPath, entry.originalContent, 'utf-8');
          }
        }
      } catch (rbErr) {
        rollbackError = `ROLLBACK_FAILED: Failed to restore original files: ${(rbErr as Error).message}`;
      }

      const failureStatus = rollbackError ? 'FAILED' : 'ROLLED_BACK';

      return {
        status: failureStatus,
        planId: plan.planId,
        strategyId: plan.strategy.id,
        strategyVersion: plan.strategy.version,
        workspace: normalizePosixPath(options.workspaceRoot),
        timestamp,
        operations: operationResults,
        audit: {
          timestamp,
          planId: plan.planId,
          strategyId: plan.strategy.id,
          strategyVersion: plan.strategy.version,
          workspace: normalizePosixPath(options.workspaceRoot),
          filesChanged: [],
          operationsCount: 0,
          originalHashes,
          newHashes: {},
          result: failureStatus,
          rollbackAvailable: !rollbackError
        },
        rollbackAvailable: !rollbackError,
        error: rollbackError ?? `TRANSACTION_FAILED: ${(err as Error).message}. All changes rolled back.`
      };
    }
  }

  private createFailureResult(
    plan: FixPlan,
    options: FixExecutionOptions,
    timestamp: string,
    status: 'BLOCKED' | 'FAILED',
    error: string
  ): FixResult {
    return {
      status,
      planId: plan.planId,
      strategyId: plan.strategy.id,
      strategyVersion: plan.strategy.version,
      workspace: normalizePosixPath(options.workspaceRoot),
      timestamp,
      operations: plan.operations.map((op) => ({
        operationId: op.id,
        targetPath: op.targetPath,
        status: 'FAILED',
        originalHash: op.originalContentHash,
        error
      })),
      audit: {
        timestamp,
        planId: plan.planId,
        strategyId: plan.strategy.id,
        strategyVersion: plan.strategy.version,
        workspace: normalizePosixPath(options.workspaceRoot),
        filesChanged: [],
        operationsCount: 0,
        originalHashes: {},
        newHashes: {},
        result: status,
        rollbackAvailable: false
      },
      rollbackAvailable: false,
      error
    };
  }
}

/**
 * High-level helper to execute a fix plan.
 */
export async function executeFix(
  plan: FixPlan,
  options: FixExecutionOptions
): Promise<FixResult> {
  const executor = new FixExecutor();
  return executor.execute(plan, options);
}
