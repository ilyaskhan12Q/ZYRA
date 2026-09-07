import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeEvidence } from '../../src/evidence/normalizer.js';
import { type LighthouseRunResult } from '../../src/lighthouse/types.js';
import { RuleEngine } from '../../src/rules/engine.js';
import { RuleRegistry } from '../../src/rules/registry.js';
import { type PerformanceRule } from '../../src/rules/types.js';

describe('Rule Engine — Orchestration & Determinism', async () => {
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

  const mobileEvidence = normalizeEvidence({
    metadata: {
      targetUrl: 'https://example.com/',
      requestedUrl: 'https://example.com/',
      finalDisplayedUrl: 'https://example.com/',
      device: 'mobile',
      timestamp: '2026-09-05T12:00:00.000Z',
      durationMs: 4200,
      lighthouseVersion: '13.4.1'
    },
    rawLhr: mobileLhr
  });

  const desktopEvidence = normalizeEvidence({
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
  });

  it('produces zero findings for healthy desktop evidence', () => {
    const engine = new RuleEngine();
    const findings = engine.evaluate(desktopEvidence);
    assert.equal(findings.length, 0);
  });

  it('evaluates synthetic mobile evidence and surfaces structured findings', () => {
    const engine = new RuleEngine();
    const findings = engine.evaluate(mobileEvidence);
    assert.ok(findings.length > 0);

    const ruleIds = findings.map((f) => f.ruleId);
    assert.ok(ruleIds.includes('FCP_CRITICAL'), 'FCP 4100ms should trigger FCP_CRITICAL');
    assert.ok(ruleIds.includes('LCP_CRITICAL'), 'LCP 5500ms should trigger LCP_CRITICAL');
    assert.ok(ruleIds.includes('TBT_CRITICAL'), 'TBT 28710ms should trigger TBT_CRITICAL');
    assert.ok(ruleIds.includes('SPEED_INDEX_SLOW'), 'Speed Index 6200ms should trigger SPEED_INDEX_SLOW');
    assert.ok(ruleIds.includes('UNUSED_JS_HIGH'), 'Unused JS 350KB should trigger UNUSED_JS_HIGH');
    assert.ok(ruleIds.includes('LONG_TASK'), 'Long tasks should trigger LONG_TASK');
    assert.ok(
      ruleIds.includes('IMAGE_OPTIMIZATION_OPPORTUNITY'),
      'Image optimization should trigger IMAGE_OPTIMIZATION_OPPORTUNITY'
    );

    // CLS is 0 in synthetic-mobile -> must NOT trigger CLS_POOR
    assert.ok(!ruleIds.includes('CLS_POOR'), 'CLS = 0 must not trigger CLS_POOR');
    // INP is 180ms in synthetic-mobile -> must NOT trigger INP_SLOW
    assert.ok(!ruleIds.includes('INP_SLOW'), 'INP = 180ms must not trigger INP_SLOW');
  });

  it('guarantees 100% deterministic output across repeated evaluations', () => {
    const engine = new RuleEngine();
    const baseline = JSON.stringify(engine.evaluate(mobileEvidence));

    for (let i = 0; i < 5; i++) {
      const runOutput = JSON.stringify(engine.evaluate(mobileEvidence));
      assert.equal(runOutput, baseline, `Run ${i + 1} produced non-identical findings`);
    }
  });

  it('strictly enforces deterministic sorting order: CRITICAL > HIGH > WARNING > INFO', () => {
    const engine = new RuleEngine();
    const findings = engine.evaluate(mobileEvidence);

    const severityOrder = { CRITICAL: 4, HIGH: 3, WARNING: 2, INFO: 1 };
    for (let i = 0; i < findings.length - 1; i++) {
      const currentSev = severityOrder[findings[i].severity];
      const nextSev = severityOrder[findings[i + 1].severity];
      assert.ok(
        currentSev >= nextSev,
        `Finding order violation: ${findings[i].severity} appeared before ${findings[i + 1].severity}`
      );
    }
  });

  it('deduplicates findings with identical IDs', () => {
    const registry = new RuleRegistry([]);
    const ruleA: PerformanceRule = {
      id: 'TEST_RULE_A',
      version: '1.0',
      category: 'metrics',
      defaultSeverity: 'HIGH',
      title: 'Rule A',
      description: 'Rule A description',
      evidenceConsumed: ['metrics.tbt'],
      thresholdSummary: 'none',
      thresholdSource: 'ZYRA Heuristic',
      evaluate: () => [
        {
          id: 'finding:test_duplicate',
          ruleId: 'TEST_RULE_A',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'HIGH',
          title: 'Test',
          description: 'Desc',
          observed: { value: 100 },
          threshold: { value: 50, condition: '> 50', source: 'ZYRA Heuristic' },
          evidenceRefs: ['metrics.tbt'],
          confidence: 'DETERMINISTIC',
          nextInvestigation: 'Investigate'
        }
      ]
    };

    const ruleB: PerformanceRule = {
      id: 'TEST_RULE_B',
      version: '1.0',
      category: 'metrics',
      defaultSeverity: 'HIGH',
      title: 'Rule B',
      description: 'Rule B description',
      evidenceConsumed: ['metrics.tbt'],
      thresholdSummary: 'none',
      thresholdSource: 'ZYRA Heuristic',
      evaluate: () => [
        {
          id: 'finding:test_duplicate', // Same finding ID!
          ruleId: 'TEST_RULE_B',
          ruleVersion: '1.0',
          category: 'metrics',
          severity: 'HIGH',
          title: 'Test Duplicate',
          description: 'Desc',
          observed: { value: 100 },
          threshold: { value: 50, condition: '> 50', source: 'ZYRA Heuristic' },
          evidenceRefs: ['metrics.tbt'],
          confidence: 'DETERMINISTIC',
          nextInvestigation: 'Investigate'
        }
      ]
    };

    registry.register(ruleA);
    registry.register(ruleB);

    const engine = new RuleEngine(registry);
    const findings = engine.evaluate(mobileEvidence);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, 'finding:test_duplicate');
  });

  it('safely handles rule evaluation errors without creating fake findings', () => {
    const registry = new RuleRegistry([]);
    const faultyRule: PerformanceRule = {
      id: 'FAULTY_RULE',
      version: '1.0',
      category: 'javascript',
      defaultSeverity: 'CRITICAL',
      title: 'Faulty Rule',
      description: 'Always throws',
      evidenceConsumed: ['scripts.items'],
      thresholdSummary: 'none',
      thresholdSource: 'ZYRA Heuristic',
      evaluate: () => {
        throw new Error('Simulated evaluator failure');
      }
    };

    registry.register(faultyRule);
    const engine = new RuleEngine(registry);

    // Default mode: does not crash, returns empty findings, records structured error
    const findings = engine.evaluate(mobileEvidence);
    assert.equal(findings.length, 0);

    const lastErrors = engine.getLastErrors();
    assert.equal(lastErrors.length, 1);
    assert.equal(lastErrors[0].ruleId, 'FAULTY_RULE');
    assert.equal(lastErrors[0].message, 'Simulated evaluator failure');

    // Strict mode: throws
    assert.throws(
      () => engine.evaluate(mobileEvidence, { strict: true }),
      /Rule engine evaluation failed with 1 rule error\(s\)/
    );
  });
});
