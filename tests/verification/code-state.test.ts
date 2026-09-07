import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { verifyWorkspaceCodeState } from '../../src/verification/index.js';
import { computeSha256 } from '../../src/fixes/safety.js';
import { type FixResult } from '../../src/fixes/types.js';

describe('Code State Hash Validation — Phase 08 Verification', () => {
  it('verifies matching code state against FixResult audit hashes', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-code-state-test-'));
    try {
      const filePath = path.join(tmpDir, 'src/index.ts');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const content = 'export const greeting = "hello world";\n';
      await fs.writeFile(filePath, content, 'utf-8');
      const hash = computeSha256(content);

      const fixResult: FixResult = {
        status: 'APPLIED',
        planId: 'plan_1',
        strategyId: 'FIX_UNUSED_IMPORT',
        strategyVersion: '1.0',
        workspace: tmpDir,
        timestamp: new Date().toISOString(),
        operations: [],
        audit: {
          timestamp: new Date().toISOString(),
          planId: 'plan_1',
          strategyId: 'FIX_UNUSED_IMPORT',
          strategyVersion: '1.0',
          workspace: tmpDir,
          filesChanged: ['src/index.ts'],
          operationsCount: 1,
          originalHashes: {},
          newHashes: {
            'src/index.ts': hash
          },
          result: 'APPLIED',
          rollbackAvailable: true
        },
        rollbackAvailable: true
      };

      const verification = await verifyWorkspaceCodeState(tmpDir, fixResult);
      assert.equal(verification.valid, true);
      assert.equal(verification.files.length, 1);
      assert.equal(verification.files[0].matches, true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects drifted code state when file on disk differs from audit', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-code-drift-test-'));
    try {
      const filePath = path.join(tmpDir, 'src/index.ts');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'modified content after fix\n', 'utf-8');

      const fixResult: FixResult = {
        status: 'APPLIED',
        planId: 'plan_1',
        strategyId: 'FIX_UNUSED_IMPORT',
        strategyVersion: '1.0',
        workspace: tmpDir,
        timestamp: new Date().toISOString(),
        operations: [],
        audit: {
          timestamp: new Date().toISOString(),
          planId: 'plan_1',
          strategyId: 'FIX_UNUSED_IMPORT',
          strategyVersion: '1.0',
          workspace: tmpDir,
          filesChanged: ['src/index.ts'],
          operationsCount: 1,
          originalHashes: {},
          newHashes: {
            'src/index.ts': 'expected_hash_that_does_not_match'
          },
          result: 'APPLIED',
          rollbackAvailable: true
        },
        rollbackAvailable: true
      };

      const verification = await verifyWorkspaceCodeState(tmpDir, fixResult);
      assert.equal(verification.valid, false);
      assert.equal(verification.files.length, 1);
      assert.equal(verification.files[0].matches, false);
      assert.ok(verification.error?.includes('drifted'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects missing files declared in fix result', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-missing-file-test-'));
    try {
      const fixResult: FixResult = {
        status: 'APPLIED',
        planId: 'plan_1',
        strategyId: 'FIX_UNUSED_IMPORT',
        strategyVersion: '1.0',
        workspace: tmpDir,
        timestamp: new Date().toISOString(),
        operations: [],
        audit: {
          timestamp: new Date().toISOString(),
          planId: 'plan_1',
          strategyId: 'FIX_UNUSED_IMPORT',
          strategyVersion: '1.0',
          workspace: tmpDir,
          filesChanged: ['src/deleted.ts'],
          operationsCount: 1,
          originalHashes: {},
          newHashes: {
            'src/deleted.ts': 'hash123'
          },
          result: 'APPLIED',
          rollbackAvailable: true
        },
        rollbackAvailable: true
      };

      const verification = await verifyWorkspaceCodeState(tmpDir, fixResult);
      assert.equal(verification.valid, false);
      assert.equal(verification.files[0].matches, false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
