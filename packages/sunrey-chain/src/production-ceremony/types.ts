/**
 * Chunk 85 — SunRey production genesis ceremony and launch-authorization
 * package types.
 *
 * This is the architecture and evidence package for a future authorized
 * production genesis. It does not launch mainnet, create real production
 * private keys in CI, or convert dress-rehearsal artifacts into
 * production authority.
 */

import type { CryptographicPolicyManifest, GenesisAssetAllocationManifest } from '../mainnet/types.ts';
import type { SignerSafetyState } from '../validators/types.ts';

export const PRODUCTION_CEREMONY_SCHEMA_VERSION = 1 as const;
export const PRODUCTION_CEREMONY_TOOL_VERSION = 'sunrey-ceremony/production/1' as const;

export const PRODUCTION_CEREMONY_ROLES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'OPERATIONS_AUTHORITY',
  'RELEASE_AUTHORITY',
  'VALIDATOR_OPERATOR',
  'CEREMONY_OBSERVER',
] as const;
export type ProductionCeremonyRole = (typeof PRODUCTION_CEREMONY_ROLES)[number];

export const REQUIRED_PRODUCTION_HUMAN_ROLES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'RELEASE_AUTHORITY',
] as const;
export type RequiredProductionHumanRole = (typeof REQUIRED_PRODUCTION_HUMAN_ROLES)[number];

export const PRODUCTION_CEREMONY_ACTOR_KINDS = ['HUMAN', 'AI', 'SERVICE', 'AUTOMATION'] as const;
export type ProductionCeremonyActorKind = (typeof PRODUCTION_CEREMONY_ACTOR_KINDS)[number];

export const PRODUCTION_KEY_PURPOSES = [
  'VALIDATOR_CONSENSUS',
  'VALIDATOR_P2P',
  'VALIDATOR_GOVERNANCE',
  'PROTOCOL_GOVERNANCE',
  'SECURITY_GOVERNANCE',
  'RELEASE_AUTHORITY',
  'GENESIS_AUTHORITY',
  'RECOVERY_AUTHORITY',
  'CUSTODY_SIGNING',
  'ORACLE_SIGNING',
] as const;
export type ProductionKeyPurpose = (typeof PRODUCTION_KEY_PURPOSES)[number];

export const HIGH_RISK_KEY_PURPOSES = [
  'VALIDATOR_CONSENSUS',
  'PROTOCOL_GOVERNANCE',
  'SECURITY_GOVERNANCE',
  'RELEASE_AUTHORITY',
  'GENESIS_AUTHORITY',
  'RECOVERY_AUTHORITY',
  'CUSTODY_SIGNING',
  'ORACLE_SIGNING',
] as const;
export type HighRiskKeyPurpose = (typeof HIGH_RISK_KEY_PURPOSES)[number];

export const VALIDATOR_ACCEPTANCE_STATES = [
  'CANDIDATE',
  'TECHNICALLY_VERIFIED',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'HUMAN_ACCEPTED',
  'GENESIS_ELIGIBLE',
] as const;
export type ValidatorAcceptanceState = (typeof VALIDATOR_ACCEPTANCE_STATES)[number];

export const VALIDATOR_EVIDENCE_KINDS = [
  'OPERATOR_IDENTITY',
  'INFRASTRUCTURE_READINESS',
  'SECURITY_CONTROLS',
  'SIGNER_READINESS',
  'HSM_ATTESTATION',
  'OPERATIONS_RUNBOOK_ACKNOWLEDGEMENT',
  'GOVERNANCE_AGREEMENT',
  'INCIDENT_CONTACT',
  'OTHER_GOVERNED_REQUIREMENT',
] as const;
export type ValidatorEvidenceKind = (typeof VALIDATOR_EVIDENCE_KINDS)[number];

export const GENESIS_ELIGIBILITY_STATES = [
  'GENESIS_PACKAGE_INCOMPLETE',
  'GENESIS_ENGINEERING_READY',
  'AWAITING_EXTERNAL_EVIDENCE',
  'AWAITING_HUMAN_AUTHORIZATION',
  'GENESIS_AUTHORIZATION_PACKAGE_COMPLETE',
] as const;
export type GenesisEligibilityState = (typeof GENESIS_ELIGIBILITY_STATES)[number];

export const EXTERNAL_BLOCKER_CODES = [
  'MISSING_EXTERNAL_SECURITY_REVIEW',
  'MISSING_HSM_EVIDENCE',
  'MISSING_LEGAL_APPROVAL',
  'MISSING_LICENSE',
  'MISSING_PROVIDER_AGREEMENT',
  'MISSING_HUMAN_AUTHORIZATION',
  'MISSING_CANDIDATE_V2',
  'MISSING_MAINNET_RC',
  'UNAPPROVED_ASSET_ALLOCATION',
  'OPEN_CRITICAL_SECURITY_BLOCKER',
  'OPEN_HIGH_SECURITY_BLOCKER',
  'FIXTURE_VALIDATOR_NOT_GENESIS_ELIGIBLE',
  'SIMULATION_HSM_NOT_PRODUCTION',
  'TICKERS_NOT_ASSIGNED',
] as const;
export type ExternalBlockerCode = (typeof EXTERNAL_BLOCKER_CODES)[number];

export const GENESIS_TIME_STATES = [
  'UNSELECTED',
  'PROCEDURE_DEFINED',
  'HUMAN_SELECTED',
  'AUTHORIZED',
] as const;
export type GenesisTimeState = (typeof GENESIS_TIME_STATES)[number];

export const HSM_ATTESTATION_LABELS = [
  'SIMULATION_ATTESTATION',
  'PROVIDER_ATTESTATION_UNVERIFIED',
  'PROVIDER_ATTESTATION_VERIFIED',
  'REJECTED',
] as const;
export type HsmAttestationLabel = (typeof HSM_ATTESTATION_LABELS)[number];

export const CEREMONY_TRANSCRIPT_ACTIONS = [
  'PLAN_BOUND',
  'PARTICIPANT_REGISTERED',
  'PROVIDER_CHECKED',
  'VALIDATOR_DOSSIER_RECORDED',
  'PUBLIC_CONTRIBUTION',
  'HSM_ATTESTATION',
  'SIGNER_CHALLENGE',
  'GENESIS_GENERATED',
  'HASH_VERIFIED',
  'HUMAN_APPROVAL',
  'APPROVAL_REJECTED',
  'OFFLINE_PACKAGE_EXPORTED',
  'READINESS_SNAPSHOT',
  'AUTHORIZATION_PACKAGE_SEALED',
] as const;
export type CeremonyTranscriptAction = (typeof CEREMONY_TRANSCRIPT_ACTIONS)[number];

export type GenesisTimePolicy = {
  readonly procedureId: string;
  readonly state: GenesisTimeState;
  readonly selectedUnixMs: bigint | null;
  readonly selectedUtc: string | null;
  readonly usesDeveloperLocalClock: false;
  readonly notes: string;
};

export type ProductionGenesisCeremonyPlan = {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly planVersion: number;
  readonly environmentClass: 'PRODUCTION' | 'DRESS_REHEARSAL';
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly protocolVersion: string;
  readonly economicBundleHash: string;
  readonly cryptoPolicyId: string;
  readonly cryptoPolicyHash: string;
  readonly validatorCandidateSetHash: string;
  readonly governanceAuthorityId: string;
  readonly releaseAuthorityId: string;
  readonly genesisAuthorityId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: string;
  readonly allocationManifestHash: string;
  readonly requiredHumanRoles: readonly RequiredProductionHumanRole[];
  readonly requiredApprovals: number;
  readonly genesisTimePolicy: GenesisTimePolicy;
  readonly usableForProduction: boolean;
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
};

export type ProductionCeremonyParticipant = {
  readonly participantId: string;
  readonly displayName: string;
  readonly role: ProductionCeremonyRole;
  readonly actorKind: ProductionCeremonyActorKind;
  readonly publicIdentityHash: string;
};

export type ProductionValidatorEvidenceRef = {
  readonly kind: ValidatorEvidenceKind;
  readonly reference: string | null;
  readonly hash: string | null;
  readonly state: 'ABSENT' | 'PROVIDED' | 'VERIFIED' | 'REJECTED';
  readonly notes: string;
};

export type ProductionValidatorDossier = {
  readonly validatorId: string;
  readonly legalOperatorReference: string | null;
  readonly operatorEvidenceState: 'ABSENT' | 'PROVIDED' | 'VERIFIED';
  readonly consensusPublicKeyDescriptor: string;
  readonly p2pPublicKey: string;
  readonly governanceKey: string;
  readonly signerProvider: string;
  readonly hsmEvidenceClass: 'SIMULATION_HSM' | 'REAL_PROVIDER_HSM';
  readonly hsmEvidenceReference: string | null;
  readonly bondConfiguration: string;
  readonly failureDomain: string;
  readonly infrastructureProvider: string;
  readonly networkEndpoints: readonly string[];
  readonly incidentContactReference: string | null;
  readonly ceremonyContributionState: 'PENDING' | 'CONTRIBUTED' | 'ATTESTED' | 'REJECTED';
  readonly fixtureClass: boolean;
  readonly evidence: readonly ProductionValidatorEvidenceRef[];
  readonly organizationalIndependenceClaimed: false;
};

export type ProductionValidatorAcceptance = {
  readonly validatorId: string;
  readonly state: ValidatorAcceptanceState;
  readonly configuredEvidenceComplete: boolean;
  readonly rejectionReason: string | null;
};

export type ProductionAuthorityDossier = {
  readonly authorityId: string;
  readonly purpose: ProductionKeyPurpose;
  readonly publicDescriptor: string;
  readonly threshold: number;
  readonly requiredHuman: boolean;
  readonly occupiedByAi: false;
};

export type ProductionGenesisContribution = {
  readonly contributionId: string;
  readonly validatorId: string | null;
  readonly participantId: string;
  readonly purpose: ProductionKeyPurpose;
  readonly publicKeyHex: string;
  readonly publicKeyFingerprint: string;
  readonly algorithm: string;
  readonly providerId: string;
  readonly keyHandle: string;
  readonly environment: 'SIMULATION' | 'REHEARSAL' | 'PRODUCTION_CANDIDATE';
  readonly attestationHash: string | null;
};

export type ProductionHsmAttestation = {
  readonly providerId: string;
  readonly keyHandle: string;
  readonly publicDescriptor: string;
  readonly algorithm: string;
  readonly attestation: string;
  readonly attestationHash: string;
  readonly creationEvidence: string;
  readonly purpose: ProductionKeyPurpose;
  readonly environment: 'SIMULATION' | 'REHEARSAL' | 'PRODUCTION_CANDIDATE';
  readonly humanWitness: string | null;
  readonly label: HsmAttestationLabel;
  readonly pqCapability: 'UNSUPPORTED' | 'SOFTWARE_ONLY' | 'PROVIDER_CLAIMED';
  readonly simulation: boolean;
};

export type ProductionCeremonyTranscriptEntry = {
  readonly sessionId: string;
  readonly sequence: number;
  readonly action: CeremonyTranscriptAction;
  readonly participantRole: ProductionCeremonyRole | 'SYSTEM';
  readonly actorKind: ProductionCeremonyActorKind | 'SYSTEM';
  readonly publicContribution: string | null;
  readonly artifactHashes: readonly string[];
  readonly approval: string | null;
  readonly attestation: string | null;
  readonly previousEntryHash: string;
  readonly entryHash: string;
  readonly occurredAtUtc: string;
};

export type ProductionCeremonyTranscript = {
  readonly sessionId: string;
  readonly entries: readonly ProductionCeremonyTranscriptEntry[];
  readonly transcriptHash: string;
  readonly finalized: boolean;
};

export type ProductionGenesisManifest = {
  readonly schemaVersion: 1;
  readonly presentation: 'JSON_NOT_CONSENSUS';
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly validatorSetHash: string;
  readonly validatorKeysHash: string;
  readonly governanceKeysHash: string;
  readonly cryptoPolicy: CryptographicPolicyManifest;
  readonly economicPolicyHash: string;
  readonly feePolicy: string;
  readonly treasuryPolicy: string;
  readonly allocation: GenesisAssetAllocationManifest;
  readonly allocationHash: string;
  readonly genesisTimePolicy: GenesisTimePolicy;
  readonly moduleHashes: readonly string[];
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly environment: 'simulation';
  readonly productionActivated: false;
  readonly mainnetEnabled: false;
};

export type ProductionReadinessSnapshot = {
  readonly capturedAtUtc: string;
  readonly engineeringReadiness: string;
  readonly providerReadiness: string;
  readonly auditState: string;
  readonly hsmState: string;
  readonly legalRegulatoryState: string;
  readonly licenseState: string;
  readonly partnerDependencies: string;
  readonly humanAuthorization: string;
  readonly immutable: true;
};

export type ProductionGenesisAuthorizationPackage = {
  readonly schemaVersion: 1;
  readonly genesisHash: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly transcriptHash: string;
  readonly validatorSetHash: string;
  readonly humanAuthorizationSet: readonly string[];
  readonly readinessSnapshot: ProductionReadinessSnapshot;
  readonly usableForProduction: boolean;
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
};

export type ExternalBlocker = {
  readonly code: ExternalBlockerCode;
  readonly present: true;
  readonly detail: string;
};

export type ProductionGenesisVerificationReport = {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly planVersion: number;
  readonly environmentClass: 'PRODUCTION' | 'DRESS_REHEARSAL';
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly mainnetRcVerified: boolean;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly candidateV2Verified: boolean;
  readonly validatorCount: number;
  readonly validatorEvidenceStatus: readonly ProductionValidatorAcceptance[];
  readonly hsmStatus: string;
  readonly cryptoPolicyId: string;
  readonly genesisAllocationStatus: 'UNAPPROVED' | 'REHEARSAL_ONLY' | 'APPROVED';
  readonly candidateHash: string;
  readonly transcriptIntegrity: boolean;
  readonly externalBlockers: readonly ExternalBlocker[];
  readonly humanAuthorizationState: string;
  readonly eligibility: GenesisEligibilityState;
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
};

export type LaunchAuthorizationDossier = {
  readonly schemaVersion: 1;
  readonly title: 'SunRey Launch Authorization Dossier';
  readonly executesLaunch: false;
  readonly plan: ProductionGenesisCeremonyPlan;
  readonly report: ProductionGenesisVerificationReport;
  readonly authorization: ProductionGenesisAuthorizationPackage | null;
  readonly blockers: readonly ExternalBlocker[];
  readonly eligibility: GenesisEligibilityState;
  readonly humanReadable: string;
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
};

export type CeremonyEvidenceBundle = {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly planHash: string;
  readonly transcriptHash: string;
  readonly genesisHash: string;
  readonly authorizationPackageHash: string | null;
  readonly dossierHash: string;
  readonly simulation: boolean;
  readonly realProductionKeysCreated: false;
};

export type ProductionGenesisCeremonySession = {
  readonly sessionId: string;
  readonly plan: ProductionGenesisCeremonyPlan;
  readonly participants: readonly ProductionCeremonyParticipant[];
  readonly dossiers: readonly ProductionValidatorDossier[];
  readonly acceptances: readonly ProductionValidatorAcceptance[];
  readonly contributions: readonly ProductionGenesisContribution[];
  readonly attestations: readonly ProductionHsmAttestation[];
  readonly authorities: readonly ProductionAuthorityDossier[];
  readonly transcript: ProductionCeremonyTranscript;
  readonly genesis: {
    readonly manifest: ProductionGenesisManifest;
    readonly canonicalBytesHex: string;
    readonly genesisHash: string;
  } | null;
  readonly authorization: ProductionGenesisAuthorizationPackage | null;
  readonly signerSafety: readonly SignerSafetyState[];
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
};

export type OfflineCeremonyPackage = {
  readonly packageId: string;
  readonly publicData: readonly string[];
  readonly hashes: readonly string[];
  readonly signingRequests: readonly string[];
  readonly publicSignatures: readonly string[];
  readonly attestations: readonly string[];
  readonly approvedMetadata: readonly string[];
  readonly containsSecretKeyMaterial: false;
};

export type ProductionGenesisCeremonyDressRehearsal = {
  readonly rehearsalId: string;
  readonly session: ProductionGenesisCeremonySession;
  readonly report: ProductionGenesisVerificationReport;
  readonly dossier: LaunchAuthorizationDossier;
  readonly evidence: CeremonyEvidenceBundle;
  readonly genesisHash: string;
  readonly transcriptVerified: boolean;
  readonly usableForProduction: boolean;
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
};
