import { type LighthouseRunResult } from '../lighthouse/types.js';
import {
  EVIDENCE_SCHEMA_VERSION,
  type ZyraEvidence,
  type MetricDetail,
  type NormalizedAudit,
  type ResourceSummaryItem,
  type NetworkRequestEvidence,
  type ScriptEvidence,
  type LongTaskEvidence,
  type ImageEvidence,
  type FontEvidence
} from './types.js';

/**
 * Normalize an individual metric from an audit object.
 */
function extractMetric(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  audit: any,
  unit: 'ms' | 'score'
): MetricDetail {
  if (!audit || typeof audit !== 'object') {
    return { value: null, unit, score: null };
  }

  const value = typeof audit.numericValue === 'number' ? audit.numericValue : null;
  const score = typeof audit.score === 'number' ? audit.score : null;
  const displayValue = typeof audit.displayValue === 'string' ? audit.displayValue : undefined;

  return { value, unit, score, displayValue };
}

/**
 * Normalizes raw Lighthouse results into a stable, deterministic ZYRA Evidence model.
 */
export function normalizeEvidence(runResult: LighthouseRunResult): ZyraEvidence {
  const { metadata, rawLhr } = runResult;
  const audits = rawLhr?.audits ?? {};

  // 1. Metrics normalization
  const fcp = extractMetric(audits['first-contentful-paint'], 'ms');
  const lcp = extractMetric(audits['largest-contentful-paint'], 'ms');
  const cls = extractMetric(audits['cumulative-layout-shift'], 'score');
  const tbt = extractMetric(audits['total-blocking-time'], 'ms');
  const speedIndex = extractMetric(audits['speed-index'], 'ms');

  // INP: Only include if explicitly reported; never invent
  const inpAudit = audits['interaction-to-next-paint'];
  let inp: MetricDetail | null = null;
  if (inpAudit && typeof inpAudit.numericValue === 'number') {
    inp = extractMetric(inpAudit, 'ms');
  }

  // 2. Score normalization
  const perfScore = rawLhr?.categories?.performance?.score;
  const performanceScore = typeof perfScore === 'number' ? perfScore : null;

  // 3. Audits extraction
  const normalizedAudits: NormalizedAudit[] = Object.entries(audits).map(([id, audit]: [string, any]) => ({
    id,
    title: audit?.title ?? id,
    description: audit?.description ?? '',
    score: typeof audit?.score === 'number' ? audit.score : null,
    scoreDisplayMode: audit?.scoreDisplayMode ?? 'notApplicable',
    displayValue: audit?.displayValue,
    numericValue: typeof audit?.numericValue === 'number' ? audit.numericValue : undefined,
    numericUnit: audit?.numericUnit
  }));

  // 4. Resource summary extraction
  const resourceSummaryItems: ResourceSummaryItem[] = (
    audits['resource-summary']?.details?.items ?? []
  ).map((item: any) => ({
    resourceType: String(item.resourceType ?? 'other'),
    label: String(item.label ?? item.resourceType ?? 'Other'),
    requestCount: Number(item.requestCount ?? 0),
    transferSizeBytes: Number(item.transferSize ?? 0)
  }));

  // 5. Network requests extraction
  const rawNetworkRequests = audits['network-requests']?.details?.items ?? [];
  const networkRequests: NetworkRequestEvidence[] = rawNetworkRequests.map((req: any) => {
    const requestTimeMs = typeof req.networkRequestTime === 'number' ? req.networkRequestTime : undefined;
    const endTimeMs = typeof req.networkEndTime === 'number' ? req.networkEndTime : undefined;
    const durationMs =
      requestTimeMs !== undefined && endTimeMs !== undefined
        ? Math.max(0, endTimeMs - requestTimeMs)
        : undefined;

    return {
      url: String(req.url ?? ''),
      protocol: req.protocol,
      resourceType: req.resourceType,
      mimeType: req.mimeType,
      statusCode: typeof req.statusCode === 'number' ? req.statusCode : undefined,
      transferSizeBytes: Number(req.transferSize ?? 0),
      resourceSizeBytes: typeof req.resourceSize === 'number' ? req.resourceSize : undefined,
      priority: req.priority,
      requestTimeMs,
      endTimeMs,
      durationMs
    };
  });

  // 6. Scripts & Long tasks extraction
  const unusedJsItems = audits['unused-javascript']?.details?.items ?? [];
  const unusedJsMap = new Map<string, number>();
  for (const item of unusedJsItems) {
    if (item.url && typeof item.wastedBytes === 'number') {
      unusedJsMap.set(item.url, item.wastedBytes);
    }
  }

  const scripts: ScriptEvidence[] = networkRequests
    .filter(
      (req) =>
        req.resourceType === 'Script' ||
        (req.mimeType && req.mimeType.toLowerCase().includes('javascript'))
    )
    .map((req) => ({
      url: req.url,
      transferSizeBytes: req.transferSizeBytes,
      resourceSizeBytes: req.resourceSizeBytes,
      unusedBytes: unusedJsMap.get(req.url)
    }));

  const rawLongTasks = audits['long-tasks']?.details?.items ?? [];
  const longTasks: LongTaskEvidence[] = rawLongTasks.map((task: any) => ({
    url: task.url,
    startTimeMs: Number(task.startTime ?? 0),
    durationMs: Number(task.duration ?? 0)
  }));

  // 7. Images extraction
  const imageOptimizationItems = [
    ...(audits['modern-image-formats']?.details?.items ?? []),
    ...(audits['uses-optimized-images']?.details?.items ?? [])
  ];
  const wastedImageMap = new Map<string, number>();
  for (const item of imageOptimizationItems) {
    if (item.url && typeof item.wastedBytes === 'number') {
      wastedImageMap.set(item.url, item.wastedBytes);
    }
  }

  const images: ImageEvidence[] = networkRequests
    .filter(
      (req) =>
        req.resourceType === 'Image' ||
        (req.mimeType && req.mimeType.toLowerCase().startsWith('image/'))
    )
    .map((req) => ({
      url: req.url,
      mimeType: req.mimeType,
      transferSizeBytes: req.transferSizeBytes,
      resourceSizeBytes: req.resourceSizeBytes,
      wastedBytes: wastedImageMap.get(req.url)
    }));

  // 8. Fonts extraction
  const fonts: FontEvidence[] = networkRequests
    .filter(
      (req) =>
        req.resourceType === 'Font' ||
        (req.mimeType && req.mimeType.toLowerCase().includes('font'))
    )
    .map((req) => ({
      url: req.url,
      transferSizeBytes: req.transferSizeBytes,
      resourceSizeBytes: req.resourceSizeBytes
    }));

  // 9. Traceability Mapping
  const traceability: Record<string, string> = {
    'metrics.fcp': 'audits.first-contentful-paint.numericValue',
    'metrics.lcp': 'audits.largest-contentful-paint.numericValue',
    'metrics.cls': 'audits.cumulative-layout-shift.numericValue',
    'metrics.tbt': 'audits.total-blocking-time.numericValue',
    'metrics.speedIndex': 'audits.speed-index.numericValue',
    'metrics.inp': 'audits.interaction-to-next-paint.numericValue',
    'scores.performance': 'categories.performance.score',
    'resources.summary': 'audits.resource-summary.details.items',
    'network.requests': 'audits.network-requests.details.items',
    'scripts.items': 'audits.network-requests (resourceType === "Script")',
    'scripts.longTasks': 'audits.long-tasks.details.items',
    'images.items': 'audits.network-requests (resourceType === "Image")',
    'fonts.items': 'audits.network-requests (resourceType === "Font")'
  };

  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    target: {
      url: metadata.targetUrl,
      requestedUrl: metadata.requestedUrl,
      finalUrl: metadata.finalDisplayedUrl,
      device: metadata.device,
      timestamp: metadata.timestamp
    },
    run: {
      durationMs: metadata.durationMs,
      lighthouseVersion: metadata.lighthouseVersion,
      benchmarkIndex: metadata.benchmarkIndex,
      userAgent: metadata.userAgent
    },
    scores: {
      performance: performanceScore
    },
    metrics: {
      fcp,
      lcp,
      cls,
      tbt,
      speedIndex,
      inp
    },
    audits: normalizedAudits,
    resources: {
      summary: resourceSummaryItems,
      items: networkRequests
    },
    network: {
      requests: networkRequests
    },
    scripts: {
      items: scripts,
      longTasks
    },
    images: {
      items: images
    },
    fonts: {
      items: fonts
    },
    traceability
  };
}
