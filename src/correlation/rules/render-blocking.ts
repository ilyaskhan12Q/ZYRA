/**
 * Correlation Rule: Render-Blocking Resources (CORR_RENDER_BLOCKING)
 *
 * Correlates render-blocking findings (RENDER_BLOCKING_RESOURCE, FCP_SLOW, FCP_CRITICAL)
 * with scanned stylesheets, scripts, entry points, and workspace assets.
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

export const CORR_RENDER_BLOCKING_RULE: CorrelationRule = {
  id: 'CORR_RENDER_BLOCKING',
  version: '1.0',
  title: 'Render-Blocking Resources to Codebase Correlation',
  description: 'Correlates browser-identified render-blocking stylesheets and scripts with workspace assets and entry points.',
  evidenceConsumed: ['audits', 'network.requests'],

  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[] {
    const { evidence, findings, codebase } = context;
    const matches: CorrelationRuleMatch[] = [];

    const rbFinding = findings.find((f) => f.ruleId === 'RENDER_BLOCKING_RESOURCE');
    const fcpFinding = findings.find((f) => f.ruleId === 'FCP_SLOW' || f.ruleId === 'FCP_CRITICAL');

    if (!rbFinding && !fcpFinding) {
      return [];
    }

    const rbAudit = evidence.audits.find((a) => a.id === 'render-blocking-resources');
    if (!rbAudit || (rbAudit.score === 1 && (rbAudit.numericValue ?? 0) === 0)) {
      return [];
    }

    const targetUrl = evidence.target.url;
    const targetOrigin = normalizeUrl(targetUrl).origin;
    const candidateAssets = codebase.assets.filter(
      (a) => a.category === 'stylesheet' || a.category === 'script' || a.extension === '.css' || a.extension === '.js'
    );

    // Look for network requests that are stylesheets or scripts with high priority
    const renderBlockingRequests = evidence.network.requests.filter((r) => {
      const isCssOrJs = r.resourceType === 'Stylesheet' || r.resourceType === 'Script' || r.url.endsWith('.css') || r.url.endsWith('.js');
      const isHighPriority = r.priority === 'VeryHigh' || r.priority === 'High';
      return isCssOrJs && isHighPriority;
    });

    const candidateUrls = renderBlockingRequests.length > 0
      ? renderBlockingRequests.map((r) => r.url)
      : (rbAudit.displayValue ? [rbAudit.displayValue] : []);

    for (const resUrl of candidateUrls) {
      const normUrl = normalizeUrl(resUrl, targetOrigin);
      const assetMatch = matchResourceToAsset(resUrl, targetOrigin, candidateAssets);

      const signals: ConfidenceSignal[] = [CONFIDENCE_WEIGHTS.RELEVANT_AUDIT_MATCH];
      const links: EvidenceLink[] = [];
      const supporting: string[] = [];
      const contradicting: string[] = [];
      const missing: string[] = [];

      supporting.push(`Lighthouse identified '${normUrl.filename}' as render-blocking.`);

      links.push({
        sourceType: 'lighthouseAudit',
        sourceRef: 'audits[render-blocking-resources]',
        targetType: 'networkResource',
        targetRef: `network[${resUrl}]`,
        relationship: 'RENDER_BLOCKING_IDENTIFIED',
        strength: 'strong',
        reason: 'Lighthouse audit flagged this resource as delaying First Contentful Paint.'
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
          sourceRef: `network[${resUrl}]`,
          targetType: 'asset',
          targetRef: `assets[${assetMatch.matchedAsset.relativePath}]`,
          relationship: 'RENDER_BLOCKING_ASSET_MATCH',
          strength: 'strong',
          reason: assetMatch.reason
        });
      } else if (assetMatch.matchType === 'probable' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.PROBABLE_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Probable filename match with workspace asset '${assetMatch.matchedAsset.relativePath}'.`);
      } else {
        if (normUrl.isExternal) {
          signals.push(CONFIDENCE_WEIGHTS.MISSING_LOCAL_SOURCE_PENALTY);
          missing.push(`Render-blocking resource is hosted on external domain '${normUrl.origin}'. No local source exists.`);
          isExternalOrUnresolved = true;
        } else {
          missing.push(`Local render-blocking resource '${normUrl.pathname}' could not be matched to an unbundled source file.`);
        }
      }

      // Check entry points
      for (const ep of codebase.entryPoints) {
        if (normUrl.filename.toLowerCase().includes('entry') || normUrl.filename.toLowerCase().includes('main') || normUrl.filename.toLowerCase().includes('app')) {
          signals.push(CONFIDENCE_WEIGHTS.ENTRY_POINT_RELATIONSHIP);
          supporting.push(`Resource associates with root entry point '${ep.path}'.`);
          break;
        }
      }

      const findingIds = [
        ...(rbFinding ? [rbFinding.id] : []),
        ...(fcpFinding ? [fcpFinding.id] : [])
      ];

      const confidence = calculateConfidence(signals);
      const { status, level } = resolveCorrelationStatus(confidence, isExternalOrUnresolved);

      const candidateId = `candidate:render_blocking:${targetPath ?? normUrl.filename}`;
      const candidate: CandidateContributor = {
        id: candidateId,
        targetPath,
        targetType: targetPath ? 'asset' : (normUrl.isExternal ? 'external_resource' : 'unknown'),
        targetName,
        findingIds,
        status,
        assessmentLevel: level,
        confidence,
        links,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing,
        reasoning: targetPath
          ? `Render-blocking delay is ${status.toLowerCase().replace(/_/g, ' ')} by '${targetName}', which blocks early painting.`
          : `External or unmapped render-blocking resource '${targetName}' blocks early painting.`,
        nextInvestigation: targetPath
          ? `Investigate inlining critical CSS, deferring non-critical scripts, or loading stylesheets asynchronously.`
          : `Audit external tag managers or stylesheets loaded in document <head>.`
      };

      const assessmentFinding = rbFinding ?? fcpFinding;
      let assessment: RootCauseAssessment | undefined;
      if (assessmentFinding) {
        assessment = {
          id: `assessment:${assessmentFinding.id}`,
          findingId: assessmentFinding.id,
          status,
          assessmentLevel: level,
          topCandidateId: candidateId,
          candidateIds: [candidateId],
          confidence,
          summary: `Render-blocking condition attributed to '${targetName}'.`,
          primaryBottleneckType: 'render_blocking',
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
