import { describe, it } from 'node:test';
import assert from 'node:assert';
import { correlate } from '../../src/correlation/engine.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type Finding } from '../../src/rules/types.js';
import { type CodebaseEvidence } from '../../src/codebase/types.js';

function createMockEvidence(): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: { durationMs: 4000, lighthouseVersion: '13.4.1' },
    scores: { performance: 0.4 },
    metrics: {
      fcp: { value: 1500, unit: 'ms', score: 0.9 },
      lcp: { value: 5000, unit: 'ms', score: 0.2 },
      cls: { value: 0.01, unit: 'score', score: 0.99 },
      tbt: { value: 800, unit: 'ms', score: 0.4 },
      speedIndex: { value: 2500, unit: 'ms', score: 0.8 },
      inp: null
    },
    audits: [
      {
        id: 'largest-contentful-paint',
        title: 'Largest Contentful Paint',
        description: 'LCP element was a heading text block',
        score: 0.2,
        scoreDisplayMode: 'numeric'
      }
    ],
    resources: { summary: [], items: [] },
    network: { requests: [] },
    scripts: { items: [], longTasks: [] },
    images: { items: [] },
    fonts: { items: [] },
    traceability: {}
  };
}

describe('Negative Tests — Anti-Hallucination & Conservative Causality', () => {
  it('does NOT blame large local workspace assets if they were not loaded in browser', () => {
    const evidence = createMockEvidence();
    // No images were loaded in browser
    evidence.images.items = [];

    const findings: Finding[] = [
      {
        id: 'finding:lcp_critical',
        ruleId: 'LCP_CRITICAL',
        ruleVersion: '1.0',
        category: 'metrics',
        severity: 'CRITICAL',
        title: 'Critical LCP',
        description: 'LCP exceeded 4000ms',
        observed: { value: 5000, unit: 'ms' },
        threshold: { value: 4000, unit: 'ms', condition: '> 4000 ms', source: 'Google Web Vitals' },
        evidenceRefs: ['metrics.lcp'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect LCP elements.'
      }
    ];

    // Workspace has a huge uncompressed 10MB image sitting in public/
    const codebase: CodebaseEvidence = {
      schemaVersion: '1.0',
      workspace: {
        root: '/app',
        scannedAt: '2026-09-06T12:00:00.000Z',
        scannerVersion: '1.0',
        stats: { filesScanned: 5, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 10000000 }
      },
      framework: { name: 'Vite', confidence: 'detected', evidenceRefs: [] },
      packageManager: { name: 'npm', hasConflict: false, evidenceRefs: [] },
      runtime: { evidenceRefs: [] },
      dependencies: [],
      files: [],
      routes: [],
      entryPoints: [],
      assets: [
        {
          relativePath: 'public/images/giant-unused.png',
          extension: '.png',
          category: 'image',
          sizeBytes: 10485760 // 10 MB
        }
      ],
      imports: [],
      configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
      warnings: []
    };

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    // The giant unused image must NOT be identified as a candidate or root cause
    const imageCand = result.candidates.find((c) => c.targetName.includes('giant-unused.png'));
    assert.strictEqual(imageCand, undefined);

    const lcpAssessment = result.assessments.find((a) => a.findingId === 'finding:lcp_critical');
    assert.strictEqual(lcpAssessment?.status, 'NO_CORRELATION');
    assert.strictEqual(lcpAssessment?.assessmentLevel, 'UNKNOWN');
  });

  it('does NOT blame React dependency for TBT merely because React is installed', () => {
    const evidence = createMockEvidence();
    evidence.scripts.items = [
      {
        url: 'https://example.com/assets/app.js',
        transferSizeBytes: 40000
      }
    ];

    const findings: Finding[] = [
      {
        id: 'finding:tbt_critical',
        ruleId: 'TBT_CRITICAL',
        ruleVersion: '1.0',
        category: 'metrics',
        severity: 'CRITICAL',
        title: 'Critical TBT',
        description: 'TBT was 800ms',
        observed: { value: 800, unit: 'ms' },
        threshold: { value: 600, unit: 'ms', condition: '> 600 ms', source: 'Google Lighthouse' },
        evidenceRefs: ['metrics.tbt'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect script execution.'
      }
    ];

    const codebase: CodebaseEvidence = {
      schemaVersion: '1.0',
      workspace: {
        root: '/app',
        scannedAt: '2026-09-06T12:00:00.000Z',
        scannerVersion: '1.0',
        stats: { filesScanned: 5, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 1000 }
      },
      framework: { name: 'React', confidence: 'detected', evidenceRefs: [] },
      packageManager: { name: 'npm', hasConflict: false, evidenceRefs: [] },
      runtime: { evidenceRefs: [] },
      dependencies: [
        { name: 'react', versionRange: '^19.0.0', dependencyType: 'production', sourceManifest: 'package.json' },
        { name: 'react-dom', versionRange: '^19.0.0', dependencyType: 'production', sourceManifest: 'package.json' }
      ],
      files: [],
      routes: [],
      entryPoints: [],
      assets: [],
      imports: [],
      configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
      warnings: []
    };

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    // React should NOT be claimed as STRONGLY_SUPPORTED or root cause
    const reactCand = result.candidates.find((c) => c.targetName === 'react');
    assert.strictEqual(reactCand, undefined);
  });

  it('does NOT blame App.tsx for LCP without direct evidence', () => {
    const evidence = createMockEvidence();
    const findings: Finding[] = [
      {
        id: 'finding:lcp_critical',
        ruleId: 'LCP_CRITICAL',
        ruleVersion: '1.0',
        category: 'metrics',
        severity: 'CRITICAL',
        title: 'Critical LCP',
        description: 'LCP was 5000ms',
        observed: { value: 5000, unit: 'ms' },
        threshold: { value: 4000, unit: 'ms', condition: '> 4000 ms', source: 'Google Web Vitals' },
        evidenceRefs: ['metrics.lcp'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect LCP.'
      }
    ];

    const codebase: CodebaseEvidence = {
      schemaVersion: '1.0',
      workspace: {
        root: '/app',
        scannedAt: '2026-09-06T12:00:00.000Z',
        scannerVersion: '1.0',
        stats: { filesScanned: 5, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 1000 }
      },
      framework: { name: 'React', confidence: 'detected', evidenceRefs: [] },
      packageManager: { name: 'npm', hasConflict: false, evidenceRefs: [] },
      runtime: { evidenceRefs: [] },
      dependencies: [],
      files: [
        { relativePath: 'src/App.tsx', extension: '.tsx', category: 'source', sizeBytes: 25000 }
      ],
      routes: [],
      entryPoints: [
        { path: 'src/App.tsx', detectionReason: 'Root component', evidenceRefs: [] }
      ],
      assets: [],
      imports: [],
      configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
      warnings: []
    };

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const appCand = result.candidates.find((c) => c.targetName.includes('App.tsx'));
    // If route/entry rule noted App.tsx as entry point, it must NOT be marked STRONGLY_SUPPORTED or root cause
    if (appCand) {
      assert.notStrictEqual(appCand.status, 'STRONGLY_SUPPORTED');
      assert.strictEqual(appCand.contradictingEvidence.some((c) => c.includes('structural context only')), true);
    }
  });

  it('does NOT invent a local source file for external third-party scripts', () => {
    const evidence = createMockEvidence();
    evidence.scripts.items = [
      {
        url: 'https://third-party.example.com/widget.js',
        transferSizeBytes: 450000,
        unusedBytes: 300000
      }
    ];

    const findings: Finding[] = [
      {
        id: 'finding:unused_js',
        ruleId: 'UNUSED_JS_HIGH',
        ruleVersion: '1.0',
        category: 'javascript',
        severity: 'HIGH',
        title: 'Unused JS',
        description: 'Unused JS > 100 KB',
        observed: { value: 300000, unit: 'bytes' },
        threshold: { value: 100000, unit: 'bytes', condition: '> 100 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['scripts.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect bundle.'
      }
    ];

    const codebase: CodebaseEvidence = {
      schemaVersion: '1.0',
      workspace: {
        root: '/app',
        scannedAt: '2026-09-06T12:00:00.000Z',
        scannerVersion: '1.0',
        stats: { filesScanned: 5, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 1000 }
      },
      framework: { name: 'Vite', confidence: 'detected', evidenceRefs: [] },
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

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const extCand = result.candidates.find((c) => c.targetType === 'external_resource');
    assert.notStrictEqual(extCand, undefined);
    assert.strictEqual(extCand?.targetPath, undefined);
    assert.strictEqual(extCand?.status, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(extCand?.assessmentLevel, 'UNKNOWN');
    assert.match(extCand!.missingEvidence[0]!, /No local codebase source exists/);
  });
});
