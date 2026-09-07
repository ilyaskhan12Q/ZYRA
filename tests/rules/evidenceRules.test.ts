import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { UNUSED_JS_HIGH_RULE } from '../../src/rules/evaluators/javascript/unusedJs.js';
import { LONG_TASK_RULE } from '../../src/rules/evaluators/javascript/longTasks.js';
import { RENDER_BLOCKING_RULE } from '../../src/rules/evaluators/network/renderBlocking.js';
import { LARGE_RESOURCE_RULE } from '../../src/rules/evaluators/network/largeResource.js';
import {
  IMAGE_OPTIMIZATION_RULE,
  LARGE_IMAGE_RULE
} from '../../src/rules/evaluators/images/imageOpt.js';
import { FONT_RESOURCE_LARGE_RULE } from '../../src/rules/evaluators/fonts/fontResource.js';

function createMockEvidence(overrides: Partial<ZyraEvidence> = {}): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T00:00:00.000Z'
    },
    run: { durationMs: 3000, lighthouseVersion: '13.4.1' },
    scores: { performance: 0.9 },
    metrics: {
      fcp: { value: 1000, unit: 'ms', score: 1.0 },
      lcp: { value: 1500, unit: 'ms', score: 1.0 },
      tbt: { value: 20, unit: 'ms', score: 1.0 },
      cls: { value: 0, unit: 'score', score: 1.0 },
      speedIndex: { value: 1200, unit: 'ms', score: 1.0 },
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

describe('Rule Engine — Evidence Evaluators', () => {
  describe('Unused JavaScript Evaluator', () => {
    it('returns empty findings when unused JS <= 100 KB', () => {
      const ev = createMockEvidence({
        scripts: {
          items: [
            { url: 'https://example.com/app.js', transferSizeBytes: 200000, unusedBytes: 80000 }
          ],
          longTasks: []
        }
      });
      assert.deepEqual(UNUSED_JS_HIGH_RULE.evaluate(ev), []);
    });

    it('triggers UNUSED_JS_HIGH when unused JS > 100 KB', () => {
      const ev = createMockEvidence({
        scripts: {
          items: [
            { url: 'https://example.com/app.js', transferSizeBytes: 400000, unusedBytes: 150000 }
          ],
          longTasks: []
        }
      });
      const findings = UNUSED_JS_HIGH_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'UNUSED_JS_HIGH');
      assert.equal(findings[0].severity, 'HIGH');
      assert.equal(findings[0].category, 'javascript');
      assert.equal(findings[0].threshold.value, 100000);
      assert.equal(findings[0].threshold.source, 'ZYRA Heuristic');
    });
  });

  describe('Long Tasks Evaluator', () => {
    it('returns empty findings when no tasks exceed 200 ms and total <= 500 ms', () => {
      const ev = createMockEvidence({
        scripts: {
          items: [],
          longTasks: [
            { startTimeMs: 100, durationMs: 60 },
            { startTimeMs: 300, durationMs: 80 }
          ]
        }
      });
      assert.deepEqual(LONG_TASK_RULE.evaluate(ev), []);
    });

    it('triggers LONG_TASK when a single task exceeds 200 ms', () => {
      const ev = createMockEvidence({
        scripts: {
          items: [],
          longTasks: [{ startTimeMs: 200, durationMs: 250 }]
        }
      });
      const findings = LONG_TASK_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'LONG_TASK');
      assert.equal(findings[0].severity, 'HIGH');
    });

    it('triggers LONG_TASK when cumulative tasks exceed 500 ms', () => {
      const ev = createMockEvidence({
        scripts: {
          items: [],
          longTasks: [
            { startTimeMs: 100, durationMs: 180 },
            { startTimeMs: 300, durationMs: 190 },
            { startTimeMs: 500, durationMs: 160 }
          ]
        }
      });
      const findings = LONG_TASK_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'LONG_TASK');
    });
  });

  describe('Render-Blocking Evaluator', () => {
    it('returns empty findings when no render-blocking delay exists', () => {
      const ev = createMockEvidence({
        audits: [
          {
            id: 'render-blocking-resources',
            title: 'Eliminate render-blocking resources',
            description: '',
            score: 1.0,
            scoreDisplayMode: 'numeric',
            numericValue: 0
          }
        ]
      });
      assert.deepEqual(RENDER_BLOCKING_RULE.evaluate(ev), []);
    });

    it('triggers RENDER_BLOCKING_RESOURCE when numericValue > 0', () => {
      const ev = createMockEvidence({
        audits: [
          {
            id: 'render-blocking-resources',
            title: 'Eliminate render-blocking resources',
            description: '',
            score: 0.4,
            scoreDisplayMode: 'numeric',
            numericValue: 450
          }
        ]
      });
      const findings = RENDER_BLOCKING_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'RENDER_BLOCKING_RESOURCE');
      assert.equal(findings[0].severity, 'HIGH');
      assert.equal(findings[0].category, 'rendering');
    });
  });

  describe('Large Resource Evaluator', () => {
    it('returns empty findings when all network payloads are <= 500 KB', () => {
      const ev = createMockEvidence({
        network: {
          requests: [
            { url: 'https://example.com/small.js', transferSizeBytes: 100000 },
            { url: 'https://example.com/style.css', transferSizeBytes: 40000 }
          ]
        }
      });
      assert.deepEqual(LARGE_RESOURCE_RULE.evaluate(ev), []);
    });

    it('triggers LARGE_RESOURCE when payload exceeds 500 KB', () => {
      const ev = createMockEvidence({
        network: {
          requests: [
            { url: 'https://example.com/large-bundle.js', transferSizeBytes: 750000 }
          ]
        }
      });
      const findings = LARGE_RESOURCE_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'LARGE_RESOURCE');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].category, 'network');
    });
  });

  describe('Image Evaluators', () => {
    it('triggers IMAGE_OPTIMIZATION_OPPORTUNITY when wasted bytes > 100 KB', () => {
      const ev = createMockEvidence({
        images: {
          items: [
            {
              url: 'https://example.com/photo.png',
              transferSizeBytes: 300000,
              wastedBytes: 150000
            }
          ]
        }
      });
      const findings = IMAGE_OPTIMIZATION_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'IMAGE_OPTIMIZATION_OPPORTUNITY');
      assert.equal(findings[0].severity, 'WARNING');
    });

    it('triggers LARGE_IMAGE when single image transfer > 500 KB', () => {
      const ev = createMockEvidence({
        images: {
          items: [
            {
              url: 'https://example.com/huge.jpg',
              transferSizeBytes: 800000
            }
          ]
        }
      });
      const findings = LARGE_IMAGE_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'LARGE_IMAGE');
      assert.equal(findings[0].severity, 'WARNING');
    });
  });

  describe('Font Evaluator', () => {
    it('returns empty findings when fonts <= 100 KB', () => {
      const ev = createMockEvidence({
        fonts: {
          items: [
            { url: 'https://example.com/font.woff2', transferSizeBytes: 45000 }
          ]
        }
      });
      assert.deepEqual(FONT_RESOURCE_LARGE_RULE.evaluate(ev), []);
    });

    it('triggers FONT_RESOURCE_LARGE when font > 100 KB', () => {
      const ev = createMockEvidence({
        fonts: {
          items: [
            { url: 'https://example.com/heavy-font.ttf', transferSizeBytes: 220000 }
          ]
        }
      });
      const findings = FONT_RESOURCE_LARGE_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'FONT_RESOURCE_LARGE');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].category, 'fonts');
    });
  });
});
