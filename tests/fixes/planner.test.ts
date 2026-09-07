import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  planFixes,
  type FixPlanningContext,
  computeSha256
} from '../../src/fixes/index.js';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { type Finding } from '../../src/rules/types.js';
import { type CodebaseEvidence } from '../../src/codebase/types.js';
import { type CorrelationResult } from '../../src/correlation/types.js';

function createMockEvidence(): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T12:00:00.000Z'
    },
    run: { durationMs: 1200, lighthouseVersion: '13.4.1' },
    scores: { performance: 0.5 },
    metrics: {
      fcp: { value: 3200, unit: 'ms', score: 0.4 },
      lcp: { value: 5200, unit: 'ms', score: 0.2 },
      cls: { value: 0, unit: 'score', score: 1 },
      tbt: { value: 500, unit: 'ms', score: 0.4 },
      speedIndex: { value: 4000, unit: 'ms', score: 0.5 },
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

function createMockCodebase(workspaceRoot: string): CodebaseEvidence {
  return {
    schemaVersion: '1.0',
    workspace: {
      root: workspaceRoot,
      scannedAt: '2026-09-06T12:00:00.000Z',
      scannerVersion: '1.0',
      stats: { filesScanned: 5, filesSkipped: 0, directoriesSkipped: 0, totalSizeBytes: 10000 }
    },
    framework: {
      name: 'Vite',
      confidence: 'detected',
      evidenceRefs: ['package.json']
    },
    packageManager: {
      name: 'npm',
      hasConflict: false,
      evidenceRefs: []
    },
    runtime: { evidenceRefs: [] },
    dependencies: [],
    files: [
      { relativePath: 'index.html', extension: '.html', category: 'source', sizeBytes: 500 },
      { relativePath: 'src/styles/main.css', extension: '.css', category: 'stylesheet', sizeBytes: 400 },
      { relativePath: 'src/App.tsx', extension: '.tsx', category: 'source', sizeBytes: 600 },
      { relativePath: 'public/hero.webp', extension: '.webp', category: 'asset', sizeBytes: 250000 },
      { relativePath: 'public/font.woff2', extension: '.woff2', category: 'asset', sizeBytes: 150000 }
    ],
    routes: [],
    entryPoints: [{ path: 'src/App.tsx', detectionReason: 'Main component', evidenceRefs: [] }],
    assets: [
      { relativePath: 'public/hero.webp', extension: '.webp', category: 'image', sizeBytes: 250000 },
      { relativePath: 'public/font.woff2', extension: '.woff2', category: 'font', sizeBytes: 150000 }
    ],
    imports: [],
    configuration: { configFiles: [], hasSourceMaps: false, evidenceRefs: [] },
    warnings: []
  };
}

describe('Fix Planner — Phase 07 Verification', () => {
  it('plans LCP image attribute optimization when markup references image', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-planner-'));
    try {
      const htmlFile = path.join(tmpDir, 'index.html');
      await fs.writeFile(
        htmlFile,
        '<!DOCTYPE html><html><body><img src="/public/hero.webp" alt="Hero"></body></html>'
      );
      const imgFile = path.join(tmpDir, 'public/hero.webp');
      await fs.mkdir(path.dirname(imgFile), { recursive: true });
      await fs.writeFile(imgFile, Buffer.from([0x00, 0x01, 0x02]));

      const findings: Finding[] = [
        {
          id: 'finding:lcp_critical',
          ruleId: 'LCP_CRITICAL',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'CRITICAL',
          title: 'Largest Contentful Paint is critically high',
          description: 'LCP observed at 5200 ms',
          observed: { value: 5200, unit: 'ms' },
          threshold: { value: 4000, unit: 'ms', condition: '> 4000 ms', source: 'Google Web Vitals' },
          evidenceRefs: ['metrics.lcp'],
          confidence: 'DETERMINISTIC',
          nextInvestigation: 'Trace LCP element'
        }
      ];

      const correlation: CorrelationResult = {
        schemaVersion: '1.0',
        evaluatedAt: '2026-09-06T12:00:00.000Z',
        correlatorVersion: '1.0',
        summary: {
          totalFindings: 1,
          correlatedFindings: 1,
          stronglySupportedCandidates: 1,
          supportedCandidates: 0,
          possibleCandidates: 0,
          insufficientEvidenceCount: 0,
          noCorrelationCount: 0
        },
        candidates: [
          {
            id: 'candidate:image:public/hero.webp',
            targetPath: 'public/hero.webp',
            targetType: 'asset',
            targetName: 'public/hero.webp',
            findingIds: ['finding:lcp_critical'],
            status: 'STRONGLY_SUPPORTED',
            assessmentLevel: 'STRONGLY_SUPPORTED_CONTRIBUTOR',
            confidence: { score: 0.9, signals: [], rationale: 'Exact asset match' },
            links: [
              {
                sourceType: 'image',
                sourceRef: 'images[hero.webp]',
                targetType: 'asset',
                targetRef: 'assets[public/hero.webp]',
                relationship: 'EXACT_MATCH',
                strength: 'strong',
                reason: 'Path match'
              }
            ],
            supportingEvidence: ['LCP element match'],
            contradictingEvidence: [],
            missingEvidence: [],
            reasoning: 'Browser LCP element maps to local hero.webp',
            nextInvestigation: 'Optimize image loading'
          }
        ],
        assessments: [],
        warnings: []
      };

      const context: FixPlanningContext = {
        workspaceRoot: tmpDir,
        evidence: createMockEvidence(),
        findings,
        codebase: createMockCodebase(tmpDir),
        correlation,
        fixedTimestamp: '2026-09-06T12:00:00.000Z'
      };

      const plans = await planFixes(context);
      assert.strictEqual(plans.length, 1);

      const plan = plans[0]!;
      assert.strictEqual(plan.strategy.id, 'FIX_IMAGE_OPTIMIZATION');
      assert.strictEqual(plan.risk, 'LOW');
      assert.strictEqual(plan.operations.length, 1);
      assert.strictEqual(plan.operations[0]!.type, 'EDIT_ATTRIBUTE');
      assert.ok(plan.operations[0]!.replacementContent?.includes('fetchpriority="high"'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects external CDN candidates from fix planning (no local fix for external assets)', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-planner-'));
    try {
      const correlation: CorrelationResult = {
        schemaVersion: '1.0',
        evaluatedAt: '2026-09-06T12:00:00.000Z',
        correlatorVersion: '1.0',
        summary: {
          totalFindings: 1,
          correlatedFindings: 1,
          stronglySupportedCandidates: 1,
          supportedCandidates: 0,
          possibleCandidates: 0,
          insufficientEvidenceCount: 0,
          noCorrelationCount: 0
        },
        candidates: [
          {
            id: 'candidate:external:https://cdn.example.com/banner.jpg',
            targetType: 'external_resource',
            targetName: 'https://cdn.example.com/banner.jpg',
            findingIds: ['finding:large_image'],
            status: 'SUPPORTED_CONTRIBUTOR',
            assessmentLevel: 'SUPPORTED_CONTRIBUTOR',
            confidence: { score: 0.8, signals: [], rationale: 'CDN resource' },
            links: [],
            supportingEvidence: [],
            contradictingEvidence: [],
            missingEvidence: [],
            reasoning: 'External CDN image',
            nextInvestigation: 'Inspect CDN'
          }
        ],
        assessments: [],
        warnings: []
      };

      const context: FixPlanningContext = {
        workspaceRoot: tmpDir,
        evidence: createMockEvidence(),
        findings: [],
        codebase: createMockCodebase(tmpDir),
        correlation,
        fixedTimestamp: '2026-09-06T12:00:00.000Z'
      };

      const plans = await planFixes(context);
      assert.strictEqual(plans.length, 0, 'Must NOT generate local fix plans for external CDN resources');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('guarantees 100% deterministic planning across consecutive runs', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zyra-planner-'));
    try {
      const htmlFile = path.join(tmpDir, 'index.html');
      await fs.writeFile(
        htmlFile,
        '<!DOCTYPE html><html><body><img src="/public/hero.webp" alt="Hero"></body></html>'
      );
      const imgFile = path.join(tmpDir, 'public/hero.webp');
      await fs.mkdir(path.dirname(imgFile), { recursive: true });
      await fs.writeFile(imgFile, Buffer.from([0x00, 0x01, 0x02]));

      const correlation: CorrelationResult = {
        schemaVersion: '1.0',
        evaluatedAt: '2026-09-06T12:00:00.000Z',
        correlatorVersion: '1.0',
        summary: {
          totalFindings: 1,
          correlatedFindings: 1,
          stronglySupportedCandidates: 1,
          supportedCandidates: 0,
          possibleCandidates: 0,
          insufficientEvidenceCount: 0,
          noCorrelationCount: 0
        },
        candidates: [
          {
            id: 'candidate:image:public/hero.webp',
            targetPath: 'public/hero.webp',
            targetType: 'asset',
            targetName: 'public/hero.webp',
            findingIds: ['finding:lcp_critical'],
            status: 'STRONGLY_SUPPORTED',
            assessmentLevel: 'STRONGLY_SUPPORTED_CONTRIBUTOR',
            confidence: { score: 0.9, signals: [], rationale: 'Exact asset match' },
            links: [],
            supportingEvidence: [],
            contradictingEvidence: [],
            missingEvidence: [],
            reasoning: 'LCP image',
            nextInvestigation: 'Fix'
          }
        ],
        assessments: [],
        warnings: []
      };

      const context: FixPlanningContext = {
        workspaceRoot: tmpDir,
        evidence: createMockEvidence(),
        findings: [],
        codebase: createMockCodebase(tmpDir),
        correlation,
        fixedTimestamp: '2026-09-06T12:00:00.000Z'
      };

      const plans1 = await planFixes(context);
      const plans2 = await planFixes(context);

      assert.strictEqual(JSON.stringify(plans1), JSON.stringify(plans2));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
