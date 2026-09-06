import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  findProjectRoot,
  validateContext,
  loadContext
} from '../../src/context/loader.js';
import { REQUIRED_CONTEXT_FILES } from '../../src/context/types.js';

describe('Context System — Discovery & Loading', () => {
  it('finds the project root containing .context/', async () => {
    const root = await findProjectRoot(process.cwd());
    assert.ok(root, 'Project root should be discovered');
    const contextDir = path.join(root, '.context');
    const stats = await fs.stat(contextDir);
    assert.ok(stats.isDirectory(), '.context should be a directory');
  });

  it('validates that all required context files exist in the project', async () => {
    const validation = await validateContext();
    assert.equal(validation.isValid, true, 'Project context should be valid');
    assert.equal(validation.missingFiles.length, 0, 'No files should be missing');
    assert.equal(validation.malformedFiles.length, 0, 'No files should be malformed');
    assert.equal(
      validation.foundFiles.length,
      REQUIRED_CONTEXT_FILES.length,
      `Should find all ${REQUIRED_CONTEXT_FILES.length} required files`
    );

    for (const requiredFile of REQUIRED_CONTEXT_FILES) {
      assert.ok(
        validation.foundFiles.includes(requiredFile),
        `Required file ${requiredFile} must be found`
      );
    }
  });

  it('loads all 10 context files into a structured ProjectContext', async () => {
    const context = await loadContext();
    assert.ok(context.projectRoot, 'projectRoot should be defined');
    assert.ok(context.contextDir, 'contextDir should be defined');
    assert.ok(context.loadedAt, 'loadedAt should be defined');
    assert.equal(context.summary.totalDocuments, REQUIRED_CONTEXT_FILES.length);

    for (const fileName of REQUIRED_CONTEXT_FILES) {
      const doc = context.documents[fileName];
      assert.ok(doc, `Document ${fileName} should exist in context`);
      assert.equal(doc.name, fileName);
      assert.equal(doc.exists, true);
      assert.ok(doc.content.length > 0, `Content of ${fileName} should not be empty`);
      assert.ok(doc.sizeBytes > 0, `Size of ${fileName} should be greater than 0`);
    }
  });

  it('detects missing files when .context is incomplete', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-test-missing-'));
    const tempContextDir = path.join(tempDir, '.context');
    await fs.mkdir(tempContextDir);

    // Only create MISSION.md
    await fs.writeFile(path.join(tempContextDir, 'MISSION.md'), '# Mission');

    const validation = await validateContext(tempDir);
    assert.equal(validation.isValid, false);
    assert.equal(validation.missingFiles.length, REQUIRED_CONTEXT_FILES.length - 1);
    assert.ok(validation.missingFiles.includes('PROJECT.md'));
    assert.ok(validation.missingFiles.includes('ARCHITECTURE.md'));

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('detects malformed empty files in context directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-test-empty-'));
    const tempContextDir = path.join(tempDir, '.context');
    await fs.mkdir(tempContextDir);

    // Create all files, but one is empty
    for (const file of REQUIRED_CONTEXT_FILES) {
      const content = file === 'MISSION.md' ? '' : `# ${file}`;
      await fs.writeFile(path.join(tempContextDir, file), content);
    }

    const validation = await validateContext(tempDir);
    assert.equal(validation.isValid, false);
    assert.equal(validation.malformedFiles.length, 1);
    assert.equal(validation.malformedFiles[0].name, 'MISSION.md');

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('throws an informative error when attempting to loadContext on invalid context', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-test-throw-'));
    const tempContextDir = path.join(tempDir, '.context');
    await fs.mkdir(tempContextDir);

    await assert.rejects(
      async () => {
        await loadContext(tempDir);
      },
      /Invalid ZYRA project context/
    );

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
