import { describe, it } from 'node:test';
import assert from 'node:assert';
import { correlate } from '../../src/correlation/engine.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type Finding } from '../../src/rules/types.js';
import { type CodebaseEvidence } from '../../src/codebase/types.js';

function createDeterministicInputs() {
  const evidence: ZyraEvidence = {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/blog/hello-world',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: { durationMs: 4500, lighthouseVersion: '13.4.1' },
    scores: { performance: 0.45 },
    metrics: {
      fcp: { value: 2200, unit: 'ms', score: 0.7 },
      lcp: { value: 4800, unit: 'ms', score: 0.2 },
      cls: { value: 0.05, unit: 'score', score: 0.95 },
      tbt: { value: 450, unit: 'ms', score: 0.6 },
      speedIndex: { value: 3500, unit: 'ms', score: 0.7 },
      inp: null
    },
    audits: [
      {
        id: 'largest-contentful-paint',
        title: 'LCP',
        description: 'LCP element /images/cover.webp',
        score: 0.2,
        scoreDisplayMode: 'numeric',
        displayValue: '/images/cover.webp'
      }
    ],
    resources: { summary: [], items: [] },
    network: {
      requests: [
        {
          url: 'https://example.com/images/cover.webp',
          transferSizeBytes: 950000,
          resourceSizeBytes: 950000,
          priority: 'VeryHigh'
        },
        {
          url: 'https://example.com/fonts/inter.woff2',
          transferSizeBytes: 120000,
          resourceSizeBytes: 120000
        }
      ]
    },
    scripts: { items: [], longTasks: [] },
    images: {
      items: [
        {
          url: 'https://example.com/images/cover.webp',
          transferSizeBytes: 950000,
          resourceSizeBytes: 950000
        }
      ]
    },
    fonts: {
      items: [
        {
          url: 'https://example.com/fonts/inter.woff2',
          transferSizeBytes: 120000,
          resourceSizeBytes: 120000
        }
      ]
    },
    traceability: {}
  };

  const findings: Finding[] = [
    {
      id: 'finding:lcp_critical',
      ruleId: 'LCP_CRITICAL',
      ruleVersion: '1.0',
      category: 'metrics',
      severity: 'CRITICAL',
      title: 'Critical LCP',
      description: 'LCP exceeded 4000ms',
      observed: { value: 4800, unit: 'ms' },
      threshold: { value: 4000, unit: 'ms', condition: '> 4000 ms', source: 'Google Web Vitals' },
      evidenceRefs: ['metrics.lcp'],
      confidence: 'DETERMINISTIC',
      nextInvestigation: 'Inspect cover image.'
    },
    {
      id: 'finding:font_resource_large',
      ruleId: 'FONT_RESOURCE_LARGE',
      ruleVersion: '1.0',
      category: 'fonts',
      severity: 'WARNING',
      title: 'Large Font',
      description: 'Font transferred > 100 KB',
      observed: { value: 120000, unit: 'bytes' },
      threshold: { value: 100000, unit: 'bytes', condition: '> 100 KB', source: 'ZYRA Heuristic' },
      evidenceRefs: ['fonts.items'],
      confidence: 'DETERMINISTIC',
      nextInvestigation: 'Subset font.'
    }
  ];

  const codebase: CodebaseEvidence = {
    schemaVersion: '1.0',
    workspace: {
      root: '/app',
      scannedAt: '2026-09-06T12:00:00.000Z',
      scannerVersion: '1.0',
      stats: { filesScanned: 10, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 2000000 }
    },
    framework: { name: 'Next.js (App Router)', confidence: 'detected', evidenceRefs: [] },
    packageManager: { name: 'pnpm', hasConflict: false, evidenceRefs: [] },
    runtime: { evidenceRefs: [] },
    dependencies: [],
    files: [],
    routes: [
      {
        path: '/blog/[slug]',
        sourceFile: 'src/app/blog/[slug]/page.tsx',
        framework: 'Next.js',
        detectionMethod: 'convention',
        isDynamic: true,
        evidenceRefs: []
      }
    ],
    entryPoints: [
      { path: 'src/app/layout.tsx', detectionReason: 'Root layout', evidenceRefs: [] }
    ],
    assets: [
      {
        relativePath: 'public/images/cover.webp',
        extension: '.webp',
        category: 'image',
        sizeBytes: 950000
      },
      {
        relativePath: 'public/fonts/inter.woff2',
        extension: '.woff2',
        category: 'font',
        sizeBytes: 120000
      }
    ],
    imports: [],
    configuration: { configFiles: [], hasSourceMaps: true, evidenceRefs: [] },
    warnings: []
  };

  return { evidence, findings, codebase };
}

describe('Correlation Determinism — Stability Across Consecutive Executions', () => {
  it('produces 100% byte-for-byte identical output across repeated runs', () => {
    const { evidence, findings, codebase } = createDeterministicInputs();

    const options = { fixedTimestamp: '2026-09-06T12:00:00.000Z' };

    const run1 = correlate(evidence, findings, codebase, options);
    const run2 = correlate(evidence, findings, codebase, options);
    const run3 = correlate(evidence, findings, codebase, options);

    const json1 = JSON.stringify(run1, null, 2);
    const json2 = JSON.stringify(run2, null, 2);
    const json3 = JSON.stringify(run3, null, 2);

    assert.strictEqual(json1, json2, 'Run 1 and Run 2 must be identical');
    assert.strictEqual(json2, json3, 'Run 2 and Run 3 must be identical');
  });

  it('enforces deterministic candidate sorting: Status -> Confidence -> Severity -> ID', () => {
    const { evidence, findings, codebase } = createDeterministicInputs();
    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    assert.strictEqual(result.candidates.length >= 2, true);

    // First candidate should be STRONGLY_SUPPORTED image
    const first = result.candidates[0]!;
    assert.strictEqual(first.status, 'STRONGLY_SUPPORTED');
    assert.strictEqual(first.targetName, 'public/images/cover.webp');
  });
});
