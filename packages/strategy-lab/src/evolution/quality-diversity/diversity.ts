import type { BehaviorDescriptors, DiversityCollapseReport, NicheArchive, NicheElite } from './types.ts';

function behaviorVector(d: BehaviorDescriptors): readonly number[] {
  return [
    d.holdingHorizonBin,
    d.turnoverBin,
    d.trendSensitivityBin,
    d.meanReversionSensitivityBin,
    d.valuationSensitivityBin,
    d.earningsSensitivityBin,
    d.macroSensitivityBin,
    d.volatilityPreferenceBin,
    d.liquidityRequirementBin,
    d.marketBetaBin,
  ];
}

function assetClassOrdinal(x: BehaviorDescriptors['assetClass']): number {
  const order = [
    'EQUITY',
    'FIXED_INCOME',
    'COMMODITY',
    'CRYPTO',
    'FX',
    'MULTI_ASSET',
    'OTHER',
  ] as const;
  return order.indexOf(x);
}

function signalOrdinal(x: BehaviorDescriptors['signalFamily']): number {
  const order = [
    'MOMENTUM',
    'MEAN_REVERSION',
    'VALUE',
    'CARRY',
    'EVENT',
    'STAT_ARB',
    'MACHINE_LEARNED',
    'HYBRID',
    'OTHER',
  ] as const;
  return order.indexOf(x);
}

function regimeOrdinal(x: BehaviorDescriptors['regimePreference']): number {
  const order = [
    'TRENDING',
    'MEAN_REVERTING',
    'HIGH_VOL',
    'LOW_VOL',
    'RISK_ON',
    'RISK_OFF',
    'NEUTRAL',
  ] as const;
  return order.indexOf(x);
}

function drawdownOrdinal(x: BehaviorDescriptors['drawdownProfile']): number {
  const order = ['SHALLOW', 'MODERATE', 'DEEP', 'UNKNOWN'] as const;
  return order.indexOf(x);
}

function longShortOrdinal(x: BehaviorDescriptors['longShortBias']): number {
  const order = ['LONG_ONLY', 'LONG_BIASED', 'MARKET_NEUTRAL', 'SHORT_BIASED', 'SHORT_ONLY'] as const;
  return order.indexOf(x);
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 1;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) {
    return 1;
  }
  return dot / denom;
}

function fullDescriptorVector(e: NicheElite): number[] {
  const b = e.descriptor.behavior;
  const continuous = behaviorVector(b);
  return [
    ...continuous,
    assetClassOrdinal(b),
    signalOrdinal(b),
    drawdownOrdinal(b),
    longShortOrdinal(b),
    regimeOrdinal(b),
  ];
}

/**
 * Reserved research fraction for unexplored niches — scales linearly with empty fraction.
 */
export function researchBudgetForEmptyNiches(input: {
  readonly emptyNicheFraction: number;
  readonly totalResearchBudget: number;
}): number {
  if (input.totalResearchBudget <= 0 || !Number.isFinite(input.totalResearchBudget)) {
    return 0;
  }
  const f = Math.max(0, Math.min(1, input.emptyNicheFraction));
  return input.totalResearchBudget * f;
}

export function assessDiversityCollapse(
  archive: NicheArchive,
  thresholds: { readonly maxGeneticSimilarityMass: number; readonly maxBehavioralSimilarityMean: number },
): DiversityCollapseReport {
  const elites = [...archive.elites.values()];
  if (elites.length === 0) {
    return {
      geneticSimilarityMass: 0,
      behavioralSimilarityMean: 0,
      collapseDetected: false,
      modeGenomeHash: null,
    };
  }

  const hashCounts = new Map<string, number>();
  for (const e of elites) {
    const h = e.candidate.genomeHash ?? '__null__';
    hashCounts.set(h, (hashCounts.get(h) ?? 0) + 1);
  }
  let modeHash: string | null = null;
  let modeCount = 0;
  for (const [h, c] of hashCounts) {
    if (c > modeCount) {
      modeCount = c;
      modeHash = h === '__null__' ? null : h;
    }
  }
  const geneticMass = modeCount / elites.length;

  let simSum = 0;
  let pairCount = 0;
  const vectors = elites.map(fullDescriptorVector);
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      simSum += cosineSimilarity(vectors[i]!, vectors[j]!);
      pairCount++;
    }
  }
  const behavioralMean = pairCount === 0 ? 0 : simSum / pairCount;

  const collapse =
    geneticMass > thresholds.maxGeneticSimilarityMass ||
    behavioralMean > thresholds.maxBehavioralSimilarityMean;

  return {
    geneticSimilarityMass: geneticMass,
    behavioralSimilarityMean: behavioralMean,
    collapseDetected: collapse,
    modeGenomeHash: modeHash,
  };
}
