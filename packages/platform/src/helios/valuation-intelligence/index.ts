export {
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
  HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA,
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  HELIOS_VAL01_VALUATION_DOMAIN_QUALIFIED,
  HELIOS_VAL01_VALUATION_DOMAIN_BLOCKED,
  VALUATION_METHODS,
  VALUATION_SCENARIO_KINDS,
  VALUATION_ASSUMPTION_VALUE_KINDS,
  VALUATION_INPUT_SOURCES,
  VAL_WORK_PACKAGES,
  type ValuationMethod,
  type ValuationScenarioKind,
  type ValuationAssumptionValueKind,
  type ValuationInputSource,
  type ValWorkPackageId,
} from './taxonomy.ts';

export type { ValuationSourceRef, ValuationTemporalEnvelope } from './temporal-envelope.ts';

export type {
  ValuationScenario,
  ValuationSnapshot,
  ValuationEvidenceManifest,
  ValuationIntelligenceStoreSnapshot,
  ValuationAssumption,
  ValuationAssumptionValue,
  ValuationDistribution,
  IntrinsicValueDistribution,
  MarketImpliedExpectation,
  ValuationDistributionQuantile,
} from './val01-canonical-domain.ts';

export {
  freezeValuationAssumption,
  assertAssumptionExplicit,
} from './assumption.ts';

export {
  isValuationArtifactKnowableAt,
  filterKnowableValuationArtifacts,
  assertNoValuationLeakage,
} from './knowable-at.ts';

export {
  evaluateValuationMethodApplicability,
  listApplicableValuationMethods,
  applicableMethodsOnly,
  type ValuationIssuerProfile,
  type ValuationMethodApplicability,
} from './applicability.ts';

export {
  bindSecFundamentalsSnapshot,
  type SecFundamentalsBinding,
  type Earn09ProbabilisticStateBinding,
  type AafV2FeatureFabricBinding,
  type MacroYieldRateBinding,
  type StrategyLabResearchBinding,
  type ValuationInputManifest,
} from './input-manifest.ts';

export {
  VAL01_FUNDAMENTALS_BRIDGE_VERSION,
  issuerProfileFromFundamentals,
  attachSecFundamentalsToValuationInput,
} from './fundamentals-bridge.ts';

export {
  VAL01_EARN09_BRIDGE_VERSION,
  bindEarn09ProbabilisticState,
  forwardEpsAnchorMinor,
  earn09KnowableAt,
} from './earn09-bridge.ts';

export {
  VAL01_MACRO_BRIDGE_VERSION,
  macroReleaseToYieldBinding,
  collectMacroYieldBindings,
} from './macro-bridge.ts';

export {
  VAL01_AAF_V2_MANDATORY,
  bindAafV2UniversalManifest,
  bindVal01ToAafV2,
  type Val01AafV2Binding,
} from './aaf-bridge.ts';

export {
  toStrategyLabValuationResearchRef,
  bindStrategyLabResearch,
  type StrategyLabValuationResearchRef,
} from './strategy-lab-bridge.ts';

export { createValuationIntelligenceStore, type ValuationIntelligenceStore } from './store.ts';
export { compileValuationEvidenceManifest } from './evidence-manifest.ts';

export {
  evaluateVal01DomainQualification,
  type Val01QualificationChecks,
  type Val01QualificationResult,
} from './val01-qualification.ts';

export {
  demoVal01EvaluationTime,
  demoVal01FutureLeakTime,
  demoVal01IssuerProfile,
  demoVal01FundamentalSnapshot,
  demoVal01WaccAssumption,
  demoVal01FutureLeakAssumption,
  demoVal01BaseScenario,
  demoVal01Snapshot,
  demoVal01IntrinsicDistribution,
} from './val01-fixtures.ts';

export { listValWorkPackages, type ValWorkPackageRow } from './work-package-registry.ts';
