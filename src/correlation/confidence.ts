/**
 * ZYRA Deterministic Confidence Model & Status Calculator
 */

import {
  type Confidence,
  type ConfidenceSignal,
  type CorrelationStatus,
  type AssessmentLevel
} from './types.js';

export const CONFIDENCE_WEIGHTS = {
  // Positive signals
  EXACT_ASSET_MATCH: {
    weight: 0.35,
    name: 'EXACT_ASSET_MATCH',
    description: 'Exact path match between network resource URL and scanned workspace asset.'
  },
  PROBABLE_ASSET_MATCH: {
    weight: 0.20,
    name: 'PROBABLE_ASSET_MATCH',
    description: 'Unique filename and extension match in workspace despite differing folder path.'
  },
  LCP_ELEMENT_AUDIT_MATCH: {
    weight: 0.25,
    name: 'LCP_ELEMENT_AUDIT_MATCH',
    description: 'Lighthouse largest-contentful-paint audit explicitly cited this resource.'
  },
  RELEVANT_AUDIT_MATCH: {
    weight: 0.15,
    name: 'RELEVANT_AUDIT_MATCH',
    description: 'Lighthouse diagnostic audit (render-blocking, unused code, compression) cited this resource.'
  },
  EXACT_ROUTE_MATCH: {
    weight: 0.20,
    name: 'EXACT_ROUTE_MATCH',
    description: 'Target browser URL path exactly matches a declared static route.'
  },
  DYNAMIC_ROUTE_MATCH: {
    weight: 0.15,
    name: 'DYNAMIC_ROUTE_MATCH',
    description: 'Target browser URL path matches a declared framework dynamic route pattern.'
  },
  METADATA_CORROBORATION: {
    weight: 0.10,
    name: 'METADATA_CORROBORATION',
    description: 'Resource transfer size corresponds to local asset size on disk.'
  },
  ENTRY_POINT_RELATIONSHIP: {
    weight: 0.10,
    name: 'ENTRY_POINT_RELATIONSHIP',
    description: 'Resource correlates with application root layout or client entry point.'
  },
  MULTIPLE_INDEPENDENT_SIGNALS: {
    weight: 0.10,
    name: 'MULTIPLE_INDEPENDENT_SIGNALS',
    description: 'Multiple independent evidence categories (audits, assets, routes) corroborate the candidate.'
  },

  // Negative / Contradicting / Missing signals
  CONTRADICTING_CACHED_TRANSFER: {
    weight: -0.25,
    name: 'CONTRADICTING_CACHED_TRANSFER',
    description: 'Resource was cached or had negligible transfer size despite payload finding.'
  },
  AMBIGUOUS_MATCH_PENALTY: {
    weight: -0.30,
    name: 'AMBIGUOUS_MATCH_PENALTY',
    description: 'Multiple conflicting files share the same name, creating attribution ambiguity.'
  },
  UNRESOLVED_BUNDLE_PENALTY: {
    weight: -0.35,
    name: 'UNRESOLVED_BUNDLE_PENALTY',
    description: 'Bundled script cannot be mapped to specific source code without source maps.'
  },
  MISSING_LOCAL_SOURCE_PENALTY: {
    weight: -0.40,
    name: 'MISSING_LOCAL_SOURCE_PENALTY',
    description: 'Resource is third-party or external with no local workspace counterpart.'
  }
} as const;

/**
 * Calculates deterministic confidence from a set of signals.
 */
export function calculateConfidence(signals: ConfidenceSignal[]): Confidence {
  if (!signals || signals.length === 0) {
    return {
      score: 0,
      signals: [],
      rationale: 'No evidence signals available to support correlation.'
    };
  }

  // Sum weights deterministically
  let sum = 0;
  for (const sig of signals) {
    sum += sig.weight;
  }

  // Clamp bounded 0.0 <= score <= 1.0
  const score = Math.max(0.0, Math.min(1.0, Math.round(sum * 100) / 100));

  // Construct deterministic rationale
  const positiveSignals = signals.filter((s) => s.weight > 0);
  const negativeSignals = signals.filter((s) => s.weight < 0);

  const parts: string[] = [];
  if (positiveSignals.length > 0) {
    parts.push(`Supported by ${positiveSignals.map((s) => s.name).join(', ')}.`);
  }
  if (negativeSignals.length > 0) {
    parts.push(`Penalized by ${negativeSignals.map((s) => s.name).join(', ')}.`);
  }

  const rationale = parts.join(' ') || 'Deterministic score computed from evidence signals.';

  return {
    score,
    signals,
    rationale
  };
}

/**
 * Maps a confidence score and signal profile to controlled status and assessment level.
 */
export function resolveCorrelationStatus(
  confidence: Confidence,
  isExternalOrUnresolved = false
): { status: CorrelationStatus; level: AssessmentLevel } {
  if (isExternalOrUnresolved) {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      level: 'UNKNOWN'
    };
  }

  const hasContradictions = confidence.signals.some((s) => s.weight < 0);
  const positiveCount = confidence.signals.filter((s) => s.weight > 0).length;

  if (confidence.score >= 0.75 && positiveCount >= 2 && !hasContradictions) {
    return {
      status: 'STRONGLY_SUPPORTED',
      level: 'STRONGLY_SUPPORTED_CONTRIBUTOR'
    };
  }

  if (confidence.score >= 0.50 && positiveCount >= 2) {
    return {
      status: 'SUPPORTED_CONTRIBUTOR',
      level: 'SUPPORTED_CONTRIBUTOR'
    };
  }

  if (confidence.score >= 0.20 && positiveCount >= 1) {
    return {
      status: 'POSSIBLE_CORRELATION',
      level: 'CORRELATED'
    };
  }

  if (confidence.score > 0) {
    return {
      status: 'POSSIBLE_CORRELATION',
      level: 'OBSERVED'
    };
  }

  return {
    status: 'NO_CORRELATION',
    level: 'UNKNOWN'
  };
}
