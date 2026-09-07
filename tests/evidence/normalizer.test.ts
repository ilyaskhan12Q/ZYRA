import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeEvidence } from '../../src/evidence/normalizer.js';
import { type LighthouseRunResult } from '../../src/lighthouse/types.js';

describe('Evidence Engine — Normalizer', async () => {
  const mobileFixtureRaw = await fs.readFile(
    path.resolve(process.cwd(), 'fixtures/lighthouse/synthetic-mobile.json'),
    'utf-8'
  );
  const mobileLhr = JSON.parse(mobileFixtureRaw);

  const desktopFixtureRaw = await fs.readFile(
    path.resolve(process.cwd(), 'fixtures/lighthouse/synthetic-desktop.json'),
    'utf-8'
  );
  const desktopLhr = JSON.parse(desktopFixtureRaw);

  it('normalizes synthetic mobile Lighthouse results into ZYRA Evidence model', () => {
    const runResult: LighthouseRunResult = {
      metadata: {
        targetUrl: 'https://example.com/',
        requestedUrl: 'https://example.com/',
        finalDisplayedUrl: 'https://example.com/',
        device: 'mobile',
        timestamp: '2026-09-05T12:00:00.000Z',
        durationMs: 4200,
        lighthouseVersion: '13.4.1',
        benchmarkIndex: 1250,
        userAgent: 'test-agent'
      },
      rawLhr: mobileLhr
    };

    const evidence = normalizeEvidence(runResult);

    // Schema and target
    assert.equal(evidence.schemaVersion, '1.0');
    assert.equal(evidence.target.url, 'https://example.com/');
    assert.equal(evidence.target.device, 'mobile');
    assert.equal(evidence.target.timestamp, '2026-09-05T12:00:00.000Z');

    // Run metadata
    assert.equal(evidence.run.durationMs, 4200);
    assert.equal(evidence.run.lighthouseVersion, '13.4.1');
    assert.equal(evidence.run.benchmarkIndex, 1250);

    // Performance score
    assert.equal(evidence.scores.performance, 0.42);

    // Core Web Vitals and Metrics (in ms or score)
    assert.equal(evidence.metrics.fcp.value, 4100);
    assert.equal(evidence.metrics.fcp.unit, 'ms');
    assert.equal(evidence.metrics.fcp.score, 0.35);

    assert.equal(evidence.metrics.lcp.value, 5500);
    assert.equal(evidence.metrics.lcp.unit, 'ms');
    assert.equal(evidence.metrics.lcp.score, 0.22);

    assert.equal(evidence.metrics.tbt.value, 28710);
    assert.equal(evidence.metrics.tbt.unit, 'ms');
    assert.equal(evidence.metrics.tbt.score, 0.05);

    assert.equal(evidence.metrics.cls.value, 0);
    assert.equal(evidence.metrics.cls.unit, 'score');
    assert.equal(evidence.metrics.cls.score, 1);

    assert.equal(evidence.metrics.speedIndex.value, 6200);
    assert.equal(evidence.metrics.speedIndex.unit, 'ms');

    // INP should be present in this fixture
    assert.notEqual(evidence.metrics.inp, null);
    assert.equal(evidence.metrics.inp?.value, 180);
    assert.equal(evidence.metrics.inp?.unit, 'ms');

    // Audits preserved
    assert.ok(evidence.audits.length > 5);
    const lcpAudit = evidence.audits.find((a) => a.id === 'largest-contentful-paint');
    assert.ok(lcpAudit);
    assert.equal(lcpAudit.numericValue, 5500);

    // Network & Resources
    assert.equal(evidence.network.requests.length, 5);
    assert.equal(evidence.resources.summary.length, 5);

    // Scripts
    assert.equal(evidence.scripts.items.length, 2);
    const appJs = evidence.scripts.items.find((s) => s.url.includes('app.js'));
    assert.ok(appJs);
    assert.equal(appJs.unusedBytes, 250000);

    // Images
    assert.equal(evidence.images.items.length, 1);
    const heroImg = evidence.images.items[0];
    assert.equal(heroImg.wastedBytes, 280000);

    // Long tasks
    assert.equal(evidence.scripts.longTasks.length, 2);
    assert.equal(evidence.scripts.longTasks[0].durationMs, 450);

    // Traceability
    assert.equal(evidence.traceability['metrics.lcp'], 'audits.largest-contentful-paint.numericValue');
    assert.equal(evidence.traceability['scores.performance'], 'categories.performance.score');
  });

  it('normalizes synthetic desktop results and keeps INP null when not present', () => {
    const runResult: LighthouseRunResult = {
      metadata: {
        targetUrl: 'https://desktop.example.com/',
        requestedUrl: 'https://desktop.example.com/',
        finalDisplayedUrl: 'https://desktop.example.com/',
        device: 'desktop',
        timestamp: '2026-09-05T12:00:00.000Z',
        durationMs: 2500,
        lighthouseVersion: '13.4.1'
      },
      rawLhr: desktopLhr
    };

    const evidence = normalizeEvidence(runResult);

    assert.equal(evidence.target.device, 'desktop');
    assert.equal(evidence.scores.performance, 0.94);
    assert.equal(evidence.metrics.fcp.value, 650);
    assert.equal(evidence.metrics.lcp.value, 1100);
    assert.equal(evidence.metrics.tbt.value, 25);
    assert.equal(evidence.metrics.cls.value, 0.02);

    // INP was not in desktop fixture — must be null, never invented
    assert.equal(evidence.metrics.inp, null);
  });
});
