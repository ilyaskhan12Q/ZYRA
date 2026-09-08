import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  formatCIReportTerminal,
  formatCIPRComment,
  type CIResult,
  CI_SCHEMA_VERSION
} from '../../src/ci/index.js';

function makeSampleResult(status: CIResult['status'] = 'PASS', exitCode = 0): CIResult {
  return {
    schemaVersion: CI_SCHEMA_VERSION,
    id: 'ci_rep_test',
    timestamp: '2026-09-08T12:00:00.000Z',
    targetUrl: 'https://example.com/',
    device: 'mobile',
    status,
    exitCode,
    policy: {},
    currentRun: {
      url: 'https://example.com/',
      device: 'mobile',
      metrics: { lcp: 2400, cls: 0.05 },
      scores: { performance: 0.95 },
      evidenceTimestamp: '2026-09-08T12:00:00.000Z'
    },
    baseline: {
      id: 'base_rep_test',
      url: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-07T12:00:00.000Z',
      metrics: { lcp: 2600, cls: 0.05 },
      scores: { performance: 0.90 },
      compatible: true
    },
    comparison: {
      compatible: true,
      overallStatus: 'IMPROVED',
      metrics: {
        lcp: {
          metric: 'lcp',
          name: 'Largest Contentful Paint',
          before: 2600,
          after: 2400,
          absoluteDelta: -200,
          percentageDelta: -7.7,
          direction: 'improved',
          status: 'IMPROVED',
          unit: 'ms',
          threshold: '>2500',
          isSignificant: true
        }
      },
      regressions: [],
      improvements: [],
      unchanged: []
    },
    budgets: {
      passed: true,
      evaluations: [
        {
          metric: 'lcp',
          name: 'Largest Contentful Paint',
          actual: 2400,
          budgetMax: 2500,
          unit: 'ms',
          status: 'PASS',
          delta: -100,
          percentageOfBudget: 96.0
        }
      ],
      violations: [],
      warnings: []
    },
    summary: 'CI Check Passed: All performance budgets met and zero regressions detected.'
  };
}

describe('CI Reporter — Phase 09 Validation', () => {
  it('formats terminal report with clean aligned tables', () => {
    const res = makeSampleResult('PASS', 0);
    const text = formatCIReportTerminal(res);

    assert.ok(text.includes('ZYRA CI PERFORMANCE CHECK'));
    assert.ok(text.includes('Target:            https://example.com/'));
    assert.ok(text.includes('Status:            PASS'));
    assert.ok(text.includes('Exit Code:         0'));
    assert.ok(text.includes('BASELINE COMPARISON'));
    assert.ok(text.includes('PERFORMANCE BUDGETS'));
    assert.ok(text.includes('[PASS]'));
  });

  it('formats terminal report showing regressions and failures', () => {
    const res = makeSampleResult('FAIL', 1);
    res.comparison!.regressions = [
      {
        metric: 'lcp',
        name: 'Largest Contentful Paint',
        baseline: 2400,
        current: 3100,
        absoluteDelta: 700,
        percentageDelta: 29.2,
        direction: 'regressed',
        status: 'REGRESSED',
        isSignificant: true,
        unit: 'ms',
        severity: 'CRITICAL',
        details: 'LCP regressed by +700ms'
      }
    ];
    res.comparison!.metrics.lcp.status = 'REGRESSED';
    res.comparison!.metrics.lcp.after = 3100;
    res.comparison!.metrics.lcp.absoluteDelta = 700;

    const text = formatCIReportTerminal(res);
    assert.ok(text.includes('[REGRESSION]'));
    assert.ok(text.includes('Exit Code:         1'));
  });

  it('formats PR markdown comment with tables and emojis', () => {
    const res = makeSampleResult('PASS', 0);
    const md = formatCIPRComment(res);

    assert.ok(md.includes('### ⚡ ZYRA CI Performance Check: **✅ PASS**'));
    assert.ok(md.includes('#### 📊 Baseline Comparison'));
    assert.ok(md.includes('| **Largest Contentful Paint** |'));
    assert.ok(md.includes('#### 🎯 Performance Budgets'));
    assert.ok(md.includes('| Metric | Actual | Budget Max | Status |'));
    assert.ok(md.includes('*Generated deterministically by [ZYRA]'));
  });
});
