/**
 * Correlation Rule: Large Resource to Asset Correlation (CORR_RESOURCE_ASSET)
 *
 * Correlates large network payload findings (LARGE_RESOURCE) with scanned workspace assets.
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
import { matchResourceToAsset } from '../matching/assetMatcher.js';
import { normalizeUrl } from '../matching/urlMatcher.js';
import { CONFIDENCE_WEIGHTS, calculateConfidence, resolveCorrelationStatus } from '../confidence.js';

export const CORR_RESOURCE_ASSET_RULE: CorrelationRule = {
  id: 'CORR_RESOURCE_ASSET',
  version: '1.0',
  title: 'Network Resource to Codebase Asset Correlation',
  description: 'Correlates generic large network payloads with workspace static assets and media files.',
  evidenceConsumed: ['resources.items', 'network.requests'],

  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[] {
    const { evidence, findings, codebase } = context;
    const matches: CorrelationRuleMatch[] = [];

    const lrFinding = findings.find((f) => f.ruleId === 'LARGE_RESOURCE');
    if (!lrFinding) {
      return [];
    }

    const targetUrl = evidence.target.url;
    const targetOrigin = normalizeUrl(targetUrl).origin;

    // Filter large network requests (> 500 KB)
    const largeRequests = evidence.network.requests.filter((r) => r.transferSizeBytes > 500000);

    for (const req of largeRequests) {
      const normUrl = normalizeUrl(req.url, targetOrigin);
      const assetMatch = matchResourceToAsset(req.url, targetOrigin, codebase.assets);

      const signals: ConfidenceSignal[] = [];
      const links: EvidenceLink[] = [];
      const supporting: string[] = [];
      const contradicting: string[] = [];
      const missing: string[] = [];

      supporting.push(`Network payload '${normUrl.filename}' transferred ${(req.transferSizeBytes / 1024).toFixed(1)} KB.`);

      links.push({
        sourceType: 'networkResource',
        sourceRef: `network[${req.url}]`,
        targetType: 'networkResource',
        targetRef: `network[${req.url}]`,
        relationship: 'LARGE_PAYLOAD_TRANSFER',
        strength: 'strong',
        reason: `Single network request transfer size (${(req.transferSizeBytes / 1024).toFixed(1)} KB) exceeded 500 KB threshold.`
      });

      let targetPath: string | undefined;
      let targetName = normUrl.filename;
      let isExternalOrUnresolved = false;

      if (assetMatch.matchType === 'exact' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Exact match with workspace asset '${assetMatch.matchedAsset.relativePath}'.`);

        links.push({
          sourceType: 'networkResource',
          sourceRef: `network[${req.url}]`,
          targetType: 'asset',
          targetRef: `assets[${assetMatch.matchedAsset.relativePath}]`,
          relationship: 'RESOURCE_ASSET_MATCH',
          strength: 'strong',
          reason: assetMatch.reason
        });

        const sizeDelta = Math.abs(assetMatch.matchedAsset.sizeBytes - req.transferSizeBytes);
        if (sizeDelta <= assetMatch.matchedAsset.sizeBytes * 0.25) {
          signals.push(CONFIDENCE_WEIGHTS.METADATA_CORROBORATION);
          supporting.push(`Asset file size on disk (${(assetMatch.matchedAsset.sizeBytes / 1024).toFixed(1)} KB) corresponds to transfer size.`);
        }
      } else if (assetMatch.matchType === 'probable' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.PROBABLE_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Probable filename match with workspace asset '${assetMatch.matchedAsset.relativePath}'.`);
      } else if (assetMatch.matchType === 'ambiguous') {
        signals.push(CONFIDENCE_WEIGHTS.AMBIGUOUS_MATCH_PENALTY);
        contradicting.push(`Multiple files (${assetMatch.candidateAssets.map((a) => a.relativePath).join(', ')}) share this name.`);
      } else {
        if (normUrl.isExternal) {
          signals.push(CONFIDENCE_WEIGHTS.MISSING_LOCAL_SOURCE_PENALTY);
          missing.push(`Large resource is hosted on external domain '${normUrl.origin}'. No local workspace asset exists.`);
          isExternalOrUnresolved = true;
        } else {
          missing.push(`No matching local asset found in scanned workspace for path '${normUrl.pathname}'.`);
        }
      }

      if (links.length >= 2) {
        signals.push(CONFIDENCE_WEIGHTS.MULTIPLE_INDEPENDENT_SIGNALS);
      }

      const confidence = calculateConfidence(signals);
      const { status, level } = resolveCorrelationStatus(confidence, isExternalOrUnresolved);

      const candidateId = `candidate:resource:${targetPath ?? normUrl.filename}`;
      const candidate: CandidateContributor = {
        id: candidateId,
        targetPath,
        targetType: targetPath ? 'asset' : (normUrl.isExternal ? 'external_resource' : 'unknown'),
        targetName,
        findingIds: [lrFinding.id],
        status,
        assessmentLevel: level,
        confidence,
        links,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing,
        reasoning: targetPath
          ? `Resource '${targetName}' is a ${status.toLowerCase().replace(/_/g, ' ')} contributor to network payload overhead, matching '${targetPath}'.`
          : `External or unmapped resource '${targetName}' exceeded payload budget without a local codebase counterpart.`,
        nextInvestigation: targetPath
          ? `Inspect compression, lazy-loading, or chunk splitting for '${targetPath}'.`
          : `Evaluate reducing or caching external resource '${normUrl.raw}'.`
      };

      const assessment: RootCauseAssessment = {
        id: `assessment:${lrFinding.id}`,
        findingId: lrFinding.id,
        status,
        assessmentLevel: level,
        topCandidateId: candidateId,
        candidateIds: [candidateId],
        confidence,
        summary: `Large resource payload finding attributed to '${targetName}'.`,
        primaryBottleneckType: 'unclassified',
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing
      };

      matches.push({ candidate, assessment });
    }

    return matches;
  }
};
