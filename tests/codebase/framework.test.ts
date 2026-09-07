import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { scanCodebase } from '../../src/codebase/scanner.js';
import { detectFramework } from '../../src/codebase/detector/framework.js';
import { detectPackageManager } from '../../src/codebase/detector/packageManager.js';
import { detectRuntime } from '../../src/codebase/detector/runtime.js';

describe('Codebase Scanner — Framework, Package Manager & Runtime Detection', () => {
  const nextAppPath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
  const viteReactPath = path.resolve(process.cwd(), 'fixtures/codebase/vite-react');
  const vueAppPath = path.resolve(process.cwd(), 'fixtures/codebase/vue-app');
  const ambiguousPath = path.resolve(process.cwd(), 'fixtures/codebase/ambiguous-fixture');

  it('detects Next.js App Router with detected confidence', async () => {
    const result = await scanCodebase(nextAppPath);
    const fw = result.framework;

    assert.equal(fw.name, 'Next.js');
    assert.equal(fw.version, '14.2.5');
    assert.equal(fw.confidence, 'detected');
    assert.ok(fw.evidenceRefs.length > 0);
  });

  it('detects Vite + React with detected confidence', async () => {
    const result = await scanCodebase(viteReactPath);
    const fw = result.framework;

    assert.equal(fw.name, 'React (Vite)');
    assert.equal(fw.confidence, 'detected');
    assert.ok(fw.evidenceRefs.some(s => s.toLowerCase().includes('vite')));
  });

  it('detects Vue framework', async () => {
    const result = await scanCodebase(vueAppPath);
    const fw = result.framework;

    assert.equal(fw.name, 'Vue');
    assert.equal(fw.version, '^3.4.0');
    assert.ok(fw.confidence === 'probable' || fw.confidence === 'detected');
  });

  it('detects ambiguous framework when conflicting meta-frameworks coexist', async () => {
    const result = await scanCodebase(ambiguousPath);
    const fw = result.framework;

    assert.equal(fw.confidence, 'ambiguous');
    assert.ok(fw.evidenceRefs.length >= 2);
  });

  it('detects npm from package-lock.json', async () => {
    const result = await scanCodebase(nextAppPath);
    const pm = result.packageManager;

    assert.equal(pm.name, 'npm');
    assert.equal(pm.lockfile, 'package-lock.json');
    assert.equal(pm.hasConflict, false);
  });

  it('detects pnpm from pnpm-lock.yaml', async () => {
    const result = await scanCodebase(viteReactPath);
    const pm = result.packageManager;

    assert.equal(pm.name, 'pnpm');
    assert.equal(pm.lockfile, 'pnpm-lock.yaml');
    assert.equal(pm.hasConflict, false);
  });

  it('detects yarn from yarn.lock', async () => {
    const result = await scanCodebase(vueAppPath);
    const pm = result.packageManager;

    assert.equal(pm.name, 'yarn');
    assert.equal(pm.lockfile, 'yarn.lock');
    assert.equal(pm.hasConflict, false);
  });

  it('detects lockfile conflict when multiple lockfiles exist', async () => {
    const result = await scanCodebase(ambiguousPath);
    const pm = result.packageManager;

    assert.equal(pm.hasConflict, true);
    assert.equal(pm.name, 'unknown');
    assert.ok(pm.conflicts?.includes('package-lock.json'));
    assert.ok(pm.conflicts?.includes('yarn.lock'));

    const warning = result.warnings.find(w => w.code === 'LOCKFILE_CONFLICT');
    assert.ok(warning, 'Must emit LOCKFILE_CONFLICT warning');
  });

  it('detects declared Node.js runtime from package.json engines', async () => {
    const result = await scanCodebase(nextAppPath);
    const runtime = result.runtime;

    assert.equal(runtime.declaredNodeVersion, '>=18.17.0');
    assert.equal(runtime.source, 'package.json engines.node');
  });
});
