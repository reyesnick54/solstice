import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
} from '../taxonomy.ts';

import {
  evaluateIntrinsicModelApplicability,
  evaluateMarketReferencedModelApplicability,
  inferCharacteristicTags,
  type EnsembleCompanyCharacteristics,
} from './applicability.ts';
import { aggregateIntrinsicLane, aggregateMarketReferencedLane, computeModelDisagreement } from './aggregation.ts';
import { generateModelChallengerCases } from './challenger.ts';
import {
  assertAllIntrinsicCandidatesPriceFree,
  assertLanesNotBlended,
  type LaneSeparationViolation,
} from './lane-separation.ts';
import { buildValuationReconciliation } from './reconciliation.ts';
import { buildModelReliabilityState, type HistoricalModelResearchRecord } from './reliability.ts';
import { appendModelTrustLedgerEntry, createModelTrustLedger } from './trust-ledger.ts';
import { VAL11_ENSEMBLE_SCHEMA } from './taxonomy.ts';
import type {
  IntrinsicModelCandidate,
  MarketReferencedModelCandidate,
  ModelTrustLedger,
  ValuationEnsembleState,
} from './types.ts';
import { computeAdaptiveModelWeights } from './weighting.ts';

export type RunVal11EnsembleInput = {
  readonly ensembleId: string;
  readonly entityId: string;
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly currency: string;
  readonly company: EnsembleCompanyCharacteristics;
  readonly intrinsicCandidates: readonly IntrinsicModelCandidate[];
  readonly marketReferencedCandidates: readonly MarketReferencedModelCandidate[];
  readonly historicalReliability: readonly HistoricalModelResearchRecord[];
  readonly trustLedger?: ModelTrustLedger;
};

export type Val11EnsembleRunResult = {
  readonly state: ValuationEnsembleState;
  readonly trustLedger: ModelTrustLedger;
  readonly laneSeparationViolations: readonly LaneSeparationViolation[];
};

export function runVal11AdaptiveValuationEnsemble(input: RunVal11EnsembleInput): Val11EnsembleRunResult {
  const tags = inferCharacteristicTags(input.company);

  const applicabilityStates = Object.freeze([
    ...input.intrinsicCandidates.map((c) => evaluateIntrinsicModelApplicability(input.company, c.method)),
    ...input.marketReferencedCandidates.map((c) =>
      evaluateMarketReferencedModelApplicability(input.company, c.method),
    ),
  ]);

  const reliabilityStates = Object.freeze(
    input.historicalReliability.map((record) => {
      const applicability = applicabilityStates.find((a) => a.method === record.method);
      return buildModelReliabilityState(record, applicability?.applicabilityScore ?? 0.3);
    }),
  );

  const uncertaintyByMethod: Record<string, number> = {};
  for (const c of [...input.intrinsicCandidates, ...input.marketReferencedCandidates]) {
    uncertaintyByMethod[String(c.method)] = c.uncertaintyScore;
  }

  const modelWeights = computeAdaptiveModelWeights({
    applicability: applicabilityStates,
    reliability: reliabilityStates,
    currentUncertaintyByMethod: uncertaintyByMethod,
  });

  const intrinsicWeightSum = modelWeights
    .filter((w) => w.lane === 'INTRINSIC')
    .reduce((s, w) => s + w.posteriorWeight, 0);
  assertLanesNotBlended({
    intrinsicWeightSum,
    marketReferencedInIntrinsicSum: 0,
  });

  const intrinsicDistribution = aggregateIntrinsicLane({
    distributionId: `${input.ensembleId}:intrinsic`,
    currency: input.currency,
    candidates: input.intrinsicCandidates,
    weights: modelWeights,
  });

  const marketReferencedDistribution = aggregateMarketReferencedLane({
    distributionId: `${input.ensembleId}:market`,
    currency: input.currency,
    candidates: input.marketReferencedCandidates,
    weights: modelWeights,
  });

  const disagreement = Object.freeze([
    computeModelDisagreement(
      'INTRINSIC',
      input.intrinsicCandidates.map((c) => Object.freeze({ method: c.method, equityValuePerShareMinor: c.equityValuePerShareMinor })),
    ),
    computeModelDisagreement(
      'MARKET_REFERENCED',
      input.marketReferencedCandidates.map((c) =>
        Object.freeze({ method: c.method, equityValuePerShareMinor: c.equityValuePerShareMinor }),
      ),
    ),
  ]);

  const reconciliation = buildValuationReconciliation({
    reconciliationId: `${input.ensembleId}:reconciliation`,
    intrinsic: intrinsicDistribution,
    marketReferenced: marketReferencedDistribution,
    applicabilityNotes: applicabilityStates.flatMap((a) => a.reasons).slice(0, 6),
  });

  const challengerCases = generateModelChallengerCases({
    intrinsicCandidates: input.intrinsicCandidates,
    marketReferencedCandidates: input.marketReferencedCandidates,
    weights: modelWeights,
    currency: input.currency,
    baseIntrinsic: intrinsicDistribution,
    baseMarket: marketReferencedDistribution,
  });

  let trustLedger =
    input.trustLedger ??
    createModelTrustLedger({ ledgerId: `${input.ensembleId}:trust`, entityId: input.entityId });

  for (const applicability of applicabilityStates) {
    const reliability = reliabilityStates.find((r) => r.method === applicability.method);
    if (!reliability) continue;
    trustLedger = appendModelTrustLedgerEntry(trustLedger, {
      method: applicability.method,
      lane: applicability.lane,
      evaluationTime: input.evaluationTime,
      reliability,
      applicability,
      sealedAt: input.compiledAt,
    });
  }

  const laneSeparationViolations = assertAllIntrinsicCandidatesPriceFree(input.intrinsicCandidates);

  const state: ValuationEnsembleState = Object.freeze({
    schema: VAL11_ENSEMBLE_SCHEMA,
    valuationSchema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    authority: HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
    ensembleId: input.ensembleId,
    entityId: input.entityId,
    evaluationTime: input.evaluationTime,
    compiledAt: input.compiledAt,
    characteristicTags: tags,
    intrinsicCandidates: input.intrinsicCandidates,
    marketReferencedCandidates: input.marketReferencedCandidates,
    applicabilityStates,
    reliabilityStates,
    modelWeights,
    disagreement,
    intrinsicDistribution,
    marketReferencedDistribution,
    reconciliation,
    challengerCases,
    grantsExecutionAuthority: false,
    researchOnly: true,
    notAFact: true,
    opaqueAiPriceTarget: false,
  });

  return Object.freeze({ state, trustLedger, laneSeparationViolations });
}
