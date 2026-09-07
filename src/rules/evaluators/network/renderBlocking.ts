import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const RENDER_BLOCKING_RULE: PerformanceRule = {
  id: 'RENDER_BLOCKING_RESOURCE',
  version: '1.0',
  category: 'rendering',
  defaultSeverity: 'HIGH',
  title: 'Render-Blocking Resources Delaying First Paint',
  description: 'Stylesheets or scripts were identified blocking the main thread from painting the initial view.',
  evidenceConsumed: ['audits.render-blocking-resources'],
  thresholdSummary: THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.condition,
  thresholdSource: THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const rbAudit = evidence?.audits?.find((a) => a.id === 'render-blocking-resources');
    if (!rbAudit) {
      return [];
    }

    const wastedMs =
      typeof rbAudit.numericValue === 'number'
        ? rbAudit.numericValue
        : rbAudit.score !== null && rbAudit.score < 1
          ? 100 // heuristic fallback if score < 1 without explicit numericValue
          : 0;

    if (wastedMs <= THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.value) {
      return [];
    }

    const displayMs = Math.round(wastedMs);

    return [
      {
        id: 'finding:render_blocking_resource',
        ruleId: 'RENDER_BLOCKING_RESOURCE',
        ruleVersion: '1.0',
        category: 'rendering',
        severity: 'HIGH',
        title: 'Render-Blocking Resources Delaying First Paint',
        description: `Render-blocking resources were detected causing an estimated ${displayMs} ms delay in initial page rendering.`,
        observed: {
          value: wastedMs,
          unit: 'ms',
          displayValue: `${displayMs} ms wasted`
        },
        threshold: {
          value: THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.value,
          unit: THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.unit,
          condition: THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.condition,
          source: THRESHOLDS.RENDER_BLOCKING_SAVINGS_MS.source
        },
        evidenceRefs: ['audits.render-blocking-resources'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate inlining critical CSS above the fold, deferring non-critical scripts with async/defer attributes, and removing unused stylesheet imports.'
      }
    ];
  }
};
