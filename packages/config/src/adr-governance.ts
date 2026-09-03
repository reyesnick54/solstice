/**
 * Canonical ADR lifecycle vocabulary and registry.
 *
 * Engineering decision status, legal/regulatory confidence, and production
 * activation are separate axes. IMPLEMENTED does not mean APPROVED.
 * CONFIGURED does not mean LIVE.
 */

export const ADR_ENGINEERING_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'ACCEPTED_FOR_ENGINEERING',
  'ACCEPTED',
  'SUPERSEDED',
  'REJECTED',
  'DEPRECATED',
] as const;
export type AdrEngineeringStatus = (typeof ADR_ENGINEERING_STATUSES)[number];

export const ADR_LEGAL_CONFIDENCE = [
  'NOT_APPLICABLE',
  'DRAFT',
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEWED',
  'CONFIRMED_BY_COUNSEL',
] as const;
export type AdrLegalConfidence = (typeof ADR_LEGAL_CONFIDENCE)[number];

export const ADR_IMPLEMENTATION_STATUSES = [
  'NOT_IMPLEMENTED',
  'PARTIAL',
  'IMPLEMENTED',
] as const;
export type AdrImplementationStatus = (typeof ADR_IMPLEMENTATION_STATUSES)[number];

export const ADR_PRODUCTION_ACTIVATION = [
  'NOT_ALLOWED',
  'ENGINEERING_ONLY',
  'REGULATORY_GATED',
  'EXTERNAL_APPROVAL_REQUIRED',
] as const;
export type AdrProductionActivation = (typeof ADR_PRODUCTION_ACTIVATION)[number];

export const EXTERNAL_APPROVAL_STATES = [
  'UNVERIFIED',
  'NOT_APPROVED',
  'EXTERNAL_APPROVAL_REQUIRED',
  'RESEARCH_REQUIRED',
] as const;
export type ExternalApprovalState = (typeof EXTERNAL_APPROVAL_STATES)[number];

export type AdrRecord = {
  readonly number: string;
  readonly title: string;
  readonly file: string;
  readonly engineeringStatus: AdrEngineeringStatus;
  readonly legalConfidence: AdrLegalConfidence;
  readonly implementationStatus: AdrImplementationStatus;
  readonly referencedByProductionCode: boolean;
  readonly legalApprovalRequired: boolean;
  readonly externalProviderApprovalRequired: boolean;
  readonly regulatoryApprovalRequired: boolean;
  readonly productionActivation: AdrProductionActivation;
  readonly externalApprovalState: ExternalApprovalState;
  readonly notes?: string;
};

/** Machine-readable ADR inventory. Keep in sync with docs/architecture/adr/README.md. */
export const ADR_REGISTRY: readonly AdrRecord[] = Object.freeze([
  {
    number: '0006',
    title: 'Policy Engine Language',
    file: 'ADR-0006-policy-engine-language.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Option C engineered in simulation; no pack is CONFIRMED_BY_COUNSEL',
  },
  {
    number: '0007',
    title: 'Identity and authentication stack (earlier draft)',
    file: 'ADR-0007-identity-stack.md',
    engineeringStatus: 'SUPERSEDED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'NOT_IMPLEMENTED',
    referencedByProductionCode: false,
    legalApprovalRequired: false,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: false,
    productionActivation: 'NOT_ALLOWED',
    externalApprovalState: 'UNVERIFIED',
    notes: 'Superseded by ADR-0007-identity-and-authentication-stack.md; not renumbered',
  },
  {
    number: '0007',
    title: 'Identity and Authentication Stack',
    file: 'ADR-0007-identity-and-authentication-stack.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: true,
    regulatoryApprovalRequired: false,
    productionActivation: 'EXTERNAL_APPROVAL_REQUIRED',
    externalApprovalState: 'EXTERNAL_APPROVAL_REQUIRED',
    notes: 'In-house domain engineered; vendor not selected; security review outstanding',
  },
  {
    number: '0008',
    title: 'Persistence Layer for Phase 1',
    file: 'ADR-0008-persistence-layer.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: false,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: false,
    productionActivation: 'ENGINEERING_ONLY',
    externalApprovalState: 'UNVERIFIED',
    notes: 'Addendum A: engineering-accepted Option A; not counsel',
  },
  {
    number: '0009',
    title: 'Canonical cryptographic infrastructure',
    file: 'ADR-0009-cryptographic-infrastructure.md',
    engineeringStatus: 'ACCEPTED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: false,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: false,
    productionActivation: 'ENGINEERING_ONLY',
    externalApprovalState: 'UNVERIFIED',
  },
  {
    number: '0010',
    title: 'Canonical compliance screening fabric',
    file: 'ADR-0010-compliance-screening-fabric.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: true,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'EXTERNAL_APPROVAL_REQUIRED',
  },
  {
    number: '0011',
    title: 'Personal Economic Graph',
    file: 'ADR-0011-personal-economic-graph.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: false,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: false,
    productionActivation: 'ENGINEERING_ONLY',
    externalApprovalState: 'UNVERIFIED',
  },
  {
    number: '0012',
    title: 'Machine-verifiable mandates and Growth Orchestrator',
    file: 'ADR-0012-mandates-and-growth-orchestrator.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: false,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: false,
    productionActivation: 'ENGINEERING_ONLY',
    externalApprovalState: 'UNVERIFIED',
  },
  {
    number: '0013',
    title: 'Regulatory Digital Twin',
    file: 'ADR-0013-regulatory-digital-twin.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Simulation only; not a legal opinion',
  },
  {
    number: '0013',
    title: 'Personal Economic Value Engine',
    file: 'ADR-0013-personal-economic-value-engine.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'NOT_APPLICABLE',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: false,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: false,
    productionActivation: 'ENGINEERING_ONLY',
    externalApprovalState: 'UNVERIFIED',
  },
  {
    number: '0014',
    title: 'Investment Risk Engine and Model Registry',
    file: 'ADR-0014-investment-risk-and-model-registry.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Simulation limits only; LIVE_INVESTMENT_EXECUTION stays false',
  },
  {
    number: '0015',
    title: 'SunRey Chain foundation',
    file: 'ADR-0015-sunrey-chain-foundation.md',
    engineeringStatus: 'PROPOSED',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Simulation trust layer only',
  },
  {
    number: '0016',
    title: 'SunRey Blockchain node architecture',
    file: 'ADR-0016-sunrey-blockchain-node-architecture.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0017',
    title: 'SunRey Blockchain consensus architecture',
    file: 'ADR-0017-sunrey-blockchain-consensus-architecture.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Development Tendermint-class; production not implemented',
  },
  {
    number: '0018',
    title: 'SunRey Blockchain validator architecture',
    file: 'ADR-0018-sunrey-blockchain-validator-architecture.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0019',
    title: 'SunRey Blockchain state machine architecture',
    file: 'ADR-0019-sunrey-blockchain-state-machine-architecture.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0020',
    title: 'SunRey Blockchain execution runtime',
    file: 'ADR-0020-sunrey-blockchain-execution-runtime.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0021',
    title: 'Transaction and block encoding',
    file: 'ADR-0021-sunrey-blockchain-transaction-block-encoding.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0022',
    title: 'Blockchain storage model',
    file: 'ADR-0022-sunrey-blockchain-storage-model.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0023',
    title: 'Networking / P2P architecture',
    file: 'ADR-0023-sunrey-blockchain-networking-p2p.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Development Quinn/rustls; not production BFT',
  },
  {
    number: '0024',
    title: 'Cryptographic agility model',
    file: 'ADR-0024-sunrey-blockchain-cryptographic-agility.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0025',
    title: 'Post-quantum migration architecture',
    file: 'ADR-0025-sunrey-blockchain-post-quantum-migration.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Not quantum-secure; production/HSM pending',
  },
  {
    number: '0026',
    title: 'Native asset model',
    file: 'ADR-0026-sunrey-blockchain-native-asset-model.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Tickers NOT_ASSIGNED; production quantities UNCONFIGURED',
  },
  {
    number: '0027',
    title: 'Oracle architecture',
    file: 'ADR-0027-sunrey-blockchain-oracle-architecture.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: true,
    regulatoryApprovalRequired: true,
    productionActivation: 'EXTERNAL_APPROVAL_REQUIRED',
    externalApprovalState: 'EXTERNAL_APPROVAL_REQUIRED',
    notes: 'Development oracle network; no live market-data network',
  },
  {
    number: '0028',
    title: 'Governance and protocol upgrades',
    file: 'ADR-0028-sunrey-blockchain-governance-upgrades.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Development UpgradePlan; production governance not implemented',
  },
  {
    number: '0029',
    title: 'Interoperability model',
    file: 'ADR-0029-sunrey-blockchain-interoperability.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Development light-client gateway; LIVE_INTEROP_ENABLED stays false',
  },
  {
    number: '0030',
    title: 'Privacy / confidentiality model',
    file: 'ADR-0030-sunrey-blockchain-privacy-confidentiality.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0031',
    title: 'Canonical ledger vs blockchain authority',
    file: 'ADR-0031-canonical-ledger-vs-blockchain-authority.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0032',
    title: 'Evidence anchoring and audit',
    file: 'ADR-0032-sunrey-blockchain-evidence-anchoring.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
  },
  {
    number: '0033',
    title: 'Chain identity / network ID / genesis',
    file: 'ADR-0033-sunrey-blockchain-identity-genesis.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'REGULATORY_GATED',
    externalApprovalState: 'NOT_APPROVED',
    notes: 'Production genesis activation NOT_IMPLEMENTED',
  },
  {
    number: '0034',
    title: 'SunRey Access Fabric / Human Access Economy',
    file: 'ADR-0034-sunrey-access-fabric.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'PARTIAL',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: true,
    regulatoryApprovalRequired: true,
    productionActivation: 'EXTERNAL_APPROVAL_REQUIRED',
    externalApprovalState: 'EXTERNAL_APPROVAL_REQUIRED',
    notes: 'ACCESS-01 foundation only',
  },
  {
    number: '0035',
    title: 'Economic Awareness Fabric canonicalization',
    file: 'ADR-0035-economic-awareness-fabric-canonicalization.md',
    engineeringStatus: 'ACCEPTED_FOR_ENGINEERING',
    legalConfidence: 'RESEARCH_REQUIRED',
    implementationStatus: 'IMPLEMENTED',
    referencedByProductionCode: true,
    legalApprovalRequired: true,
    externalProviderApprovalRequired: false,
    regulatoryApprovalRequired: true,
    productionActivation: 'NOT_ALLOWED',
    externalApprovalState: 'RESEARCH_REQUIRED',
    notes: 'Canonical Information Consensus in sunrey-chain; orchestration adapter in economic-awareness-fabric',
  },
]);

export function findAdrByFile(file: string): AdrRecord | undefined {
  return ADR_REGISTRY.find((row) => row.file === file);
}

export function findAdrsByNumber(number: string): readonly AdrRecord[] {
  return ADR_REGISTRY.filter((row) => row.number === number);
}

/** ADRs where engineering code exists but production activation is gated. */
export function implementedButNotProductionApproved(): readonly AdrRecord[] {
  return ADR_REGISTRY.filter(
    (row) =>
      row.implementationStatus !== 'NOT_IMPLEMENTED' &&
      row.productionActivation !== 'ENGINEERING_ONLY' &&
      row.engineeringStatus !== 'SUPERSEDED',
  );
}

/** ADRs still PROPOSED or not ACCEPTED that have production code references. */
export function proposedWithProductionCode(): readonly AdrRecord[] {
  return ADR_REGISTRY.filter(
    (row) =>
      row.engineeringStatus === 'PROPOSED' &&
      row.referencedByProductionCode &&
      row.implementationStatus !== 'NOT_IMPLEMENTED',
  );
}

export function engineeringStatusAllowsProductionActivation(status: AdrEngineeringStatus): boolean {
  return status === 'ACCEPTED';
}

export function productionActivationAllowed(record: AdrRecord): false {
  void record;
  return false;
}
