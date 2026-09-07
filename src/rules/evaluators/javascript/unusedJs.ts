import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const UNUSED_JS_HIGH_RULE: PerformanceRule = {
  id: 'UNUSED_JS_HIGH',
  version: '1.0',
  category: 'javascript',
  defaultSeverity: 'HIGH',
  title: 'High Volume of Unused JavaScript',
  description: 'Unused JavaScript transfer exceeds 100 KB, wasting network bandwidth and slowing script evaluation.',
  evidenceConsumed: ['audits.unused-javascript', 'scripts.items'],
  thresholdSummary: THRESHOLDS.UNUSED_JS_BYTES.condition,
  thresholdSource: THRESHOLDS.UNUSED_JS_BYTES.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    // Determine total wasted bytes either from the unused-javascript audit or from script items
    const unusedAudit = evidence?.audits?.find((a) => a.id === 'unused-javascript');
    const auditWastedBytes =
      typeof unusedAudit?.numericValue === 'number' ? unusedAudit.numericValue : 0;

    const scriptsWastedBytes = (evidence?.scripts?.items ?? []).reduce(
      (sum, script) => sum + (script.unusedBytes ?? 0),
      0
    );

    const totalUnusedBytes = Math.max(auditWastedBytes, scriptsWastedBytes);

    if (totalUnusedBytes <= THRESHOLDS.UNUSED_JS_BYTES.value) {
      return [];
    }

    const kbWasted = (totalUnusedBytes / 1024).toFixed(1);

    return [
      {
        id: 'finding:unused_js_high',
        ruleId: 'UNUSED_JS_HIGH',
        ruleVersion: '1.0',
        category: 'javascript',
        severity: 'HIGH',
        title: 'High Volume of Unused JavaScript',
        description: `Observed ${kbWasted} KB of unused JavaScript loaded during initial page load, exceeding the threshold of ${(THRESHOLDS.UNUSED_JS_BYTES.value / 1024).toFixed(0)} KB.`,
        observed: {
          value: totalUnusedBytes,
          unit: 'bytes',
          displayValue: `${kbWasted} KB`
        },
        threshold: {
          value: THRESHOLDS.UNUSED_JS_BYTES.value,
          unit: THRESHOLDS.UNUSED_JS_BYTES.unit,
          condition: THRESHOLDS.UNUSED_JS_BYTES.condition,
          source: THRESHOLDS.UNUSED_JS_BYTES.source
        },
        evidenceRefs: ['audits.unused-javascript', 'scripts.items'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate bundle code-splitting boundaries, tree-shaking efficacy, dynamic imports for non-critical routes, and deferred loading of third-party scripts.'
      }
    ];
  }
};
