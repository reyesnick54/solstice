import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
/** Portable ref shape consumed by Strategy Lab promotion gates (defined here to avoid platform→strategy-lab imports). */
export type StrategyLabAdaptiveAlphaQualificationRef = {
  readonly qualificationId: string;
  readonly contentHash: string;
  readonly promotionPermitted: boolean;
  readonly failedGates: readonly string[];
  readonly policyHash: string;
};
import type { TemporalObservation } from '../feature-fabric/temporal-types.ts';
import type { FeatureCoverageProbe } from '../feature-fabric/feature-coverage/types.ts';
import type { UniverseEntityCharacteristics } from '../feature-fabric/aaf06/coverage-bias-types.ts';
import {
  buildAdaptiveAlphaCompilerContext,
  runAdaptiveAlphaResearchPipeline,
} from './pipeline.ts';
import type { AdaptiveAlphaQualification } from './types.ts';

export function toStrategyLabAdaptiveAlphaQualificationRef(
  qualification: AdaptiveAlphaQualification,
): StrategyLabAdaptiveAlphaQualificationRef {
  const failedGates = qualification.certification.gateVerdicts
    .filter((row) => row.status === 'FAIL')
    .map((row) => row.gate);
  return Object.freeze({
    qualificationId: qualification.qualificationId,
    contentHash: qualification.certification.contentHash,
    promotionPermitted: qualification.promotionPermitted,
    failedGates: Object.freeze(failedGates),
    policyHash: qualification.evidenceBundle.policyHash,
  });
}

function obs(partial: TemporalObservation): TemporalObservation {
  return Object.freeze(partial);
}

export function certifyStrategyLabBaselineDataset(input: {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly strategyEvaluationId: string;
  readonly qualifiedAt: UtcInstant;
  readonly evidenceVault?: EvidenceVault | null;
}): AdaptiveAlphaQualification {
  const decision = input.qualifiedAt;
  const marketClose = new Date(Date.parse(decision) - 3_600_000).toISOString() as UtcInstant;
  const entity = 'ent_strategy_lab_baseline';
  const instrument = 'inst_strategy_lab_baseline';
  const observations: TemporalObservation[] = [
    obs({
      observationRef: 'mkt_bar',
      kind: 'MARKET_BAR',
      entityId: entity,
      instrumentId: instrument,
      sourceEventTime: marketClose,
      knowableAt: marketClose,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: null,
      valueMinor: 10_000n,
      metadata: Object.freeze({ venue: 'sandbox' }),
    }),
    obs({
      observationRef: 'sec_filing',
      kind: 'CORPORATE_FILING',
      entityId: entity,
      instrumentId: instrument,
      sourceEventTime: marketClose,
      knowableAt: marketClose,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: marketClose,
      valueMinor: 1n,
      metadata: Object.freeze({ form: '10-Q' }),
    }),
    obs({
      observationRef: 'macro_cpi',
      kind: 'MACRO_RELEASE',
      entityId: entity,
      instrumentId: null,
      sourceEventTime: marketClose,
      knowableAt: marketClose,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: null,
      valueMinor: 250n,
      metadata: Object.freeze({ series: 'CPI' }),
    }),
    obs({
      observationRef: 'alt_sentiment',
      kind: 'ALT_DATA',
      entityId: entity,
      instrumentId: instrument,
      sourceEventTime: marketClose,
      knowableAt: marketClose,
      validUntil: null,
      revisionSequence: 0,
      periodEnd: null,
      publishedKnowableAt: null,
      valueMinor: 42n,
      metadata: Object.freeze({ provider: 'fixture_alt' }),
    }),
  ];
  const context = buildAdaptiveAlphaCompilerContext({
    observations,
    entityResolutionVersion: 'eres_strategy_lab_baseline_v1',
  });
  const member = Object.freeze({
    canonicalEntityId: entity,
    canonicalInstrumentId: instrument,
    evaluationTimestamp: decision,
    sector: 'TECH',
    industry: null,
    marketCapBucket: 'LARGE',
    liquidityBucket: 'HIGH',
    geography: 'US',
    venue: 'sandbox',
    assetClass: 'EQUITY',
  });
  const probes: FeatureCoverageProbe[] = [
    Object.freeze({
      member,
      featureId: 'close_minor',
      providerId: 'sandbox',
      signal: Object.freeze({
        published: true,
        providerAvailable: true,
        providerCoversInstrument: true,
        entitlementState: 'USABLE',
        entityResolved: true,
        applicable: true,
        qualityState: 'VALID',
        historicalGap: false,
        knowableAtEvaluationTime: true,
        valuePresent: true,
      }),
    }),
  ];
  const entities: UniverseEntityCharacteristics[] = [];
  for (let i = 0; i < 40; i += 1) {
    entities.push(
      Object.freeze({
        entityId: `ent_balanced_${i}`,
        marketCapMinor: 5_000_000_000n,
        liquidityScore: 50,
        volatilityBps: 1_000,
        sector: 'TECH',
        geography: 'US',
        listingAgeDays: 800,
        historicalReturnBps: 300,
        assetClass: 'EQUITY',
      }),
    );
  }
  const pipeline = runAdaptiveAlphaResearchPipeline({
    hypothesisRef: 'strategy-lab-baseline',
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    strategyEvaluationId: input.strategyEvaluationId,
    featureRequirements: Object.freeze(['close_minor']),
    featureDefinitions: Object.freeze([
      Object.freeze({
        featureId: 'close_minor',
        version: '1',
        computeKind: 'AS_OF_SCALAR',
        observationKind: 'MARKET_BAR',
        instrumentId: instrument,
      }),
    ]),
    entityId: entity,
    instrumentId: instrument,
    decisionTimes: Object.freeze([decision]),
    compilerContext: context,
    universeVersion: 'univ_strategy_lab_baseline',
    eligibleMembers: Object.freeze([member]),
    coverageProbes: Object.freeze(probes),
    biasAssessmentInput: {
      assessmentId: 'cba_baseline_balanced',
      researchDatasetId: input.strategyEvaluationId,
      evaluatedAt: decision,
      eligibleUniverse: entities,
      featureCoveredEntityIds: entities.map((row) => row.entityId),
    },
    actorKind: 'QUALIFICATION_SERVICE',
    qualifiedAt: input.qualifiedAt,
    evidenceVault: input.evidenceVault ?? null,
  });
  if (!pipeline.ok) {
    throw new Error(`baseline AAF certification failed at ${pipeline.stage}: ${pipeline.message}`);
  }
  return pipeline.qualification;
}
