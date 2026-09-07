import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  CORR_IMAGE_ASSET_RULE,
  CORR_FONT_ASSET_RULE,
  CORR_RENDER_BLOCKING_RULE,
  CORR_SCRIPT_IMPORT_RULE,
  CORR_RESOURCE_ASSET_RULE,
  CORR_ROUTE_ENTRY_RULE
} from '../../src/correlation/rules/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type Finding } from '../../src/rules/types.js';
import { type CodebaseEvidence } from '../../src/codebase/types.js';

function createBaseEvidence(overrides: Partial<ZyraEvidence> = {}): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: {
      durationMs: 5000,
      lighthouseVersion: '13.4.1'
    },
    scores: { performance: 0.5 },
    metrics: {
      fcp: { value: 2000, unit: 'ms', score: 0.8 },
      lcp: { value: 4500, unit: 'ms', score: 0.3 },
      cls: { value: 0.05, unit: 'score', score: 0.95 },
      tbt: { value: 300, unit: 'ms', score: 0.7 },
      speedIndex: { value: 3000, unit: 'ms', score: 0.8 },
      inp: null
    },
    audits: [],
    resources: { summary: [], items: [] },
    network: { requests: [] },
    scripts: { items: [], longTasks: [] },
    images: { items: [] },
    fonts: { items: [] },
    traceability: {},
    ...overrides
  };
}

function createBaseCodebase(overrides: Partial<CodebaseEvidence> = {}): CodebaseEvidence {
  return {
    schemaVersion: '1.0',
    workspace: {
      root: '/app',
      scannedAt: '2026-09-06T12:00:00.000Z',
      scannerVersion: '1.0',
      stats: { filesScanned: 10, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 1000 }
    },
    framework: { name: 'Next.js (App Router)', confidence: 'detected', evidenceRefs: [] },
    packageManager: { name: 'npm', hasConflict: false, evidenceRefs: [] },
    runtime: { evidenceRefs: [] },
    dependencies: [],
    files: [],
    routes: [
      {
        path: '/',
        sourceFile: 'src/app/page.tsx',
        framework: 'Next.js',
        detectionMethod: 'convention',
        isDynamic: false,
        evidenceRefs: []
      }
    ],
    entryPoints: [
      { path: 'src/app/layout.tsx', detectionReason: 'Root layout', evidenceRefs: [] }
    ],
    assets: [],
    imports: [],
    configuration: { configFiles: [], hasSourceMaps: true, evidenceRefs: [] },
    warnings: [],
    ...overrides
  };
}

describe('Correlation Rules — Image Asset Rule (CORR_IMAGE_ASSET)', () => {
  it('correlates LCP image finding with codebase asset and marks STRONGLY_SUPPORTED', () => {
    const evidence = createBaseEvidence({
      audits: [
        {
          id: 'largest-contentful-paint',
          title: 'Largest Contentful Paint',
          description: 'LCP element is /images/hero.webp',
          score: 0.3,
          scoreDisplayMode: 'numeric',
          displayValue: '/images/hero.webp'
        }
      ],
      images: {
        items: [
          {
            url: 'https://example.com/images/hero.webp',
            transferSizeBytes: 850000,
            resourceSizeBytes: 850000
          }
        ]
      }
    });

    const findings: Finding[] = [
      {
        id: 'finding:lcp_critical',
        ruleId: 'LCP_CRITICAL',
        ruleVersion: '1.0',
        category: 'metrics',
        severity: 'CRITICAL',
        title: 'Critical LCP',
        description: 'LCP exceeded 4000ms',
        observed: { value: 4500, unit: 'ms' },
        threshold: { value: 4000, unit: 'ms', condition: '> 4000 ms', source: 'Google Web Vitals' },
        evidenceRefs: ['metrics.lcp'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect LCP image.'
      }
    ];

    const codebase = createBaseCodebase({
      assets: [
        {
          relativePath: 'public/images/hero.webp',
          extension: '.webp',
          category: 'image',
          sizeBytes: 850000
        }
      ]
    });

    const matches = CORR_IMAGE_ASSET_RULE.evaluate({ evidence, findings, codebase });
    assert.strictEqual(matches.length, 1);
    const { candidate, assessment } = matches[0]!;

    assert.strictEqual(candidate.targetName, 'public/images/hero.webp');
    assert.strictEqual(candidate.status, 'STRONGLY_SUPPORTED');
    assert.strictEqual(candidate.assessmentLevel, 'STRONGLY_SUPPORTED_CONTRIBUTOR');
    assert.strictEqual(assessment?.primaryBottleneckType, 'image_payload');
    assert.strictEqual(assessment?.findingId, 'finding:lcp_critical');
  });

  it('penalizes cached 0-byte transfer image', () => {
    const evidence = createBaseEvidence({
      images: {
        items: [
          {
            url: 'https://example.com/images/cached.webp',
            transferSizeBytes: 0,
            resourceSizeBytes: 600000
          }
        ]
      }
    });

    const findings: Finding[] = [
      {
        id: 'finding:large_image',
        ruleId: 'LARGE_IMAGE',
        ruleVersion: '1.0',
        category: 'images',
        severity: 'WARNING',
        title: 'Large Image',
        description: 'Image transferred > 500 KB',
        observed: { value: 600000, unit: 'bytes' },
        threshold: { value: 500000, unit: 'bytes', condition: '> 500 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['images.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Compress image.'
      }
    ];

    const codebase = createBaseCodebase({
      assets: [
        {
          relativePath: 'public/images/cached.webp',
          extension: '.webp',
          category: 'image',
          sizeBytes: 600000
        }
      ]
    });

    const matches = CORR_IMAGE_ASSET_RULE.evaluate({ evidence, findings, codebase });
    assert.strictEqual(matches.length, 1);
    const { candidate } = matches[0]!;
    assert.strictEqual(candidate.contradictingEvidence.length > 0, true);
    assert.notStrictEqual(candidate.status, 'STRONGLY_SUPPORTED');
  });
});

describe('Correlation Rules — Font Asset Rule (CORR_FONT_ASSET)', () => {
  it('correlates large local font with workspace font asset', () => {
    const evidence = createBaseEvidence({
      fonts: {
        items: [
          {
            url: 'https://example.com/fonts/heavy-font.woff2',
            transferSizeBytes: 150000
          }
        ]
      }
    });

    const findings: Finding[] = [
      {
        id: 'finding:font_resource_large',
        ruleId: 'FONT_RESOURCE_LARGE',
        ruleVersion: '1.0',
        category: 'fonts',
        severity: 'WARNING',
        title: 'Large Font',
        description: 'Font exceeds 100 KB',
        observed: { value: 150000, unit: 'bytes' },
        threshold: { value: 100000, unit: 'bytes', condition: '> 100 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['fonts.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Subset font.'
      }
    ];

    const codebase = createBaseCodebase({
      assets: [
        {
          relativePath: 'public/fonts/heavy-font.woff2',
          extension: '.woff2',
          category: 'font',
          sizeBytes: 150000
        }
      ]
    });

    const matches = CORR_FONT_ASSET_RULE.evaluate({ evidence, findings, codebase });
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0]!.candidate.targetName, 'public/fonts/heavy-font.woff2');
    assert.strictEqual(matches[0]!.candidate.status, 'SUPPORTED_CONTRIBUTOR');
    assert.strictEqual(matches[0]!.assessment?.primaryBottleneckType, 'font_payload');
  });
});

describe('Correlation Rules — Render-Blocking Rule (CORR_RENDER_BLOCKING)', () => {
  it('correlates render blocking stylesheet with workspace asset', () => {
    const evidence = createBaseEvidence({
      audits: [
        {
          id: 'render-blocking-resources',
          title: 'Eliminate render-blocking resources',
          description: 'Potential savings 800ms',
          score: 0,
          scoreDisplayMode: 'numeric',
          numericValue: 800,
          displayValue: 'styles.css'
        }
      ],
      network: {
        requests: [
          {
            url: 'https://example.com/styles.css',
            resourceType: 'Stylesheet',
            priority: 'VeryHigh',
            transferSizeBytes: 65000
          }
        ]
      }
    });

    const findings: Finding[] = [
      {
        id: 'finding:render_blocking',
        ruleId: 'RENDER_BLOCKING_RESOURCE',
        ruleVersion: '1.0',
        category: 'rendering',
        severity: 'HIGH',
        title: 'Render Blocking Resource',
        description: 'Render blocking resources detected',
        observed: { value: 800, unit: 'ms' },
        threshold: { value: 0, unit: 'ms', condition: '> 0 ms', source: 'ZYRA Heuristic' },
        evidenceRefs: ['audits'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inline critical CSS.'
      }
    ];

    const codebase = createBaseCodebase({
      assets: [
        {
          relativePath: 'public/styles.css',
          extension: '.css',
          category: 'stylesheet',
          sizeBytes: 65000
        }
      ]
    });

    const matches = CORR_RENDER_BLOCKING_RULE.evaluate({ evidence, findings, codebase });
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0]!.candidate.targetName, 'public/styles.css');
    assert.strictEqual(matches[0]!.assessment?.primaryBottleneckType, 'render_blocking');
  });
});

describe('Correlation Rules — Script & Import Rule (CORR_SCRIPT_IMPORT)', () => {
  it('correlates unused JS bundle with entry point and flags missing source maps', () => {
    const evidence = createBaseEvidence({
      scripts: {
        items: [
          {
            url: 'https://example.com/assets/main.bundle.js',
            transferSizeBytes: 400000,
            unusedBytes: 250000
          }
        ],
        longTasks: []
      }
    });

    const findings: Finding[] = [
      {
        id: 'finding:unused_js',
        ruleId: 'UNUSED_JS_HIGH',
        ruleVersion: '1.0',
        category: 'javascript',
        severity: 'HIGH',
        title: 'High Unused JavaScript',
        description: 'Wasted JS > 100 KB',
        observed: { value: 250000, unit: 'bytes' },
        threshold: { value: 100000, unit: 'bytes', condition: '> 100 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['scripts.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Code split bundle.'
      }
    ];

    const codebase = createBaseCodebase({
      entryPoints: [
        { path: 'src/main.tsx', detectionReason: 'App entry', evidenceRefs: [] }
      ],
      configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] }
    });

    const matches = CORR_SCRIPT_IMPORT_RULE.evaluate({ evidence, findings, codebase });
    assert.strictEqual(matches.length, 1);
    const { candidate } = matches[0]!;
    assert.strictEqual(candidate.targetPath, 'src/main.tsx');
    assert.strictEqual(candidate.missingEvidence.some((m) => m.includes('source maps')), true);
  });
});

describe('Correlation Rules — Route Entry Rule (CORR_ROUTE_ENTRY)', () => {
  it('links target URL to matching route as supporting context only', () => {
    const evidence = createBaseEvidence();
    const findings: Finding[] = [];
    const codebase = createBaseCodebase();

    const matches = CORR_ROUTE_ENTRY_RULE.evaluate({ evidence, findings, codebase });
    assert.strictEqual(matches.length, 1);
    const { candidate } = matches[0]!;
    assert.strictEqual(candidate.targetPath, 'src/app/page.tsx');
    assert.strictEqual(candidate.targetType, 'route');
    assert.strictEqual(candidate.contradictingEvidence.some((c) => c.includes('structural context only')), true);
  });
});
