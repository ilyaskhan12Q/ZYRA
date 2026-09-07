import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  FIX_SCHEMA_VERSION,
  type FixPlan,
  type FixResult,
  validateFixPlan,
  validateFixResult
} from '../../src/fixes/index.js';

function createValidPlan(): FixPlan {
  return {
    schemaVersion: FIX_SCHEMA_VERSION,
    planId: 'plan_test123',
    createdAt: '2026-09-06T12:00:00.000Z',
    targetWorkspace: '/home/user/project',
    sourceFindingIds: ['finding:lcp_critical'],
    sourceCorrelationIds: ['candidate:image:public/hero.webp'],
    candidate: {
      candidateId: 'candidate:image:public/hero.webp',
      targetPath: 'public/hero.webp',
      targetType: 'asset',
      reason: 'Observed LCP image',
      evidenceRefs: ['images[hero.webp]'],
      findingRefs: ['finding:lcp_critical'],
      correlationRefs: ['CORR_IMAGE_ASSET']
    },
    strategy: {
      id: 'FIX_IMAGE_OPTIMIZATION',
      version: '1.0',
      name: 'Image Loading & Asset Optimization'
    },
    operations: [
      {
        id: 'op_1',
        type: 'EDIT_ATTRIBUTE',
        targetPath: 'index.html',
        originalContentHash: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        expectedOriginalContent: '<img src="/hero.webp">',
        replacementContent: '<img fetchpriority="high" src="/hero.webp">',
        reason: 'Prioritize LCP image'
      }
    ],
    risk: 'LOW',
    confidence: 0.9,
    expectedImpact: {
      targetMetric: 'LCP',
      estimatedDirection: 'improve',
      description: 'Potential reduction in LCP resource load delay'
    },
    preconditions: [
      {
        description: 'Target asset exists',
        satisfied: true
      }
    ],
    safetyChecks: [
      {
        name: 'WORKSPACE_CONTAINMENT',
        status: 'PASSED',
        details: 'Path inside workspace'
      }
    ],
    rollbackInformation: {
      strategy: 'IN_MEMORY',
      available: true,
      operations: [
        {
          targetPath: 'index.html',
          originalHash: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          originalContent: '<img src="/hero.webp">'
        }
      ]
    },
    status: 'READY_FOR_REVIEW'
  };
}

function createValidResult(): FixResult {
  return {
    status: 'APPLIED',
    planId: 'plan_test123',
    strategyId: 'FIX_IMAGE_OPTIMIZATION',
    strategyVersion: '1.0',
    workspace: '/home/user/project',
    timestamp: '2026-09-06T12:00:00.000Z',
    operations: [
      {
        operationId: 'op_1',
        targetPath: 'index.html',
        status: 'APPLIED',
        originalHash: 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        newHash: 'def1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      }
    ],
    audit: {
      timestamp: '2026-09-06T12:00:00.000Z',
      planId: 'plan_test123',
      strategyId: 'FIX_IMAGE_OPTIMIZATION',
      strategyVersion: '1.0',
      workspace: '/home/user/project',
      filesChanged: ['index.html'],
      operationsCount: 1,
      originalHashes: { 'index.html': 'abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
      newHashes: { 'index.html': 'def1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
      result: 'APPLIED',
      rollbackAvailable: true
    },
    rollbackAvailable: true
  };
}

describe('Fix Contracts & Schema Validation — Phase 07 Verification', () => {
  describe('FixPlan Validation', () => {
    it('validates a compliant FixPlan as valid', () => {
      const plan = createValidPlan();
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(validation.errors.length, 0);
    });

    it('rejects unsupported schemaVersion', () => {
      const plan = createValidPlan();
      (plan as any).schemaVersion = '2.0';
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('Unsupported schemaVersion')));
    });

    it('rejects missing or empty planId', () => {
      const plan = createValidPlan();
      plan.planId = '';
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('planId')));
    });

    it('rejects invalid risk level', () => {
      const plan = createValidPlan();
      (plan as any).risk = 'EXTREME';
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('risk')));
    });

    it('rejects invalid status', () => {
      const plan = createValidPlan();
      (plan as any).status = 'COMPLETED';
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('status')));
    });

    it('rejects invalid candidate or strategy', () => {
      const plan = createValidPlan();
      delete (plan as any).candidate;
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('candidate')));
    });

    it('rejects operations with missing originalContentHash', () => {
      const plan = createValidPlan();
      (plan.operations[0] as any).originalContentHash = '';
      const validation = validateFixPlan(plan);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('originalContentHash')));
    });

    it('rejects non-object plan input', () => {
      const validation = validateFixPlan('not-a-plan');
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('non-null object')));
    });
  });

  describe('FixResult Validation', () => {
    it('validates a compliant FixResult as valid', () => {
      const result = createValidResult();
      const validation = validateFixResult(result);
      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(validation.errors.length, 0);
    });

    it('rejects invalid result execution status', () => {
      const result = createValidResult();
      (result as any).status = 'SUCCESSFUL';
      const validation = validateFixResult(result);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('status')));
    });

    it('rejects missing audit record', () => {
      const result = createValidResult();
      delete (result as any).audit;
      const validation = validateFixResult(result);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors.some((e) => e.includes('audit')));
    });
  });
});
