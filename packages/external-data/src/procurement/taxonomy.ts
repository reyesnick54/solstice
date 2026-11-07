/**
 * HELIOS ALT10 — government procurement observation taxonomy (external-data plane).
 */

export const PROCUREMENT_OBSERVATION_SCHEMA = 'sunrey.external.procurement-observation.v1' as const;

export const PROCUREMENT_PROVIDER_KINDS = [
  'federal_procurement_api',
  'official_award_publication',
  'public_tender_system',
  'official_contract_notice',
  'simulation_fixture',
] as const;

export type ProcurementProviderKind = (typeof PROCUREMENT_PROVIDER_KINDS)[number];

export const PROCUREMENT_ARTIFACT_KINDS = [
  'PROCUREMENT_AWARD',
  'PROCUREMENT_MODIFICATION',
  'PROCUREMENT_OBLIGATION',
  'CONTRACT_VEHICLE',
  'GOVERNMENT_CUSTOMER',
  'PROCUREMENT_BACKLOG_ESTIMATE',
] as const;

export type ProcurementArtifactKind = (typeof PROCUREMENT_ARTIFACT_KINDS)[number];

/** Resolved counterparty role — attribution never rolls JV awards to parent automatically. */
export const PROCUREMENT_COUNTERPARTY_ROLES = [
  'contractor',
  'subsidiary',
  'joint_venture',
  'parent_company',
] as const;

export type ProcurementCounterpartyRole = (typeof PROCUREMENT_COUNTERPARTY_ROLES)[number];

export const PROCUREMENT_CONTRACT_TYPES = [
  'FFP',
  'CPFF',
  'CPAF',
  'T&M',
  'IDIQ',
  'BPA',
  'OTHER',
] as const;

export type ProcurementContractType = (typeof PROCUREMENT_CONTRACT_TYPES)[number];

/**
 * Monetary semantics on procurement observations. REVENUE may appear only on
 * ContractRevenueConversionEstimate produced by calibrated historical analysis.
 */
export const PROCUREMENT_VALUE_KINDS = [
  'AWARD_CEILING',
  'OBLIGATION',
  'PAID',
] as const;

export type ProcurementValueKind = (typeof PROCUREMENT_VALUE_KINDS)[number];

export const PROCUREMENT_MODIFICATION_KINDS = [
  'funding',
  'scope',
  'period',
  'termination',
  'other',
] as const;

export type ProcurementModificationKind = (typeof PROCUREMENT_MODIFICATION_KINDS)[number];
