/**
 * Lighthouse Runner Types
 */

export type DeviceType = 'mobile' | 'desktop';

export interface LighthouseRunnerOptions {
  url: string;
  device?: DeviceType;
  timeoutMs?: number;
  extraChromeFlags?: string[];
  port?: number;
  onProgress?: (status: string) => void;
}

export interface LighthouseRunMetadata {
  targetUrl: string;
  requestedUrl: string;
  finalDisplayedUrl: string;
  device: DeviceType;
  timestamp: string;
  durationMs: number;
  lighthouseVersion: string;
  benchmarkIndex?: number;
  userAgent?: string;
}

export interface LighthouseRunResult {
  metadata: LighthouseRunMetadata;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawLhr: Record<string, any>;
}
