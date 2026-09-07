import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { computeSha256, FIX_SCHEMA_VERSION, type FixPlan } from '../../src/fixes/index.js';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '../../..');
const cliPath = path.join(projectRoot, 'dist/src/cli/index.js');

describe('Fix CLI Commands — Phase 07 Verification', () => {
  it('executes zyra fix catalog cleanly', async () => {
    const { stdout, stderr } = await execFileAsync('node', [cliPath, 'fix', 'catalog']);
    assert.strictEqual(stderr, '');
    assert.ok(stdout.includes('ZYRA — Fix Strategy Catalog'));
    assert.ok(stdout.includes('FIX_IMAGE_OPTIMIZATION'));
    assert.ok(stdout.includes('FIX_RENDER_BLOCKING_RESOURCE'));
    assert.ok(stdout.includes('FIX_LARGE_FONT'));
    assert.ok(stdout.includes('FIX_UNUSED_IMPORT'));
  });

  it('executes zyra fix catalog --json emitting valid JSON', async () => {
    const { stdout, stderr } = await execFileAsync('node', [cliPath, 'fix', 'catalog', '--json']);
    assert.strictEqual(stderr, '');
    const catalog = JSON.parse(stdout);
    assert.ok(Array.isArray(catalog));
    assert.strictEqual(catalog.length, 6);
    assert.strictEqual(catalog[0].id, 'FIX_IMAGE_OPTIMIZATION');
  });

  it('executes zyra fix apply --dry-run successfully without modifying files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-cli-fix-'));
    try {
      const htmlFile = path.join(tmpDir, 'index.html');
      const originalContent = '<html><body><img src="/hero.webp"></body></html>';
      await fs.writeFile(htmlFile, originalContent);

      const plan: FixPlan = {
        schemaVersion: FIX_SCHEMA_VERSION,
        planId: 'plan_cli_test',
        createdAt: '2026-09-06T12:00:00.000Z',
        targetWorkspace: tmpDir,
        sourceFindingIds: ['finding:lcp'],
        sourceCorrelationIds: [],
        candidate: {
          candidateId: 'cand:1',
          targetPath: 'index.html',
          targetType: 'source',
          reason: 'LCP image markup',
          evidenceRefs: [],
          findingRefs: [],
          correlationRefs: []
        },
        strategy: { id: 'FIX_IMAGE_OPTIMIZATION', version: '1.0', name: 'Image' },
        operations: [
          {
            id: 'op_1',
            type: 'EDIT_ATTRIBUTE',
            targetPath: 'index.html',
            originalContentHash: computeSha256(originalContent),
            expectedOriginalContent: '<img src="/hero.webp">',
            replacementContent: '<img fetchpriority="high" src="/hero.webp">',
            reason: 'prioritize LCP'
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

      const planFile = path.join(tmpDir, 'plan.json');
      await fs.writeFile(planFile, JSON.stringify(plan, null, 2));

      const { stdout, stderr } = await execFileAsync('node', [
        cliPath,
        'fix',
        'apply',
        planFile,
        '--workspace',
        tmpDir,
        '--dry-run'
      ]);

      assert.strictEqual(stderr, '');
      assert.ok(stdout.includes('Mode:              DRY_RUN (Simulation — No Files Modified)'));
      assert.ok(stdout.includes('Result:            DRY_RUN'));
      assert.ok(stdout.includes('Verification:      NOT YET PERFORMED'));

      // Verify file remains completely unchanged
      const content = await fs.readFile(htmlFile, 'utf-8');
      assert.strictEqual(content, originalContent);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('executes zyra fix apply cleanly and modifies file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-cli-fix-'));
    try {
      const htmlFile = path.join(tmpDir, 'index.html');
      const originalContent = '<html><body><img src="/hero.webp"></body></html>';
      await fs.writeFile(htmlFile, originalContent);

      const plan: FixPlan = {
        schemaVersion: FIX_SCHEMA_VERSION,
        planId: 'plan_cli_apply',
        createdAt: '2026-09-06T12:00:00.000Z',
        targetWorkspace: tmpDir,
        sourceFindingIds: ['finding:lcp'],
        sourceCorrelationIds: [],
        candidate: {
          candidateId: 'cand:1',
          targetPath: 'index.html',
          targetType: 'source',
          reason: 'LCP image markup',
          evidenceRefs: [],
          findingRefs: [],
          correlationRefs: []
        },
        strategy: { id: 'FIX_IMAGE_OPTIMIZATION', version: '1.0', name: 'Image' },
        operations: [
          {
            id: 'op_1',
            type: 'EDIT_ATTRIBUTE',
            targetPath: 'index.html',
            originalContentHash: computeSha256(originalContent),
            expectedOriginalContent: '<img src="/hero.webp">',
            replacementContent: '<img fetchpriority="high" src="/hero.webp">',
            reason: 'prioritize LCP'
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

      const planFile = path.join(tmpDir, 'plan.json');
      await fs.writeFile(planFile, JSON.stringify(plan, null, 2));

      const { stdout, stderr } = await execFileAsync('node', [
        cliPath,
        'fix',
        'apply',
        planFile,
        '--workspace',
        tmpDir
      ]);

      assert.strictEqual(stderr, '');
      assert.ok(stdout.includes('Result:            APPLIED'));
      assert.ok(stdout.includes('Verification:      NOT YET PERFORMED'));

      // Verify file modified
      const content = await fs.readFile(htmlFile, 'utf-8');
      assert.strictEqual(
        content,
        '<html><body><img fetchpriority="high" src="/hero.webp"></body></html>'
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('displays fix command help with --help', async () => {
    const { stdout } = await execFileAsync('node', [cliPath, 'fix', '--help']);
    assert.ok(stdout.includes('zyra fix plan'));
    assert.ok(stdout.includes('zyra fix apply'));
    assert.ok(stdout.includes('zyra fix catalog'));
  });
});
