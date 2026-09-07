import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '../../..');
const skillPath = path.join(projectRoot, 'SKILL.md');
const agentDocPath = path.join(projectRoot, 'docs/AGENT-SKILL.md');
const cliPath = path.join(projectRoot, 'dist/src/cli/index.js');
const packageJsonPath = path.join(projectRoot, 'package.json');

describe('Agent Skill & /zyra Packaging — Phase 06 Verification', () => {
  describe('SKILL.md Specification & Integrity', () => {
    it('contains valid YAML frontmatter with name and description', async () => {
      const content = await fs.readFile(skillPath, 'utf-8');
      assert.ok(content.startsWith('---'), 'SKILL.md must start with YAML frontmatter delimiter');
      
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      assert.ok(frontmatterMatch, 'SKILL.md must contain complete YAML frontmatter');
      
      const frontmatter = frontmatterMatch[1];
      assert.ok(frontmatter.includes('name: zyra'), 'YAML frontmatter must declare name: zyra');
      assert.ok(frontmatter.includes('description:'), 'YAML frontmatter must declare description');
    });

    it('declares Skill Version 1.0 distinct from package version', async () => {
      const content = await fs.readFile(skillPath, 'utf-8');
      assert.ok(content.includes('Skill Version:** 1.0'), 'SKILL.md must declare Skill Version 1.0');
    });

    it('contains all mandatory instructional sections', async () => {
      const content = await fs.readFile(skillPath, 'utf-8');
      const requiredSections = [
        'Identity & Purpose',
        'Core Loop & Phase Capability Matrix',
        'Agent Invocation & `/zyra` Interface',
        'Command Routing & Execution Resolution',
        'Workspace Discovery: Tool vs. Target',
        'Target Workspace Safety & Read-Only Guarantee',
        'Secret & Sensitive Data Protection',
        'Evidence Interpretation & Anti-Hallucination',
        'Deep Investigation Workflow',
        'Standard Agent Response Format',
        'Error Handling & Diagnostic Troubleshooting'
      ];

      for (const section of requiredSections) {
        assert.ok(
          content.includes(section),
          `SKILL.md must contain section: ${section}`
        );
      }
    });

    it('explicitly states that Phase 07 fix capabilities are NOT available yet', async () => {
      const content = await fs.readFile(skillPath, 'utf-8');
      assert.ok(content.includes('FIX                  [NOT YET AVAILABLE — Phase 07]'));
      assert.ok(content.includes('Unsupported Future Commands (DO NOT INVOKE)'));
      assert.ok(content.includes('/zyra --fix'));
      assert.ok(content.includes('/zyra --patch'));
      assert.ok(content.includes('/zyra --rollback'));
    });

    it('defines the 6-tier evidence interpretation hierarchy', async () => {
      const content = await fs.readFile(skillPath, 'utf-8');
      const tiers = [
        'OBSERVED FACT',
        'DETERMINISTIC FINDING',
        'CORRELATION',
        'CANDIDATE CONTRIBUTOR',
        'ROOT-CAUSE ASSESSMENT',
        'HYPOTHESIS'
      ];

      for (const tier of tiers) {
        assert.ok(content.includes(tier), `SKILL.md must define tier: ${tier}`);
      }
    });

    it('enforces secret protection rules', async () => {
      const content = await fs.readFile(skillPath, 'utf-8');
      assert.ok(content.includes('.env'));
      assert.ok(content.includes('*.pem'));
      assert.ok(content.includes('*.key'));
      assert.ok(content.includes('id_rsa'));
    });
  });

  describe('docs/AGENT-SKILL.md Documentation Specification', () => {
    it('exists and documents the agent skill interface', async () => {
      const stats = await fs.stat(agentDocPath);
      assert.ok(stats.isFile());
      const content = await fs.readFile(agentDocPath, 'utf-8');
      assert.ok(content.includes('ZYRA — Agent Skill & Integration Specification'));
      assert.ok(content.includes('Phase 06 — Agent Skill + `/zyra`'));
      assert.ok(content.includes('Target Workspace as Untrusted Input'));
      assert.ok(content.includes('Read-Only Guarantee'));
    });
  });

  describe('package.json Packaging & Bin Configuration', () => {
    it('configures zyra binary in package.json bin field', async () => {
      const raw = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(raw);
      assert.equal(pkg.name, 'zyra');
      assert.equal(pkg.version, '0.6.0');
      assert.ok(pkg.bin, 'package.json must contain bin field');
      assert.equal(pkg.bin.zyra, './dist/src/cli/index.js');
    });

    it('includes required files in package.json files array', async () => {
      const raw = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(raw);
      assert.ok(pkg.files.includes('dist'));
      assert.ok(pkg.files.includes('SKILL.md'));
      assert.ok(pkg.files.includes('.context'));
      assert.ok(pkg.files.includes('docs'));
      assert.ok(pkg.files.includes('README.md'));
    });

    it('ensures dist/src/cli/index.js exists and starts with valid shebang', async () => {
      const content = await fs.readFile(cliPath, 'utf-8');
      assert.ok(
        content.startsWith('#!/usr/bin/env node'),
        'CLI entrypoint must begin with #!/usr/bin/env node'
      );
    });
  });

  describe('Working-Directory Independence & Execution Resolution', () => {
    it('executes zyra --version cleanly from outside the repository (/tmp)', async () => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cliPath, '--version'],
        { cwd: os.tmpdir() }
      );
      assert.equal(stderr, '');
      assert.ok(stdout.includes('zyra v0.6.0'));
    });

    it('executes zyra --help cleanly from outside the repository (/tmp)', async () => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cliPath, '--help'],
        { cwd: os.tmpdir() }
      );
      assert.equal(stderr, '');
      assert.ok(stdout.includes('ZYRA — Agent-Native Web Performance Investigation Tool (v0.6.0)'));
      assert.ok(stdout.includes('USAGE:'));
      assert.ok(stdout.includes('zyra analyze <url> --workspace <path>'));
    });

    it('executes zyra rules --json cleanly from outside the repository (/tmp)', async () => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cliPath, 'rules', '--json'],
        { cwd: os.tmpdir() }
      );
      assert.equal(stderr, '');
      const catalog = JSON.parse(stdout);
      assert.ok(Array.isArray(catalog));
      assert.equal(catalog.length, 16);
    });

    it('executes zyra context cleanly from outside the repository (/tmp) by falling back to package root', async () => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cliPath, 'context'],
        { cwd: os.tmpdir() }
      );
      assert.equal(stderr, '');
      assert.ok(stdout.includes('ZYRA — Persistent Project Context'));
      assert.ok(stdout.includes('10 verified'));
      assert.ok(stdout.includes('Health: All required context documents are present and valid.'));
    });

    it('supports /zyra dispatch prefix cleanly', async () => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cliPath, '/zyra', '--version'],
        { cwd: os.tmpdir() }
      );
      assert.equal(stderr, '');
      assert.ok(stdout.includes('zyra v0.6.0'));
    });
  });

  describe('Security Boundaries & Read-Only Invariants', () => {
    it('guarantees codebase inspection is strictly read-only on target workspaces', async () => {
      const tempTargetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-target-'));
      await fs.writeFile(
        path.join(tempTargetDir, 'package.json'),
        JSON.stringify({ name: 'target-safety-app', version: '1.0.0' }, null, 2)
      );
      await fs.writeFile(
        path.join(tempTargetDir, 'index.html'),
        '<html><body><h1>Safe Target</h1></body></html>'
      );

      // Snapshot files and mtimes before
      const filesBefore = await fs.readdir(tempTargetDir);
      const statsBefore = await Promise.all(
        filesBefore.map((f) => fs.stat(path.join(tempTargetDir, f)))
      );

      // Run inspection
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [cliPath, 'codebase', tempTargetDir, '--json'],
        { cwd: os.tmpdir() }
      );

      assert.equal(stderr, '');
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.schemaVersion, '1.0');
      assert.equal(parsed.workspace.stats.filesScanned >= 2, true);

      // Verify files and mtimes after
      const filesAfter = await fs.readdir(tempTargetDir);
      assert.deepEqual(filesBefore.sort(), filesAfter.sort(), 'No files added or removed');

      const statsAfter = await Promise.all(
        filesAfter.map((f) => fs.stat(path.join(tempTargetDir, f)))
      );

      for (let i = 0; i < statsBefore.length; i++) {
        assert.equal(
          statsBefore[i].mtimeMs,
          statsAfter[i].mtimeMs,
          'Files in target workspace must not be touched or modified'
        );
      }

      await fs.rm(tempTargetDir, { recursive: true, force: true });
    });

    it('rejects unsupported future commands without fabricating functionality', async () => {
      const unsupportedCommands = ['--fix', '--patch', '--rollback', '--compare'];
      for (const cmd of unsupportedCommands) {
        await assert.rejects(
          async () => {
            await execFileAsync(process.execPath, [cliPath, cmd], { cwd: os.tmpdir() });
          },
          (err: Error & { code?: number }) => {
            assert.notEqual(err.code, 0, `Command ${cmd} should return non-zero exit code`);
            return true;
          }
        );
      }
    });
  });
});
