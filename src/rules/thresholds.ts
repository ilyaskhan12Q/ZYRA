/**
 * Central Threshold Definitions with Documented Rationale and Source Attribution.
 *
 * Rules must NEVER scatter magic numbers across evaluators. All threshold boundaries
 * reference this authoritative definition.
 */

export interface ThresholdDefinition {
  readonly value: number;
  readonly unit: string;
  readonly condition: string;
  readonly source: 'Google Web Vitals' | 'Google Lighthouse' | 'ZYRA Heuristic';
  readonly rationale: string;
}

export const THRESHOLDS = {
  // First Contentful Paint (FCP)
  FCP_SLOW: {
    value: 1800,
    unit: 'ms',
    condition: '> 1800 ms',
    source: 'Google Web Vitals',
    rationale: 'Official 75th percentile boundary separating Good (<= 1.8s) from Needs Improvement.'
  },
  FCP_CRITICAL: {
    value: 3000,
    unit: 'ms',
    condition: '> 3000 ms',
    source: 'Google Web Vitals',
    rationale: 'Official 75th percentile boundary separating Needs Improvement from Poor (> 3.0s).'
  },

  // Largest Contentful Paint (LCP)
  LCP_SLOW: {
    value: 2500,
    unit: 'ms',
    condition: '> 2500 ms',
    source: 'Google Web Vitals',
    rationale: 'Official Core Web Vitals threshold separating Good (<= 2.5s) from Needs Improvement.'
  },
  LCP_CRITICAL: {
    value: 4000,
    unit: 'ms',
    condition: '> 4000 ms',
    source: 'Google Web Vitals',
    rationale: 'Official Core Web Vitals threshold separating Needs Improvement from Poor (> 4.0s).'
  },

  // Total Blocking Time (TBT)
  TBT_HIGH: {
    value: 200,
    unit: 'ms',
    condition: '> 200 ms',
    source: 'Google Lighthouse',
    rationale: 'Lighthouse scoring distribution threshold separating Good (<= 200ms) from Moderate blocking.'
  },
  TBT_CRITICAL: {
    value: 600,
    unit: 'ms',
    condition: '> 600 ms',
    source: 'Google Lighthouse',
    rationale: 'Lighthouse scoring distribution threshold representing severe main-thread blockage (> 600ms).'
  },

  // Cumulative Layout Shift (CLS)
  CLS_WARNING: {
    value: 0.10,
    unit: 'score',
    condition: '> 0.10',
    source: 'Google Web Vitals',
    rationale: 'Official Core Web Vitals threshold separating Good (<= 0.10) from Needs Improvement.'
  },
  CLS_CRITICAL: {
    value: 0.25,
    unit: 'score',
    condition: '> 0.25',
    source: 'Google Web Vitals',
    rationale: 'Official Core Web Vitals threshold separating Needs Improvement from Poor (> 0.25).'
  },

  // Speed Index
  SPEED_INDEX_SLOW: {
    value: 3400,
    unit: 'ms',
    condition: '> 3400 ms',
    source: 'Google Lighthouse',
    rationale: 'Lighthouse scoring distribution threshold separating Good (<= 3.4s) from Needs Improvement.'
  },
  SPEED_INDEX_CRITICAL: {
    value: 5800,
    unit: 'ms',
    condition: '> 5800 ms',
    source: 'Google Lighthouse',
    rationale: 'Lighthouse scoring distribution threshold separating Needs Improvement from Poor (> 5.8s).'
  },

  // Interaction to Next Paint (INP)
  INP_SLOW: {
    value: 200,
    unit: 'ms',
    condition: '> 200 ms',
    source: 'Google Web Vitals',
    rationale: 'Official Core Web Vitals threshold separating Good (<= 200ms) from Needs Improvement.'
  },
  INP_CRITICAL: {
    value: 500,
    unit: 'ms',
    condition: '> 500 ms',
    source: 'Google Web Vitals',
    rationale: 'Official Core Web Vitals threshold separating Needs Improvement from Poor (> 500ms).'
  },

  // JavaScript: Unused Code
  UNUSED_JS_BYTES: {
    value: 100000, // 100 KB
    unit: 'bytes',
    condition: '> 100 KB unused',
    source: 'ZYRA Heuristic',
    rationale: 'Conservative threshold for dead code transfer overhead warranting bundle code-splitting.'
  },

  // JavaScript: Long Tasks
  LONG_TASK_SINGLE_MS: {
    value: 200,
    unit: 'ms',
    condition: '> 200 ms duration',
    source: 'ZYRA Heuristic',
    rationale: 'Severe individual main-thread execution task blocking user interactions (baseline is 50ms).'
  },
  LONG_TASK_TOTAL_MS: {
    value: 500,
    unit: 'ms',
    condition: '> 500 ms total duration',
    source: 'ZYRA Heuristic',
    rationale: 'Cumulative main-thread long task duration indicating extensive synchronous execution.'
  },

  // Network & Rendering: Render Blocking Resources
  RENDER_BLOCKING_SAVINGS_MS: {
    value: 0,
    unit: 'ms',
    condition: '> 0 ms potential savings',
    source: 'ZYRA Heuristic',
    rationale: 'Presence of stylesheets or scripts identified by Lighthouse that delay initial paint.'
  },

  // Network: Large Resource Transfer
  LARGE_RESOURCE_BYTES: {
    value: 500000, // 500 KB
    unit: 'bytes',
    condition: '> 500 KB transfer',
    source: 'ZYRA Heuristic',
    rationale: 'Individual payload size that significantly impacts network queueing and transfer time.'
  },

  // Images: Optimization & Size
  IMAGE_WASTED_BYTES: {
    value: 100000, // 100 KB
    unit: 'bytes',
    condition: '> 100 KB potential savings',
    source: 'ZYRA Heuristic',
    rationale: 'Wasted image bytes detectable through modern compression or format conversion.'
  },
  LARGE_IMAGE_BYTES: {
    value: 500000, // 500 KB
    unit: 'bytes',
    condition: '> 500 KB transfer',
    source: 'ZYRA Heuristic',
    rationale: 'Individual unoptimized image payload exceeding reasonable web asset budgets.'
  },

  // Fonts: Transfer Size
  LARGE_FONT_BYTES: {
    value: 100000, // 100 KB
    unit: 'bytes',
    condition: '> 100 KB transfer',
    source: 'ZYRA Heuristic',
    rationale: 'Web font resource exceeding expected WOFF2 subset transfer budget.'
  }
} as const satisfies Record<string, ThresholdDefinition>;
