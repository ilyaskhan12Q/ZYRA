import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as http from 'node:http';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(process.cwd(), 'dist/src/cli/index.js');

describe('CLI — Command Execution', () => {
  it('displays help message with --help', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, '--help']);
    assert.equal(stderr, '');
    assert.ok(stdout.includes('ZYRA — Agent-Native Web Performance Investigation Tool'));
    assert.ok(stdout.includes('rules'));
    assert.ok(stdout.includes('MEASUREMENT OPTIONS:'));
    assert.ok(stdout.includes('--mobile'));
    assert.ok(stdout.includes('--desktop'));
  });

  it('displays version with --version', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, '--version']);
    assert.equal(stderr, '');
    assert.ok(stdout.includes('zyra v0.6.0'));
  });

  it('prints structured summary with zyra context', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'context']);
    assert.equal(stderr, '');
    assert.ok(stdout.includes('ZYRA — Persistent Project Context'));
    assert.ok(stdout.includes('MISSION.md'));
    assert.ok(stdout.includes('Health: All required context documents are present and valid.'));
  });

  it('outputs valid JSON with zyra context --json', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'context', '--json']);
    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.summary.projectName, 'ZYRA');
    assert.equal(parsed.summary.totalDocuments, 10);
  });

  it('displays rule catalog with zyra rules', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'rules']);
    assert.equal(stderr, '');
    assert.ok(stdout.includes('ZYRA — Performance Rule Catalog'));
    assert.ok(stdout.includes('16 Registered Rules'));
    assert.ok(stdout.includes('FCP_SLOW'));
    assert.ok(stdout.includes('LCP_CRITICAL'));
    assert.ok(stdout.includes('TBT_CRITICAL'));
  });

  it('outputs valid JSON rule catalog with zyra rules --json', async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'rules', '--json']);
    assert.equal(stderr, '');
    const catalog = JSON.parse(stdout);
    assert.ok(Array.isArray(catalog));
    assert.equal(catalog.length, 16);
    assert.ok(catalog.find((r: { id: string }) => r.id === 'FCP_SLOW'));
    assert.ok(catalog.find((r: { id: string }) => r.id === 'TBT_CRITICAL'));
  });

  it('returns non-zero exit code on unknown command', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [cliPath, 'bad-command-xyz']);
      },
      (err: { code: number; stderr: string }) => {
        assert.equal(err.code, 1);
        assert.ok(err.stderr.includes('Unknown command'));
        return true;
      }
    );
  });

  it('rejects unsupported URL protocols', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [cliPath, 'ftp://example.com/file']);
      },
      (err: { code: number; stderr: string }) => {
        assert.equal(err.code, 1);
        assert.ok(err.stderr.includes('Invalid URL'));
        return true;
      }
    );
  });

  it('runs real measurement against local server and outputs human summary with findings', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><h1>CLI Test</h1></body></html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 8080;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        testUrl,
        '--mobile',
        '--timeout',
        '30000'
      ]);

      assert.ok(stdout.includes('ZYRA — Performance Analysis'));
      assert.ok(stdout.includes(testUrl));
      assert.ok(stdout.includes('PERFORMANCE EVIDENCE'));
      assert.ok(stdout.includes('First Contentful Paint (FCP)'));
      assert.ok(stdout.includes('Largest Contentful Paint (LCP)'));
      assert.ok(stdout.includes('Total Blocking Time (TBT)'));
      assert.ok(stdout.includes('Cumulative Layout Shift (CLS)'));
      assert.ok(stdout.includes('Overall Lab Score'));
      assert.ok(stdout.includes('FINDINGS'));
    } finally {
      server.close();
    }
  });

  it('runs measurement against local server and outputs structured JSON with findings', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><h1>CLI JSON Test</h1></body></html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 8080;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        testUrl,
        '--desktop',
        '--json',
        '--timeout',
        '30000'
      ]);

      const parsed = JSON.parse(stdout);
      // Evidence contract preserved
      assert.equal(parsed.schemaVersion, '1.0');
      assert.equal(parsed.target.device, 'desktop');
      assert.equal(parsed.target.url, testUrl);
      assert.ok(typeof parsed.metrics.fcp.value === 'number');
      assert.ok(typeof parsed.metrics.lcp.value === 'number');
      assert.ok(parsed.audits.length > 0);

      // Findings contract present
      assert.equal(parsed.findingSchemaVersion, '1.0');
      assert.ok(Array.isArray(parsed.findings));
      assert.ok(parsed.evidence);
    } finally {
      server.close();
    }
  });

  it('prints structured summary with zyra codebase <path>', async () => {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'codebase', fixturePath]);

    assert.equal(stderr, '');
    assert.ok(stdout.includes('ZYRA — Codebase Investigation'));
    assert.ok(stdout.includes('Primary Framework: Next.js'));
    assert.ok(stdout.includes('Package Manager:   npm'));
    assert.ok(stdout.includes('Declared Node:     >=18.17.0'));
    assert.ok(stdout.includes('ROUTES'));
    assert.ok(stdout.includes('/dashboard'));
    assert.ok(stdout.includes('ENTRY POINTS'));
    assert.ok(stdout.includes('app/layout.tsx'));
    assert.ok(stdout.includes('ASSETS'));
    assert.ok(stdout.includes('hero.png'));
  });

  it('outputs valid JSON with zyra codebase <path> --json', async () => {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'codebase', fixturePath, '--json']);

    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schemaVersion, '1.0');
    assert.equal(parsed.framework.name, 'Next.js');
    assert.equal(parsed.packageManager.name, 'npm');
    assert.ok(Array.isArray(parsed.routes));
    assert.ok(Array.isArray(parsed.dependencies));
    assert.ok(Array.isArray(parsed.entryPoints));
    assert.ok(Array.isArray(parsed.assets));
  });

  it('supports zyra inspect as an alias for zyra codebase', async () => {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/codebase/vite-react');
    const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, 'inspect', fixturePath, '--json']);

    assert.equal(stderr, '');
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.schemaVersion, '1.0');
    assert.equal(parsed.framework.name, 'React (Vite)');
    assert.equal(parsed.packageManager.name, 'pnpm');
  });

  it('returns non-zero exit code when zyra codebase is missing path', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [cliPath, 'codebase']);
      },
      (err: { code: number; stderr: string }) => {
        assert.equal(err.code, 1);
        assert.ok(err.stderr.includes('Please specify a workspace path to inspect'));
        return true;
      }
    );
  });

  it('runs correlation with zyra <url> --workspace <path>', async () => {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><h1>Correlation Test</h1></body></html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 8080;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        testUrl,
        '--workspace',
        fixturePath,
        '--timeout',
        '30000'
      ]);

      assert.ok(stdout.includes('PERFORMANCE EVIDENCE'));
      assert.ok(stdout.includes('CODEBASE EVIDENCE'));
      assert.ok(stdout.includes('Next.js'));
      assert.ok(stdout.includes('CORRELATION ANALYSIS'));
      assert.ok(stdout.includes('CANDIDATE CONTRIBUTORS'));
      assert.ok(stdout.includes('ROOT-CAUSE ASSESSMENTS'));
    } finally {
      server.close();
    }
  });

  it('runs correlation and outputs valid JSON with zyra analyze <url> --workspace <path> --json', async () => {
    const fixturePath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body><h1>Correlation JSON Test</h1></body></html>');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 8080;
    const testUrl = `http://127.0.0.1:${port}`;

    try {
      const { stdout } = await execFileAsync(process.execPath, [
        cliPath,
        'analyze',
        testUrl,
        '--workspace',
        fixturePath,
        '--json',
        '--timeout',
        '30000'
      ]);

      const parsed = JSON.parse(stdout);
      assert.equal(parsed.schemaVersion, '1.0');
      assert.equal(parsed.findingSchemaVersion, '1.0');
      assert.equal(parsed.codebaseEvidenceSchemaVersion, '1.0');
      assert.equal(parsed.correlationSchemaVersion, '1.0');
      assert.ok(parsed.codebaseEvidence);
      assert.ok(parsed.correlation);
      assert.ok(Array.isArray(parsed.correlations));
      assert.ok(Array.isArray(parsed.correlation.assessments));
      assert.equal(parsed.correlation.schemaVersion, '1.0');
    } finally {
      server.close();
    }
  });

  it('returns non-zero exit code when zyra analyze is missing URL', async () => {
    await assert.rejects(
      async () => {
        await execFileAsync(process.execPath, [cliPath, 'analyze']);
      },
      (err: { code: number; stderr: string }) => {
        assert.equal(err.code, 1);
        assert.ok(err.stderr.includes('Please specify a URL to analyze'));
        return true;
      }
    );
  });
});
