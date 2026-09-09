import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(process.cwd(), 'dist/src/cli/index.js');
const FIXTURE_MOBILE = path.resolve(process.cwd(), 'fixtures/lighthouse/synthetic-mobile.json');

describe('CI CLI Commands — Phase 09 Validation', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-ci-cli-test-'));
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('captures a baseline via zyra ci baseline', async () => {
    const baselineOut = path.join(tempDir, 'ci-baseline.json');
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [CLI_PATH, 'ci', 'baseline', 'https://example.com/', '--current', FIXTURE_MOBILE, '--output', baselineOut]
    );

    assert.ok(stdout.includes('ZYRA CI — Baseline Captured'));
    assert.ok(stdout.includes('Saved To:'));

    const saved = JSON.parse(await fs.readFile(baselineOut, 'utf-8'));
    assert.equal(saved.schemaVersion, '1.0');
    assert.equal(saved.device, 'mobile');
  });

  it('executes a passing CI performance check (exit code 0)', async () => {
    const baselineOut = path.join(tempDir, 'pass-baseline.json');
    const resultOut = path.join(tempDir, 'pass-result.json');
    const mdOut = path.join(tempDir, 'pass-summary.md');
    const generousBudget = JSON.stringify({
      budgets: { LCP: 10000, FCP: 10000, TBT: 50000, SpeedIndex: 15000, CLS: 0.5 }
    });

    // First save baseline
    await execFileAsync(
      process.execPath,
      [CLI_PATH, 'ci', 'baseline', 'https://example.com/', '--current', FIXTURE_MOBILE, '--output', baselineOut]
    );

    // Run CI check against baseline
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        CLI_PATH,
        'ci',
        'https://example.com/',
        '--current',
        FIXTURE_MOBILE,
        '--baseline',
        baselineOut,
        '--budget',
        generousBudget,
        '--output',
        resultOut,
        '--markdown-output',
        mdOut
      ]
    );

    assert.ok(stdout.includes('ZYRA CI PERFORMANCE CHECK'));
    assert.ok(stdout.includes('Status:            PASS'));
    assert.ok(stdout.includes('Exit Code:         0'));

    const resObj = JSON.parse(await fs.readFile(resultOut, 'utf-8'));
    assert.equal(resObj.status, 'PASS');
    assert.equal(resObj.exitCode, 0);

    const mdContent = await fs.readFile(mdOut, 'utf-8');
    assert.ok(mdContent.includes('### ⚡ ZYRA CI Performance Check'));
  });

  it('executes a failing CI performance check on budget violation (exit code 1)', async () => {
    const baselineOut = path.join(tempDir, 'fail-baseline.json');
    const strictBudget = JSON.stringify({ budgets: { LCP: 500 } }); // Will fail since synthetic LCP is > 500

    await execFileAsync(
      process.execPath,
      [CLI_PATH, 'ci', 'baseline', 'https://example.com/', '--current', FIXTURE_MOBILE, '--output', baselineOut]
    );

    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [
          CLI_PATH,
          'ci',
          'https://example.com/',
          '--current',
          FIXTURE_MOBILE,
          '--baseline',
          baselineOut,
          '--budget',
          strictBudget
        ]);
      },
      (err: any) => {
        assert.equal(err.code, 1);
        assert.ok(err.stdout.includes('Status:            FAIL'));
        assert.ok(err.stdout.includes('Exit Code:         1'));
        return true;
      }
    );
  });

  it('outputs clean Schema v1.0 JSON with --json', async () => {
    const baselineOut = path.join(tempDir, 'json-baseline.json');
    const generousBudget = JSON.stringify({
      budgets: { LCP: 10000, FCP: 10000, TBT: 50000, SpeedIndex: 15000, CLS: 0.5 }
    });

    await execFileAsync(
      process.execPath,
      [CLI_PATH, 'ci', 'baseline', 'https://example.com/', '--current', FIXTURE_MOBILE, '--output', baselineOut]
    );

    const { stdout } = await execFileAsync(process.execPath, [
      CLI_PATH,
      'ci',
      'https://example.com/',
      '--current',
      FIXTURE_MOBILE,
      '--baseline',
      baselineOut,
      '--budget',
      generousBudget,
      '--json'
    ]);

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schemaVersion, '1.0');
    assert.equal(parsed.status, 'PASS');
    assert.equal(parsed.exitCode, 0);
  });

  it('returns exit code 3 (INCONCLUSIVE) on incompatible baseline URL', async () => {
    const baselineOut = path.join(tempDir, 'incompat-baseline.json');
    await execFileAsync(
      process.execPath,
      [CLI_PATH, 'ci', 'baseline', 'https://example.com/', '--current', FIXTURE_MOBILE, '--output', baselineOut]
    );

    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [
          CLI_PATH,
          'ci',
          'https://different-site.org/',
          '--current',
          FIXTURE_MOBILE,
          '--baseline',
          baselineOut
        ]);
      },
      (err: any) => {
        assert.equal(err.code, 3);
        assert.ok(err.stdout.includes('Status:            INCONCLUSIVE'));
        assert.ok(err.stdout.includes('Exit Code:         3'));
        return true;
      }
    );
  });

  it('supports CIBaseline format in --current option for CI check', async () => {
    const baselineOut = path.join(tempDir, 'baseline-for-current.json');
    const generousBudget = JSON.stringify({
      budgets: { LCP: 10000, FCP: 10000, TBT: 50000, SpeedIndex: 15000, CLS: 0.5 }
    });

    // Capture baseline to produce a CIBaseline JSON file
    await execFileAsync(
      process.execPath,
      [CLI_PATH, 'ci', 'baseline', 'https://example.com/', '--current', FIXTURE_MOBILE, '--output', baselineOut]
    );

    // Pass the CIBaseline file as --current
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        CLI_PATH,
        'ci',
        'https://example.com/',
        '--current',
        baselineOut,
        '--baseline',
        baselineOut,
        '--budget',
        generousBudget,
        '--json'
      ]
    );

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schemaVersion, '1.0');
    assert.equal(parsed.status, 'PASS');
    assert.equal(parsed.exitCode, 0);
    assert.ok(parsed.currentRun.metrics.lcp > 0);
  });
});
