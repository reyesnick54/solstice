import {
  directMethodPoint,
  doublyRobustPoint,
  effectiveSampleSizeFromImportanceRatios,
  importanceRatio,
  ipsPoint,
  snipsPoint,
  switchDoublyRobustPoint,
  usedAnnotationInDirect,
} from './estimators.ts';
import { mulberry32 } from './rng.ts';
import {
  HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED,
  HELIOS_CF05_OPE_BLOCKED,
  HELIOS_CF05_SCHEMA,
  type OpeEstimatorKind,
} from './taxonomy.ts';
import type {
  AnnotationQualityRecord,
  EstimatorDiagnostics,
  EstimatorAgreement,
  HeliosOpeLogRow,
  MultiEstimatorOffPolicyResult,
  OffPolicyConfidenceInterval,
  OffPolicyEstimate,
  OffPolicyEvaluationOptions,
  PropensitySupportSummary,
} from './types.ts';

const DEFAULT_OPTIONS: OffPolicyEvaluationOptions = {
  bootstrap: {
    confidenceLevel: 0.95,
    bootstrapReplicates: 400,
    rngSeed: 1,
  },
  minimumEffectiveSampleSize: 10,
  maximumImportanceRatio: 50,
  inconclusiveCovThreshold: 0.35,
  switchImportanceCap: 20,
  annotationDirectPolicy: 'forbid',
  contextAdaptiveSwitch: { enabled: true, varianceRatioThreshold: 4 },
};

function mergeOptions(options: Partial<OffPolicyEvaluationOptions>): OffPolicyEvaluationOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    bootstrap: { ...DEFAULT_OPTIONS.bootstrap, ...(options.bootstrap ?? {}) },
    contextAdaptiveSwitch: {
      ...DEFAULT_OPTIONS.contextAdaptiveSwitch,
      ...(options.contextAdaptiveSwitch ?? {}),
    },
  };
}

function summarizeSupport(rows: readonly HeliosOpeLogRow[], cap?: number): PropensitySupportSummary {
  if (rows.length === 0) {
    const base = {
      minBehaviorPropensity: 0,
      maxBehaviorPropensity: 0,
      meanBehaviorPropensity: 0,
      maxImportanceRatio: 0,
    };
    return cap === undefined ? base : { ...base, importanceWeightCap: cap };
  }
  let minB = Number.POSITIVE_INFINITY;
  let maxB = 0;
  let sumB = 0;
  let maxR = 0;
  for (const row of rows) {
    minB = Math.min(minB, row.behaviorPropensity);
    maxB = Math.max(maxB, row.behaviorPropensity);
    sumB += row.behaviorPropensity;
    maxR = Math.max(maxR, importanceRatio(row));
  }
  const base = {
    minBehaviorPropensity: minB,
    maxBehaviorPropensity: maxB,
    meanBehaviorPropensity: sumB / rows.length,
    maxImportanceRatio: maxR,
  };
  return cap === undefined ? base : { ...base, importanceWeightCap: cap };
}

function collectAnnotationQuality(rows: readonly HeliosOpeLogRow[]): readonly AnnotationQualityRecord[] {
  return rows.map((row, rowIndex) => {
    if (!row.annotation) {
      return {
        rowIndex,
        source: 'unknown',
        confidence: 0,
        calibration: [],
        modelVersion: '',
        evidenceCount: 0,
      };
    }
    const a = row.annotation;
    return {
      rowIndex,
      source: a.source,
      confidence: a.confidence,
      calibration: a.calibration,
      modelVersion: a.modelVersion,
      evidenceCount: a.evidence.length,
    };
  });
}

function coefficientOfVariation(values: readonly number[]): number {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 0;
  const variance = xs.reduce((s, v) => s + (v - mean) ** 2, 0) / (xs.length - 1);
  const sd = Math.sqrt(Math.max(variance, 0));
  return Math.abs(sd / mean);
}

function estimatorAgreementFrom(points: readonly number[]): EstimatorAgreement {
  const xs = points.filter((v) => Number.isFinite(v));
  if (xs.length === 0) {
    return {
      meanEstimate: Number.NaN,
      minEstimate: Number.NaN,
      maxEstimate: Number.NaN,
      range: Number.NaN,
      coefficientOfVariation: Number.NaN,
      maxPairwiseAbsDiff: Number.NaN,
    };
  }
  let minV = xs[0]!;
  let maxV = xs[0]!;
  let sum = 0;
  for (const v of xs) {
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    sum += v;
  }
  const mean = sum / xs.length;
  let maxDiff = 0;
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      maxDiff = Math.max(maxDiff, Math.abs(xs[i]! - xs[j]!));
    }
  }
  return {
    meanEstimate: mean,
    minEstimate: minV,
    maxEstimate: maxV,
    range: maxV - minV,
    coefficientOfVariation: coefficientOfVariation(xs),
    maxPairwiseAbsDiff: maxDiff,
  };
}

type BlockIndex = { readonly blockId: string; readonly indices: readonly number[] };

function buildBlockIndex(rows: readonly HeliosOpeLogRow[]): readonly BlockIndex[] {
  const map = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    let list = map.get(row.blockId);
    if (!list) {
      list = [];
      map.set(row.blockId, list);
    }
    list.push(i);
  }
  return [...map.entries()].map(([blockId, indices]) => ({ blockId, indices }));
}

function drawBlockBootstrapSample(rows: readonly HeliosOpeLogRow[], blocks: readonly BlockIndex[], rng: () => number): HeliosOpeLogRow[] {
  if (blocks.length === 0) return [];
  const chosen: HeliosOpeLogRow[] = [];
  for (let b = 0; b < blocks.length; b += 1) {
    const pick = Math.floor(rng() * blocks.length);
    const block = blocks[pick]!;
    for (const idx of block.indices) {
      chosen.push(rows[idx]!);
    }
  }
  return chosen;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = (sorted.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low]!;
  const w = idx - low;
  return sorted[low]! * (1 - w) + sorted[high]! * w;
}

function bootstrapStd(samples: readonly number[]): number {
  const xs = samples.filter((v) => Number.isFinite(v));
  if (xs.length < 2) return Number.NaN;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(Math.max(v, 0));
}

function pointForEstimator(kind: OpeEstimatorKind, sample: readonly HeliosOpeLogRow[], opts: OffPolicyEvaluationOptions): number {
  switch (kind) {
    case 'DIRECT_METHOD':
      return directMethodPoint(sample, opts.annotationDirectPolicy);
    case 'IPS':
      return ipsPoint(sample);
    case 'SELF_NORMALIZED_IPS': {
      const { value } = snipsPoint(sample);
      return value;
    }
    case 'DOUBLY_ROBUST':
      return doublyRobustPoint(sample);
    case 'SWITCH_DOUBLY_ROBUST':
      return switchDoublyRobustPoint(sample, opts.switchImportanceCap);
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function effectiveSampleForEstimator(kind: OpeEstimatorKind, sample: readonly HeliosOpeLogRow[], opts: OffPolicyEvaluationOptions): number {
  if (sample.length === 0) return 0;
  switch (kind) {
    case 'DIRECT_METHOD':
      return sample.length;
    case 'IPS':
    case 'DOUBLY_ROBUST':
      return effectiveSampleSizeFromImportanceRatios(sample);
    case 'SWITCH_DOUBLY_ROBUST':
      return effectiveSampleSizeFromImportanceRatios(sample, opts.switchImportanceCap);
    case 'SELF_NORMALIZED_IPS': {
      const { ess } = snipsPoint(sample);
      return ess;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function buildEstimate(
  kind: OpeEstimatorKind,
  point: number,
  ess: number,
  support: PropensitySupportSummary,
  rows: readonly HeliosOpeLogRow[],
  opts: OffPolicyEvaluationOptions,
  bootstrapSamples: readonly number[],
): OffPolicyEstimate {
  const notes: string[] = [];
  if (opts.contextAdaptiveSwitch.enabled && kind === 'SWITCH_DOUBLY_ROBUST') {
    notes.push(`switch_cap_tau=${opts.switchImportanceCap}`);
  }

  const annUsedPerRow = rows.map((r) => usedAnnotationInDirect(r, opts.annotationDirectPolicy));
  const anyAnn = annUsedPerRow.some(Boolean);
  if (kind === 'DIRECT_METHOD' && !anyAnn && rows.some((r) => r.annotation)) {
    notes.push('annotations_present_but_direct_policy_forbid');
  }

  const diagnostics: EstimatorDiagnostics = {
    estimator: kind,
    pointEstimate: point,
    effectiveSampleSize: ess,
    usedAnnotationInDirectMethod: kind === 'DIRECT_METHOD' ? anyAnn : false,
    bootstrapStdError: bootstrapStd(bootstrapSamples),
    notes: Object.freeze(notes),
  };

  const level = opts.bootstrap.confidenceLevel;
  const sorted = [...bootstrapSamples].filter(Number.isFinite).sort((a, b) => a - b);
  let ci: OffPolicyConfidenceInterval | null = null;
  if (sorted.length >= 10) {
    const alpha = (1 - level) / 2;
    ci = {
      level,
      lower: percentile(sorted, alpha),
      upper: percentile(sorted, 1 - alpha),
      method: 'block_bootstrap_percentile',
    };
  }

  return {
    estimator: kind,
    expectedOutcome: point,
    confidenceInterval: ci,
    effectiveSampleSize: ess,
    support,
    diagnostics,
    annotationQuality: collectAnnotationQuality(rows),
  };
}

/**
 * Multi-estimator off-policy evaluation (CF05). IPS-type estimators use logged propensities only;
 * counterfactual annotations never substitute for observed actions in weighting.
 */
export function evaluateOffPolicyMultiEstimator(
  rows: readonly HeliosOpeLogRow[],
  options: Partial<OffPolicyEvaluationOptions> = {},
): MultiEstimatorOffPolicyResult {
  const opts = mergeOptions(options);
  const allKinds: readonly OpeEstimatorKind[] = [
    'DIRECT_METHOD',
    'IPS',
    'SELF_NORMALIZED_IPS',
    'DOUBLY_ROBUST',
    'SWITCH_DOUBLY_ROBUST',
  ];
  const want = opts.estimators ?? new Set(allKinds);
  const kinds = allKinds.filter((k) => want.has(k));

  const blocks = buildBlockIndex(rows);
  const rng = mulberry32(opts.bootstrap.rngSeed >>> 0);

  const estimates: OffPolicyEstimate[] = [];

  for (const kind of kinds) {
    const point = pointForEstimator(kind, rows, opts);
    const ess = effectiveSampleForEstimator(kind, rows, opts);
    const support = summarizeSupport(rows, kind === 'SWITCH_DOUBLY_ROBUST' ? opts.switchImportanceCap : undefined);

    const boot: number[] = [];
    for (let r = 0; r < opts.bootstrap.bootstrapReplicates; r += 1) {
      const sample = drawBlockBootstrapSample(rows, blocks, rng);
      boot.push(pointForEstimator(kind, sample, opts));
    }

    estimates.push(buildEstimate(kind, point, ess, support, rows, opts, boot));
  }

  const pointMap = new Map(estimates.map((e) => [e.estimator, e.expectedOutcome] as const));
  const points = [...pointMap.values()].filter((v) => Number.isFinite(v));
  const agreement = estimatorAgreementFrom(points);

  const status =
    agreement.coefficientOfVariation > opts.inconclusiveCovThreshold ? 'INCONCLUSIVE' : 'OK';

  const blockers: string[] = [];
  if (rows.length === 0) blockers.push('empty_log');
  const snipsEss = pointMap.has('SELF_NORMALIZED_IPS')
    ? estimates.find((e) => e.estimator === 'SELF_NORMALIZED_IPS')?.effectiveSampleSize ?? 0
    : snipsPoint(rows).ess;
  if (snipsEss < opts.minimumEffectiveSampleSize) blockers.push('low_effective_sample_size');
  const support = summarizeSupport(rows);
  if (support.maxImportanceRatio > opts.maximumImportanceRatio) blockers.push('weak_support_large_weights');
  if (rows.some((r) => r.behaviorPropensity <= 0)) blockers.push('non_positive_behavior_propensity');
  const drPoint = pointMap.get('DOUBLY_ROBUST');
  if (!Number.isFinite(drPoint ?? Number.NaN)) blockers.push('doubly_robust_non_finite');

  let drVar = Number.NaN;
  let snipsVar = Number.NaN;
  for (const e of estimates) {
    const se = e.diagnostics.bootstrapStdError;
    if (!Number.isFinite(se ?? Number.NaN)) continue;
    const v = (se as number) ** 2;
    if (e.estimator === 'DOUBLY_ROBUST') drVar = v;
    if (e.estimator === 'SELF_NORMALIZED_IPS') snipsVar = v;
  }

  const enriched =
    opts.contextAdaptiveSwitch.enabled &&
    Number.isFinite(drVar) &&
    Number.isFinite(snipsVar) &&
    snipsVar > 0 &&
    drVar > opts.contextAdaptiveSwitch.varianceRatioThreshold * snipsVar
      ? estimates.map((est) => {
          if (est.estimator !== 'SWITCH_DOUBLY_ROBUST') return est;
          const extra = `high_dr_bootstrap_variance_vs_snips_ratio threshold=${opts.contextAdaptiveSwitch.varianceRatioThreshold}`;
          return {
            ...est,
            diagnostics: {
              ...est.diagnostics,
              notes: Object.freeze([...est.diagnostics.notes, extra]),
            },
          };
        })
      : estimates;

  const qualified = blockers.length === 0 && status !== 'INCONCLUSIVE';

  return Object.freeze({
    schemaVersion: HELIOS_CF05_SCHEMA,
    status,
    estimates: Object.freeze(enriched),
    estimatorAgreement: agreement,
    qualification: Object.freeze({
      qualified,
      marker: qualified ? HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED : HELIOS_CF05_OPE_BLOCKED,
      blockers: Object.freeze(blockers),
    }),
  });
}
