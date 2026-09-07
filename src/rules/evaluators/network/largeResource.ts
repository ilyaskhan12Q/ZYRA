import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const LARGE_RESOURCE_RULE: PerformanceRule = {
  id: 'LARGE_RESOURCE',
  version: '1.0',
  category: 'network',
  defaultSeverity: 'WARNING',
  title: 'Large Network Payload Detected',
  description: 'Individual network payloads exceeding 500 KB transfer size were transferred during page load.',
  evidenceConsumed: ['network.requests'],
  thresholdSummary: THRESHOLDS.LARGE_RESOURCE_BYTES.condition,
  thresholdSource: THRESHOLDS.LARGE_RESOURCE_BYTES.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const requests = evidence?.network?.requests ?? [];
    if (!Array.isArray(requests) || requests.length === 0) {
      return [];
    }

    const largeRequests = requests.filter(
      (r) => (r.transferSizeBytes ?? 0) > THRESHOLDS.LARGE_RESOURCE_BYTES.value
    );

    if (largeRequests.length === 0) {
      return [];
    }

    const maxTransfer = Math.max(...largeRequests.map((r) => r.transferSizeBytes));
    const count = largeRequests.length;
    const isHigh = maxTransfer > 2000000; // 2 MB
    const severity = isHigh ? 'HIGH' : 'WARNING';

    const maxKb = (maxTransfer / 1024).toFixed(1);

    return [
      {
        id: 'finding:large_resource',
        ruleId: 'LARGE_RESOURCE',
        ruleVersion: '1.0',
        category: 'network',
        severity,
        title: isHigh ? 'Critical Network Payload Detected' : 'Large Network Payload Detected',
        description: `Observed ${count} network resource(s) exceeding the 500 KB transfer budget, with the largest payload transferring ${maxKb} KB.`,
        observed: {
          value: maxTransfer,
          unit: 'bytes',
          displayValue: `${maxKb} KB max (${count} resource${count > 1 ? 's' : ''})`
        },
        threshold: {
          value: THRESHOLDS.LARGE_RESOURCE_BYTES.value,
          unit: THRESHOLDS.LARGE_RESOURCE_BYTES.unit,
          condition: THRESHOLDS.LARGE_RESOURCE_BYTES.condition,
          source: THRESHOLDS.LARGE_RESOURCE_BYTES.source
        },
        evidenceRefs: ['network.requests'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate HTTP compression (Brotli/Gzip), asset minification, code chunking, and lazy-loading non-critical resources.'
      }
    ];
  }
};
