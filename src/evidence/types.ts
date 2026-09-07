/**
 * ZYRA Evidence Engine Data Contracts (Schema Version 1.0)
 */

import { type DeviceType } from '../lighthouse/types.js';

export const EVIDENCE_SCHEMA_VERSION = '1.0' as const;

export interface EvidenceTarget {
  url: string;
  requestedUrl?: string;
  finalUrl?: string;
  device: DeviceType;
  timestamp: string; // ISO 8601
}

export interface EvidenceRun {
  durationMs: number;
  lighthouseVersion: string;
  benchmarkIndex?: number;
  userAgent?: string;
}

export interface MetricDetail {
  value: number | null;
  unit: 'ms' | 'score';
  score: number | null;
  displayValue?: string;
}

export interface EvidenceMetrics {
  fcp: MetricDetail;
  lcp: MetricDetail;
  cls: MetricDetail;
  tbt: MetricDetail;
  speedIndex: MetricDetail;
  inp: MetricDetail | null; // null if not captured; never invented
}

export interface EvidenceScores {
  performance: number | null; // 0.0 to 1.0
}

export interface NormalizedAudit {
  id: string; // Stable audit identifier (e.g. 'largest-contentful-paint')
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
}

export interface ResourceSummaryItem {
  resourceType: string;
  label: string;
  requestCount: number;
  transferSizeBytes: number;
}

export interface NetworkRequestEvidence {
  url: string;
  protocol?: string;
  resourceType?: string;
  mimeType?: string;
  statusCode?: number;
  transferSizeBytes: number;
  resourceSizeBytes?: number;
  priority?: string;
  requestTimeMs?: number;
  endTimeMs?: number;
  durationMs?: number;
}

export interface ScriptEvidence {
  url: string;
  transferSizeBytes: number;
  resourceSizeBytes?: number;
  unusedBytes?: number;
}

export interface LongTaskEvidence {
  url?: string;
  startTimeMs: number;
  durationMs: number;
}

export interface ImageEvidence {
  url: string;
  mimeType?: string;
  transferSizeBytes: number;
  resourceSizeBytes?: number;
  wastedBytes?: number;
}

export interface FontEvidence {
  url: string;
  transferSizeBytes: number;
  resourceSizeBytes?: number;
}

export interface ZyraEvidence {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  target: EvidenceTarget;
  run: EvidenceRun;
  scores: EvidenceScores;
  metrics: EvidenceMetrics;
  audits: NormalizedAudit[];
  resources: {
    summary: ResourceSummaryItem[];
    items: NetworkRequestEvidence[];
  };
  network: {
    requests: NetworkRequestEvidence[];
  };
  scripts: {
    items: ScriptEvidence[];
    longTasks: LongTaskEvidence[];
  };
  images: {
    items: ImageEvidence[];
  };
  fonts: {
    items: FontEvidence[];
  };
  traceability: Record<string, string>;
}

export interface EvidenceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
