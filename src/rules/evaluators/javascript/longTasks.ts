import { type ZyraEvidence } from '../../../evidence/types.js';
import { type PerformanceRule, type Finding } from '../../types.js';
import { THRESHOLDS } from '../../thresholds.js';

export const LONG_TASK_RULE: PerformanceRule = {
  id: 'LONG_TASK',
  version: '1.0',
  category: 'javascript',
  defaultSeverity: 'HIGH',
  title: 'Main-Thread Long Tasks Detected',
  description: 'Main-thread tasks exceeding 50 ms were observed blocking browser interactivity and frame execution.',
  evidenceConsumed: ['scripts.longTasks'],
  thresholdSummary: `${THRESHOLDS.LONG_TASK_SINGLE_MS.condition} or ${THRESHOLDS.LONG_TASK_TOTAL_MS.condition}`,
  thresholdSource: THRESHOLDS.LONG_TASK_SINGLE_MS.source,
  evaluate(evidence: ZyraEvidence): Finding[] {
    const longTasks = evidence?.scripts?.longTasks ?? [];
    if (!Array.isArray(longTasks) || longTasks.length === 0) {
      return [];
    }

    const count = longTasks.length;
    const maxDurationMs = Math.max(...longTasks.map((t) => t.durationMs ?? 0));
    const totalDurationMs = longTasks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);

    const exceedsSingle = maxDurationMs > THRESHOLDS.LONG_TASK_SINGLE_MS.value;
    const exceedsTotal = totalDurationMs > THRESHOLDS.LONG_TASK_TOTAL_MS.value;

    if (!exceedsSingle && !exceedsTotal) {
      return [];
    }

    const isCritical = maxDurationMs > 500 || totalDurationMs > 1500;
    const severity = isCritical ? 'CRITICAL' : 'HIGH';

    return [
      {
        id: 'finding:long_task',
        ruleId: 'LONG_TASK',
        ruleVersion: '1.0',
        category: 'javascript',
        severity,
        title: isCritical
          ? 'Severe Main-Thread Long Tasks Detected'
          : 'Main-Thread Long Tasks Detected',
        description: `Observed ${count} main-thread long task(s) with maximum duration of ${Math.round(maxDurationMs)} ms and cumulative execution time of ${Math.round(totalDurationMs)} ms.`,
        observed: {
          value: maxDurationMs,
          unit: 'ms',
          displayValue: `${Math.round(maxDurationMs)} ms max (${count} task${count > 1 ? 's' : ''}, ${Math.round(totalDurationMs)} ms total)`
        },
        threshold: {
          value: THRESHOLDS.LONG_TASK_SINGLE_MS.value,
          unit: THRESHOLDS.LONG_TASK_SINGLE_MS.unit,
          condition: THRESHOLDS.LONG_TASK_SINGLE_MS.condition,
          source: THRESHOLDS.LONG_TASK_SINGLE_MS.source
        },
        evidenceRefs: ['scripts.longTasks'],
        confidence: 'DETERMINISTIC',
        nextInvestigation:
          'Investigate long-running JavaScript execution blocks, heavy JSON parsing, synchronous framework hydration, or layout recalculations during initial execution.'
      }
    ];
  }
};
