import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { FixStrategyRegistry } from '../../src/fixes/index.js';

describe('Fix Strategy Registry — Phase 07 Verification', () => {
  it('registers all 6 default fix strategies', () => {
    const registry = new FixStrategyRegistry();
    const all = registry.getAll();
    assert.strictEqual(all.length, 6);

    const ids = all.map((s) => s.id);
    assert.ok(ids.includes('FIX_IMAGE_OPTIMIZATION'));
    assert.ok(ids.includes('FIX_RENDER_BLOCKING_RESOURCE'));
    assert.ok(ids.includes('FIX_LARGE_FONT'));
    assert.ok(ids.includes('FIX_UNUSED_IMPORT'));
    assert.ok(ids.includes('FIX_SAFE_DYNAMIC_IMPORT'));
    assert.ok(ids.includes('FIX_RESOURCE_REFERENCE'));
  });

  it('rejects duplicate strategy registrations with descriptive error', () => {
    const registry = new FixStrategyRegistry();
    const first = registry.getAll()[0]!;

    assert.throws(
      () => registry.register(first),
      (err: any) => err.message.includes(`Strategy with ID '${first.id}' is already registered`)
    );
  });

  it('retrieves registered strategy by ID', () => {
    const registry = new FixStrategyRegistry();
    const strategy = registry.get('FIX_IMAGE_OPTIMIZATION');
    assert.ok(strategy);
    assert.strictEqual(strategy.id, 'FIX_IMAGE_OPTIMIZATION');
    assert.strictEqual(strategy.version, '1.0');
    assert.strictEqual(strategy.riskLevel, 'LOW');
  });

  it('generates structured machine-readable catalog', () => {
    const registry = new FixStrategyRegistry();
    const catalog = registry.getFixStrategyCatalog();
    assert.strictEqual(catalog.length, 6);

    for (const item of catalog) {
      assert.ok(item.id);
      assert.ok(item.version);
      assert.ok(item.name);
      assert.ok(item.description);
      assert.ok(item.riskLevel);
      assert.ok(Array.isArray(item.applicableFindings));
      assert.ok(Array.isArray(item.applicableCorrelations));
      assert.ok(Array.isArray(item.preconditions));
    }
  });

  it('supports unregistering strategies', () => {
    const registry = new FixStrategyRegistry();
    assert.strictEqual(registry.unregister('FIX_IMAGE_OPTIMIZATION'), true);
    assert.strictEqual(registry.get('FIX_IMAGE_OPTIMIZATION'), undefined);
    assert.strictEqual(registry.getAll().length, 5);
  });
});
