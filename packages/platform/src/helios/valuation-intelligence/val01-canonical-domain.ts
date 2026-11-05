/**
 * VAL01 — canonical probabilistic valuation intelligence domain types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ValuationAssumption } from './assumption.ts';
import type {
  IntrinsicValueDistribution,
  MarketImpliedExpectation,
  ValuationDistribution,
} from './distribution.ts';
import type { ValuationTemporalEnvelope } from './temporal-envelope.ts';
import type {
  HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA,
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
  ValuationMethod,
  ValuationScenarioKind,
} from './taxonomy.ts';

export type ValuationScenario = ValuationTemporalEnvelope & {
  readonly scenarioId: string;
  readonly scenarioKind: ValuationScenarioKind;
  readonly label: string;
  readonly assumptionIds: readonly string[];
  readonly method: ValuationMethod;
  readonly grantsExecutionAuthority: false;
};

export type ValuationSnapshot = ValuationTemporalEnvelope & {
  readonly schema: typeof HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA;
  readonly authority: typeof HELIOS_VALUATION_INTELLIGENCE_AUTHORITY;
  readonly snapshotId: string;
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly issuerProfileRef: string;
  readonly scenarioIds: readonly string[];
  readonly assumptionIds: readonly string[];
  readonly distributionIds: readonly string[];
  readonly marketImpliedExpectationIds: readonly string[];
  readonly inputManifestRef: string | null;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
};

export type ValuationEvidenceManifest = {
  readonly schema: typeof HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA;
  readonly manifestId: string;
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly snapshots: readonly ValuationSnapshot[];
  readonly scenarios: readonly ValuationScenario[];
  readonly assumptions: readonly ValuationAssumption[];
  readonly distributions: readonly ValuationDistribution[];
  readonly intrinsicDistributions: readonly IntrinsicValueDistribution[];
  readonly marketImpliedExpectations: readonly MarketImpliedExpectation[];
  readonly contentHash: string;
  readonly grantsExecutionAuthority: false;
};

export type ValuationIntelligenceStoreSnapshot = {
  readonly snapshots: readonly ValuationSnapshot[];
  readonly scenarios: readonly ValuationScenario[];
  readonly assumptions: readonly ValuationAssumption[];
  readonly distributions: readonly ValuationDistribution[];
  readonly intrinsicDistributions: readonly IntrinsicValueDistribution[];
  readonly marketImpliedExpectations: readonly MarketImpliedExpectation[];
};

export type {
  ValuationAssumption,
  ValuationAssumptionValue,
} from './assumption.ts';
export type {
  ValuationDistribution,
  IntrinsicValueDistribution,
  MarketImpliedExpectation,
  ValuationDistributionQuantile,
} from './distribution.ts';
