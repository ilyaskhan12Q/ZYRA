import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createCIBaseline } from '../../src/ci/baseline.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '../../..');
const cliPath = path.join(projectRoot, 'dist/src/cli/index.js');

function createMockEvidence(
  metrics: Record<string, number | null> = {},
  device: 'mobile' | 'desktop' = 'mobile',
  url = 'https://example.com/'
): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url,
      device,
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

  describe('BUG-001 Regression — CIBaseline Integration in zyra verify', () => {
    it('successfully consumes a valid CIBaseline file and produces verified improvement JSON', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-ci-base-verify-'));
      try {
        const baseFile = path.join(tmpDir, 'ci-baseline.json');
        const postFile = path.join(tmpDir, 'postfix.json');

        const baseEvidence = createMockEvidence({ lcp: 5000, fcp: 2500, tbt: 400 });
        const ciBaseline = createCIBaseline(baseEvidence, { testSource: 'BUG-001' });

        await fs.writeFile(baseFile, JSON.stringify(ciBaseline, null, 2), 'utf-8');
        await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3000, fcp: 1800, tbt: 250 })), 'utf-8');

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

        const result = JSON.parse(stdout);
        assert.equal(result.schemaVersion, '1.0');
        assert.equal(result.status, 'VERIFIED_IMPROVEMENT');
        assert.equal(result.decision, 'KEEP_FIX');

        // Check baseline metadata preserved correctly
        assert.equal(result.baseline.url, 'https://example.com/');
        assert.equal(result.baseline.device, 'mobile');
        assert.equal(result.baseline.metrics.lcp, 5000);
        assert.equal(result.baseline.metrics.fcp, 2500);

        // Check metric comparison
        assert.equal(result.comparison.metrics.lcp.before, 5000);
        assert.equal(result.comparison.metrics.lcp.after, 3000);
        assert.equal(result.comparison.metrics.lcp.absoluteDelta, -2000);
        assert.equal(result.comparison.metrics.lcp.status, 'IMPROVED');
        assert.equal(result.regressions.length, 0);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('formats human-readable table when consuming a valid CIBaseline file', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-ci-base-human-'));
      try {
        const baseFile = path.join(tmpDir, 'ci-baseline.json');
        const postFile = path.join(tmpDir, 'postfix.json');

        const baseEvidence = createMockEvidence({ lcp: 4800 });
        const ciBaseline = createCIBaseline(baseEvidence);

        await fs.writeFile(baseFile, JSON.stringify(ciBaseline, null, 2), 'utf-8');
        await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3100 })), 'utf-8');

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
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('fails safely without TypeError when baseline contains malformed JSON syntax', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-malformed-json-'));
      try {
        const badFile = path.join(tmpDir, 'bad.json');
        await fs.writeFile(badFile, '{ invalid json syntax !!!', 'utf-8');

        await assert.rejects(
          async () => {
            await execFileAsync(process.execPath, [
              cliPath,
              'verify',
              'https://example.com/',
              '--workspace',
              tmpDir,
              '--baseline',
              badFile
            ]);
          },
          (err: any) => {
            assert.equal(err.code, 1);
            assert.ok(err.stderr.includes('Failed to read baseline evidence file'));
            assert.ok(!err.stderr.includes('TypeError'));
            return true;
          }
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('fails safely without TypeError when CIBaseline is missing snapshot', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-no-snapshot-'));
      try {
        const noSnapFile = path.join(tmpDir, 'no-snapshot.json');
        const invalidBaseline = {
          schemaVersion: '1.0',
          id: 'base_missing_snap',
          url: 'https://example.com/',
          device: 'mobile'
        };
        await fs.writeFile(noSnapFile, JSON.stringify(invalidBaseline), 'utf-8');

        await assert.rejects(
          async () => {
            await execFileAsync(process.execPath, [
              cliPath,
              'verify',
              'https://example.com/',
              '--workspace',
              tmpDir,
              '--baseline',
              noSnapFile
            ]);
          },
          (err: any) => {
            assert.equal(err.code, 1);
            assert.ok(err.stderr.includes('missing snapshot or evidence'));
            assert.ok(!err.stderr.includes('TypeError'));
            return true;
          }
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('fails safely without TypeError when snapshot is missing evidence', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-no-evidence-'));
      try {
        const noEvFile = path.join(tmpDir, 'no-evidence.json');
        const invalidBaseline = {
          schemaVersion: '1.0',
          id: 'base_missing_evidence',
          url: 'https://example.com/',
          device: 'mobile',
          snapshot: {
            id: 'snap_empty',
            timestamp: new Date().toISOString()
          }
        };
        await fs.writeFile(noEvFile, JSON.stringify(invalidBaseline), 'utf-8');

        await assert.rejects(
          async () => {
            await execFileAsync(process.execPath, [
              cliPath,
              'verify',
              'https://example.com/',
              '--workspace',
              tmpDir,
              '--baseline',
              noEvFile
            ]);
          },
          (err: any) => {
            assert.equal(err.code, 1);
            assert.ok(err.stderr.includes('snapshot.evidence is missing'));
            assert.ok(!err.stderr.includes('TypeError'));
            return true;
          }
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('fails safely without TypeError when baseline contains invalid evidence data', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-invalid-ev-'));
      try {
        const badEvFile = path.join(tmpDir, 'invalid-evidence.json');
        const invalidBaseline = {
          schemaVersion: '1.0',
          snapshot: {
            evidence: {
              schemaVersion: '2.0', // Unsupported version
              target: { url: 'not-a-valid-url', device: 'tablet' }
            }
          }
        };
        await fs.writeFile(badEvFile, JSON.stringify(invalidBaseline), 'utf-8');

        await assert.rejects(
          async () => {
            await execFileAsync(process.execPath, [
              cliPath,
              'verify',
              'https://example.com/',
              '--workspace',
              tmpDir,
              '--baseline',
              badEvFile
            ]);
          },
          (err: any) => {
            assert.equal(err.code, 1);
            assert.ok(err.stderr.includes('Invalid baseline evidence'));
            assert.ok(!err.stderr.includes('TypeError'));
            return true;
          }
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('detects and reports device profile incompatibility safely without TypeError', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-profile-mismatch-'));
      try {
        const baseFile = path.join(tmpDir, 'desktop-baseline.json');
        const postFile = path.join(tmpDir, 'mobile-postfix.json');

        const baseEvidence = createMockEvidence({ lcp: 4000 }, 'desktop');
        const ciBaseline = createCIBaseline(baseEvidence);

        await fs.writeFile(baseFile, JSON.stringify(ciBaseline, null, 2), 'utf-8');
        await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3000 }, 'mobile')), 'utf-8');

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
          '--mobile',
          '--json'
        ]);

        const result = JSON.parse(stdout);
        assert.equal(result.status, 'INCONCLUSIVE');
        assert.equal(result.decision, 'INCONCLUSIVE');
        assert.ok(result.summary.includes('Device profile mismatch'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('detects and reports target URL incompatibility safely without TypeError', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-url-mismatch-'));
      try {
        const baseFile = path.join(tmpDir, 'url-a-baseline.json');
        const postFile = path.join(tmpDir, 'url-b-postfix.json');

        const baseEvidence = createMockEvidence({ lcp: 4000 }, 'mobile', 'https://example.com/page-a');
        const ciBaseline = createCIBaseline(baseEvidence);

        await fs.writeFile(baseFile, JSON.stringify(ciBaseline, null, 2), 'utf-8');
        await fs.writeFile(postFile, JSON.stringify(createMockEvidence({ lcp: 3000 }, 'mobile', 'https://example.com/page-b')), 'utf-8');

        const { stdout } = await execFileAsync(process.execPath, [
          cliPath,
          'verify',
          'https://example.com/page-a',
          '--workspace',
          tmpDir,
          '--baseline',
          baseFile,
          '--post-fix',
          postFile,
          '--json'
        ]);

        const result = JSON.parse(stdout);
        assert.equal(result.status, 'INCONCLUSIVE');
        assert.equal(result.decision, 'INCONCLUSIVE');
        assert.ok(result.summary.includes('Target URL mismatch'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
