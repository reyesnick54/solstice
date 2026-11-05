import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { ValuationTimeHorizon } from './taxonomy.ts';
import type {
  ExpectationGap,
  FrozenValuationEvidencePack,
  MarketImpliedExpectation,
  ValuationAssumptionChallengeState,
  ValuationInvestmentThesis,
  ValuationSpecialistArtifact,
} from './types.ts';

function weightedPerShare(state: ValuationAssumptionChallengeState): bigint {
  let sum = 0n;
  let weight = 0;
  for (const band of state.intrinsicValueDistribution) {
    sum += (band.perShareMinor * BigInt(Math.round(band.probability * 1000))) / 1000n;
    weight += band.probability;
  }
  if (weight <= 0) return state.intrinsicValueDistribution[0]?.perShareMinor ?? 0n;
  return sum;
}

export function buildValuationInvestmentThesis(input: {
  readonly workOrderId: string;
  readonly entity: string;
  readonly instrumentId: string;
  readonly timeHorizon: ValuationTimeHorizon;
  readonly informationTime: UtcInstant;
  readonly expirationTime: UtcInstant;
  readonly pack: FrozenValuationEvidencePack;
  readonly assumptionChallengeState: ValuationAssumptionChallengeState;
  readonly artifacts: readonly ValuationSpecialistArtifact[];
  readonly assignedCoverage: readonly string[];
}): ValuationInvestmentThesis {
  const bull = input.artifacts.find((row) => row.role === 'BULL_VALUATION');
  const bear = input.artifacts.find((row) => row.role === 'BEAR_VALUATION');
  const synthesis = input.artifacts.find((row) => row.role === 'VALUATION_SYNTHESIS');
  const reverseDcf = input.artifacts.find((row) => row.role === 'REVERSE_DCF_CHALLENGE');
  const dcf = input.artifacts.find((row) => row.role === 'DCF_VALUATION');
  const wacc = input.artifacts.find((row) => row.role === 'COST_OF_CAPITAL');

  const basePerShare = weightedPerShare(input.assumptionChallengeState);
  const bullBand = input.assumptionChallengeState.intrinsicValueDistribution.find(
    (row) => row.label === 'BULL',
  );
  const bearBand = input.assumptionChallengeState.intrinsicValueDistribution.find(
    (row) => row.label === 'BEAR',
  );

  const marketImpliedExpectations: MarketImpliedExpectation[] = [];
  if (input.assumptionChallengeState.marketPriceMinor != null) {
    marketImpliedExpectations.push(
      Object.freeze({
        metric: 'PRICE_PER_SHARE',
        impliedView: `Market ${input.assumptionChallengeState.marketPriceMinor.toString()} minor units`,
        evidenceRef: input.pack.evidence[0]?.evidenceId ?? 'market_observation',
      }),
    );
  }
  if (input.assumptionChallengeState.impliedGrowthBps != null) {
    marketImpliedExpectations.push(
      Object.freeze({
        metric: 'IMPLIED_REVENUE_GROWTH',
        impliedView: `${input.assumptionChallengeState.impliedGrowthBps} bps embedded in price`,
        evidenceRef: input.pack.evidence[0]?.evidenceId ?? 'reverse_dcf_placeholder',
      }),
    );
  }
  if (input.assumptionChallengeState.impliedWaccBps != null) {
    marketImpliedExpectations.push(
      Object.freeze({
        metric: 'IMPLIED_WACC',
        impliedView: `${input.assumptionChallengeState.impliedWaccBps} bps discount rate implied by market`,
        evidenceRef: input.pack.evidence[0]?.evidenceId ?? 'reverse_dcf_placeholder',
      }),
    );
  }

  const expectationGaps: ExpectationGap[] = [];
  if (input.assumptionChallengeState.marketPriceMinor != null) {
    const gapMinor = basePerShare - input.assumptionChallengeState.marketPriceMinor;
    expectationGaps.push(
      Object.freeze({
        topic: 'INTRINSIC_VS_MARKET',
        intrinsicView: `Committee base intrinsic ${basePerShare.toString()} minor per share`,
        marketImplied: `Observed market ${input.assumptionChallengeState.marketPriceMinor.toString()} minor per share`,
        gapSummary: `Gap ${gapMinor.toString()} minor units per share (simulation intelligence only)`,
        evidenceRefs: Object.freeze(input.pack.evidence.map((row) => row.evidenceId).slice(0, 4)),
      }),
    );
  }
  if (reverseDcf && dcf) {
    expectationGaps.push(
      Object.freeze({
        topic: 'GROWTH_AND_TERMINAL',
        intrinsicView: dcf.thesis.slice(0, 120),
        marketImplied: reverseDcf.thesis.slice(0, 120),
        gapSummary: 'Forward DCF assumptions vs reverse-implied market expectations',
        evidenceRefs: Object.freeze([
          ...reverseDcf.supportingEvidence.slice(0, 2),
          ...dcf.supportingEvidence.slice(0, 2),
        ]),
      }),
    );
  }

  const keyAssumptions = input.artifacts
    .filter((row) =>
      [
        'REVENUE_FORECAST',
        'MARGIN',
        'COST_OF_CAPITAL',
        'DCF_VALUATION',
        'CAPITAL_INTENSITY',
        'SOTP',
      ].includes(row.role),
    )
    .map((row) => `${row.role}: ${row.thesis.slice(0, 130)}`);

  const fragileAssumptions = input.artifacts
    .flatMap((row) => row.challengesIssued)
    .concat(
      input.artifacts
        .filter((row) => row.confidence < 0.55)
        .map((row) => `Low confidence ${row.role}: ${row.uncertainty.slice(0, 100)}`),
    )
    .slice(0, 10);

  const contradicting = input.artifacts.flatMap((row) => row.contradictingEvidence).slice(0, 12);

  const avgConfidence =
    input.artifacts.length > 0
      ? input.artifacts.reduce((sum, row) => sum + row.confidence, 0) / input.artifacts.length
      : 0.5;

  const thesisId = `vit_${createHash('sha256')
    .update(`${input.workOrderId}:${input.pack.contentHash}:${input.pack.factsHash}`)
    .digest('hex')
    .slice(0, 18)}`;

  const baseSummary =
    synthesis?.thesis ??
    `Base valuation for ${input.entity} (${input.instrumentId}) from assumption challenge state ${input.assumptionChallengeState.stateId}.`;

  return Object.freeze({
    thesisId,
    entity: input.entity,
    instrumentId: input.instrumentId,
    timeHorizon: input.timeHorizon,
    intrinsicValueDistribution: input.assumptionChallengeState.intrinsicValueDistribution,
    marketImpliedExpectations: Object.freeze([...marketImpliedExpectations]),
    expectationGaps: Object.freeze(expectationGaps.length > 0 ? expectationGaps : [
      Object.freeze({
        topic: 'COVERAGE',
        intrinsicView: baseSummary.slice(0, 120),
        marketImplied: 'Market-implied metrics unavailable — insufficient entitled evidence',
        gapSummary: 'Committee documents coverage-limited expectation gap',
        evidenceRefs: Object.freeze(input.pack.evidence.map((row) => row.evidenceId).slice(0, 2)),
      }),
    ]),
    baseCase: Object.freeze({
      summary: baseSummary,
      perShareMinor: basePerShare,
      keyPoints: Object.freeze(keyAssumptions.slice(0, 4)),
      confidence: synthesis?.confidence ?? avgConfidence,
    }),
    bullCase: Object.freeze({
      summary: bull?.thesis ?? `Bull valuation path for ${input.entity}.`,
      perShareMinor: bullBand?.perShareMinor ?? null,
      keyPoints: Object.freeze(bull?.supportingEvidence.slice(0, 4) ?? []),
      confidence: bull?.confidence ?? 0.5,
    }),
    bearCase: Object.freeze({
      summary: bear?.thesis ?? `Bear valuation path for ${input.entity}.`,
      perShareMinor: bearBand?.perShareMinor ?? null,
      keyPoints: Object.freeze(bear?.supportingEvidence.slice(0, 4) ?? []),
      confidence: bear?.confidence ?? 0.5,
    }),
    keyAssumptions: Object.freeze(keyAssumptions.length > 0 ? keyAssumptions : [baseSummary.slice(0, 140)]),
    fragileAssumptions: Object.freeze(
      fragileAssumptions.length > 0
        ? fragileAssumptions
        : [`WACC and terminal growth hinge on ${wacc?.role ?? 'COST_OF_CAPITAL'} fixture depth`],
    ),
    contradictingEvidence: Object.freeze(contradicting),
    confidence: avgConfidence,
    uncertainty: `Committee uncertainty score ${input.assumptionChallengeState.uncertaintyScore.toFixed(2)}; valuation intelligence only — no order authority.`,
    evidenceRefs: Object.freeze(input.pack.evidence.map((row) => row.evidenceId)),
    AAFQualification: Object.freeze({
      pointInTimeFrozen: true,
      simulationOnly: true as const,
      futureLeakRejected: true,
      canonicalFactsImmutable: true as const,
      note: 'Evidence and canonical financial facts hashed at committee start; simulation ENVIRONMENT only.',
    }),
    expirationTime: input.expirationTime,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}
