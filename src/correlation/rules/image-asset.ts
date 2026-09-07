/**
 * Correlation Rule: Image Asset Correlation (CORR_IMAGE_ASSET)
 *
 * Correlates image-related findings (LCP_CRITICAL, LCP_SLOW, LARGE_IMAGE, IMAGE_OPTIMIZATION_OPPORTUNITY)
 * with scanned codebase image assets, active routes, and Lighthouse element audits.
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
import { matchRoute } from '../matching/routeMatcher.js';
import { normalizeUrl } from '../matching/urlMatcher.js';
import { CONFIDENCE_WEIGHTS, calculateConfidence, resolveCorrelationStatus } from '../confidence.js';

const RELEVANT_FINDING_IDS = new Set([
  'LCP_CRITICAL',
  'LCP_SLOW',
  'LARGE_IMAGE',
  'IMAGE_OPTIMIZATION_OPPORTUNITY'
]);

export const CORR_IMAGE_ASSET_RULE: CorrelationRule = {
  id: 'CORR_IMAGE_ASSET',
  version: '1.0',
  title: 'Image Resource to Codebase Asset Correlation',
  description: 'Correlates browser-observed image bottlenecks with workspace image assets, route context, and element audits.',
  evidenceConsumed: ['images.items', 'audits', 'network.requests'],

  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[] {
    const { evidence, findings, codebase } = context;
    const matches: CorrelationRuleMatch[] = [];

    // Filter relevant findings
    const targetFindings = findings.filter((f) => RELEVANT_FINDING_IDS.has(f.ruleId));
    if (targetFindings.length === 0) {
      return [];
    }

    const targetUrl = evidence.target.url;
    const targetOrigin = normalizeUrl(targetUrl).origin;
    const imageAssets = codebase.assets.filter((a) => a.category === 'image');
    const routeMatch = matchRoute(targetUrl, codebase.routes);

    // Find LCP element audit if present
    const lcpAudit = evidence.audits.find((a) => a.id === 'largest-contentful-paint');
    const lcpFinding = targetFindings.find((f) => f.ruleId === 'LCP_CRITICAL' || f.ruleId === 'LCP_SLOW');

    // 1. Correlate images in evidence.images.items
    for (const img of evidence.images.items) {
      const normImgUrl = normalizeUrl(img.url, targetOrigin);
      const assetMatch = matchResourceToAsset(img.url, targetOrigin, imageAssets);

      // Determine if this image is involved in any finding
      const isLargeImage = img.transferSizeBytes > 500000 || (img.resourceSizeBytes ?? 0) > 500000;
      const hasWastedBytes = (img.wastedBytes ?? 0) > 100000;

      // Check if this image URL was the LCP element
      // Lighthouse LCP audit description or displayValue often references the image or its URL
      const maxImgSize = Math.max(...evidence.images.items.map((i) => i.transferSizeBytes || (i.resourceSizeBytes ?? 0)));
      const isLcpImage = lcpFinding && (
        (lcpAudit?.description && lcpAudit.description.includes(normImgUrl.filename)) ||
        (lcpAudit?.displayValue && lcpAudit.displayValue.includes(normImgUrl.filename)) ||
        // If there's an LCP finding and this is the largest image on page
        (isLargeImage && evidence.images.items.length > 0 && (img.transferSizeBytes || (img.resourceSizeBytes ?? 0)) === maxImgSize)
      );

      if (!isLargeImage && !hasWastedBytes && !isLcpImage) {
        // Image did not trigger performance concerns
        continue;
      }

      // Associate relevant finding IDs
      const associatedFindingIds: string[] = [];
      for (const f of targetFindings) {
        if ((f.ruleId === 'LCP_CRITICAL' || f.ruleId === 'LCP_SLOW') && isLcpImage) {
          associatedFindingIds.push(f.id);
        } else if (f.ruleId === 'LARGE_IMAGE' && isLargeImage) {
          associatedFindingIds.push(f.id);
        } else if (f.ruleId === 'IMAGE_OPTIMIZATION_OPPORTUNITY' && hasWastedBytes) {
          associatedFindingIds.push(f.id);
        }
      }

      if (associatedFindingIds.length === 0) {
        continue;
      }

      // Build signals
      const signals: ConfidenceSignal[] = [];
      const links: EvidenceLink[] = [];
      const supporting: string[] = [];
      const contradicting: string[] = [];
      const missing: string[] = [];

      supporting.push(`Browser loaded image resource '${normImgUrl.filename}' (${(img.transferSizeBytes / 1024).toFixed(1)} KB).`);

      links.push({
        sourceType: 'image',
        sourceRef: `images[${img.url}]`,
        targetType: 'networkResource',
        targetRef: `network[${img.url}]`,
        relationship: 'NETWORK_TRANSFER',
        strength: 'strong',
        reason: `Image transferred over network with size ${(img.transferSizeBytes / 1024).toFixed(1)} KB.`
      });

      if (isLcpImage) {
        signals.push(CONFIDENCE_WEIGHTS.LCP_ELEMENT_AUDIT_MATCH);
        supporting.push('Image resource is the Largest Contentful Paint (LCP) visual element.');
        links.push({
          sourceType: 'lighthouseAudit',
          sourceRef: 'audits[largest-contentful-paint]',
          targetType: 'image',
          targetRef: `images[${img.url}]`,
          relationship: 'LCP_ELEMENT_MATCH',
          strength: 'strong',
          reason: 'Lighthouse identified this image as the primary LCP contributor.'
        });
      }

      if (hasWastedBytes) {
        signals.push(CONFIDENCE_WEIGHTS.RELEVANT_AUDIT_MATCH);
        supporting.push(`Lighthouse identified ${(img.wastedBytes! / 1024).toFixed(1)} KB potential compression/format savings.`);
      }

      // Asset matching evaluation
      let targetPath: string | undefined;
      let targetName = normImgUrl.filename;
      let isExternalOrUnresolved = false;

      if (assetMatch.matchType === 'exact' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.EXACT_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Exact match with workspace asset '${assetMatch.matchedAsset.relativePath}'.`);

        links.push({
          sourceType: 'networkResource',
          sourceRef: `network[${img.url}]`,
          targetType: 'asset',
          targetRef: `assets[${assetMatch.matchedAsset.relativePath}]`,
          relationship: 'RESOURCE_ASSET_MATCH',
          strength: 'strong',
          reason: assetMatch.reason
        });

        // Size corroboration check
        const sizeDelta = Math.abs(assetMatch.matchedAsset.sizeBytes - img.transferSizeBytes);
        const sizeTolerance = assetMatch.matchedAsset.sizeBytes * 0.25; // 25% tolerance for HTTP compression headers
        if (sizeDelta <= sizeTolerance) {
          signals.push(CONFIDENCE_WEIGHTS.METADATA_CORROBORATION);
          supporting.push(`Asset file size on disk (${(assetMatch.matchedAsset.sizeBytes / 1024).toFixed(1)} KB) corresponds to browser transfer size.`);
        }
      } else if (assetMatch.matchType === 'probable' && assetMatch.matchedAsset) {
        signals.push(CONFIDENCE_WEIGHTS.PROBABLE_ASSET_MATCH);
        targetPath = assetMatch.matchedAsset.relativePath;
        targetName = assetMatch.matchedAsset.relativePath;
        supporting.push(`Probable unique filename match with asset '${assetMatch.matchedAsset.relativePath}'.`);
      } else if (assetMatch.matchType === 'ambiguous') {
        signals.push(CONFIDENCE_WEIGHTS.AMBIGUOUS_MATCH_PENALTY);
        contradicting.push(`Ambiguous asset match: multiple files (${assetMatch.candidateAssets.map((a) => a.relativePath).join(', ')}) share this name.`);
      } else {
        // Unmatched local asset
        if (normImgUrl.isExternal) {
          signals.push(CONFIDENCE_WEIGHTS.MISSING_LOCAL_SOURCE_PENALTY);
          missing.push(`Image is hosted externally on '${normImgUrl.origin}'. No local workspace asset exists.`);
          isExternalOrUnresolved = true;
        } else {
          missing.push(`No matching local asset found in scanned workspace for served path '${normImgUrl.pathname}'.`);
        }
      }

      // Route correlation check
      if (routeMatch.matchedRoute && targetPath) {
        if (routeMatch.matchType === 'exact' || routeMatch.matchType === 'root') {
          signals.push(CONFIDENCE_WEIGHTS.EXACT_ROUTE_MATCH);
          supporting.push(`Active URL matched static route '${routeMatch.matchedRoute.path}' (${routeMatch.matchedRoute.sourceFile}).`);
          links.push({
            sourceType: 'route',
            sourceRef: `routes[${routeMatch.matchedRoute.path}]`,
            targetType: 'asset',
            targetRef: `assets[${targetPath}]`,
            relationship: 'ROUTE_ASSET_ASSOCIATION',
            strength: 'moderate',
            reason: `Asset is loaded in the context of route '${routeMatch.matchedRoute.path}'.`
          });
        } else if (routeMatch.matchType === 'dynamic') {
          signals.push(CONFIDENCE_WEIGHTS.DYNAMIC_ROUTE_MATCH);
          supporting.push(`Active URL matched dynamic route '${routeMatch.matchedRoute.path}' (${routeMatch.matchedRoute.sourceFile}).`);
        }
      }

      // Check for contradicting evidence: cached transfer or zero size
      if (img.transferSizeBytes === 0 || (img.resourceSizeBytes && img.resourceSizeBytes > 0 && img.transferSizeBytes < 5000)) {
        signals.push(CONFIDENCE_WEIGHTS.CONTRADICTING_CACHED_TRANSFER);
        contradicting.push('Image resource was served from cache or transfer size was negligible, weakening network transfer bottleneck attribution.');
      }

      // Corroborating multiple signals bonus
      const distinctCategories = new Set(links.map((l) => l.sourceType));
      if (distinctCategories.size >= 2) {
        signals.push(CONFIDENCE_WEIGHTS.MULTIPLE_INDEPENDENT_SIGNALS);
        supporting.push('Multiple independent evidence sources (network, audits, assets) corroborate this contributor.');
      }

      const confidence = calculateConfidence(signals);
      const { status, level } = resolveCorrelationStatus(confidence, isExternalOrUnresolved);

      const candidateId = `candidate:image:${targetPath ?? normImgUrl.filename}`;
      const candidate: CandidateContributor = {
        id: candidateId,
        targetPath,
        targetType: targetPath ? 'asset' : (normImgUrl.isExternal ? 'external_resource' : 'unknown'),
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
          ? `The image asset '${targetName}' is identified as a ${status.toLowerCase().replace(/_/g, ' ')} contributor because browser telemetry recorded ${(img.transferSizeBytes / 1024).toFixed(1)} KB transfer, matching local asset '${targetPath}'${isLcpImage ? ' as the primary LCP element' : ''}.`
          : `External or unmapped image resource '${targetName}' contributed to network transfer, but cannot be tied to a local codebase asset.`,
        nextInvestigation: targetPath
          ? `Verify whether '${targetPath}' can be compressed, converted to modern formats (WebP/AVIF), responsive-sized, or preloaded.`
          : `Investigate external image hosting at '${normImgUrl.origin ?? normImgUrl.raw}'.`
      };

      // Create assessment if LCP finding is linked
      let assessment: RootCauseAssessment | undefined;
      if (isLcpImage && lcpFinding) {
        assessment = {
          id: `assessment:${lcpFinding.id}`,
          findingId: lcpFinding.id,
          status,
          assessmentLevel: level,
          topCandidateId: candidateId,
          candidateIds: [candidateId],
          confidence,
          summary: `LCP delay is attributed to image asset '${targetName}' based on empirical element audit and asset match.`,
          primaryBottleneckType: 'image_payload',
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
