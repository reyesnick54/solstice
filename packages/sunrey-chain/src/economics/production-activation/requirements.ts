/**
 * Domain-separated production economic activation requirements.
 *
 * Engineering evidence cannot satisfy EXTERNAL or HUMAN slots.
 */

import type {
  ActivationRequirement,
  EconomicActivationDomain,
} from './types.ts';

export const DOMAIN_TO_MAINNET = {
  SUNREY_COIN_ISSUANCE: 'SUNREY_COIN_NATIVE_ASSET',
  MOONREY_COIN_ISSUANCE: 'MOONREY_COIN_NATIVE_ASSET',
  HUMAN_INFORMATION_MARKET: 'HUMAN_INFORMATION_MARKET',
  PRODUCTIVE_ECONOMIC_DATA: 'PRODUCTIVE_CAPACITY_MARKET',
  SUNREY_EXCHANGE_SETTLEMENT: 'SUNREY_EXCHANGE',
} as const;

export const ACTIVATION_REQUIREMENTS: readonly ActivationRequirement[] = Object.freeze([
  Object.freeze({
    requirementId: 'SHARED.LIVE_FLAGS_DISABLED',
    domain: 'SHARED',
    title: 'LIVE_* flags remain disabled',
    evidenceClass: 'ENGINEERING',
    blockerCode: 'LIVE_FLAGS_MUST_REMAIN_DISABLED',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.PRODUCTION_PARAMETERS',
    domain: 'SHARED',
    title: 'Production monetary parameters explicit, versioned, hashed, governed',
    evidenceClass: 'HUMAN',
    blockerCode: 'PRODUCTION_PARAMETER_UNCONFIGURED',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.SUNREY_MAXIMUM_SUPPLY',
    domain: 'SHARED',
    title: 'SunRey maximum supply configured',
    evidenceClass: 'HUMAN',
    blockerCode: 'MAXIMUM_SUPPLY_UNCONFIGURED',
    mainnetDomain: 'SUNREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'SHARED.MOONREY_MAXIMUM_SUPPLY',
    domain: 'SHARED',
    title: 'MoonRey maximum supply configured',
    evidenceClass: 'HUMAN',
    blockerCode: 'MAXIMUM_SUPPLY_UNCONFIGURED',
    mainnetDomain: 'MOONREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'SHARED.SUNREY_GENESIS_SUPPLY',
    domain: 'SHARED',
    title: 'SunRey genesis supply configured',
    evidenceClass: 'HUMAN',
    blockerCode: 'GENESIS_SUPPLY_UNCONFIGURED',
    mainnetDomain: 'SUNREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'SHARED.MOONREY_GENESIS_SUPPLY',
    domain: 'SHARED',
    title: 'MoonRey genesis supply configured',
    evidenceClass: 'HUMAN',
    blockerCode: 'GENESIS_SUPPLY_UNCONFIGURED',
    mainnetDomain: 'MOONREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'SHARED.ISSUANCE_POLICY',
    domain: 'SHARED',
    title: 'Post-genesis issuance policies configured',
    evidenceClass: 'HUMAN',
    blockerCode: 'ISSUANCE_POLICY_UNCONFIGURED',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.POLICY_BINDINGS',
    domain: 'SHARED',
    title: 'Cross-policy version bindings consistent',
    evidenceClass: 'ENGINEERING',
    blockerCode: 'POLICY_BINDING_MISMATCH',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.SUPPLY_RECONCILIATION',
    domain: 'SHARED',
    title: 'AssetSupplyBook canonical and reconciled',
    evidenceClass: 'ENGINEERING',
    blockerCode: 'SUPPLY_RECONCILIATION_FAILED',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.GENESIS_ALLOCATION',
    domain: 'SHARED',
    title: 'Genesis allocation authorized separately from capability activation',
    evidenceClass: 'HUMAN',
    blockerCode: 'GENESIS_ALLOCATION_NOT_AUTHORIZED',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.EXTERNAL_SECURITY',
    domain: 'SHARED',
    title: 'External security assessment with no open critical/high findings',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'EXTERNAL_SECURITY_REVIEW_MISSING',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.LEGAL_EVIDENCE',
    domain: 'SHARED',
    title: 'Counsel opinion evidence slot filled',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'LEGAL_EVIDENCE_MISSING',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.REGULATORY_EVIDENCE',
    domain: 'SHARED',
    title: 'Regulatory approval evidence slot filled',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'REGULATORY_EVIDENCE_MISSING',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.PARTNER_EVIDENCE',
    domain: 'SHARED',
    title: 'Partner agreement evidence slot filled',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'PARTNER_EVIDENCE_MISSING',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SHARED.HUMAN_AUTHORIZATION',
    domain: 'SHARED',
    title: 'Required human accountability roles present',
    evidenceClass: 'HUMAN',
    blockerCode: 'HUMAN_AUTHORIZATION_MISSING',
    mainnetDomain: null,
  }),
  Object.freeze({
    requirementId: 'SUNREY.CONVERSION_POLICY',
    domain: 'SUNREY_COIN_ISSUANCE',
    title: 'SunRey contribution settlement conversion is production-class',
    evidenceClass: 'HUMAN',
    blockerCode: 'CONVERSION_POLICY_NOT_PRODUCTION',
    mainnetDomain: 'SUNREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'MOONREY.CONVERSION_POLICY',
    domain: 'MOONREY_COIN_ISSUANCE',
    title: 'MoonRey GPUV settlement conversion is production-class',
    evidenceClass: 'HUMAN',
    blockerCode: 'CONVERSION_POLICY_NOT_PRODUCTION',
    mainnetDomain: 'MOONREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'MOONREY.VALUE_POLICY',
    domain: 'MOONREY_COIN_ISSUANCE',
    title: 'MoonRey Productive Value policy is production-class (V1 insufficient)',
    evidenceClass: 'HUMAN',
    blockerCode: 'VALUE_POLICY_NOT_PRODUCTION',
    mainnetDomain: 'MOONREY_COIN_NATIVE_ASSET',
  }),
  Object.freeze({
    requirementId: 'ORACLE.PROVIDER_EVIDENCE',
    domain: 'PRODUCTIVE_ECONOMIC_DATA',
    title: 'Real provider onboarding evidence',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'ORACLE_PROVIDER_EVIDENCE_MISSING',
    mainnetDomain: 'PRODUCTIVE_CAPACITY_MARKET',
  }),
  Object.freeze({
    requirementId: 'ORACLE.LICENSE_EVIDENCE',
    domain: 'PRODUCTIVE_ECONOMIC_DATA',
    title: 'Provider data-license evidence',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'ORACLE_LICENSE_EVIDENCE_MISSING',
    mainnetDomain: 'PRODUCTIVE_CAPACITY_MARKET',
  }),
  Object.freeze({
    requirementId: 'ORACLE.SOURCE_DIVERSITY',
    domain: 'PRODUCTIVE_ECONOMIC_DATA',
    title: 'Source diversity sufficient for intended production categories',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'SOURCE_DIVERSITY_INSUFFICIENT',
    mainnetDomain: 'PRODUCTIVE_CAPACITY_MARKET',
  }),
  Object.freeze({
    requirementId: 'ORACLE.COVERAGE',
    domain: 'PRODUCTIVE_ECONOMIC_DATA',
    title: 'Economic data fabric coverage without production gaps',
    evidenceClass: 'ENGINEERING',
    blockerCode: 'ECONOMIC_DATA_COVERAGE_GAP',
    mainnetDomain: 'PRODUCTIVE_CAPACITY_MARKET',
  }),
  Object.freeze({
    requirementId: 'HIN.PRIVACY_REVIEW',
    domain: 'HUMAN_INFORMATION_MARKET',
    title: 'HIN privacy review evidence provided',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'HIN_PRIVACY_REVIEW_MISSING',
    mainnetDomain: 'HUMAN_INFORMATION_MARKET',
  }),
  Object.freeze({
    requirementId: 'HIN.LEGAL_REVIEW',
    domain: 'HUMAN_INFORMATION_MARKET',
    title: 'HIN legal analysis evidence provided',
    evidenceClass: 'EXTERNAL',
    blockerCode: 'HIN_LEGAL_REVIEW_MISSING',
    mainnetDomain: 'HUMAN_INFORMATION_MARKET',
  }),
  Object.freeze({
    requirementId: 'HIN.HUMAN_AUTHORIZATION',
    domain: 'HUMAN_INFORMATION_MARKET',
    title: 'HIN human authorization provided',
    evidenceClass: 'HUMAN',
    blockerCode: 'HIN_HUMAN_AUTHORIZATION_MISSING',
    mainnetDomain: 'HUMAN_INFORMATION_MARKET',
  }),
  Object.freeze({
    requirementId: 'HIN.CHAIN_ANCHOR',
    domain: 'HUMAN_INFORMATION_MARKET',
    title: 'HIN chain-anchor engineering path ready',
    evidenceClass: 'ENGINEERING',
    blockerCode: 'HIN_CHAIN_ANCHOR_NOT_READY',
    mainnetDomain: 'HUMAN_INFORMATION_MARKET',
  }),
]);

export function requirementsFor(
  domain: EconomicActivationDomain | 'SHARED',
): readonly ActivationRequirement[] {
  return ACTIVATION_REQUIREMENTS.filter((row) => row.domain === domain || row.domain === 'SHARED');
}

export function requirementById(requirementId: string): ActivationRequirement | undefined {
  return ACTIVATION_REQUIREMENTS.find((row) => row.requirementId === requirementId);
}
