import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RuleRegistry, DEFAULT_RULES } from '../../src/rules/registry.js';
import { type PerformanceRule } from '../../src/rules/types.js';

describe('Rule Engine — Rule Registry', () => {
  it('registers all 16 built-in default rules', () => {
    const registry = new RuleRegistry();
    assert.equal(registry.size, 16);
    assert.equal(DEFAULT_RULES.length, 16);
  });

  it('guarantees unique and non-empty rule IDs across all default rules', () => {
    const seen = new Set<string>();
    for (const rule of DEFAULT_RULES) {
      assert.ok(rule.id, 'Rule ID must be defined');
      assert.ok(typeof rule.id === 'string');
      assert.ok(!seen.has(rule.id), `Duplicate rule ID found in defaults: ${rule.id}`);
      seen.add(rule.id);
    }
  });

  it('guarantees every rule has valid metadata and version', () => {
    for (const rule of DEFAULT_RULES) {
      assert.equal(rule.version, '1.0');
      assert.ok(rule.title.length > 0);
      assert.ok(rule.description.length > 0);
      assert.ok(Array.isArray(rule.evidenceConsumed));
      assert.ok(rule.evidenceConsumed.length > 0);
      assert.ok(rule.thresholdSummary.length > 0);
      assert.ok(['Google Web Vitals', 'Google Lighthouse', 'ZYRA Heuristic'].includes(rule.thresholdSource));
    }
  });

  it('rejects duplicate rule registrations with a descriptive error', () => {
    const registry = new RuleRegistry();
    const duplicateRule: PerformanceRule = {
      id: 'FCP_SLOW',
      version: '1.0',
      category: 'metrics',
      defaultSeverity: 'WARNING',
      title: 'Duplicate',
      description: 'Duplicate',
      evidenceConsumed: ['metrics.fcp'],
      thresholdSummary: '> 1800 ms',
      thresholdSource: 'Google Web Vitals',
      evaluate: () => []
    };

    assert.throws(
      () => registry.register(duplicateRule),
      /Duplicate rule registration: Rule with ID 'FCP_SLOW' is already registered\./
    );
  });

  it('allows unregistering and re-registering custom rules', () => {
    const registry = new RuleRegistry([]);
    assert.equal(registry.size, 0);

    const customRule: PerformanceRule = {
      id: 'CUSTOM_TEST_RULE',
      version: '1.0',
      category: 'resources',
      defaultSeverity: 'INFO',
      title: 'Custom Test',
      description: 'Custom Test Rule',
      evidenceConsumed: ['resources.summary'],
      thresholdSummary: 'none',
      thresholdSource: 'ZYRA Heuristic',
      evaluate: () => []
    };

    registry.register(customRule);
    assert.equal(registry.size, 1);
    assert.equal(registry.get('CUSTOM_TEST_RULE'), customRule);

    const unregistered = registry.unregister('CUSTOM_TEST_RULE');
    assert.equal(unregistered, true);
    assert.equal(registry.size, 0);
    assert.equal(registry.get('CUSTOM_TEST_RULE'), undefined);
  });

  it('generates a complete structured rule catalog', () => {
    const registry = new RuleRegistry();
    const catalog = registry.getRuleCatalog();
    assert.equal(catalog.length, 16);
    const fcpEntry = catalog.find((c) => c.id === 'FCP_SLOW');
    assert.ok(fcpEntry);
    assert.equal(fcpEntry.category, 'metrics');
    assert.equal(fcpEntry.severity, 'WARNING');
    assert.equal(fcpEntry.thresholdSource, 'Google Web Vitals');
  });
});
