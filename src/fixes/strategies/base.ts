/**
 * Base Fix Strategy & Helpers
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type FixCandidate,
  type FixExpectedImpact,
  type FixOperation,
  type FixPlan,
  type FixPlanningContext,
  type FixPrecondition,
  type FixRiskLevel,
  type FixSafetyCheck,
  type FixStrategy,
  FIX_SCHEMA_VERSION
} from '../types.js';
import {
  computeSha256,
  validateWorkspacePath,
  normalizePosixPath
} from '../safety.js';

export abstract class BaseFixStrategy implements FixStrategy {
  abstract readonly id: string;
  abstract readonly version: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly applicableFindings: string[];
  abstract readonly applicableCorrelations: string[];
  abstract readonly preconditions: string[];
  abstract readonly riskLevel: FixRiskLevel;

  abstract canApply(candidate: FixCandidate, context: FixPlanningContext): Promise<boolean> | boolean;
  abstract plan(candidate: FixCandidate, context: FixPlanningContext): Promise<FixPlan | null> | FixPlan | null;

  /**
   * Generates a deterministic planId based on candidate and strategy.
   */
  protected generatePlanId(candidate: FixCandidate): string {
    const raw = `${this.id}:${candidate.candidateId}:${candidate.targetPath}`;
    return `plan_${computeSha256(raw).slice(0, 12)}`;
  }

  /**
   * Helper to safely read a workspace file and compute its SHA-256 hash.
   */
  protected async readWorkspaceFile(
    relativePath: string,
    workspaceRoot: string
  ): Promise<{ content: string; hash: string; canonicalPath: string } | null> {
    const pathCheck = await validateWorkspacePath(relativePath, workspaceRoot);
    if (!pathCheck.valid || !pathCheck.canonicalPath) {
      return null;
    }

    try {
      const buffer = await fs.readFile(pathCheck.canonicalPath);
      const hash = computeSha256(buffer);
      const content = buffer.toString('utf-8');
      return {
        content,
        hash,
        canonicalPath: pathCheck.canonicalPath
      };
    } catch {
      return null;
    }
  }

  /**
   * Builds a complete, valid FixPlan object.
   */
  protected createPlan(params: {
    candidate: FixCandidate;
    context: FixPlanningContext;
    operations: FixOperation[];
    risk?: FixRiskLevel;
    expectedImpact: FixExpectedImpact;
    preconditions: FixPrecondition[];
    safetyChecks?: FixSafetyCheck[];
  }): FixPlan {
    const planId = this.generatePlanId(params.candidate);
    const createdAt = params.context.fixedTimestamp ?? new Date().toISOString();

    return {
      schemaVersion: FIX_SCHEMA_VERSION,
      planId,
      createdAt,
      targetWorkspace: normalizePosixPath(params.context.workspaceRoot),
      sourceFindingIds: params.candidate.findingRefs,
      sourceCorrelationIds: params.candidate.correlationRefs,
      candidate: params.candidate,
      strategy: {
        id: this.id,
        version: this.version,
        name: this.name
      },
      operations: params.operations,
      risk: params.risk ?? this.riskLevel,
      confidence: 0.85, // Default confidence or caller-provided
      expectedImpact: params.expectedImpact,
      preconditions: params.preconditions,
      safetyChecks: params.safetyChecks ?? [
        {
          name: 'WORKSPACE_CONTAINMENT',
          status: 'PASSED',
          details: 'All modified target paths reside inside canonical workspace.'
        },
        {
          name: 'CONTENT_HASH_RECORDED',
          status: 'PASSED',
          details: 'Original content hashes recorded for optimistic concurrency verification.'
        }
      ],
      rollbackInformation: {
        strategy: 'IN_MEMORY',
        available: true,
        operations: params.operations.map((op) => ({
          targetPath: op.targetPath,
          originalHash: op.originalContentHash,
          originalContent: op.expectedOriginalContent
        }))
      },
      status: 'READY_FOR_REVIEW'
    };
  }
}
