/**
 * Canonical staged activation plan.
 *
 * Stages are conceptual and independent. A later stage is not an
 * obligation to activate every listed domain.
 */

import {
  STAGED_ACTIVATION_DOMAINS,
  STAGED_ACTIVATION_SCHEMA_VERSION,
  STAGED_ACTIVATION_STAGES,
  STAGED_ACTIVATION_TOOL_VERSION,
  type StagedActivationDomain,
  type StagedActivationPlan,
  type StagedActivationStage,
} from './types.ts';

const DOMAINS_BY_STAGE: Readonly<Record<StagedActivationStage, readonly StagedActivationDomain[]>> = Object.freeze({
  STAGE_0_GENESIS_AND_CONSENSUS: Object.freeze(['SUNREY_CHAIN']),
  STAGE_1_READ_ONLY_PUBLIC_SURFACES: Object.freeze(['SUNREY_CHAIN']),
  STAGE_2_NATIVE_ASSET_BASE: Object.freeze(['SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET']),
  STAGE_3_ECONOMIC_EVIDENCE_READ_ONLY: Object.freeze(['PRODUCTIVE_ECONOMIC_DATA']),
  STAGE_4_CUSTODY_CANDIDATE: Object.freeze(['INSTITUTIONAL_CUSTODY']),
  STAGE_5_EXCHANGE_CANDIDATE: Object.freeze(['SUNREY_EXCHANGE', 'SUNREY_EXCHANGE_SETTLEMENT']),
  STAGE_6_GOVERNED_NATIVE_ISSUANCE: Object.freeze(['SUNREY_COIN_ISSUANCE', 'MOONREY_COIN_ISSUANCE']),
  STAGE_7_REGULATED_FINANCIAL_SERVICES: Object.freeze(['FIAT_BANKING', 'PAYMENT_RAILS', 'CARDS', 'INVESTMENTS']),
  STAGE_8_HIN_AND_PRODUCTIVE_MARKETS: Object.freeze([
    'HUMAN_INFORMATION_MARKET',
    'PRODUCTIVE_CAPACITY_MARKET',
    'INTEROPERABILITY',
  ]),
});

const STAGE_ORDER = new Map<StagedActivationStage, number>(
  STAGED_ACTIVATION_STAGES.map((stage, index) => [stage, index]),
);

export function canonicalStagedPlan(): StagedActivationPlan {
  return Object.freeze({
    schemaVersion: STAGED_ACTIVATION_SCHEMA_VERSION,
    toolVersion: STAGED_ACTIVATION_TOOL_VERSION,
    stages: STAGED_ACTIVATION_STAGES,
    domainsByStage: DOMAINS_BY_STAGE,
    allAtOnceActivation: false,
    conceptualRehearsalOnly: true,
    everyDomainMustActivate: false,
  });
}

export function stageIndex(stage: StagedActivationStage): number {
  return STAGE_ORDER.get(stage) ?? 0;
}

export function previousStage(stage: StagedActivationStage): StagedActivationStage | null {
  const index = stageIndex(stage);
  return index === 0 ? null : STAGED_ACTIVATION_STAGES[index - 1] ?? null;
}

export function nextStage(stage: StagedActivationStage): StagedActivationStage | null {
  const index = stageIndex(stage);
  return index >= STAGED_ACTIVATION_STAGES.length - 1 ? null : STAGED_ACTIVATION_STAGES[index + 1] ?? null;
}

export function domainsForStage(stage: StagedActivationStage): readonly StagedActivationDomain[] {
  return DOMAINS_BY_STAGE[stage];
}

export function homeStage(domain: StagedActivationDomain): StagedActivationStage {
  if (domain === 'SUNREY_CHAIN') {
    return 'STAGE_0_GENESIS_AND_CONSENSUS';
  }
  for (const stage of STAGED_ACTIVATION_STAGES) {
    if (DOMAINS_BY_STAGE[stage].includes(domain)) {
      return stage;
    }
  }
  return 'STAGE_0_GENESIS_AND_CONSENSUS';
}

export function isIssuanceDomain(domain: StagedActivationDomain): boolean {
  return domain === 'SUNREY_COIN_ISSUANCE' || domain === 'MOONREY_COIN_ISSUANCE';
}

export function isRegulatedFinancialDomain(domain: StagedActivationDomain): boolean {
  return (
    domain === 'FIAT_BANKING' ||
    domain === 'PAYMENT_RAILS' ||
    domain === 'CARDS' ||
    domain === 'INVESTMENTS'
  );
}

export function isExchangeDomain(domain: StagedActivationDomain): boolean {
  return domain === 'SUNREY_EXCHANGE' || domain === 'SUNREY_EXCHANGE_SETTLEMENT';
}

export function isDependentProduct(domain: StagedActivationDomain): boolean {
  return domain !== 'SUNREY_CHAIN';
}

export function allStagedDomains(): readonly StagedActivationDomain[] {
  return STAGED_ACTIVATION_DOMAINS;
}

export function readOnlyPublicSurfacesActivateMoney(): false {
  return false;
}
