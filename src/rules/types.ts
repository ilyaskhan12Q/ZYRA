/**
 * ZYRA Performance Rule Engine — Data Contracts & Types (Schema Version 1.0)
 */

import { type ZyraEvidence } from '../evidence/types.js';

export const FINDING_SCHEMA_VERSION = '1.0' as const;

export type FindingSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export type FindingConfidence = 'DETERMINISTIC';

export type RuleCategory =
  | 'metrics'
  | 'javascript'
  | 'network'
  | 'images'
  | 'fonts'
  | 'rendering'
  | 'resources';

export interface FindingObserved {
  value: number | string;
  unit?: string;
  displayValue?: string;
}

export interface FindingThreshold {
  value: number | string;
  unit?: string;
  condition: string;
  source: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
}

export interface Finding {
  id: string;
  ruleId: string;
  ruleVersion: string;
  category: RuleCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  observed: FindingObserved;
  threshold: FindingThreshold;
  evidenceRefs: string[];
  confidence: FindingConfidence;
  nextInvestigation: string;
}

export interface PerformanceRule {
  readonly id: string;
  readonly version: string;
  readonly category: RuleCategory;
  readonly defaultSeverity: FindingSeverity;
  readonly title: string;
  readonly description: string;
  readonly evidenceConsumed: string[];
  readonly thresholdSummary: string;
  readonly thresholdSource: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
  evaluate(evidence: ZyraEvidence): Finding[];
}

export interface RuleExecutionError {
  ruleId: string;
  message: string;
  stack?: string;
}

export interface RuleCatalogEntry {
  id: string;
  version: string;
  category: RuleCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidenceConsumed: string[];
  thresholdSummary: string;
  thresholdSource: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
}
