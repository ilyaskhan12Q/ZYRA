import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '../../..');
const cliPath = path.join(projectRoot, 'dist/src/cli/index.js');

function createMockEvidence(metrics: Record<string, number | null> = {}) {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: {
      durationMs: 12000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.65
    },
    metrics: {
      fcp: { value: metrics.fcp ?? 2000, unit: 'ms', score: 0.8 },
      lcp: { value: metrics.lcp ?? 4500, unit: 'ms', score: 0.5 },
      cls: { value: metrics.cls ?? 0.04, unit: 'score', score: 0.95 },
      tbt: { value: metrics.tbt ?? 300, unit: 'ms', score: 0.7 },
      speedIndex: { value: metrics.speedIndex ?? 3500, unit: 'ms', score: 0.7 },
      inp: null
    },
    audits: [],
    resources: { summary: [], items: [] },
    network: { requests: [] },
    scripts: { items: [], longTasks: [] },
    images: { items: [] },
    fonts: { items: [] },
    traceability: {}
  };
}

describe('Verification CLI Commands — Phase 08 Verification', () => {
  it('displays verification summary in human-readable table format', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-cli-verify-test-'));
    try {
      const baseFile = path.join(tmpDir, 'baseline.json');
      const postFile = path.join(tmpDir, 'postfix.json');

      await fs.writeFile(baseFile, JSON.stringify(createMockEvidence({ lcp: 5000 })), 'utf-8');
      await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3200 })), 'utf-8');

      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        'verify',
        'https://example.com/',
        '--workspace',
        tmpDir,
        '--baseline',
        baseFile,
        '--post-fix',
        postFile
      ]);

      assert.ok(stdout.includes('ZYRA — Post-Fix Performance Verification'));
      assert.ok(stdout.includes('Status:            VERIFIED_IMPROVEMENT'));
      assert.ok(stdout.includes('Decision:          KEEP_FIX'));
      assert.ok(stdout.includes('Largest Contentful Paint'));
      assert.ok(stdout.includes('[IMPROVED]'));
      assert.ok(stdout.includes('REGRESSION CHECK'));
      assert.ok(stdout.includes('None detected'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('outputs valid JSON when run with --json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-cli-json-test-'));
    try {
      const baseFile = path.join(tmpDir, 'baseline.json');
      const postFile = path.join(tmpDir, 'postfix.json');

      await fs.writeFile(baseFile, JSON.stringify(createMockEvidence({ lcp: 5000 })), 'utf-8');
      await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3200 })), 'utf-8');

      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        'verify',
        'https://example.com/',
        '--workspace',
        tmpDir,
        '--baseline',
        baseFile,
        '--post-fix',
        postFile,
        '--json'
      ]);

      const parsed = JSON.parse(stdout);
      assert.equal(parsed.schemaVersion, '1.0');
      assert.equal(parsed.status, 'VERIFIED_IMPROVEMENT');
      assert.equal(parsed.decision, 'KEEP_FIX');
      assert.ok(parsed.comparison.metrics.lcp);
      assert.equal(parsed.comparison.metrics.lcp.status, 'IMPROVED');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('saves result to file when --output is provided', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-cli-out-test-'));
    try {
      const baseFile = path.join(tmpDir, 'baseline.json');
      const postFile = path.join(tmpDir, 'postfix.json');
      const outFile = path.join(tmpDir, 'result.json');

      await fs.writeFile(baseFile, JSON.stringify(createMockEvidence({ lcp: 5000 })), 'utf-8');
      await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3200 })), 'utf-8');

      await execFileAsync(process.execPath, [
        cliPath,
        'verify',
        'https://example.com/',
        '--workspace',
        tmpDir,
        '--baseline',
        baseFile,
        '--post-fix',
        postFile,
        '--output',
        outFile
      ]);

      const fileContent = await fs.readFile(outFile, 'utf-8');
      const parsed = JSON.parse(fileContent);
      assert.equal(parsed.schemaVersion, '1.0');
      assert.equal(parsed.status, 'VERIFIED_IMPROVEMENT');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('supports zyra fix verify subcommand', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-fix-verify-test-'));
    try {
      const baseFile = path.join(tmpDir, 'baseline.json');
      const postFile = path.join(tmpDir, 'postfix.json');
      const fixResultFile = path.join(tmpDir, 'fix-result.json');

      await fs.writeFile(baseFile, JSON.stringify(createMockEvidence({ lcp: 5000 })), 'utf-8');
      await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3200 })), 'utf-8');

      const mockFixResult = {
        status: 'APPLIED',
        planId: 'plan_test_99',
        strategyId: 'FIX_IMAGE_OPTIMIZATION',
        strategyVersion: '1.0',
        workspace: tmpDir,
        timestamp: new Date().toISOString(),
        operations: [],
        audit: {
          timestamp: new Date().toISOString(),
          planId: 'plan_test_99',
          strategyId: 'FIX_IMAGE_OPTIMIZATION',
          strategyVersion: '1.0',
          workspace: tmpDir,
          filesChanged: [],
          operationsCount: 0,
          originalHashes: {},
          newHashes: {},
          result: 'APPLIED',
          rollbackAvailable: true
        },
        rollbackAvailable: true
      };
      await fs.writeFile(fixResultFile, JSON.stringify(mockFixResult), 'utf-8');

      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        'fix',
        'verify',
        fixResultFile,
        '--url',
        'https://example.com/',
        '--workspace',
        tmpDir,
        '--baseline',
        baseFile,
        '--post-fix',
        postFile
      ]);

      assert.ok(stdout.includes('ZYRA — Post-Fix Performance Verification'));
      assert.ok(stdout.includes('Status:            VERIFIED_IMPROVEMENT'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails gracefully when --baseline is missing', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [
          cliPath,
          'verify',
          'https://example.com/',
          '--workspace',
          '/tmp'
        ]);
      },
      (err: any) => {
        assert.equal(err.code, 1);
        assert.ok(err.stderr.includes('Baseline evidence required'));
        return true;
      }
    );
  });
});
