import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  computeSha256,
  isBinaryContent,
  isProtectedFile,
  validateWorkspacePath,
  verifyContentHash
} from '../../src/fixes/index.js';

describe('Fix Safety & Security Invariants — Phase 07 Verification', () => {
  describe('Path Traversal & Workspace Containment', () => {
    it('accepts valid workspace-relative paths', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      try {
        const testFile = path.join(tmpDir, 'src/index.ts');
        await fs.mkdir(path.dirname(testFile), { recursive: true });
        await fs.writeFile(testFile, 'export const x = 1;');

        const result = await validateWorkspacePath('src/index.ts', tmpDir);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.relativePath, 'src/index.ts');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('rejects relative path traversal escaping workspace (../../etc/passwd)', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      try {
        const result = await validateWorkspacePath('../../etc/passwd', tmpDir);
        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('PATH_TRAVERSAL_DETECTED'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('rejects absolute paths resolving outside workspace', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      try {
        const result = await validateWorkspacePath('/tmp/some-external-file.js', tmpDir);
        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('WORKSPACE_ESCAPE_DETECTED'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('rejects symlinks pointing outside workspace root', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-outside-'));
      try {
        const outsideFile = path.join(outsideDir, 'secret.txt');
        await fs.writeFile(outsideFile, 'secret content');

        const symlinkPath = path.join(tmpDir, 'escape_link');
        await fs.symlink(outsideFile, symlinkPath);

        const result = await validateWorkspacePath('escape_link', tmpDir);
        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('WORKSPACE_ESCAPE_DETECTED'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
        await fs.rm(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('Protected File Protection', () => {
    it('identifies and blocks sensitive credentials and environment files', () => {
      assert.strictEqual(isProtectedFile('.env'), true);
      assert.strictEqual(isProtectedFile('.env.local'), true);
      assert.strictEqual(isProtectedFile('.env.production'), true);
      assert.strictEqual(isProtectedFile('server.key'), true);
      assert.strictEqual(isProtectedFile('cert.pem'), true);
      assert.strictEqual(isProtectedFile('id_rsa'), true);
      assert.strictEqual(isProtectedFile('id_ed25519'), true);
      assert.strictEqual(isProtectedFile('credentials.json'), true);
      assert.strictEqual(isProtectedFile('secret_config.json'), true);
      assert.strictEqual(isProtectedFile('package-lock.json'), true);
      assert.strictEqual(isProtectedFile('pnpm-lock.yaml'), true);
      assert.strictEqual(isProtectedFile('yarn.lock'), true);
      assert.strictEqual(isProtectedFile('tsconfig.json'), true);
    });

    it('allows normal source and asset files', () => {
      assert.strictEqual(isProtectedFile('src/App.tsx'), false);
      assert.strictEqual(isProtectedFile('public/hero.webp'), false);
      assert.strictEqual(isProtectedFile('src/styles/main.css'), false);
      assert.strictEqual(isProtectedFile('index.html'), false);
    });

    it('validateWorkspacePath blocks protected files', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      try {
        const envFile = path.join(tmpDir, '.env');
        await fs.writeFile(envFile, 'API_KEY=secret123');

        const result = await validateWorkspacePath('.env', tmpDir);
        assert.strictEqual(result.valid, false);
        assert.ok(result.error?.includes('PROTECTED_FILE_BLOCKED'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Optimistic Concurrency & Content Hash Verification', () => {
    it('returns match: true when current file hash matches expected hash', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      try {
        const testFile = path.join(tmpDir, 'test.txt');
        const content = 'Hello World';
        await fs.writeFile(testFile, content);
        const expectedHash = computeSha256(content);

        const check = await verifyContentHash(testFile, expectedHash);
        assert.strictEqual(check.matches, true);
        assert.strictEqual(check.currentHash, expectedHash);
        assert.strictEqual(check.currentContent, content);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('returns match: false with PLAN_STALE error when content hash differs', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-safety-'));
      try {
        const testFile = path.join(tmpDir, 'test.txt');
        await fs.writeFile(testFile, 'Modified content by user');
        const oldHash = computeSha256('Original content when planned');

        const check = await verifyContentHash(testFile, oldHash);
        assert.strictEqual(check.matches, false);
        assert.ok(check.error?.includes('PLAN_STALE'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('Binary File Protection', () => {
    it('detects binary buffers with null bytes', () => {
      const binaryBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0x1a, 0x0a]);
      assert.strictEqual(isBinaryContent(binaryBuffer), true);
    });

    it('recognizes regular UTF-8 text as non-binary', () => {
      const textBuffer = Buffer.from('const greeting = "Hello, world!";\nexport default greeting;');
      assert.strictEqual(isBinaryContent(textBuffer), false);
    });
  });
});
