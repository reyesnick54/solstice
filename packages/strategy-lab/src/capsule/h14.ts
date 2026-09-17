import type { UtcInstant } from '../../../domain/src/time.ts';
import { asStrategyCapsuleId, asStrategyCapsuleVersion, asStrategyFamilyId } from './ids.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';
import type {
  StrategyCapsuleMaterial,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './types.ts';

/** Mirrors HELIOS H14 reference-price entry rule without importing platform. */
export const HELIOS_H14_RULE_ID = 'HELIOS_H14_REFERENCE_PRICE_ENTRY_V1';
export const HELIOS_H14_FAMILY_ID = asStrategyFamilyId('sfam_helios_h14_reference_price');
export const HELIOS_H14_CAPSULE_ID = asStrategyCapsuleId('scap_helios_h14_reference_price_v1');
export const HELIOS_H14_ENTRY_THRESHOLD_MINOR = '10100';
export const HELIOS_H14_EXIT_THRESHOLD_MINOR = '10300';
export const HELIOS_H14_ENTRY_QUANTITY_UNITS = '1000000000';

export function buildHeliosH14Material(): StrategyCapsuleMaterial {
  return Object.freeze({
    description: Object.freeze({
      strategyName: 'HELIOS H14 Reference Price Entry',
      hypothesis:
        'Enter when qualified reference mid is at or below the entry threshold; exit when mid reaches exit threshold.',
      economicRationale:
        'Deterministic mean-reversion style entry on reference price observation bound to executable opportunity terms.',
      intendedEdge: 'Reference mid dislocation below entry threshold with explicit exit discipline.',
      expectedOperatingRegime: 'PAPER executable opportunities with fresh reference price evidence.',
      knownFailureModes: Object.freeze([
        'Stale reference price',
        'Opportunity not qualified for proposal',
        'Spread/slippage exceeds assumptions',
      ]),
    }),
    instrumentUniverse: Object.freeze({
      supportedInstrumentClasses: Object.freeze(['EQUITY']),
      instrumentIds: Object.freeze([]),
      universeSelectionRules: Object.freeze(['HELIOS_EXECUTABLE_OPPORTUNITY_INSTRUMENT']),
      venues: Object.freeze(['PAPER_SIM']),
      currencies: Object.freeze(['USD']),
      liquidityRequirements: Object.freeze(['QUALIFIED_OPPORTUNITY_LIQUIDITY']),
      eligibilityRestrictions: Object.freeze(['QUALIFIED_FOR_PROPOSAL', 'WORK_ORDER_ACTIVE']),
    }),
    featureSpecification: Object.freeze({
      featureIds: Object.freeze(['reference_mid_minor', 'price_reference_as_of']),
      dataDependencies: Object.freeze(['helios.executable_opportunity.qualification_terms']),
      observationTypes: Object.freeze(['REFERENCE_PRICE']),
      lookbackWindows: Object.freeze(['0']),
      normalizationRules: Object.freeze(['minor_units_bigint']),
      transformationVersions: Object.freeze(['helios-observation-v1']),
      sourceProviderRequirements: Object.freeze(['HELIOS_MARKET_OBSERVATION']),
      freshnessRequirements: Object.freeze(['OPPORTUNITY_NOT_STALE']),
    }),
    modelDependencies: Object.freeze({
      grok: Object.freeze([]),
      s3m: Object.freeze([]),
      quantitative: Object.freeze([]),
      deterministicRuleId: HELIOS_H14_RULE_ID,
      deterministicRuleVersion: 'v1',
      featureEngineVersion: 'helios-paper-feature-v1',
    }),
    decisionRule: Object.freeze({
      ruleType: 'REFERENCE_PRICE_THRESHOLD',
      entryRule: Object.freeze({
        when: 'reference_mid_minor <= entry_threshold_minor',
        action: 'BUY',
        entryThresholdMinor: HELIOS_H14_ENTRY_THRESHOLD_MINOR,
        quantityUnits: HELIOS_H14_ENTRY_QUANTITY_UNITS,
        requiresOpenPosition: false,
      }),
      noActionRule: Object.freeze({
        when: 'no entry or exit condition met',
        action: 'NO_ACTION',
      }),
      exitRule: Object.freeze({
        when: 'reference_mid_minor >= exit_threshold_minor OR force_close',
        action: 'SELL',
        exitThresholdMinor: HELIOS_H14_EXIT_THRESHOLD_MINOR,
        quantityUnits: HELIOS_H14_ENTRY_QUANTITY_UNITS,
        requiresOpenPosition: true,
      }),
      invalidationRule: Object.freeze({
        when: 'opportunity_stale OR evidence_stale OR work_order_inactive',
        action: 'NO_ACTION',
      }),
      positionSizingRule: Object.freeze({
        quantityUnits: HELIOS_H14_ENTRY_QUANTITY_UNITS,
        maximumConcurrentPositions: 1,
      }),
      maximumExposureAssumptions: Object.freeze({
        maximumPortfolioAllocationPct: '2.00',
        sandboxAllocationBound: true,
      }),
      minimumEvidenceRequirements: Object.freeze({
        opportunityState: 'QUALIFIED_FOR_PROPOSAL',
        deterministicResearch: true,
      }),
    }),
    operatingAssumptions: Object.freeze({
      marketHours: Object.freeze(['PAPER_SESSION']),
      minimumLiquidity: 'QUALIFIED_OPPORTUNITY',
      quoteRequirements: Object.freeze(['REFERENCE_MID']),
      spreadLimitsBps: 50,
      dataDelayAssumptionMs: 0,
      maximumObservationAgeMs: 86_400_000,
      orderTypeAssumptions: Object.freeze(['MARKET_SIMULATION']),
      executionModelAssumptions: Object.freeze(['helios-paper-fill-v1']),
      accountSizeLimits: Object.freeze({ minimumSandboxMinor: '0' }),
      capacityAssumptions: Object.freeze(['SANDBOX_ALLOCATION_BOUND']),
    }),
    costModel: Object.freeze({
      commissionMinorPerShare: '0',
      spreadBps: 5,
      slippageBps: 10,
      exchangeFeesBps: 0,
      fundingBorrowCostBps: 0,
      marketDataCostAllocation: 'included_in_research_budget',
      inferenceResearchCostAllocation: 'zero_llm_inference',
      zeroCostForbidden: true,
    }),
    validity: Object.freeze({
      validFrom: null,
      expiresAt: null,
      regimeConstraints: Object.freeze(['PAPER', 'SIMULATION']),
      invalidatingConditions: Object.freeze(['OPPORTUNITY_EXPIRED', 'EVIDENCE_STALE']),
      modelVersionCompatibility: Object.freeze(['helios-paper-fill-v1']),
      dataVersionCompatibility: Object.freeze(['helios-observation-v1']),
    }),
    fixedQualifiedParameters: Object.freeze({
      maximumPortfolioAllocationPct: '2.00',
      maximumPositionSizeUnits: HELIOS_H14_ENTRY_QUANTITY_UNITS,
      maximumConcurrentPositions: 1,
      horizonDays: 30,
    }),
  });
}

export function buildHeliosH14StrategyCapsule(input: {
  readonly createdAt: UtcInstant;
  readonly createdBy: string;
  readonly scope?: StrategyCapsuleScope;
  readonly customerId?: string | null;
  readonly qualificationState?: StrategyCapsuleRecord['qualificationState'];
  readonly workOrderId?: string | null;
}): StrategyCapsuleRecord {
  const scope = input.scope ?? 'GLOBAL';
  const material = buildHeliosH14Material();
  return Object.freeze({
    strategyCapsuleId: HELIOS_H14_CAPSULE_ID,
    strategyFamilyId: HELIOS_H14_FAMILY_ID,
    version: asStrategyCapsuleVersion('1'),
    parentVersion: null,
    scope,
    customerId: scope === 'CUSTOMER_SCOPED' ? (input.customerId ?? null) : null,
    environment: 'PAPER',
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    lineage: Object.freeze({
      workOrderId: input.workOrderId ?? null,
      researchLineageRefs: Object.freeze(['helios-h14-paper-grow']),
      parentProposalIds: Object.freeze([]),
    }),
    material,
    evidence: Object.freeze({
      researchResultRefs: Object.freeze([]),
      observationRefs: Object.freeze([]),
      provenanceRefs: Object.freeze([]),
      sourceIndependenceNotes: Object.freeze(['deterministic_research_no_llm']),
      knownContradictions: Object.freeze([]),
      rejectedEvidenceRefs: Object.freeze([]),
      evidenceVaultRefs: Object.freeze([]),
    }),
    qualificationState: input.qualificationState ?? 'EVALUATION_PENDING',
    qualificationAt: null,
    materialHash: computeStrategyCapsuleMaterialHash(material, scope),
    frozen: false,
    evaluationRefs: Object.freeze([]),
    simulationOnly: true,
    llmDeployable: false,
  });
}
