/**
 * Correlation Rule: Script to Import & Dependency Correlation (CORR_SCRIPT_IMPORT)
 *
 * Correlates JavaScript bottlenecks (UNUSED_JS_HIGH, LONG_TASK, TBT_HIGH, TBT_CRITICAL)
 * with scanned scripts, imports, entry points, and dependencies.
 *
 * Strict Invariant: Never blames React, dependencies, or App.tsx without direct empirical evidence.
 */

import {
  type CorrelationRule,
  type CorrelationRuleContext,
  type CorrelationRuleMatch,
  type CandidateContributor,
  type RootCauseAssessment,
  type EvidenceLink,
  type ConfidenceSignal
} from '../types.js';
import { matchScriptToCodebase } from '../matching/scriptMatcher.js';
import { normalizeUrl } from '../matching/urlMatcher.js';
import { CONFIDENCE_WEIGHTS, calculateConfidence, resolveCorrelationStatus } from '../confidence.js';

const SCRIPT_FINDING_IDS = new Set([
  'UNUSED_JS_HIGH',
  'LONG_TASK',
  'TBT_HIGH',
  'TBT_CRITICAL'
]);

export const CORR_SCRIPT_IMPORT_RULE: CorrelationRule = {
  id: 'CORR_SCRIPT_IMPORT',
  version: '1.0',
  title: 'JavaScript Resource to Codebase & Dependency Correlation',
  description: 'Correlates browser-observed JavaScript execution and unused bytes with entry points, imports, and dependencies.',
  evidenceConsumed: ['scripts.items', 'scripts.longTasks', 'network.requests'],

  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[] {
    const { evidence, findings, codebase } = context;
    const matches: CorrelationRuleMatch[] = [];

    const targetFindings = findings.filter((f) => SCRIPT_FINDING_IDS.has(f.ruleId));
    if (targetFindings.length === 0) {
      return [];
    }

    const targetUrl = evidence.target.url;
    const targetOrigin = normalizeUrl(targetUrl).origin;

    const unusedJsFinding = targetFindings.find((f) => f.ruleId === 'UNUSED_JS_HIGH');
    const tbtFinding = targetFindings.find((f) => f.ruleId === 'TBT_CRITICAL' || f.ruleId === 'TBT_HIGH');
    const longTaskFinding = targetFindings.find((f) => f.ruleId === 'LONG_TASK');

    // 1. Evaluate scripts with large unused bytes or large payloads
    for (const script of evidence.scripts.items) {
      const hasUnusedJs = (script.unusedBytes ?? 0) > 100000;
      const isLargeScript = script.transferSizeBytes > 250000;

      if (!hasUnusedJs && !isLargeScript && !tbtFinding && !longTaskFinding) {
        continue;
      }

      const scriptMatch = matchScriptToCodebase(script.url, targetOrigin, codebase);
      const normUrl = normalizeUrl(script.url, targetOrigin);

      const associatedFindingIds: string[] = [];
      if (hasUnusedJs && unusedJsFinding) {
        associatedFindingIds.push(unusedJsFinding.id);
      }
      if (isLargeScript && (tbtFinding || longTaskFinding)) {
        if (tbtFinding) associatedFindingIds.push(tbtFinding.id);
        if (longTaskFinding) associatedFindingIds.push(longTaskFinding.id);
      }

      if (associatedFindingIds.length === 0) {
        continue;
      }

      const signals: ConfidenceSignal[] = [];
      const links: EvidenceLink[] = [];
      const supporting: string[] = [];
      const contradicting: string[] = [];
      const missing: string[] = [];

      supporting.push(`Browser loaded script '${normUrl.filename}' (${(script.transferSizeBytes / 1024).toFixed(1)} KB).`);

      links.push({
        sourceType: 'script',
        sourceRef: `scripts[${script.url}]`,
        targetType: 'networkResource',
        targetRef: `network[${script.url}]`,
        relationship: 'SCRIPT_TRANSFER',
        strength: 'strong',
        reason: `Script transferred ${(script.transferSizeBytes / 1024).toFixed(1)} KB.`
      });

      if (hasUnusedJs) {
        signals.push(CONFIDENCE_WEIGHTS.RELEVANT_AUDIT_MATCH);
        supporting.push(`Lighthouse identified ${(script.unusedBytes! / 1024).toFixed(1)} KB unused JavaScript in this bundle.`);
      }

      let targetPath: string | undefined;
      let targetName = normUrl.filename;
      let isExternalOrUnresolved = false;

      if (scriptMatch.relationship === 'EXTERNAL_SCRIPT') {
        signals.push(CONFIDENCE_WEIGHTS.MISSING_LOCAL_SOURCE_PENALTY);
        missing.push(scriptMatch.reason);
        targetName = scriptMatch.matchedEntityName ?? normUrl.raw;
        isExternalOrUnresolved = true;
      } else if (scriptMatch.relationship === 'SCRIPT_MATCHED_TO_ASSET') {
        signals.push(CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH);
        targetPath = scriptMatch.targetRef;
        targetName = scriptMatch.matchedEntityName ?? targetPath!;
        supporting.push(scriptMatch.reason);

        links.push({
          sourceType: 'script',
          sourceRef: `scripts[${script.url}]`,
          targetType: 'asset',
          targetRef: `assets[${targetPath}]`,
          relationship: 'SCRIPT_MATCHED_TO_ASSET',
          strength: 'strong',
          reason: scriptMatch.reason
        });
      } else if (scriptMatch.relationship === 'SCRIPT_LOADED_FROM_ENTRY') {
        signals.push(CONFIDENCE_WEIGHTS.ENTRY_POINT_RELATIONSHIP);
        targetPath = scriptMatch.targetRef;
        targetName = scriptMatch.matchedEntityName ?? targetPath!;
        supporting.push(scriptMatch.reason);

        links.push({
          sourceType: 'script',
          sourceRef: `scripts[${script.url}]`,
          targetType: 'entryPoint',
          targetRef: `entryPoints[${targetPath}]`,
          relationship: 'SCRIPT_LOADED_FROM_ENTRY',
          strength: 'moderate',
          reason: scriptMatch.reason
        });

        // If source maps are missing, penalize local bundle attribution certainty
        if (!codebase.configuration.hasSourceMaps) {
          signals.push(CONFIDENCE_WEIGHTS.UNRESOLVED_BUNDLE_PENALTY);
          missing.push('No source maps detected in build configuration; precise component attribution inside bundle is unverified.');
        }
      } else if (scriptMatch.relationship === 'DEPENDENCY_ASSOCIATION') {
        targetName = scriptMatch.matchedEntityName ?? normUrl.filename;
        supporting.push(scriptMatch.reason);

        links.push({
          sourceType: 'script',
          sourceRef: `scripts[${script.url}]`,
          targetType: 'dependency',
          targetRef: `dependencies[${scriptMatch.targetRef}]`,
          relationship: 'DEPENDENCY_ASSOCIATION',
          strength: 'weak',
          reason: scriptMatch.reason
        });

        contradicting.push('Dependency presence is an association only; existence does not prove causal execution bottleneck.');
      } else {
        // UNRESOLVED local bundle
        signals.push(CONFIDENCE_WEIGHTS.UNRESOLVED_BUNDLE_PENALTY);
        missing.push('Local bundle cannot be resolved to individual source files without source maps.');
        isExternalOrUnresolved = true;
      }

      const confidence = calculateConfidence(signals);
      const { status, level } = resolveCorrelationStatus(confidence, isExternalOrUnresolved);

      const candidateId = `candidate:script:${targetPath ?? targetName}`;
      const candidate: CandidateContributor = {
        id: candidateId,
        targetPath,
        targetType: scriptMatch.targetType,
        targetName,
        findingIds: associatedFindingIds,
        status,
        assessmentLevel: level,
        confidence,
        links,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing,
        reasoning: targetPath
          ? `Script '${targetName}' correlates with codebase ${scriptMatch.targetType} '${targetPath}' (${status.toLowerCase().replace(/_/g, ' ')}).`
          : scriptMatch.isExternal
            ? `External third-party script '${targetName}' contributes to JavaScript payload, but has no local codebase source.`
            : `Bundled script '${targetName}' contributes to JavaScript workload, but cannot be mapped to specific source code without source maps.`,
        nextInvestigation: targetPath
          ? `Inspect code-splitting, dynamic imports, or tree-shaking opportunities for '${targetPath}'.`
          : scriptMatch.isExternal
            ? `Evaluate necessity of third-party script '${targetName}' or defer its execution.`
            : `Enable source maps in build configuration to trace bundle execution to specific source modules.`
      };

      // Produce assessment if unused JS or TBT finding is linked
      const primaryFinding = unusedJsFinding ?? tbtFinding ?? longTaskFinding;
      let assessment: RootCauseAssessment | undefined;
      if (primaryFinding && associatedFindingIds.includes(primaryFinding.id)) {
        assessment = {
          id: `assessment:${primaryFinding.id}`,
          findingId: primaryFinding.id,
          status,
          assessmentLevel: level,
          topCandidateId: candidateId,
          candidateIds: [candidateId],
          confidence,
          summary: `JavaScript bottleneck associated with '${targetName}'.`,
          primaryBottleneckType: 'script_payload',
          supportingEvidence: supporting,
          contradictingEvidence: contradicting,
          missingEvidence: missing
        };
      }

      matches.push({ candidate, assessment });
    }

    return matches;
  }
};
