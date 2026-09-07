import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  executeFix,
  computeSha256,
  type FixPlan,
  FIX_SCHEMA_VERSION
} from '../../src/fixes/index.js';

function createTestPlan(
  workspaceRoot: string,
  targetFile: string,
  originalContent: string,
  originalTag: string,
  replacementTag: string
): FixPlan {
  const originalHash = computeSha256(originalContent);

  return {
    schemaVersion: FIX_SCHEMA_VERSION,
    planId: 'plan_exec_test',
    createdAt: '2026-09-06T12:00:00.000Z',
    targetWorkspace: workspaceRoot,
    sourceFindingIds: ['finding:lcp_critical'],
    sourceCorrelationIds: ['candidate:image:public/hero.webp'],
    candidate: {
      candidateId: 'candidate:image:public/hero.webp',
      targetPath: 'public/hero.webp',
      targetType: 'asset',
      reason: 'LCP image candidate',
      evidenceRefs: [],
      findingRefs: ['finding:lcp_critical'],
      correlationRefs: ['CORR_IMAGE_ASSET']
    },
    strategy: {
      id: 'FIX_IMAGE_OPTIMIZATION',
      version: '1.0',
      name: 'Image Loading & Asset Optimization'
    },
    operations: [
      {
        id: 'op_test_1',
        type: 'EDIT_ATTRIBUTE',
        targetPath: targetFile,
        originalContentHash: originalHash,
        expectedOriginalContent: originalTag,
        replacementContent: replacementTag,
        reason: 'Add fetchpriority="high"'
      }
    ],
    risk: 'LOW',
    confidence: 0.9,
    expectedImpact: {
      targetMetric: 'LCP',
      estimatedDirection: 'improve',
      description: 'Potential reduction in LCP image load delay'
    },
    preconditions: [{ description: 'File exists', satisfied: true }],
    safetyChecks: [],
    rollbackInformation: {
      strategy: 'IN_MEMORY',
      available: true,
      operations: [{ targetPath: targetFile, originalHash, originalContent }]
    },
    status: 'READY_FOR_REVIEW'
  };
}

describe('Fix Executor & Transaction Safety — Phase 07 Verification', () => {
  describe('Dry-Run Simulation', () => {
    it('simulates modification without changing any files on disk', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-exec-'));
      try {
        const testFile = path.join(tmpDir, 'index.html');
        const initialContent = '<html><body><img src="/hero.webp"></body></html>';
        await fs.writeFile(testFile, initialContent);

        const statBefore = await fs.stat(testFile);
        const plan = createTestPlan(
          tmpDir,
          'index.html',
          initialContent,
          '<img src="/hero.webp">',
          '<img fetchpriority="high" src="/hero.webp">'
        );

        const result = await executeFix(plan, {
          workspaceRoot: tmpDir,
          dryRun: true
        });

        assert.strictEqual(result.status, 'DRY_RUN');
        assert.strictEqual(result.audit.filesChanged.length, 0);

        // Verify disk content and mtime are 100% unchanged
        const contentAfter = await fs.readFile(testFile, 'utf-8');
        assert.strictEqual(contentAfter, initialContent);
        const statAfter = await fs.stat(testFile);
        assert.strictEqual(statAfter.mtimeMs, statBefore.mtimeMs);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Explicit Modification Execution', () => {
    it('applies surgical modification and emits compliant audit record', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-exec-'));
      try {
        const testFile = path.join(tmpDir, 'index.html');
        const initialContent = '<html><body><img src="/hero.webp"></body></html>';
        await fs.writeFile(testFile, initialContent);

        const plan = createTestPlan(
          tmpDir,
          'index.html',
          initialContent,
          '<img src="/hero.webp">',
          '<img fetchpriority="high" src="/hero.webp">'
        );

        const result = await executeFix(plan, {
          workspaceRoot: tmpDir,
          dryRun: false
        });

        assert.strictEqual(result.status, 'APPLIED');
        assert.strictEqual(result.operations.length, 1);
        assert.strictEqual(result.operations[0]!.status, 'APPLIED');
        assert.strictEqual(result.audit.filesChanged.length, 1);
        assert.strictEqual(result.audit.filesChanged[0], 'index.html');

        const updatedContent = await fs.readFile(testFile, 'utf-8');
        assert.strictEqual(
          updatedContent,
          '<html><body><img fetchpriority="high" src="/hero.webp"></body></html>'
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Optimistic Concurrency (PLAN_STALE Protection)', () => {
    it('refuses to overwrite user changes if file content changed after planning', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-exec-'));
      try {
        const testFile = path.join(tmpDir, 'index.html');
        const initialContent = '<html><body><img src="/hero.webp"></body></html>';
        await fs.writeFile(testFile, initialContent);

        const plan = createTestPlan(
          tmpDir,
          'index.html',
          initialContent,
          '<img src="/hero.webp">',
          '<img fetchpriority="high" src="/hero.webp">'
        );

        // User edits file before plan is applied!
        const userEditedContent = '<html><body><img src="/hero.webp" class="user-edit"></body></html>';
        await fs.writeFile(testFile, userEditedContent);

        const result = await executeFix(plan, {
          workspaceRoot: tmpDir,
          dryRun: false
        });

        assert.strictEqual(result.status, 'FAILED');
        assert.ok(result.error?.includes('PLAN_STALE'));

        // Verify user content was preserved!
        const preservedContent = await fs.readFile(testFile, 'utf-8');
        assert.strictEqual(preservedContent, userEditedContent);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Transactional Multi-File Rollback', () => {
    it('restores all previously modified files if any later operation fails', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-exec-'));
      try {
        const file1 = path.join(tmpDir, 'file1.txt');
        const file2 = path.join(tmpDir, 'file2.txt');
        const content1 = 'original file 1';
        const content2 = 'original file 2';

        await fs.writeFile(file1, content1);
        await fs.writeFile(file2, content2);

        const hash1 = computeSha256(content1);
        const hash2 = computeSha256(content2);

        const multiPlan: FixPlan = {
          schemaVersion: FIX_SCHEMA_VERSION,
          planId: 'plan_multi_fail',
          createdAt: '2026-09-06T12:00:00.000Z',
          targetWorkspace: tmpDir,
          sourceFindingIds: ['finding:1'],
          sourceCorrelationIds: [],
          candidate: {
            candidateId: 'cand:1',
            targetPath: 'file1.txt',
            targetType: 'source',
            reason: 'test',
            evidenceRefs: [],
            findingRefs: [],
            correlationRefs: []
          },
          strategy: { id: 'TEST_STRATEGY', version: '1.0', name: 'Test' },
          operations: [
            {
              id: 'op_1',
              type: 'REPLACE_TEXT',
              targetPath: 'file1.txt',
              originalContentHash: hash1,
              expectedOriginalContent: 'original file 1',
              replacementContent: 'MODIFIED FILE 1',
              reason: 'step 1'
            },
            {
              id: 'op_2',
              type: 'REPLACE_TEXT',
              targetPath: 'file2.txt',
              originalContentHash: hash2,
              // Intentionally supply pattern that does not exist to cause failure during execution
              expectedOriginalContent: 'THIS_DOES_NOT_EXIST',
              replacementContent: 'MODIFIED FILE 2',
              reason: 'step 2'
            }
          ],
          risk: 'LOW',
          confidence: 0.9,
          expectedImpact: { targetMetric: 'LCP', estimatedDirection: 'improve', description: 'test' },
          preconditions: [],
          safetyChecks: [],
          rollbackInformation: { strategy: 'IN_MEMORY', available: true, operations: [] },
          status: 'READY_FOR_REVIEW'
        };

        const result = await executeFix(multiPlan, {
          workspaceRoot: tmpDir,
          dryRun: false
        });

        assert.strictEqual(result.status, 'FAILED');
        assert.ok(result.error?.includes('PATTERN_NOT_FOUND'));

        // Crucial verification: file1 must be completely rolled back to content1!
        const restoredFile1 = await fs.readFile(file1, 'utf-8');
        assert.strictEqual(restoredFile1, content1, 'File 1 must be rolled back to its original state');

        const restoredFile2 = await fs.readFile(file2, 'utf-8');
        assert.strictEqual(restoredFile2, content2, 'File 2 must remain untouched');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Negative & Security Guards', () => {
    it('blocks execution when plan targets a protected file (.env)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-exec-'));
      try {
        const envFile = path.join(tmpDir, '.env');
        await fs.writeFile(envFile, 'SECRET=123');

        const plan: FixPlan = {
          schemaVersion: FIX_SCHEMA_VERSION,
          planId: 'plan_env',
          createdAt: '2026-09-06T12:00:00.000Z',
          targetWorkspace: tmpDir,
          sourceFindingIds: [],
          sourceCorrelationIds: [],
          candidate: {
            candidateId: 'c1',
            targetPath: '.env',
            targetType: 'config',
            reason: 'test',
            evidenceRefs: [],
            findingRefs: [],
            correlationRefs: []
          },
          strategy: { id: 'TEST', version: '1.0', name: 'Test' },
          operations: [
            {
              id: 'op_bad',
              type: 'REPLACE_TEXT',
              targetPath: '.env',
              originalContentHash: computeSha256('SECRET=123'),
              expectedOriginalContent: 'SECRET=123',
              replacementContent: 'SECRET=456',
              reason: 'malicious change'
            }
          ],
          risk: 'LOW',
          confidence: 0.5,
          expectedImpact: { targetMetric: 'Security', estimatedDirection: 'neutral', description: 'test' },
          preconditions: [],
          safetyChecks: [],
          rollbackInformation: { strategy: 'IN_MEMORY', available: false, operations: [] },
          status: 'READY_FOR_REVIEW'
        };

        const result = await executeFix(plan, {
          workspaceRoot: tmpDir,
          dryRun: false
        });

        assert.strictEqual(result.status, 'BLOCKED');
        assert.ok(result.error?.includes('PROTECTED_FILE'));

        const currentEnv = await fs.readFile(envFile, 'utf-8');
        assert.strictEqual(currentEnv, 'SECRET=123');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
