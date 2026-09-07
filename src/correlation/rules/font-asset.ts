/**
 * Correlation Rule: Font Asset Correlation (CORR_FONT_ASSET)
 *
 * Correlates font-related findings (FONT_RESOURCE_LARGE) with scanned codebase font assets
 * and external font providers.
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

export const CORR_FONT_ASSET_RULE: CorrelationRule = {
  id: 'CORR_FONT_ASSET',
  version: '1.0',
  title: 'Font Resource to Codebase Asset Correlation',
  description: 'Correlates browser-observed font transfers with workspace font assets and font service providers.',
  evidenceConsumed: ['fonts.items', 'network.requests'],

  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[] {
    const { evidence, findings, codebase } = context;
    const matches: CorrelationRuleMatch[] = [];

    const fontFinding = findings.find((f) => f.ruleId === 'FONT_RESOURCE_LARGE');
    if (!fontFinding) {
      return [];
    }

    const targetUrl = evidence.target.url;
    const targetOrigin = normalizeUrl(targetUrl).origin;
    const fontAssets = codebase.assets.filter((a) => a.category === 'font');

    for (const font of evidence.fonts.items) {
      // Rule threshold for large font is 100 KB
      if (font.transferSizeBytes <= 100000) {
        continue;
      }

      const normUrl = normalizeUrl(font.url, targetOrigin);
      const assetMatch = matchResourceToAsset(font.url, targetOrigin, fontAssets);

      const signals: ConfidenceSignal[] = [];
      const links: EvidenceLink[] = [];
      const supporting: string[] = [];
      const contradicting: string[] = [];
      const missing: string[] = [];

      supporting.push(`Browser transferred font resource '${normUrl.filename}' (${(font.transferSizeBytes / 1024).toFixed(1)} KB).`);

      links.push({
        sourceType: 'font',
        sourceRef: `fonts[${font.url}]`,
        targetType: 'networkResource',
        targetRef: `network[${font.url}]`,
        relationship: 'FONT_NETWORK_TRANSFER',
        strength: 'strong',
        reason: `Font resource transferred ${(font.transferSizeBytes / 1024).toFixed(1)} KB over network.`
      });

      let targetPath: string | undefined;
      let targetName = normUrl.filename;
      let isExternalOrUnresolved = false;

      if (assetMatch.matchType === 'exact' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Exact match with workspace font asset '${assetMatch.matchedAsset.relativePath}'.`);

        links.push({
          sourceType: 'networkResource',
          sourceRef: `network[${font.url}]`,
          targetType: 'asset',
          targetRef: `assets[${assetMatch.matchedAsset.relativePath}]`,
          relationship: 'FONT_ASSET_MATCH',
          strength: 'strong',
          reason: assetMatch.reason
        });

        const sizeDelta = Math.abs(assetMatch.matchedAsset.sizeBytes - font.transferSizeBytes);
        if (sizeDelta <= assetMatch.matchedAsset.sizeBytes * 0.25) {
          signals.push(CONFIDENCE_WEIGHTS.METADATA_CORROBORATION);
          supporting.push(`Font file size on disk (${(assetMatch.matchedAsset.sizeBytes / 1024).toFixed(1)} KB) corresponds to transfer size.`);
        }
      } else if (assetMatch.matchType === 'probable' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.PROBABLE_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Probable filename match with workspace font asset '${assetMatch.matchedAsset.relativePath}'.`);
      } else if (assetMatch.matchType === 'ambiguous') {
        signals.push(CONFIDENCE_WEIGHTS.AMBIGUOUS_MATCH_PENALTY);
        contradicting.push(`Multiple font files (${assetMatch.candidateAssets.map((a) => a.relativePath).join(', ')}) match this name.`);
      } else {
        if (normUrl.isExternal) {
          signals.push(CONFIDENCE_WEIGHTS.MISSING_LOCAL_SOURCE_PENALTY);
          missing.push(`Font is hosted on external provider '${normUrl.origin}'. No local font file exists.`);
          isExternalOrUnresolved = true;
        } else {
          missing.push(`No matching font asset found in scanned workspace for path '${normUrl.pathname}'.`);
        }
      }

      // Check cache / 0 byte transfer
      if (font.transferSizeBytes === 0) {
        signals.push(CONFIDENCE_WEIGHTS.CONTRADICTING_CACHED_TRANSFER);
        contradicting.push('Font was loaded from browser cache (0 bytes transferred).');
      }

      if (links.length >= 2) {
        signals.push(CONFIDENCE_WEIGHTS.MULTIPLE_INDEPENDENT_SIGNALS);
      }

      const confidence = calculateConfidence(signals);
      const { status, level } = resolveCorrelationStatus(confidence, isExternalOrUnresolved);

      const candidateId = `candidate:font:${targetPath ?? normUrl.filename}`;
      const candidate: CandidateContributor = {
        id: candidateId,
        targetPath,
        targetType: targetPath ? 'asset' : (normUrl.isExternal ? 'external_resource' : 'unknown'),
        targetName,
        findingIds: [fontFinding.id],
        status,
        assessmentLevel: level,
        confidence,
        links,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing,
        reasoning: targetPath
          ? `The font asset '${targetName}' is identified as a ${status.toLowerCase().replace(/_/g, ' ')} contributor because its ${(font.transferSizeBytes / 1024).toFixed(1)} KB transfer exceeded font budget, matching '${targetPath}'.`
          : `External font resource '${targetName}' on '${normUrl.origin ?? normUrl.raw}' exceeded transfer budget, but has no local file representation.`,
        nextInvestigation: targetPath
          ? `Review font subsetting, WOFF2 compression, or unicode-range declarations for '${targetPath}'.`
          : `Evaluate self-hosting the font or using font-display: swap.`
      };

      const assessment: RootCauseAssessment = {
        id: `assessment:${fontFinding.id}`,
        findingId: fontFinding.id,
        status,
        assessmentLevel: level,
        topCandidateId: candidateId,
        candidateIds: [candidateId],
        confidence,
        summary: `Large font payload finding attributed to font resource '${targetName}'.`,
        primaryBottleneckType: 'font_payload',
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing
      };

      matches.push({ candidate, assessment });
    }

    return matches;
  }
};
