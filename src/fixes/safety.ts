/**
 * ZYRA Fix Safety & Security Layer
 * Enforces workspace containment, symlink escape protection, protected file guards,
 * optimistic concurrency content hashing, and binary file protection.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { SENSITIVE_FILE_PATTERNS } from '../codebase/traversal.js';

export const PROTECTED_FILE_PATTERNS = [
  ...SENSITIVE_FILE_PATTERNS,
  /^\.git/i,
  /package-lock\.json$/i,
  /pnpm-lock\.yaml$/i,
  /yarn\.lock$/i,
  /bun\.lockb?$/i,
  /tsconfig\.json$/i
];

export function normalizePosixPath(p: string): string {
  return p.split(path.sep).join('/');
}

export function isInsideWorkspace(targetPath: string, canonicalRoot: string): boolean {
  const relative = path.relative(canonicalRoot, targetPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Computes SHA-256 hash of a string or Buffer in hex encoding.
 */
export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Checks if a file path matches sensitive or protected file patterns.
 */
export function isProtectedFile(filePath: string): boolean {
  const normalized = normalizePosixPath(filePath);
  const basename = path.posix.basename(normalized);

  return PROTECTED_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}

export interface PathValidationResult {
  valid: boolean;
  canonicalPath?: string;
  relativePath?: string;
  error?: string;
}

/**
 * Validates that a target path resolves strictly within the canonical workspace boundary,
 * detects path traversal attempts and symlink escapes, and checks for protected files.
 */
export async function validateWorkspacePath(
  targetPath: string,
  workspaceRoot: string
): Promise<PathValidationResult> {
  // Reject raw path traversal strings before resolution
  const normalizedTarget = normalizePosixPath(targetPath);
  if (normalizedTarget.includes('../') || normalizedTarget.startsWith('..')) {
    return {
      valid: false,
      error: `PATH_TRAVERSAL_DETECTED: Target path '${targetPath}' attempts relative traversal.`
    };
  }

  let canonicalRoot: string;
  try {
    canonicalRoot = await fs.realpath(workspaceRoot);
  } catch (err) {
    return {
      valid: false,
      error: `WORKSPACE_NOT_FOUND: Failed to resolve canonical workspace root '${workspaceRoot}': ${(err as Error).message}`
    };
  }

  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(canonicalRoot, targetPath);

  // If file exists, check realpath for symlink escapes
  let canonicalTarget = resolvedTarget;
  try {
    canonicalTarget = await fs.realpath(resolvedTarget);
  } catch (err) {
    // If target does not exist, resolve parent directory realpath
    const parentDir = path.dirname(resolvedTarget);
    try {
      const canonicalParent = await fs.realpath(parentDir);
      canonicalTarget = path.join(canonicalParent, path.basename(resolvedTarget));
    } catch {
      // Parent also doesn't exist or is inaccessible
      return {
        valid: false,
        error: `TARGET_NOT_ACCESSIBLE: Target path '${targetPath}' parent directory is inaccessible.`
      };
    }
  }

  if (!isInsideWorkspace(canonicalTarget, canonicalRoot)) {
    return {
      valid: false,
      error: `WORKSPACE_ESCAPE_DETECTED: Target path '${targetPath}' resolves outside the canonical workspace boundary.`
    };
  }

  const relativePath = normalizePosixPath(path.relative(canonicalRoot, canonicalTarget));

  if (isProtectedFile(relativePath)) {
    return {
      valid: false,
      error: `PROTECTED_FILE_BLOCKED: Target path '${relativePath}' matches a protected or sensitive file pattern.`
    };
  }

  return {
    valid: true,
    canonicalPath: canonicalTarget,
    relativePath
  };
}

export interface ContentHashVerificationResult {
  matches: boolean;
  currentHash: string;
  currentContent?: string;
  error?: string;
}

/**
 * Verifies optimistic concurrency guard. Reads target file and compares its current SHA-256
 * with the expected originalContentHash stored in the FixOperation.
 */
export async function verifyContentHash(
  canonicalPath: string,
  expectedHash: string
): Promise<ContentHashVerificationResult> {
  try {
    const buffer = await fs.readFile(canonicalPath);
    const currentHash = computeSha256(buffer);

    if (currentHash !== expectedHash) {
      return {
        matches: false,
        currentHash,
        error: `PLAN_STALE: File '${canonicalPath}' content hash (${currentHash.slice(0, 8)}) does not match plan expectation (${expectedHash.slice(0, 8)}). The file may have been modified after plan creation.`
      };
    }

    return {
      matches: true,
      currentHash,
      currentContent: buffer.toString('utf-8')
    };
  } catch (err) {
    return {
      matches: false,
      currentHash: '',
      error: `FILE_READ_FAILED: Failed to read file '${canonicalPath}' for hash verification: ${(err as Error).message}`
    };
  }
}

/**
 * Detects whether a buffer represents binary content (e.g. contains null bytes).
 */
export function isBinaryContent(buffer: Buffer): boolean {
  // Check the first 8000 bytes for null bytes (standard binary detection heuristic)
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}
