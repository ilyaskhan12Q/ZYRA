/**
 * Correlation Rule: Route & Entry Point Context Correlation (CORR_ROUTE_ENTRY)
 *
 * Establishes active route and application entry-point context as supporting evidence.
 *
 * Strict Invariant: Never concludes that an entry point or route file is a root cause
 * solely because it exists.
 */

import {
  type CorrelationRule,
  type CorrelationRuleContext,
  type CorrelationRuleMatch,
  type CandidateContributor,
  type EvidenceLink,
  type ConfidenceSignal
} from '../types.js';
import { matchRoute } from '../matching/routeMatcher.js';
import { normalizeUrl } from '../matching/urlMatcher.js';
import { CONFIDENCE_WEIGHTS, calculateConfidence, resolveCorrelationStatus } from '../confidence.js';

export const CORR_ROUTE_ENTRY_RULE: CorrelationRule = {
  id: 'CORR_ROUTE_ENTRY',
  version: '1.0',
  title: 'Route & Entry Point Context Correlation',
  description: 'Correlates browser target URL with detected application routes and root entry points as supporting evidence.',
  evidenceConsumed: ['target.url'],

  evaluate(context: CorrelationRuleContext): CorrelationRuleMatch[] {
    const { evidence, findings, codebase } = context;
    const matches: CorrelationRuleMatch[] = [];

    if (codebase.routes.length === 0 && codebase.entryPoints.length === 0) {
      return [];
    }

    const targetUrl = evidence.target.url;
    const norm = normalizeUrl(targetUrl);
    const routeMatch = matchRoute(targetUrl, codebase.routes);

    if (routeMatch.matchedRoute) {
      const route = routeMatch.matchedRoute;
      const signals: ConfidenceSignal[] = [];
      const links: EvidenceLink[] = [];
      const supporting: string[] = [];
      const contradicting: string[] = [];
      const missing: string[] = [];

      supporting.push(`Target URL path '${norm.pathname}' matched route declaration '${route.path}' (${route.sourceFile}).`);

      if (routeMatch.matchType === 'exact' || routeMatch.matchType === 'root') {
        signals.push(CONFIDENCE_WEIGHTS.EXACT_ROUTE_MATCH);
      } else if (routeMatch.matchType === 'dynamic') {
        signals.push(CONFIDENCE_WEIGHTS.DYNAMIC_ROUTE_MATCH);
      }

      links.push({
        sourceType: 'route',
        sourceRef: `target[${targetUrl}]`,
        targetType: 'route',
        targetRef: `routes[${route.path}]`,
        relationship: routeMatch.matchType === 'dynamic' ? 'DYNAMIC_ROUTE_MATCH' : 'STATIC_ROUTE_MATCH',
        strength: 'strong',
        reason: routeMatch.reason
      });

      // Link to root entry points if available
      for (const ep of codebase.entryPoints) {
        signals.push(CONFIDENCE_WEIGHTS.ENTRY_POINT_RELATIONSHIP);
        supporting.push(`Associated with application entry point '${ep.path}'.`);
        links.push({
          sourceType: 'route',
          sourceRef: `routes[${route.path}]`,
          targetType: 'entryPoint',
          targetRef: `entryPoints[${ep.path}]`,
          relationship: 'ENTRY_POINT_HIERARCHY',
          strength: 'moderate',
          reason: `Route renders within hierarchy of entry point '${ep.path}'.`
        });
      }

      // Explicitly note that route existence is supporting context, not causal fault
      contradicting.push('Route file presence is structural context only; it does not constitute proof of performance degradation.');

      const confidence = calculateConfidence(signals);
      const { status, level } = resolveCorrelationStatus(confidence, false);

      const candidateId = `candidate:route:${route.sourceFile}`;
      const candidate: CandidateContributor = {
        id: candidateId,
        targetPath: route.sourceFile,
        targetType: 'route',
        targetName: route.sourceFile,
        findingIds: findings.slice(0, 3).map((f) => f.id), // Context for top findings
        status: status === 'STRONGLY_SUPPORTED' ? 'SUPPORTED_CONTRIBUTOR' : status, // Conservatively capped
        assessmentLevel: level === 'STRONGLY_SUPPORTED_CONTRIBUTOR' ? 'SUPPORTED_CONTRIBUTOR' : level,
        confidence,
        links,
        supportingEvidence: supporting,
        contradictingEvidence: contradicting,
        missingEvidence: missing,
        reasoning: `The route file '${route.sourceFile}' is the verified entry route for '${norm.pathname}'. This is supporting context for the page lifecycle.`,
        nextInvestigation: `Inspect component imports and server-side data fetching inside '${route.sourceFile}'.`
      };

      matches.push({ candidate });
    }

    return matches;
  }
};
