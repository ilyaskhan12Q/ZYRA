import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { type ZyraEvidence } from '../../src/evidence/types.js';
import { FCP_SLOW_RULE, FCP_CRITICAL_RULE } from '../../src/rules/evaluators/metrics/fcp.js';
import { LCP_SLOW_RULE, LCP_CRITICAL_RULE } from '../../src/rules/evaluators/metrics/lcp.js';
import { TBT_HIGH_RULE, TBT_CRITICAL_RULE } from '../../src/rules/evaluators/metrics/tbt.js';
import { CLS_POOR_RULE } from '../../src/rules/evaluators/metrics/cls.js';
import { SPEED_INDEX_SLOW_RULE } from '../../src/rules/evaluators/metrics/speedIndex.js';
import { INP_SLOW_RULE } from '../../src/rules/evaluators/metrics/inp.js';

function createMockEvidence(metricsPartial: Partial<ZyraEvidence['metrics']>): ZyraEvidence {
  return {
    schemaVersion: '1.0',
    target: {
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-06T00:00:00.000Z'
    },
    run: {
      durationMs: 3000,
      lighthouseVersion: '13.4.1'
    },
    scores: {
      performance: 0.8
    },
    metrics: {
      fcp: { value: 1200, unit: 'ms', score: 0.9 },
      lcp: { value: 2000, unit: 'ms', score: 0.9 },
      tbt: { value: 50, unit: 'ms', score: 0.95 },
      cls: { value: 0.05, unit: 'score', score: 0.98 },
      speedIndex: { value: 2200, unit: 'ms', score: 0.9 },
      inp: null,
      ...metricsPartial
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

describe('Rule Engine — Metric Evaluators', () => {
  describe('FCP Evaluator', () => {
    it('returns empty findings for good FCP (<= 1800 ms)', () => {
      const ev = createMockEvidence({ fcp: { value: 1800, unit: 'ms', score: 1.0 } });
      assert.deepEqual(FCP_SLOW_RULE.evaluate(ev), []);
      assert.deepEqual(FCP_CRITICAL_RULE.evaluate(ev), []);
    });

    it('triggers FCP_SLOW when FCP > 1800 ms and <= 3000 ms', () => {
      const ev = createMockEvidence({ fcp: { value: 1801, unit: 'ms', score: 0.7 } });
      const findings = FCP_SLOW_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'FCP_SLOW');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].confidence, 'DETERMINISTIC');
      assert.deepEqual(findings[0].evidenceRefs, ['metrics.fcp']);
      assert.equal(findings[0].threshold.value, 1800);
      assert.equal(findings[0].threshold.source, 'Google Web Vitals');
      assert.equal(FCP_CRITICAL_RULE.evaluate(ev).length, 0);
    });

    it('triggers FCP_CRITICAL when FCP > 3000 ms', () => {
      const ev = createMockEvidence({ fcp: { value: 3001, unit: 'ms', score: 0.2 } });
      const slowFindings = FCP_SLOW_RULE.evaluate(ev);
      const critFindings = FCP_CRITICAL_RULE.evaluate(ev);
      assert.equal(slowFindings.length, 0); // FCP_SLOW defers to FCP_CRITICAL
      assert.equal(critFindings.length, 1);
      assert.equal(critFindings[0].ruleId, 'FCP_CRITICAL');
      assert.equal(critFindings[0].severity, 'HIGH');
      assert.equal(critFindings[0].threshold.value, 3000);
    });

    it('does not trigger on null or negative FCP', () => {
      const nullEv = createMockEvidence({ fcp: { value: null, unit: 'ms', score: null } });
      assert.deepEqual(FCP_SLOW_RULE.evaluate(nullEv), []);
      assert.deepEqual(FCP_CRITICAL_RULE.evaluate(nullEv), []);

      const negEv = createMockEvidence({ fcp: { value: -50, unit: 'ms', score: null } });
      assert.deepEqual(FCP_SLOW_RULE.evaluate(negEv), []);
      assert.deepEqual(FCP_CRITICAL_RULE.evaluate(negEv), []);
    });
  });

  describe('LCP Evaluator', () => {
    it('returns empty findings for good LCP (<= 2500 ms)', () => {
      const ev = createMockEvidence({ lcp: { value: 2500, unit: 'ms', score: 1.0 } });
      assert.deepEqual(LCP_SLOW_RULE.evaluate(ev), []);
      assert.deepEqual(LCP_CRITICAL_RULE.evaluate(ev), []);
    });

    it('triggers LCP_SLOW when LCP > 2500 ms and <= 4000 ms', () => {
      const ev = createMockEvidence({ lcp: { value: 2501, unit: 'ms', score: 0.8 } });
      const findings = LCP_SLOW_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'LCP_SLOW');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].threshold.value, 2500);
      assert.equal(LCP_CRITICAL_RULE.evaluate(ev).length, 0);
    });

    it('triggers LCP_CRITICAL when LCP > 4000 ms', () => {
      const ev = createMockEvidence({ lcp: { value: 4001, unit: 'ms', score: 0.1 } });
      const slowFindings = LCP_SLOW_RULE.evaluate(ev);
      const critFindings = LCP_CRITICAL_RULE.evaluate(ev);
      assert.equal(slowFindings.length, 0);
      assert.equal(critFindings.length, 1);
      assert.equal(critFindings[0].ruleId, 'LCP_CRITICAL');
      assert.equal(critFindings[0].severity, 'CRITICAL');
      assert.equal(critFindings[0].threshold.value, 4000);
    });

    it('does not trigger on null LCP', () => {
      const ev = createMockEvidence({ lcp: { value: null, unit: 'ms', score: null } });
      assert.deepEqual(LCP_SLOW_RULE.evaluate(ev), []);
      assert.deepEqual(LCP_CRITICAL_RULE.evaluate(ev), []);
    });
  });

  describe('TBT Evaluator', () => {
    it('returns empty findings for good TBT (<= 200 ms)', () => {
      const ev = createMockEvidence({ tbt: { value: 200, unit: 'ms', score: 1.0 } });
      assert.deepEqual(TBT_HIGH_RULE.evaluate(ev), []);
      assert.deepEqual(TBT_CRITICAL_RULE.evaluate(ev), []);
    });

    it('triggers TBT_HIGH when TBT > 200 ms and <= 600 ms', () => {
      const ev = createMockEvidence({ tbt: { value: 201, unit: 'ms', score: 0.8 } });
      const findings = TBT_HIGH_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'TBT_HIGH');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].threshold.value, 200);
      assert.equal(TBT_CRITICAL_RULE.evaluate(ev).length, 0);
    });

    it('triggers TBT_CRITICAL when TBT > 600 ms', () => {
      const ev = createMockEvidence({ tbt: { value: 601, unit: 'ms', score: 0.1 } });
      const highFindings = TBT_HIGH_RULE.evaluate(ev);
      const critFindings = TBT_CRITICAL_RULE.evaluate(ev);
      assert.equal(highFindings.length, 0);
      assert.equal(critFindings.length, 1);
      assert.equal(critFindings[0].ruleId, 'TBT_CRITICAL');
      assert.equal(critFindings[0].severity, 'CRITICAL');
      assert.equal(critFindings[0].threshold.value, 600);
    });

    it('does not trigger on null TBT', () => {
      const ev = createMockEvidence({ tbt: { value: null, unit: 'ms', score: null } });
      assert.deepEqual(TBT_HIGH_RULE.evaluate(ev), []);
      assert.deepEqual(TBT_CRITICAL_RULE.evaluate(ev), []);
    });
  });

  describe('CLS Evaluator', () => {
    it('returns empty findings for CLS = 0 (strictly valid good performance)', () => {
      const ev = createMockEvidence({ cls: { value: 0, unit: 'score', score: 1.0 } });
      assert.deepEqual(CLS_POOR_RULE.evaluate(ev), []);
    });

    it('returns empty findings for good CLS (<= 0.10)', () => {
      const ev = createMockEvidence({ cls: { value: 0.10, unit: 'score', score: 0.95 } });
      assert.deepEqual(CLS_POOR_RULE.evaluate(ev), []);
    });

    it('triggers CLS_POOR with WARNING when CLS > 0.10 and <= 0.25', () => {
      const ev = createMockEvidence({ cls: { value: 0.11, unit: 'score', score: 0.7 } });
      const findings = CLS_POOR_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'CLS_POOR');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].threshold.value, 0.10);
    });

    it('triggers CLS_POOR with CRITICAL when CLS > 0.25', () => {
      const ev = createMockEvidence({ cls: { value: 0.26, unit: 'score', score: 0.3 } });
      const findings = CLS_POOR_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'CLS_POOR');
      assert.equal(findings[0].severity, 'CRITICAL');
      assert.equal(findings[0].threshold.value, 0.25);
    });

    it('does not trigger on null CLS', () => {
      const ev = createMockEvidence({ cls: { value: null, unit: 'score', score: null } });
      assert.deepEqual(CLS_POOR_RULE.evaluate(ev), []);
    });
  });

  describe('Speed Index Evaluator', () => {
    it('returns empty findings for good Speed Index (<= 3400 ms)', () => {
      const ev = createMockEvidence({ speedIndex: { value: 3400, unit: 'ms', score: 1.0 } });
      assert.deepEqual(SPEED_INDEX_SLOW_RULE.evaluate(ev), []);
    });

    it('triggers SPEED_INDEX_SLOW with WARNING when SI > 3400 ms and <= 5800 ms', () => {
      const ev = createMockEvidence({ speedIndex: { value: 3401, unit: 'ms', score: 0.8 } });
      const findings = SPEED_INDEX_SLOW_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'SPEED_INDEX_SLOW');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].threshold.value, 3400);
    });

    it('triggers SPEED_INDEX_SLOW with HIGH when SI > 5800 ms', () => {
      const ev = createMockEvidence({ speedIndex: { value: 5801, unit: 'ms', score: 0.2 } });
      const findings = SPEED_INDEX_SLOW_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'SPEED_INDEX_SLOW');
      assert.equal(findings[0].severity, 'HIGH');
      assert.equal(findings[0].threshold.value, 5800);
    });

    it('does not trigger on null Speed Index', () => {
      const ev = createMockEvidence({ speedIndex: { value: null, unit: 'ms', score: null } });
      assert.deepEqual(SPEED_INDEX_SLOW_RULE.evaluate(ev), []);
    });
  });

  describe('INP Evaluator', () => {
    it('NEVER triggers when INP is null (uncaptured in lab measurement)', () => {
      const ev = createMockEvidence({ inp: null });
      assert.deepEqual(INP_SLOW_RULE.evaluate(ev), []);

      const nullValueEv = createMockEvidence({ inp: { value: null, unit: 'ms', score: null } });
      assert.deepEqual(INP_SLOW_RULE.evaluate(nullValueEv), []);
    });

    it('returns empty findings for good INP (<= 200 ms)', () => {
      const ev = createMockEvidence({ inp: { value: 200, unit: 'ms', score: 1.0 } });
      assert.deepEqual(INP_SLOW_RULE.evaluate(ev), []);
    });

    it('triggers INP_SLOW with WARNING when INP > 200 ms and <= 500 ms', () => {
      const ev = createMockEvidence({ inp: { value: 201, unit: 'ms', score: 0.8 } });
      const findings = INP_SLOW_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'INP_SLOW');
      assert.equal(findings[0].severity, 'WARNING');
      assert.equal(findings[0].threshold.value, 200);
    });

    it('triggers INP_SLOW with HIGH when INP > 500 ms', () => {
      const ev = createMockEvidence({ inp: { value: 501, unit: 'ms', score: 0.2 } });
      const findings = INP_SLOW_RULE.evaluate(ev);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].ruleId, 'INP_SLOW');
      assert.equal(findings[0].severity, 'HIGH');
      assert.equal(findings[0].threshold.value, 500);
    });
  });
});
