/**
 * Chunk 81 — SunRey production network candidate v2 types.
 *
 * Deterministic engineering candidate. Does not launch mainnet,
 * enable LIVE_* flags, or convert missing external evidence into
 * approved evidence.
 */

import type { ProductionCapabilityActivation } from '../types.ts';

export const CANDIDATE_V2_SCHEMA_VERSION = 1 as const;
export const CANDIDATE_V2_TOOL_VERSION = 'sunrey-mainnet/candidate-v2' as const;

export const DRIFT_STATES = [
  'MATCH',
  'AUTHORIZED_VARIANCE',
  'UNAUTHORIZED_DRIFT',
  'EVIDENCE_UNAVAILABLE',
] as const;
export type ConfigurationDriftState = (typeof DRIFT_STATES)[number];

export const SERVICE_ROLES = [
  'validator',
  'sentry',
  'rpc',
  'explorer',
  'oracle_collector',
  'exchange',
  'custody',
  'monitoring',
  'backup',
  'database',
  'release_service',
] as const;
export type ProductionServiceRole = (typeof SERVICE_ROLES)[number];

export const UNKNOWN = 'UNKNOWN' as const;
export const NOT_PROVIDED = 'NOT_PROVIDED' as const;
export const UNCONFIGURED = 'UNCONFIGURED' as const;
export const NOT_ASSIGNED = 'NOT_ASSIGNED' as const;

export type ProductionProtocolBundle = {
  readonly schemaVersion: 1;
  readonly transactionEnvelopeHash: string;
  readonly blockFormatHash: string;
  readonly consensusRulesHash: string;
  readonly validatorRulesHash: string;
  readonly governanceRulesHash: string;
  readonly executionModulesHash: string;
  readonly stateSchemaHash: string;
  readonly feeProtocolHash: string;
  readonly interopProtocolHash: string;
  readonly interopEnabled: false;
  readonly combinedHash: string;
};

export type ProductionEconomicBundle = {
  readonly schemaVersion: 1;
  readonly sunreyMonetaryPolicyHash: string;
  readonly moonreyMonetaryPolicyHash: string;
  readonly validatorEconomicsHash: string;
  readonly feePolicyV2Hash: string;
  readonly moonreyProductiveIssuanceHash: string;
  readonly protocolTreasuryHash: string;
  readonly economicGovernanceHash: string;
  readonly economicRcId: string;
  readonly economicRcHash: string;
  readonly productionParameters: typeof UNCONFIGURED;
  readonly tickerStatus: typeof NOT_ASSIGNED;
  readonly combinedHash: string;
};

export type ProductionSecurityBundle = {
  readonly schemaVersion: 1;
  readonly cryptoSuiteRegistryHash: string;
  readonly cryptoPolicyHash: string;
  readonly pqcMigrationPolicyHash: string;
  readonly rootOfTrustArchitectureHash: string;
  readonly releaseAuthorityHash: string;
  readonly formalEvidenceHash: string;
  readonly fuzzEvidenceHash: string;
  readonly adversarialEvidenceHash: string;
  readonly economicStressEvidenceHash: string;
  readonly auditPreparationEvidenceHash: string;
  readonly independentAuditCompleted: false;
  readonly combinedHash: string;
};

export type ProductionInfrastructureBundle = {
  readonly schemaVersion: 1;
  readonly providerRegistryHash: string;
  readonly workloadIdentityHash: string;
  readonly networkZoneHash: string;
  readonly secretReferenceHash: string;
  readonly kmsConfigurationHash: string;
  readonly hsmState: 'SIMULATION_HSM';
  readonly tlsConfigurationHash: string;
  readonly objectStorageHash: string;
  readonly containerRegistryHash: string;
  readonly iacHash: string;
  readonly combinedHash: string;
};

export type ProductionStorageBundle = {
  readonly schemaVersion: 1;
  readonly redbEngine: 'redb';
  readonly redbEngineVersion: string;
  readonly storageSchema: number;
  readonly snapshotFormatHash: string;
  readonly archivePruningHash: string;
  readonly postgresProfileHash: string;
  readonly backupRecoveryHash: string;
  readonly combinedHash: string;
};

export type FailureDomainRecord = {
  readonly region: string;
  readonly availabilityDomain: string;
  readonly operator: string;
  readonly provider: string;
  readonly networkZone: string;
};

export type ProductionValidatorCandidateV2 = {
  readonly validatorId: string;
  readonly operatorReference: string;
  readonly votingPower: string;
  readonly consensusPublicKeyDescriptor: string;
  readonly p2pKeyDescriptor: string;
  readonly governanceKeyDescriptor: string;
  readonly signerProvider: string;
  readonly hsmEvidenceState: 'SIMULATION_HSM';
  readonly failureDomain: FailureDomainRecord;
  readonly bondPolicyReference: string;
  readonly ceremonyState: 'SIMULATION_REHEARSAL';
  readonly operatorEvidenceState: 'PROVIDED_UNVERIFIED';
  readonly productionEligible: false;
  readonly fixtureKey: true;
};

export type ProviderConcentrationReport = {
  readonly operatorConcentration: readonly string[];
  readonly cloudProviderConcentration: readonly string[];
  readonly geographicConcentration: readonly string[];
  readonly networkConcentration: readonly string[];
  readonly hsmProviderConcentration: readonly string[];
  readonly organizationalIndependenceClaimed: false;
};

export type ProductionTopologyNode = {
  readonly nodeId: string;
  readonly role: ProductionServiceRole | 'relayer';
  readonly failureDomain: FailureDomainRecord;
  readonly notes: string;
};

export type ProductionTopologyManifest = {
  readonly schemaVersion: 1;
  readonly candidateId: string;
  readonly validators: readonly ProductionTopologyNode[];
  readonly sentries: readonly ProductionTopologyNode[];
  readonly rpcNodes: readonly ProductionTopologyNode[];
  readonly explorer: readonly ProductionTopologyNode[];
  readonly oracleCollectors: readonly ProductionTopologyNode[];
  readonly monitoring: readonly ProductionTopologyNode[];
  readonly backupServices: readonly ProductionTopologyNode[];
  readonly databaseServices: readonly ProductionTopologyNode[];
  readonly exchangeServices: readonly ProductionTopologyNode[];
  readonly custodyServices: readonly ProductionTopologyNode[];
  readonly relayers: readonly ProductionTopologyNode[];
  readonly combinedHash: string;
};

export type ProductionServiceRecord = {
  readonly role: ProductionServiceRole;
  readonly artifactDigest: string;
  readonly configurationHash: string;
  readonly workloadIdentity: string;
  readonly networkZone: string;
  readonly secretReferences: readonly string[];
  readonly resourceProfile: string;
  readonly healthRequirements: readonly string[];
  readonly floatingTag: false;
};

export type ProductionServiceManifest = {
  readonly schemaVersion: 1;
  readonly services: readonly ProductionServiceRecord[];
  readonly combinedHash: string;
};

export type ProductionNetworkConfiguration = {
  readonly displayName: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly productionAddressHrp: 'srprd';
  readonly protocolVersion: string;
  readonly genesisFormatVersion: string;
  readonly apiVersion: string;
  readonly environment: 'simulation';
  readonly mainnetEnabled: false;
  readonly status: 'CANDIDATE';
};

export type ProductionNetworkManifestV2 = {
  readonly schemaVersion: 1;
  readonly candidateId: string;
  readonly configuration: ProductionNetworkConfiguration;
  readonly sourceCommit: string;
  readonly releaseArtifactHash: string;
  readonly protocolVersion: string;
  readonly apiVersion: string;
  readonly economicRcId: string;
  readonly economicRcHash: string;
  readonly cryptoPolicyHash: string;
  readonly validatorSetHash: string;
  readonly economicPoliciesHash: string;
  readonly governancePolicyHash: string;
  readonly storageSchemaHash: string;
  readonly networkTopologyHash: string;
  readonly infrastructureConfigurationHash: string;
  readonly serviceManifestHash: string;
  readonly securityEvidenceHash: string;
  readonly readinessEvidenceHash: string;
  readonly combinedHash: string;
};

export type ProductionNetworkEvidenceBundle = {
  readonly schemaVersion: 1;
  readonly chunk76StressReportHash: string;
  readonly chunk77TreasuryPolicyHash: string;
  readonly chunk77TreasuryFormalHash: string;
  readonly chunk77TreasuryStressHash: string;
  readonly chunk78EconomicRcHash: string;
  readonly chunk79GovernancePackageHash: string;
  readonly chunk80RehearsalEvidenceHash: string;
  readonly formalEvidenceHash: string;
  readonly fuzzEvidenceHash: string;
  readonly adversarialEvidenceHash: string;
  readonly auditPreparationHash: string;
  readonly combinedHash: string;
};

export type ProductionNetworkCompatibilityReport = {
  readonly schemaVersion: 1;
  readonly protocolCompatible: boolean;
  readonly economicRcBound: boolean;
  readonly rehearsalDistinct: true;
  readonly v1Distinct: true;
  readonly sdkCompatible: boolean;
  readonly explorerCompatible: boolean;
  readonly notes: readonly string[];
};

export type ProductionGenesisInput = {
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: 'srprd';
  readonly protocolVersion: string;
  readonly genesisFormatVersion: string;
  readonly allocationAuthorized: false;
  readonly sunreyGenesisSupply: '0';
  readonly moonreyGenesisSupply: '0';
  readonly tickerStatus: typeof NOT_ASSIGNED;
  readonly finalized: false;
  readonly activated: false;
  readonly allocationHash: string;
  readonly inputHash: string;
};

export type ProductionNetworkCandidateV2 = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof CANDIDATE_V2_TOOL_VERSION;
  readonly candidateId: typeof import('./identity.ts').CANDIDATE_V2_ID | string;
  readonly configuration: ProductionNetworkConfiguration;
  readonly manifest: ProductionNetworkManifestV2;
  readonly protocol: ProductionProtocolBundle;
  readonly economic: ProductionEconomicBundle;
  readonly security: ProductionSecurityBundle;
  readonly infrastructure: ProductionInfrastructureBundle;
  readonly storage: ProductionStorageBundle;
  readonly topology: ProductionTopologyManifest;
  readonly services: ProductionServiceManifest;
  readonly validators: readonly ProductionValidatorCandidateV2[];
  readonly concentration: ProviderConcentrationReport;
  readonly capabilities: readonly ProductionCapabilityActivation[];
  readonly capabilityInheritance: false;
  readonly genesisInput: ProductionGenesisInput;
  readonly evidence: ProductionNetworkEvidenceBundle;
  readonly compatibility: ProductionNetworkCompatibilityReport;
  readonly configurationDigest: string;
  readonly networkManifestDigest: string;
  readonly protocolBundleDigest: string;
  readonly economicBundleDigest: string;
  readonly candidateRootHash: string;
  readonly status: 'CANDIDATE';
  readonly mainnetEnabled: false;
  readonly productionAuthorized: false;
  readonly environment: 'simulation';
};

export type ProductionNetworkVerificationCheck = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ProductionNetworkVerificationReport = {
  readonly schemaVersion: 1;
  readonly candidateId: string;
  readonly rootHash: string;
  readonly sourceCommit: string;
  readonly protocol: string;
  readonly economicRc: string;
  readonly topology: string;
  readonly securityState: string;
  readonly hsmState: 'SIMULATION_HSM';
  readonly pqcState: string;
  readonly storage: string;
  readonly infrastructure: string;
  readonly economicState: string;
  readonly readiness: string;
  readonly externalGaps: readonly string[];
  readonly checks: readonly ProductionNetworkVerificationCheck[];
  readonly ok: boolean;
  readonly productionAuthorized: false;
};

export type ProductionCandidateComparison = {
  readonly schemaVersion: 1;
  readonly leftId: string;
  readonly rightId: string;
  readonly protocolChanges: readonly string[];
  readonly economicAdditions: readonly string[];
  readonly securityEvidenceChanges: readonly string[];
  readonly infrastructureChanges: readonly string[];
  readonly storageChanges: readonly string[];
  readonly validatorChanges: readonly string[];
  readonly readinessChanges: readonly string[];
  readonly remainingExternalGaps: readonly string[];
};

export type ObservedDeploymentDescriptor = {
  readonly networkId?: string;
  readonly chainId?: string;
  readonly releaseArtifactHash?: string;
  readonly serviceArtifacts?: Readonly<Record<string, string>>;
  readonly hsmState?: string;
  readonly economicRcHash?: string;
  readonly validatorIds?: readonly string[];
  readonly authorizedVariance?: boolean;
};
