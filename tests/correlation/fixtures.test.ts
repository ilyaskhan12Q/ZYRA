import { describe, it } from 'node:test';
import assert from 'node:assert';
import { correlate } from '../../src/correlation/engine.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type Finding } from '../../src/rules/types.js';
import { type CodebaseEvidence } from '../../src/codebase/types.js';

function createBlankEvidence(url = 'https://example.com/'): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url,
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: { durationMs: 4000, lighthouseVersion: '13.4.1' },
    scores: { performance: 0.5 },
    metrics: {
      fcp: { value: 2000, unit: 'ms', score: 0.8 },
      lcp: { value: 4500, unit: 'ms', score: 0.3 },
      cls: { value: 0.05, unit: 'score', score: 0.95 },
      tbt: { value: 200, unit: 'ms', score: 0.9 },
      speedIndex: { value: 3000, unit: 'ms', score: 0.8 },
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

function createBlankCodebase(): CodebaseEvidence {
  return {
    schemaVersion: '1.0',
    workspace: {
      root: '/workspace',
      scannedAt: '2026-09-06T12:00:00.000Z',
      scannerVersion: '1.0',
      stats: { filesScanned: 10, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 1000 }
    },
    framework: { name: 'Next.js (App Router)', confidence: 'detected', evidenceRefs: [] },
    packageManager: { name: 'pnpm', hasConflict: false, evidenceRefs: [] },
    runtime: { evidenceRefs: [] },
    dependencies: [],
    files: [],
    routes: [],
    entryPoints: [],
    assets: [],
    imports: [],
    configuration: { configFiles: [], hasSourceMaps: true, evidenceRefs: [] },
    warnings: []
  };
}

describe('Correlation Engine — Realistic Scenario Fixtures (Fixtures A–F)', () => {
  // Fixture A — Strong LCP asset correlation
  it('Fixture A: Strong LCP asset correlation yields STRONGLY_SUPPORTED', () => {
    const evidence = createBlankEvidence('https://example.com/');
    evidence.audits = [
      {
        id: 'largest-contentful-paint',
        title: 'Largest Contentful Paint',
        description: 'LCP element /images/hero.webp',
        score: 0.2,
        scoreDisplayMode: 'numeric',
        displayValue: '/images/hero.webp'
      }
    ];
    evidence.images.items = [
      {
        url: 'https://example.com/images/hero.webp',
        transferSizeBytes: 870000,
        resourceSizeBytes: 870000
      }
    ];

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
        nextInvestigation: 'Inspect LCP.'
      }
    ];

    const codebase = createBlankCodebase();
    codebase.routes = [
      {
        path: '/',
        sourceFile: 'src/app/page.tsx',
        framework: 'Next.js',
        detectionMethod: 'convention',
        isDynamic: false,
        evidenceRefs: []
      }
    ];
    codebase.assets = [
      {
        relativePath: 'public/images/hero.webp',
        extension: '.webp',
        category: 'image',
        sizeBytes: 870000
      }
    ];

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    assert.strictEqual(result.summary.stronglySupportedCandidates >= 1, true);
    const heroCand = result.candidates.find((c) => c.targetName === 'public/images/hero.webp');
    assert.notStrictEqual(heroCand, undefined);
    assert.strictEqual(heroCand?.status, 'STRONGLY_SUPPORTED');
    assert.strictEqual(heroCand?.assessmentLevel, 'STRONGLY_SUPPORTED_CONTRIBUTOR');
    assert.strictEqual(heroCand?.confidence.score >= 0.75, true);

    const assessment = result.assessments.find((a) => a.findingId === 'finding:lcp_critical');
    assert.strictEqual(assessment?.status, 'STRONGLY_SUPPORTED');
    assert.strictEqual(assessment?.topCandidateId, heroCand?.id);
  });

  // Fixture B — Ambiguous asset match
  it('Fixture B: Ambiguous asset match does NOT jump to exact certainty', () => {
    const evidence = createBlankEvidence('https://example.com/');
    evidence.images.items = [
      {
        url: 'https://example.com/banner.png',
        transferSizeBytes: 600000
      }
    ];

    const findings: Finding[] = [
      {
        id: 'finding:large_image',
        ruleId: 'LARGE_IMAGE',
        ruleVersion: '1.0',
        category: 'images',
        severity: 'WARNING',
        title: 'Large Image',
        description: 'Large image transferred',
        observed: { value: 600000, unit: 'bytes' },
        threshold: { value: 500000, unit: 'bytes', condition: '> 500 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['images.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect image.'
      }
    ];

    const codebase = createBlankCodebase();
    codebase.assets = [
      { relativePath: 'src/assets/banner.png', extension: '.png', category: 'image', sizeBytes: 600000 },
      { relativePath: 'public/legacy/banner.png', extension: '.png', category: 'image', sizeBytes: 600000 }
    ];

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const cand = result.candidates.find((c) => c.targetName.includes('banner.png'));
    assert.notStrictEqual(cand, undefined);
    // Must be penalized for ambiguity and cannot be STRONGLY_SUPPORTED
    assert.notStrictEqual(cand?.status, 'STRONGLY_SUPPORTED');
    assert.strictEqual(cand?.contradictingEvidence.some((c) => c.includes('Ambiguous asset match')), true);
  });

  // Fixture C — External script
  it('Fixture C: External script with no local files produces INSUFFICIENT_EVIDENCE', () => {
    const evidence = createBlankEvidence('https://example.com/');
    evidence.scripts.items = [
      {
        url: 'https://third-party.example/script.js',
        transferSizeBytes: 300000,
        unusedBytes: 200000
      }
    ];

    const findings: Finding[] = [
      {
        id: 'finding:unused_js',
        ruleId: 'UNUSED_JS_HIGH',
        ruleVersion: '1.0',
        category: 'javascript',
        severity: 'HIGH',
        title: 'High Unused JS',
        description: 'Unused JS > 100 KB',
        observed: { value: 200000, unit: 'bytes' },
        threshold: { value: 100000, unit: 'bytes', condition: '> 100 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['scripts.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect scripts.'
      }
    ];

    const codebase = createBlankCodebase();

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const extCand = result.candidates.find((c) => c.targetType === 'external_resource');
    assert.notStrictEqual(extCand, undefined);
    assert.strictEqual(extCand?.status, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(extCand?.targetPath, undefined);
  });

  // Fixture D — Large local asset but irrelevant
  it('Fixture D: Large local asset not loaded in browser results in NO_CORRELATION', () => {
    const evidence = createBlankEvidence('https://example.com/');
    // No images loaded
    evidence.images.items = [];

    const findings: Finding[] = [
      {
        id: 'finding:lcp_critical',
        ruleId: 'LCP_CRITICAL',
        ruleVersion: '1.0',
        category: 'metrics',
        severity: 'CRITICAL',
        title: 'Critical LCP',
        description: 'LCP was 4500ms',
        observed: { value: 4500, unit: 'ms' },
        threshold: { value: 4000, unit: 'ms', condition: '> 4000 ms', source: 'Google Web Vitals' },
        evidenceRefs: ['metrics.lcp'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect LCP.'
      }
    ];

    const codebase = createBlankCodebase();
    codebase.assets = [
      {
        relativePath: 'public/images/unrelated-huge.png',
        extension: '.png',
        category: 'image',
        sizeBytes: 5000000
      }
    ];

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const unrelated = result.candidates.find((c) => c.targetName.includes('unrelated-huge.png'));
    assert.strictEqual(unrelated, undefined);
    const assessment = result.assessments.find((a) => a.findingId === 'finding:lcp_critical');
    assert.strictEqual(assessment?.status, 'NO_CORRELATION');
  });

  // Fixture E — Dynamic route
  it('Fixture E: Dynamic route correctly correlates /blog/hello to /blog/[slug]', () => {
    const evidence = createBlankEvidence('https://example.com/blog/hello');
    const findings: Finding[] = [];
    const codebase = createBlankCodebase();
    codebase.routes = [
      {
        path: '/blog/[slug]',
        sourceFile: 'src/app/blog/[slug]/page.tsx',
        framework: 'Next.js (App Router)',
        detectionMethod: 'convention',
        isDynamic: true,
        evidenceRefs: []
      }
    ];

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const routeCand = result.candidates.find((c) => c.targetType === 'route');
    assert.notStrictEqual(routeCand, undefined);
    assert.strictEqual(routeCand?.targetPath, 'src/app/blog/[slug]/page.tsx');
    assert.strictEqual(routeCand?.confidence.signals.some((s) => s.name === 'DYNAMIC_ROUTE_MATCH'), true);
  });

  // Fixture F — Contradictory evidence
  it('Fixture F: Contradictory evidence weakens attribution status', () => {
    const evidence = createBlankEvidence('https://example.com/');
    evidence.images.items = [
      {
        url: 'https://example.com/images/hero.webp',
        transferSizeBytes: 0, // Cached!
        resourceSizeBytes: 800000
      }
    ];

    const findings: Finding[] = [
      {
        id: 'finding:large_image',
        ruleId: 'LARGE_IMAGE',
        ruleVersion: '1.0',
        category: 'images',
        severity: 'WARNING',
        title: 'Large Image',
        description: 'Large image',
        observed: { value: 800000, unit: 'bytes' },
        threshold: { value: 500000, unit: 'bytes', condition: '> 500 KB', source: 'ZYRA Heuristic' },
        evidenceRefs: ['images.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation: 'Inspect.'
      }
    ];

    const codebase = createBlankCodebase();
    codebase.assets = [
      {
        relativePath: 'public/images/hero.webp',
        extension: '.webp',
        category: 'image',
        sizeBytes: 800000
      }
    ];

    const result = correlate(evidence, findings, codebase, { fixedTimestamp: '2026-09-06T12:00:00.000Z' });

    const heroCand = result.candidates.find((c) => c.targetName === 'public/images/hero.webp');
    assert.notStrictEqual(heroCand, undefined);
    assert.notStrictEqual(heroCand?.status, 'STRONGLY_SUPPORTED');
    assert.strictEqual((heroCand?.contradictingEvidence.length ?? 0) > 0, true);
  });
});
