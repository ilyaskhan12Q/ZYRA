import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { scanCodebase } from '../../src/codebase/scanner.js';
import { validateCodebaseEvidence } from '../../src/codebase/validator.js';
import { CodebaseEvidence } from '../../src/codebase/types.js';

describe('Codebase Scanner — Pipeline, Schema Validation & Determinism', () => {
  const nextAppPath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
  const viteReactPath = path.resolve(process.cwd(), 'fixtures/codebase/vite-react');

  it('scans Next.js codebase and produces valid CodebaseEvidence schema v1.0', async () => {
    const evidence = await scanCodebase(nextAppPath);

    assert.ok(evidence);
    assert.equal(evidence.schemaVersion, '1.0');
    assert.ok(evidence.workspace.root);
    assert.equal(evidence.workspace.root, 'next-app');
    assert.ok(evidence.workspace.stats.filesScanned > 0);

    const validation = validateCodebaseEvidence(evidence);
    assert.equal(validation.isValid, true, `Validation failed: ${validation.errors.join(', ')}`);
    assert.equal(validation.errors.length, 0);
  });

  it('scans Vite codebase and produces valid CodebaseEvidence schema v1.0', async () => {
    const evidence = await scanCodebase(viteReactPath);

    const validation = validateCodebaseEvidence(evidence);
    assert.equal(validation.isValid, true, `Validation failed: ${validation.errors.join(', ')}`);

    // Assets check
    assert.ok(evidence.assets.length > 0);
    assert.ok(evidence.assets.some(a => a.category === 'stylesheet' && a.relativePath === 'src/App.css'));

    // Config check
    assert.ok(evidence.configuration.configFiles.includes('vite.config.ts'));
    assert.equal(evidence.configuration.hasSourceMaps, true);
  });

  it('guarantees 100% deterministic scan output across consecutive executions', async () => {
    const run1 = await scanCodebase(nextAppPath);
    const run2 = await scanCodebase(nextAppPath);

    // Omit scannedAt timestamp for deterministic comparison
    const { scannedAt: _time1, ...ws1 } = run1.workspace;
    const { scannedAt: _time2, ...ws2 } = run2.workspace;

    assert.deepEqual({ ...run1, workspace: ws1 }, { ...run2, workspace: ws2 }, 'Two consecutive scans must produce identical evidence');
    assert.deepEqual(run1.warnings, run2.warnings, 'Two consecutive scans must produce identical warnings');
  });

  it('classifies assets into appropriate categories', async () => {
    const evidence = await scanCodebase(nextAppPath);

    const imageAsset = evidence.assets.find(a => a.relativePath === 'public/hero.png');
    assert.ok(imageAsset, 'hero.png should be detected as asset');
    assert.equal(imageAsset.category, 'image');

    const cssAsset = evidence.assets.find(a => a.relativePath === 'app/globals.css');
    assert.ok(cssAsset, 'globals.css should be detected as asset');
    assert.equal(cssAsset.category, 'stylesheet');
  });

  it('extracts tsconfig path aliases and build configuration', async () => {
    const evidence = await scanCodebase(nextAppPath);
    const config = evidence.configuration;

    assert.ok(config.configFiles.includes('tsconfig.json'));
    assert.ok(config.aliases?.['@/*'], 'Path alias @/* should be extracted');
    assert.equal(config.hasSourceMaps, true);
  });

  it('validator rejects invalid or corrupted CodebaseEvidence structures', () => {
    // 1. Non-object
    assert.equal(validateCodebaseEvidence(null as unknown as CodebaseEvidence).isValid, false);

    // 2. Unsupported schema version
    const badVersion = { schemaVersion: '2.0' } as unknown as CodebaseEvidence;
    assert.equal(validateCodebaseEvidence(badVersion).isValid, false);

    // 3. Missing workspace
    const missingWorkspace = {
      schemaVersion: '1.0',
      framework: { name: 'unknown', confidence: 'unknown', evidenceRefs: [] },
      packageManager: { name: 'unknown', hasConflict: false, evidenceRefs: [] },
      runtime: { evidenceRefs: [] },
      dependencies: [],
      files: [],
      routes: [],
      entryPoints: [],
      assets: [],
      imports: [],
      configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
      warnings: []
    } as unknown as CodebaseEvidence;
    assert.equal(validateCodebaseEvidence(missingWorkspace).isValid, false);

    // 4. Invalid file inventory item (missing relativePath)
    const invalidFile = {
      schemaVersion: '1.0',
      workspace: {
        root: 'dummy',
        scannedAt: new Date().toISOString(),
        scannerVersion: '0.4.0',
        stats: { filesScanned: 1, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 100 }
      },
      framework: { name: 'unknown', confidence: 'unknown', evidenceRefs: [] },
      packageManager: { name: 'unknown', hasConflict: false, evidenceRefs: [] },
      runtime: { evidenceRefs: [] },
      dependencies: [],
      files: [{ relativePath: 123 as unknown as string, sizeBytes: 100, extension: '.ts', category: 'source' }],
      routes: [],
      entryPoints: [],
      assets: [],
      imports: [],
      configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
      warnings: []
    } as unknown as CodebaseEvidence;
    const invalidValidation = validateCodebaseEvidence(invalidFile);
    assert.equal(invalidValidation.isValid, false);
    assert.ok(invalidValidation.errors.some(e => e.includes('invalid relativePath')));
  });
});
