import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  RenderBlockingStrategy,
  FontOptimizationStrategy,
  UnusedImportStrategy,
  DynamicImportStrategy,
  ResourceOptimizationStrategy,
  type FixCandidate,
  type FixPlanningContext
} from '../../src/fixes/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type CodebaseEvidence } from '../../src/codebase/types.js';

function createMockEvidence(): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: { url: 'https://example.com/', device: 'mobile', timestamp: '2026-09-06T12:00:00.000Z' },
    run: { durationMs: 1000, lighthouseVersion: '13.4.1' },
    scores: { performance: 0.5 },
    metrics: {
      fcp: { value: 3000, unit: 'ms', score: 0.5 },
      lcp: { value: 4500, unit: 'ms', score: 0.3 },
      cls: { value: 0, unit: 'score', score: 1 },
      tbt: { value: 400, unit: 'ms', score: 0.5 },
      speedIndex: { value: 3500, unit: 'ms', score: 0.5 },
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

function createBaseCodebase(workspaceRoot: string): CodebaseEvidence {
  return {
    schemaVersion: '1.0',
    workspace: {
      root: workspaceRoot,
      scannedAt: '2026-09-06T12:00:00.000Z',
      scannerVersion: '1.0',
      stats: { filesScanned: 5, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 5000 }
    },
    framework: { name: 'React', confidence: 'detected', evidenceRefs: [] },
    packageManager: { name: 'npm', hasConflict: false, evidenceRefs: [] },
    runtime: { evidenceRefs: [] },
    dependencies: [],
    files: [],
    routes: [],
    entryPoints: [],
    assets: [],
    imports: [],
    configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
    warnings: []
  };
}

describe('Built-in Fix Strategies Unit Tests — Phase 07 Verification', () => {
  describe('RenderBlockingStrategy (FIX_RENDER_BLOCKING_RESOURCE)', () => {
    it('plans defer attribute for render-blocking script tag in index.html', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-rb-'));
      try {
        const htmlFile = path.join(tmpDir, 'index.html');
        await fs.writeFile(
          htmlFile,
          '<!DOCTYPE html><html><head><script src="/bundle.js"></script></head><body></body></html>'
        );

        const candidate: FixCandidate = {
          candidateId: 'cand:rb',
          targetPath: 'bundle.js',
          targetType: 'asset',
          reason: 'Render blocking script',
          evidenceRefs: [],
          findingRefs: ['finding:render_blocking_resource'],
          correlationRefs: ['CORR_RENDER_BLOCKING']
        };

        const codebase = createBaseCodebase(tmpDir);
        codebase.files = [
          { relativePath: 'index.html', extension: '.html', category: 'source', sizeBytes: 200 }
        ];

        const context: FixPlanningContext = {
          workspaceRoot: tmpDir,
          evidence: createMockEvidence(),
          findings: [],
          codebase,
          correlation: { candidates: [] } as any
        };

        const strategy = new RenderBlockingStrategy();
        const plan = await strategy.plan(candidate, context);

        assert.ok(plan);
        assert.strictEqual(plan.strategy.id, 'FIX_RENDER_BLOCKING_RESOURCE');
        assert.strictEqual(plan.risk, 'LOW');
        assert.strictEqual(plan.operations.length, 1);
        assert.strictEqual(plan.operations[0]!.type, 'EDIT_ATTRIBUTE');
        assert.strictEqual(
          plan.operations[0]!.replacementContent,
          '<script defer src="/bundle.js"></script>'
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('FontOptimizationStrategy (FIX_LARGE_FONT)', () => {
    it('plans font-display: swap insertion in matching @font-face rule', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-font-'));
      try {
        const cssFile = path.join(tmpDir, 'styles.css');
        await fs.writeFile(
          cssFile,
          '@font-face {\n  font-family: "Custom";\n  src: url("/fonts/custom.woff2") format("woff2");\n}'
        );

        const candidate: FixCandidate = {
          candidateId: 'cand:font',
          targetPath: 'fonts/custom.woff2',
          targetType: 'asset',
          reason: 'Large local font',
          evidenceRefs: [],
          findingRefs: ['finding:font_resource_large'],
          correlationRefs: ['CORR_FONT_ASSET']
        };

        const codebase = createBaseCodebase(tmpDir);
        codebase.files = [
          { relativePath: 'styles.css', extension: '.css', category: 'stylesheet', sizeBytes: 200 }
        ];

        const context: FixPlanningContext = {
          workspaceRoot: tmpDir,
          evidence: createMockEvidence(),
          findings: [],
          codebase,
          correlation: { candidates: [] } as any
        };

        const strategy = new FontOptimizationStrategy();
        const plan = await strategy.plan(candidate, context);

        assert.ok(plan);
        assert.strictEqual(plan.strategy.id, 'FIX_LARGE_FONT');
        assert.strictEqual(plan.operations.length, 1);
        assert.ok(plan.operations[0]!.replacementContent?.includes('font-display: swap;'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('UnusedImportStrategy (FIX_UNUSED_IMPORT)', () => {
    it('plans removal of unused import statement in TypeScript source file', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-unused-'));
      try {
        const tsFile = path.join(tmpDir, 'src/Component.tsx');
        await fs.mkdir(path.dirname(tsFile), { recursive: true });
        await fs.writeFile(
          tsFile,
          "import { UnusedHelper } from './helpers';\nimport { UsedHelper } from './utils';\n\nexport function Component() {\n  return <div>{UsedHelper()}</div>;\n}\n"
        );

        const candidate: FixCandidate = {
          candidateId: 'cand:unused',
          targetPath: 'src/Component.tsx',
          targetType: 'source',
          reason: 'Unused JS in bundle',
          evidenceRefs: [],
          findingRefs: ['finding:unused_js_high'],
          correlationRefs: ['CORR_SCRIPT_IMPORT']
        };

        const codebase = createBaseCodebase(tmpDir);
        codebase.files = [
          { relativePath: 'src/Component.tsx', extension: '.tsx', category: 'source', sizeBytes: 300 }
        ];

        const context: FixPlanningContext = {
          workspaceRoot: tmpDir,
          evidence: createMockEvidence(),
          findings: [],
          codebase,
          correlation: { candidates: [] } as any
        };

        const strategy = new UnusedImportStrategy();
        const plan = await strategy.plan(candidate, context);

        assert.ok(plan);
        assert.strictEqual(plan.strategy.id, 'FIX_UNUSED_IMPORT');
        assert.strictEqual(plan.operations.length, 1);
        assert.strictEqual(plan.operations[0]!.type, 'REMOVE_UNUSED_IMPORT');
        assert.strictEqual(
          plan.operations[0]!.expectedOriginalContent,
          "import { UnusedHelper } from './helpers';"
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('DynamicImportStrategy (FIX_SAFE_DYNAMIC_IMPORT)', () => {
    it('plans dynamic import conversion for heavy non-critical component in React', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-dyn-'));
      try {
        const routeFile = path.join(tmpDir, 'src/routes/Dashboard.tsx');
        await fs.mkdir(path.dirname(routeFile), { recursive: true });
        await fs.writeFile(
          routeFile,
          "import React from 'react';\nimport HeavyChart from '../components/HeavyChart';\n\nexport function Dashboard() {\n  return <HeavyChart />;\n}\n"
        );

        const candidate: FixCandidate = {
          candidateId: 'cand:dyn',
          targetPath: 'src/routes/Dashboard.tsx',
          targetType: 'route',
          reason: 'Long task in heavy chart',
          evidenceRefs: [],
          findingRefs: ['finding:long_task'],
          correlationRefs: ['CORR_SCRIPT_IMPORT']
        };

        const codebase = createBaseCodebase(tmpDir);
        codebase.framework = { name: 'React', confidence: 'detected', evidenceRefs: [] };
        codebase.routes = [
          {
            path: '/dashboard',
            sourceFile: 'src/routes/Dashboard.tsx',
            framework: 'React',
            detectionMethod: 'convention',
            isDynamic: false,
            evidenceRefs: []
          }
        ];
        codebase.files = [
          { relativePath: 'src/routes/Dashboard.tsx', extension: '.tsx', category: 'source', sizeBytes: 300 }
        ];

        const context: FixPlanningContext = {
          workspaceRoot: tmpDir,
          evidence: createMockEvidence(),
          findings: [],
          codebase,
          correlation: { candidates: [] } as any
        };

        const strategy = new DynamicImportStrategy();
        const plan = await strategy.plan(candidate, context);

        assert.ok(plan);
        assert.strictEqual(plan.strategy.id, 'FIX_SAFE_DYNAMIC_IMPORT');
        assert.strictEqual(plan.risk, 'MEDIUM');
        assert.strictEqual(plan.operations.length, 1);
        assert.strictEqual(plan.operations[0]!.type, 'REPLACE_IMPORT');
        assert.ok(plan.operations[0]!.replacementContent?.includes('React.lazy'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('ResourceOptimizationStrategy (FIX_RESOURCE_REFERENCE)', () => {
    it('plans link rel=preload insertion into head in entry HTML', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-res-'));
      try {
        const htmlFile = path.join(tmpDir, 'index.html');
        await fs.writeFile(
          htmlFile,
          '<!DOCTYPE html><html><head><title>App</title></head><body></body></html>'
        );

        const candidate: FixCandidate = {
          candidateId: 'cand:res',
          targetPath: 'public/fonts/inter.woff2',
          targetType: 'asset',
          reason: 'Large early resource',
          evidenceRefs: [],
          findingRefs: ['finding:large_resource'],
          correlationRefs: ['CORR_RESOURCE_ASSET']
        };

        const codebase = createBaseCodebase(tmpDir);
        codebase.files = [
          { relativePath: 'index.html', extension: '.html', category: 'source', sizeBytes: 200 }
        ];

        const context: FixPlanningContext = {
          workspaceRoot: tmpDir,
          evidence: createMockEvidence(),
          findings: [],
          codebase,
          correlation: { candidates: [] } as any
        };

        const strategy = new ResourceOptimizationStrategy();
        const plan = await strategy.plan(candidate, context);

        assert.ok(plan);
        assert.strictEqual(plan.strategy.id, 'FIX_RESOURCE_REFERENCE');
        assert.strictEqual(plan.operations.length, 1);
        assert.strictEqual(plan.operations[0]!.type, 'INSERT_TEXT');
        assert.ok(plan.operations[0]!.replacementContent?.includes('rel="preload"'));
        assert.ok(plan.operations[0]!.replacementContent?.includes('as="font"'));
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
