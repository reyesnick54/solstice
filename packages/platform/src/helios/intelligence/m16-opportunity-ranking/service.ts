import type { EvidenceVault } from '@solstice/evidence';
import { assembleOpportunityCandidates } from '../m15-opportunity-assembly/assembly.ts';
import type { OpportunityAssemblyInput } from '../m15-opportunity-assembly/types.ts';
import { buildCrossAssetOpportunityGraph, deriveCorrelationWarnings } from '../m14-opportunity-graph/graph.ts';
import type { GraphBuildInput } from '../m14-opportunity-graph/types.ts';
import { evaluateRegime, assessRegimeCompatibility } from '../m13-regime/engine.ts';
import type { RegimeEngineInput } from '../m13-regime/types.ts';
import { sealOpportunityRankingRun } from './evidence.ts';
import { bridgeRankedOpportunitiesToMetaAllocator } from './meta-allocator-bridge.ts';
import { rankOpportunities } from './ranker.ts';
import { InMemoryOpportunityRankingStore } from './store.ts';
import type {
  OpportunityRankingCandidateInput,
  OpportunityRankingEvaluateInput,
  OpportunityRankingFactorInput,
  RankingRunResult,
} from './types.ts';
import type { TradingCostAssumptions } from '../../meta-allocator/types.ts';
import type { MarketState } from '../../multi-asset/market-state-types.ts';

export type HeliosOpportunityRankingPipelineInput = {
  readonly assembly: OpportunityAssemblyInput;
  readonly regimeInputsByInstrumentId: Readonly<Record<string, RegimeEngineInput>>;
  readonly factorOverridesByOpportunityId: Readonly<
    Record<string, Partial<OpportunityRankingFactorInput>>
  >;
  readonly graph: Omit<GraphBuildInput, 'candidates' | 'now'>;
  readonly ranking: Omit<OpportunityRankingEvaluateInput, 'candidates'>;
  readonly defaultCosts: TradingCostAssumptions;
  readonly vault?: EvidenceVault;
};

export type HeliosOpportunityRankingPipelineResult = {
  readonly assemblyId: string;
  readonly ranking: RankingRunResult;
  readonly evidenceRef: string | null;
  readonly metaAllocatorEligibleCount: number;
  readonly grantsExecutionAuthority: false;
};

export class HeliosOpportunityRankingService {
  private readonly store: InMemoryOpportunityRankingStore;

  constructor(options?: { readonly store?: InMemoryOpportunityRankingStore }) {
    this.store = options?.store ?? new InMemoryOpportunityRankingStore();
  }

  getStore(): InMemoryOpportunityRankingStore {
    return this.store;
  }

  runPipeline(input: HeliosOpportunityRankingPipelineInput): HeliosOpportunityRankingPipelineResult {
    const assembly = assembleOpportunityCandidates(input.assembly);

    const graphCandidates = assembly.accepted.map((c) =>
      Object.freeze({
        candidateId: c.candidateId,
        instrumentId: c.instrumentIds[0] ?? 'UNKNOWN',
        assetClass: c.assetClass,
        sector: c.sector,
        strategyFamily: c.strategyFamily,
      }),
    );

    const graph = buildCrossAssetOpportunityGraph({
      ...input.graph,
      candidates: graphCandidates,
      now: input.ranking.now,
    });

    const rankingCandidates: OpportunityRankingCandidateInput[] = assembly.accepted.map((candidate) => {
      const instrumentId = candidate.instrumentIds[0] ?? 'UNKNOWN';
      const regimeInput = input.regimeInputsByInstrumentId[instrumentId];
      const regimeAssessment = regimeInput ? evaluateRegime(regimeInput) : null;
      const regimeCompatibility = assessRegimeCompatibility(
        candidate.strategyFamily,
        regimeAssessment?.regime ?? 'UNKNOWN',
      );
      const correlationWarnings = deriveCorrelationWarnings(graph, candidate.candidateId);
      const correlationPenaltyBps = correlationWarnings[0]?.maxCorrelationBps ?? 0;
      const overrides = input.factorOverridesByOpportunityId[candidate.opportunityId] ?? {};

      const baseFactors: OpportunityRankingFactorInput = {
        strategyConfidenceBps: 7500,
        historicalQualificationState: 'QUALIFIED',
        regimeCompatibility,
        expectedRewardEvidenceBps: null,
        expectedDownsideEvidenceBps: null,
        realizedVolatilityBps: 1500,
        liquidityScore: 80,
        spreadBps: 15,
        estimatedFeesBps: 10,
        estimatedSlippageBps: 8,
        dataQualityScore: 85,
        evidenceQualityScore: 80,
        signalFreshnessScore: 90,
        correlationPenaltyBps,
        capitalRequirementMinor: '5000',
        availableCapitalMinor: '100000',
        providerAvailable: true,
        executionReady: true,
        expiresAt: candidate.expiresAt,
        dataQualityWarnings: Object.freeze([]),
        correlationWarnings,
        evidenceRefs: candidate.evidenceRefs,
        ...overrides,
      };

      return Object.freeze({ candidate, factors: baseFactors });
    });

    const rankingResult = rankOpportunities({
      ...input.ranking,
      candidates: Object.freeze(rankingCandidates),
    });

    const evidenceRef = sealOpportunityRankingRun(input.vault, rankingResult);
    this.store.saveRun(rankingResult);

    const handoff = bridgeRankedOpportunitiesToMetaAllocator({
      rankingResult,
      defaultCosts: input.defaultCosts,
      now: input.ranking.now,
    });

    return Object.freeze({
      assemblyId: assembly.assemblyId,
      ranking: rankingResult,
      evidenceRef,
      metaAllocatorEligibleCount: handoff.eligible.length,
      grantsExecutionAuthority: false as const,
    });
  }
}

export function marketStateRegimeInput(marketState: MarketState, now: import('@solstice/domain').UtcInstant): RegimeEngineInput {
  return Object.freeze({ marketState, now });
}
