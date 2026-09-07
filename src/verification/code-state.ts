/**
 * ZYRA Cryptographic Code State Validator
 *
 * Verifies that the target workspace files match the expected post-fix hashes
 * recorded in a FixResult audit before attributing post-fix measurements to the fix.
 */

import * as fs from 'node:fs/promises';
import { computeSha256, validateWorkspacePath } from '../fixes/safety.js';
import { type FixResult } from '../fixes/types.js';
import { type FileHashVerification } from './types.js';

export interface CodeStateVerificationResult {
  valid: boolean;
  files: FileHashVerification[];
  error?: string;
}

/**
 * Validates that workspace files correspond to the newHashes from a FixResult audit.
 */
export async function verifyWorkspaceCodeState(
  workspaceRoot: string,
  fixResult: FixResult
): Promise<CodeStateVerificationResult> {
  const files: FileHashVerification[] = [];
  const expectedHashes = fixResult.audit?.newHashes || {};

  const filePaths = Object.keys(expectedHashes);
  if (filePaths.length === 0) {
    // No files to verify
    return {
      valid: true,
      files: []
    };
  }

  let allMatch = true;

  for (const relPath of filePaths) {
    const expectedHash = expectedHashes[relPath];
    let currentHash = 'MISSING';
    let matches = false;

    try {
      const validation = await validateWorkspacePath(relPath, workspaceRoot);
      if (validation.valid && validation.canonicalPath) {
        const content = await fs.readFile(validation.canonicalPath);
        currentHash = computeSha256(content);
        matches = (currentHash === expectedHash);
      } else {
        matches = false;
        currentHash = 'INVALID_PATH';
      }
    } catch {
      matches = false;
      currentHash = 'UNREADABLE_OR_MISSING';
    }

    if (!matches) {
      allMatch = false;
    }

    files.push({
      path: relPath,
      expectedHash,
      currentHash,
      matches
    });
  }

  return {
    valid: allMatch,
    files,
    error: allMatch ? undefined : 'Workspace code state has drifted from the applied fix.'
  };
}
