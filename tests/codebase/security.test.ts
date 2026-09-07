import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { scanCodebase } from '../../src/codebase/scanner.js';
import { traverseWorkspace } from '../../src/codebase/traversal.js';

describe('Codebase Scanner — Security & Safe Traversal', () => {
  const securityFixturePath = path.resolve(process.cwd(), 'fixtures/codebase/security-fixture');
  let tempSymlinkEscapePath: string | null = null;
  let tempInternalSymlinkPath: string | null = null;

  before(() => {
    // Setup temporary symlinks for escape & internal testing
    try {
      tempSymlinkEscapePath = path.join(securityFixturePath, 'symlink-escape');
      // Create a symlink pointing outside the workspace (to os.tmpdir())
      if (!fs.existsSync(tempSymlinkEscapePath)) {
        fs.symlinkSync(os.tmpdir(), tempSymlinkEscapePath, 'dir');
      }

      tempInternalSymlinkPath = path.join(securityFixturePath, 'symlink-internal.txt');
      // Create a symlink pointing inside workspace (to allowed.txt)
      if (!fs.existsSync(tempInternalSymlinkPath)) {
        fs.symlinkSync(path.join(securityFixturePath, 'allowed.txt'), tempInternalSymlinkPath, 'file');
      }
    } catch {
      // If symlink creation fails due to platform restrictions, continue
    }
  });

  after(() => {
    if (tempSymlinkEscapePath && fs.existsSync(tempSymlinkEscapePath)) {
      try { fs.unlinkSync(tempSymlinkEscapePath); } catch {}
    }
    if (tempInternalSymlinkPath && fs.existsSync(tempInternalSymlinkPath)) {
      try { fs.unlinkSync(tempInternalSymlinkPath); } catch {}
    }
  });

  it('rejects non-existent workspace path with descriptive error', async () => {
    const nonExistentPath = path.resolve(process.cwd(), 'non-existent-workspace-path-xyz');
    await assert.rejects(
      async () => {
        await scanCodebase(nonExistentPath);
      },
      {
        message: /Directory does not exist/
      }
    );
  });

  it('rejects workspace path that is a file rather than a directory', async () => {
    const filePath = path.resolve(securityFixturePath, 'package.json');
    await assert.rejects(
      async () => {
        await scanCodebase(filePath);
      },
      {
        message: /Workspace path is not a directory/
      }
    );
  });

  it('excludes secret files from readable files and emits scan warnings', async () => {
    const traversal = await traverseWorkspace(securityFixturePath);

    // .env, .env.local, id_rsa should NOT be in readableFiles
    assert.ok(!traversal.readableFiles.has('.env'), '.env must not be readable');
    assert.ok(!traversal.readableFiles.has('.env.local'), '.env.local must not be readable');
    assert.ok(!traversal.readableFiles.has('id_rsa'), 'id_rsa must not be readable');

    // allowed.txt SHOULD be in readableFiles
    assert.ok(traversal.readableFiles.has('allowed.txt'), 'allowed.txt must be readable');

    // Warnings must include secret exclusion notices
    const secretWarnings = traversal.warnings.filter(w => w.code === 'SECRET_FILE_EXCLUDED');
    assert.ok(secretWarnings.length >= 2, 'Should emit warnings for excluded secret files');

    // Also verify CodebaseEvidence warnings from scanCodebase
    const evidence = await scanCodebase(securityFixturePath);
    const evidenceSecretWarnings = evidence.warnings.filter(w => w.code === 'SECRET_FILE_EXCLUDED');
    assert.ok(evidenceSecretWarnings.length >= 2, 'Evidence must retain secret warnings');
  });

  it('prevents symlink escaping outside workspace and emits warning', async () => {
    if (!tempSymlinkEscapePath || !fs.existsSync(tempSymlinkEscapePath)) {
      // Skip if OS environment restricted symlink creation
      return;
    }

    const { warnings, readableFiles, files } = await traverseWorkspace(securityFixturePath);

    // Files outside workspace must not be read or inventoried
    const outsideFiles = files.filter(f => f.relativePath.startsWith('symlink-escape'));
    assert.equal(outsideFiles.length, 0, 'Symlink pointing outside workspace must not be followed');

    // Symlink escape warning must be emitted
    const symlinkWarning = warnings.find(w => w.code === 'SYMLINK_OUTSIDE_WORKSPACE');
    assert.ok(symlinkWarning, 'Must record SYMLINK_OUTSIDE_WORKSPACE warning');
    assert.ok(symlinkWarning.message.includes('outside the workspace'));
  });

  it('does not read oversized files (>512KB) into memory but inventories them', async () => {
    const { warnings, readableFiles, files } = await traverseWorkspace(securityFixturePath);

    // large-file.txt should be in inventory
    const largeFileItem = files.find(f => f.relativePath === 'large-file.txt');
    assert.ok(largeFileItem, 'large-file.txt should be inventoried');
    assert.ok(largeFileItem.sizeBytes > 512 * 1024, 'large-file size should exceed 512KB');

    // large-file.txt should NOT be in readableFiles
    assert.ok(!readableFiles.has('large-file.txt'), 'large-file.txt must not be in readableFiles');

    // Warning emitted for oversized file
    const sizeWarning = warnings.find(w => w.code === 'FILE_SIZE_LIMIT_EXCEEDED');
    assert.ok(sizeWarning, 'Must record FILE_SIZE_LIMIT_EXCEEDED warning');
  });

  it('guarantees strictly read-only execution: no files created or modified', async () => {
    const packageJsonPath = path.join(securityFixturePath, 'package.json');
    const mtimeBefore = fs.statSync(packageJsonPath).mtimeMs;
    const filesBefore = fs.readdirSync(securityFixturePath);

    await scanCodebase(securityFixturePath);

    const mtimeAfter = fs.statSync(packageJsonPath).mtimeMs;
    const filesAfter = fs.readdirSync(securityFixturePath);

    assert.equal(mtimeBefore, mtimeAfter, 'mtime of existing file must not change');
    assert.deepEqual(filesBefore, filesAfter, 'Directory file listing must remain unchanged');
  });
});
