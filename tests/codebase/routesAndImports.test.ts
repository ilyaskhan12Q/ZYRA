import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { scanCodebase } from '../../src/codebase/scanner.js';
import { analyzeImports } from '../../src/codebase/analyzer/imports.js';

describe('Codebase Scanner — Routes, Entry Points & Import Graph', () => {
  const nextAppPath = path.resolve(process.cwd(), 'fixtures/codebase/next-app');
  const viteReactPath = path.resolve(process.cwd(), 'fixtures/codebase/vite-react');

  it('detects static and dynamic routes in Next.js App router', async () => {
    const result = await scanCodebase(nextAppPath);
    const routes = result.routes;

    assert.ok(routes.length >= 3, 'Must detect at least 3 routes');

    const homeRoute = routes.find(r => r.path === '/');
    assert.ok(homeRoute, 'Home route / should exist');
    assert.equal(homeRoute.isDynamic, false);
    assert.equal(homeRoute.sourceFile, 'app/page.tsx');

    const dashboardRoute = routes.find(r => r.path === '/dashboard');
    assert.ok(dashboardRoute, 'Dashboard route /dashboard should exist');
    assert.equal(dashboardRoute.isDynamic, false);
    assert.equal(dashboardRoute.sourceFile, 'app/dashboard/page.tsx');

    const blogRoute = routes.find(r => r.path === '/blog/[slug]');
    assert.ok(blogRoute, 'Dynamic route /blog/[slug] should exist');
    assert.equal(blogRoute.isDynamic, true);
    assert.equal(blogRoute.sourceFile, 'app/blog/[slug]/page.tsx');
  });

  it('identifies entry points for Next.js (root layout) and Vite (main.tsx)', async () => {
    const nextResult = await scanCodebase(nextAppPath);
    assert.ok(
      nextResult.entryPoints.some(ep => ep.path === 'app/layout.tsx' && ep.detectionReason.includes('Root Layout')),
      'Next.js root layout should be identified'
    );

    const viteResult = await scanCodebase(viteReactPath);
    assert.ok(
      viteResult.entryPoints.some(ep => ep.path === 'src/main.tsx' && ep.detectionReason.includes('Main Entry Point')),
      'Vite client entry point should be identified'
    );
  });

  it('analyzes static and dynamic imports correctly from source code', async () => {
    const result = await scanCodebase(nextAppPath);
    const imports = result.imports;

    // Find imports for app/page.tsx
    const pageImports = imports.find(i => i.sourceFile === 'app/page.tsx');
    assert.ok(pageImports, 'app/page.tsx should have import summary');

    // It has a static import: import React from 'react'
    assert.ok(pageImports.staticImports.includes('react'), 'Static import of react should be recorded');

    // It has a dynamic import: React.lazy(() => import('../components/Header'))
    assert.ok(
      pageImports.dynamicImports.includes('components/Header.tsx'),
      'Dynamic import of Header should resolve to components/Header.tsx'
    );
  });

  it('identifies CSS stylesheet imports and dependency on internal components', async () => {
    const result = await scanCodebase(nextAppPath);
    const layoutImports = result.imports.find(i => i.sourceFile === 'app/layout.tsx');

    assert.ok(layoutImports, 'app/layout.tsx imports should be recorded');
    assert.ok(layoutImports.staticImports.includes('app/globals.css'), 'globals.css import should be resolved');
  });
});
