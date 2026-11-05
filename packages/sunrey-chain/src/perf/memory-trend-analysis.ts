import type { ResourceSample } from './types.ts';

/** Soaks shorter than this use legacy RSS growth checks; HEALTH07 trend needs ≥4 samples. */
export const MEMORY_TREND_MIN_SOAK_MS = 60_000;

export const MEMORY_PHASES = ['WARMUP', 'STEADY_STATE', 'COOLDOWN'] as const;
export type MemoryPhase = (typeof MEMORY_PHASES)[number];

export type MemoryTrendConfig = {
  /** Wall-clock ms discarded from the start before trend evaluation. */
  readonly warmupDiscardMs: number;
  /** Wall-clock ms discarded from the end before trend evaluation. */
  readonly cooldownDiscardMs: number;
  /** Rolling window size (sample count) for RSS median. */
  readonly rollingMedianWindow: number;
  /** Max |Theil-Sen heapUsed slope| in bytes/ms (steady state). */
  readonly maxHeapUsedSlopeBytesPerMs: number;
  /** Max |Theil-Sen RSS slope| when heap/objects are stable (allocator retention). */
  readonly maxRssSlopeBytesPerMs: number;
  /** Max growth of rolling RSS median from first to last steady sample. */
  readonly maxRollingRssMedianDeltaBytes: number;
  /** Max increase of late steady heap floor over early steady heap floor. */
  readonly maxPostWarmupHeapFloorGrowthBytes: number;
  /** Max Theil-Sen slope for any tracked retained-object counter (count/ms). */
  readonly maxRetainedObjectSlopePerMs: number;
};

export const DEFAULT_MEMORY_TREND_CONFIG: MemoryTrendConfig = Object.freeze({
  warmupDiscardMs: 30_000,
  cooldownDiscardMs: 10_000,
  rollingMedianWindow: 5,
  maxHeapUsedSlopeBytesPerMs: 4,
  maxRssSlopeBytesPerMs: 8,
  maxRollingRssMedianDeltaBytes: 128 * 1024 * 1024,
  maxPostWarmupHeapFloorGrowthBytes: 64 * 1024 * 1024,
  maxRetainedObjectSlopePerMs: 0.002,
});

export type MemoryTrendClassification =
  | 'STABLE'
  | 'HEAP_LEAK'
  | 'RSS_RETENTION'
  | 'OBJECT_RETENTION';

export type MemoryTrendAnalysis = {
  readonly ok: boolean;
  readonly classification: MemoryTrendClassification;
  readonly detail: string;
  readonly warmupEndMs: number;
  readonly steadyEndMs: number;
  readonly cooldownStartMs: number;
  readonly steadySampleCount: number;
  readonly rollingRssMedianFirstBytes: number;
  readonly rollingRssMedianLastBytes: number;
  readonly theilSenHeapUsedSlopeBytesPerMs: number;
  readonly theilSenRssSlopeBytesPerMs: number;
  readonly highWaterMarkRssBytes: number;
  readonly highWaterMarkHeapUsedBytes: number;
  readonly earlySteadyHeapFloorBytes: number;
  readonly lateSteadyHeapFloorBytes: number;
  readonly retainedObjectSlopes: Readonly<Record<string, number>>;
  readonly rssDeltaStartToEndBytes: number;
};

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Robust slope estimator (bytes per ms). */
export function theilSenSlope(samples: readonly { readonly atMs: number; readonly value: number }[]): number {
  if (samples.length < 2) {
    return 0;
  }
  const slopes: number[] = [];
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const dt = samples[j]!.atMs - samples[i]!.atMs;
      if (dt <= 0) {
        continue;
      }
      slopes.push((samples[j]!.value - samples[i]!.value) / dt);
    }
  }
  return slopes.length === 0 ? 0 : median(slopes);
}

function rollingMedian(values: readonly number[], window: number): readonly number[] {
  if (values.length === 0) {
    return [];
  }
  const w = Math.max(1, window);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - w + 1);
    out.push(median(values.slice(start, i + 1)));
  }
  return out;
}

function phaseForAtMs(
  atMs: number,
  durationMs: number,
  config: MemoryTrendConfig,
): MemoryPhase {
  if (atMs < config.warmupDiscardMs) {
    return 'WARMUP';
  }
  if (atMs >= durationMs - config.cooldownDiscardMs) {
    return 'COOLDOWN';
  }
  return 'STEADY_STATE';
}

function retainedObjectSeries(
  snapshots: readonly ResourceSample[],
  key: keyof ResourceSample,
): readonly { readonly atMs: number; readonly value: number }[] {
  return snapshots.map((row) => ({
    atMs: row.atMs,
    value: typeof row[key] === 'number' ? (row[key] as number) : 0,
  }));
}

export function scaleMemoryTrendConfig(durationMs: number, base: MemoryTrendConfig = DEFAULT_MEMORY_TREND_CONFIG): MemoryTrendConfig {
  if (durationMs >= 120_000) {
    return base;
  }
  const ratio = durationMs / 120_000;
  const short = durationMs < 60_000;
  return Object.freeze({
    ...base,
    warmupDiscardMs: short
      ? Math.floor(durationMs * 0.45)
      : Math.max(500, Math.floor(base.warmupDiscardMs * ratio)),
    cooldownDiscardMs: short
      ? Math.floor(durationMs * 0.1)
      : Math.max(200, Math.floor(base.cooldownDiscardMs * ratio)),
    maxHeapUsedSlopeBytesPerMs: base.maxHeapUsedSlopeBytesPerMs / Math.max(0.15, ratio),
    maxRssSlopeBytesPerMs: base.maxRssSlopeBytesPerMs / Math.max(0.15, ratio),
    maxPostWarmupHeapFloorGrowthBytes: Math.max(
      base.maxPostWarmupHeapFloorGrowthBytes,
      Math.floor(base.maxPostWarmupHeapFloorGrowthBytes * Math.max(ratio, 0.5)),
    ),
    maxRollingRssMedianDeltaBytes: Math.max(
      base.maxRollingRssMedianDeltaBytes,
      Math.floor(base.maxRollingRssMedianDeltaBytes * Math.max(ratio, 0.5)),
    ),
  });
}

export function analyzeMemoryTrend(
  snapshots: readonly ResourceSample[],
  durationMs: number,
  configInput?: MemoryTrendConfig,
): MemoryTrendAnalysis {
  const config = scaleMemoryTrendConfig(durationMs, configInput);
  const empty: MemoryTrendAnalysis = Object.freeze({
    ok: false,
    classification: 'HEAP_LEAK',
    detail: 'insufficient memory snapshots for trend analysis',
    warmupEndMs: config.warmupDiscardMs,
    steadyEndMs: Math.max(0, durationMs - config.cooldownDiscardMs),
    cooldownStartMs: Math.max(0, durationMs - config.cooldownDiscardMs),
    steadySampleCount: 0,
    rollingRssMedianFirstBytes: 0,
    rollingRssMedianLastBytes: 0,
    theilSenHeapUsedSlopeBytesPerMs: 0,
    theilSenRssSlopeBytesPerMs: 0,
    highWaterMarkRssBytes: 0,
    highWaterMarkHeapUsedBytes: 0,
    earlySteadyHeapFloorBytes: 0,
    lateSteadyHeapFloorBytes: 0,
    retainedObjectSlopes: Object.freeze({}),
    rssDeltaStartToEndBytes: 0,
  });
  if (snapshots.length < 4) {
    return empty;
  }

  const steady = snapshots.filter((row) => phaseForAtMs(row.atMs, durationMs, config) === 'STEADY_STATE');
  if (steady.length < 3) {
    return Object.freeze({
      ...empty,
      detail: `steady-state samples=${steady.length} (need ≥3 after warmup/cooldown discard)`,
    });
  }

  const heapSeries = steady.map((row) => ({ atMs: row.atMs, value: row.heapUsedBytes }));
  const rssSeries = steady.map((row) => ({ atMs: row.atMs, value: row.rssBytes }));
  const rssRolling = rollingMedian(
    steady.map((row) => row.rssBytes),
    config.rollingMedianWindow,
  );
  const heapSlope = theilSenSlope(heapSeries);
  const rssSlope = theilSenSlope(rssSeries);

  const objectKeys = [
    'feeReceiptsInMemory',
    'productiveObjects',
    'productiveFacts',
    'productiveClaims',
    'heliosObservations',
    'heliosTwinOrders',
    'heliosAgentSessions',
    'heliosResearchMonitors',
    'heliosEvidenceStagingBytes',
  ] as const;
  const objectCaps: Record<(typeof objectKeys)[number], number> = {
    feeReceiptsInMemory: 8192,
    productiveObjects: 128,
    productiveFacts: 512,
    productiveClaims: 256,
    heliosObservations: 256,
    heliosTwinOrders: 512,
    heliosAgentSessions: 64,
    heliosResearchMonitors: 64,
    heliosEvidenceStagingBytes: 256 * 1024,
  };
  const tailSteady = steady.slice(-Math.max(4, Math.floor(steady.length / 3)));
  const retainedObjectSlopes: Record<string, number> = {};
  for (const key of objectKeys) {
    const tailSeries = retainedObjectSeries(tailSteady, key);
    retainedObjectSlopes[key] = theilSenSlope(tailSeries);
  }

  const highWaterMarkRssBytes = Math.max(...snapshots.map((row) => row.rssBytes));
  const highWaterMarkHeapUsedBytes = Math.max(...snapshots.map((row) => row.heapUsedBytes));
  const first = snapshots[0]!;
  const last = snapshots[snapshots.length - 1]!;
  const rssDeltaStartToEndBytes = last.rssBytes - first.rssBytes;

  const steadyWindow = Math.max(1, Math.floor(steady.length / 4));
  const earlyHeap = steady.slice(0, steadyWindow).map((row) => row.heapUsedBytes);
  const lateHeap = steady.slice(-steadyWindow).map((row) => row.heapUsedBytes);
  const earlySteadyHeapFloorBytes = Math.min(...earlyHeap);
  const lateSteadyHeapFloorBytes = Math.min(...lateHeap);
  const heapFloorGrowth = lateSteadyHeapFloorBytes - earlySteadyHeapFloorBytes;
  const rollingRssMedianFirstBytes = rssRolling[0] ?? 0;
  const rollingRssMedianLastBytes = rssRolling[rssRolling.length - 1] ?? 0;
  const rollingRssMedianDelta = rollingRssMedianLastBytes - rollingRssMedianFirstBytes;

  let objectRetention = false;
  for (const key of objectKeys) {
    const cap = objectCaps[key];
    const tailValues = tailSteady.map((row) => (typeof row[key] === 'number' ? (row[key] as number) : 0));
    if (tailValues.length < 2) {
      continue;
    }
    const tailMax = Math.max(...tailValues);
    const tailMin = Math.min(...tailValues);
    const tailSpread = tailMax - tailMin;
    const slope = retainedObjectSlopes[key] ?? 0;
    const nearCap = tailMax >= cap * 0.85;
    if (nearCap && tailSpread > cap * 0.12) {
      objectRetention = true;
    }
  }

  const plateauWindow = Math.max(2, Math.floor(steady.length / 4));
  const earlyPlateau = steady.slice(0, plateauWindow);
  const latePlateau = steady.slice(-plateauWindow);
  const earlyMaxHeap = Math.max(...earlyPlateau.map((row) => row.heapUsedBytes));
  const lateMaxHeap = Math.max(...latePlateau.map((row) => row.heapUsedBytes));
  const plateauHeapDelta = lateMaxHeap - earlyMaxHeap;

  const heapLeak = plateauHeapDelta > config.maxPostWarmupHeapFloorGrowthBytes;

  const steadyRssDrift = rollingRssMedianDelta > config.maxRollingRssMedianDeltaBytes;

  let classification: MemoryTrendClassification = 'STABLE';
  if (objectRetention) {
    classification = 'OBJECT_RETENTION';
  } else if (heapLeak) {
    classification = 'HEAP_LEAK';
  } else if (steadyRssDrift) {
    classification = 'RSS_RETENTION';
  } else if (rssDeltaStartToEndBytes > 64 * 1024 * 1024) {
    classification = 'RSS_RETENTION';
  }

  const ok = !objectRetention && !heapLeak && !steadyRssDrift;

  const detail = [
    `class=${classification}`,
    `steady_n=${steady.length}`,
    `heap_slope=${heapSlope.toFixed(4)}B/ms`,
    `rss_slope=${rssSlope.toFixed(4)}B/ms`,
    `rss_median_delta=${rollingRssMedianDelta}`,
    `heap_plateau_delta=${plateauHeapDelta}`,
    `heap_floor_growth=${heapFloorGrowth}`,
    `hwm_rss=${highWaterMarkRssBytes}`,
    `rss_start_end=${rssDeltaStartToEndBytes}`,
  ].join(' ');

  return Object.freeze({
    ok,
    classification,
    detail,
    warmupEndMs: config.warmupDiscardMs,
    steadyEndMs: Math.max(0, durationMs - config.cooldownDiscardMs),
    cooldownStartMs: Math.max(0, durationMs - config.cooldownDiscardMs),
    steadySampleCount: steady.length,
    rollingRssMedianFirstBytes,
    rollingRssMedianLastBytes,
    theilSenHeapUsedSlopeBytesPerMs: heapSlope,
    theilSenRssSlopeBytesPerMs: rssSlope,
    highWaterMarkRssBytes,
    highWaterMarkHeapUsedBytes,
    earlySteadyHeapFloorBytes,
    lateSteadyHeapFloorBytes,
    retainedObjectSlopes: Object.freeze({ ...retainedObjectSlopes }),
    rssDeltaStartToEndBytes,
  });
}

export function phaseAtMs(
  atMs: number,
  durationMs: number,
  config: MemoryTrendConfig = DEFAULT_MEMORY_TREND_CONFIG,
): MemoryPhase {
  return phaseForAtMs(atMs, durationMs, scaleMemoryTrendConfig(durationMs, config));
}
