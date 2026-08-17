/**
 * Chunk 64 — root-of-trust and ceremony types.
 *
 * Authority classes map onto canonical KeyPurpose values. This is not
 * a second purpose system. Role names are operational engineering
 * roles, not legal certifications. CI uses simulation providers only.
 */

import type { CryptoSuiteId } from '../crypto-suite.ts';
import type { HsmAlgorithmCapability, PqHardwareReadiness } from '../hsm-kms.ts';
import type { KeyPurpose } from '../purposes.ts';

export const ROOT_OF_TRUST_AUTHORITIES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_GOVERNANCE_AUTHORITY',
  'SECURITY_GOVERNANCE_AUTHORITY',
  'RELEASE_AUTHORITY',
  'VALIDATOR_CONSENSUS_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
  'VALIDATOR_P2P_IDENTITY',
  'RECOVERY_AUTHORITY',
  'CUSTODY_SIGNING_AUTHORITY',
  'ORACLE_SIGNING_AUTHORITY',
] as const;
export type RootOfTrustAuthority = (typeof ROOT_OF_TRUST_AUTHORITIES)[number];

export const CEREMONY_ROLES = [
  'CEREMONY_COORDINATOR',
  'SECURITY_OFFICER',
  'VALIDATOR_OPERATOR',
  'GOVERNANCE_SIGNER',
  'RELEASE_SIGNER',
  'WITNESS',
  'INDEPENDENT_OBSERVER',
] as const;
export type CeremonyRole = (typeof CEREMONY_ROLES)[number];

export const CEREMONY_ACTOR_KINDS = ['HUMAN', 'AI', 'SERVICE'] as const;
export type CeremonyActorKind = (typeof CEREMONY_ACTOR_KINDS)[number];

export const CEREMONY_STATES = [
  'PLANNED',
  'PARTICIPANTS_VERIFIED',
  'PROVIDER_VERIFIED',
  'KEYS_GENERATED',
  'PUBLIC_DESCRIPTORS_COLLECTED',
  'ATTESTATIONS_VERIFIED',
  'TRANSCRIPT_FINALIZED',
  'REHEARSAL_COMPLETE',
  'AWAITING_EXTERNAL_PRODUCTION_EVENT',
] as const;
export type CeremonyState = (typeof CEREMONY_STATES)[number];

export const ROOT_KEY_STATES = [
  'ACTIVE',
  'ROTATING',
  'RETIRED_FOR_NEW_USE',
  'COMPROMISED',
  'DESTROYED_PROVIDER_CONFIRMED',
] as const;
export type RootKeyState = (typeof ROOT_KEY_STATES)[number];

export const CEREMONY_NETWORK_PROFILES = [
  'OFFLINE',
  'RESTRICTED_NETWORK',
  'DEVELOPMENT_SIMULATION',
] as const;
export type CeremonyNetworkProfile = (typeof CEREMONY_NETWORK_PROFILES)[number];

export const PRODUCTION_ELIGIBILITY_STATES = [
  'SIMULATION_ONLY',
  'RESEARCH_REQUIRED',
  'PRODUCTION_CANDIDATE_UNCONFIRMED',
] as const;
export type ProductionEligibilityState = (typeof PRODUCTION_ELIGIBILITY_STATES)[number];

export const ONLINE_OFFLINE_CLASSES = ['ONLINE', 'OFFLINE', 'CEREMONY_ONLY'] as const;
export type OnlineOfflineClass = (typeof ONLINE_OFFLINE_CLASSES)[number];

export const CEREMONY_SCHEMA_VERSION = 1 as const;

export const HUMAN_GOVERNANCE_AUTHORITIES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_GOVERNANCE_AUTHORITY',
  'SECURITY_GOVERNANCE_AUTHORITY',
  'RELEASE_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
  'RECOVERY_AUTHORITY',
] as const satisfies readonly RootOfTrustAuthority[];

export const HIGH_IMPACT_OPERATIONS = [
  'CREATE_ROOT_GOVERNANCE_KEY',
  'ACTIVATE_GENESIS_SIGNING_SESSION',
  'ROTATE_RELEASE_AUTHORITY',
  'APPROVE_RECOVERY_PROCEDURE',
] as const;
export type HighImpactOperation = (typeof HIGH_IMPACT_OPERATIONS)[number];

export type CeremonyParticipant = {
  readonly participantId: string;
  readonly displayName: string;
  readonly role: CeremonyRole;
  readonly actorKind: CeremonyActorKind;
  readonly identityPublicKeyHex: string | null;
  readonly identityFingerprint: string | null;
};

export type CeremonyStep = {
  readonly stepId: string;
  readonly description: string;
  readonly requiredRole: CeremonyRole;
  readonly highImpact: boolean;
};

export type CeremonyPlan = {
  readonly ceremonyId: string;
  readonly purpose: string;
  readonly environmentClass: 'SIMULATION' | 'REHEARSAL' | 'PRODUCTION_CANDIDATE';
  readonly networkCandidate: string;
  readonly participantRoles: readonly CeremonyRole[];
  readonly requiredApprovals: number;
  readonly keyPurposes: readonly KeyPurpose[];
  readonly authorities: readonly RootOfTrustAuthority[];
  readonly cryptoSuites: readonly CryptoSuiteId[];
  readonly providerRequirements: readonly HsmAlgorithmCapability[];
  readonly steps: readonly CeremonyStep[];
  readonly expectedPublicArtifacts: readonly string[];
  readonly evidenceRequirements: readonly string[];
  readonly recoveryPlan: string;
  readonly networkProfile: CeremonyNetworkProfile;
  readonly schemaVersion: typeof CEREMONY_SCHEMA_VERSION;
  readonly requiresPublicRpc: false;
};

export type KeyPurposeMatrixRow = {
  readonly purpose: KeyPurpose;
  readonly allowedAuthority: RootOfTrustAuthority;
  readonly allowedCryptoSuites: readonly CryptoSuiteId[];
  readonly providerRequirements: readonly HsmAlgorithmCapability[];
  readonly rotationPolicy: string;
  readonly backupPolicy: string;
  readonly recoveryPolicy: string;
  readonly onlineOffline: OnlineOfflineClass;
  readonly attestationRequired: boolean;
  readonly productionEligibility: ProductionEligibilityState;
};

export type RegisteredAuthorityKey = {
  readonly keyId: string;
  readonly authority: RootOfTrustAuthority;
  readonly purpose: KeyPurpose;
  readonly suiteId: CryptoSuiteId;
  readonly publicKeyHex: string;
  readonly fingerprint: string;
  readonly keyVersion: number;
  readonly state: RootKeyState;
  readonly ownerParticipantId: string;
  readonly providerId: string;
  readonly attestationRef: string | null;
  readonly backupRef: string | null;
  readonly historical: boolean;
};

export type PublicKeyContribution = {
  readonly validatorId: string | null;
  readonly operatorParticipantId: string;
  readonly consensusPublicKeyHex: string | null;
  readonly p2pPublicKeyHex: string | null;
  readonly governancePublicKeyHex: string | null;
  readonly suiteId: CryptoSuiteId;
  readonly providerCapabilityStatement: string;
  readonly attestationReference: string;
  readonly operatorApprovalSignatureHex: string;
  readonly operatorPublicKeyHex: string;
};

export type HsmAttestationRecord = {
  readonly providerType: string;
  readonly deviceModel: string;
  readonly firmwareVersion: string;
  readonly keyId: string;
  readonly keyPurpose: KeyPurpose;
  readonly authority: RootOfTrustAuthority;
  readonly algorithm: string;
  readonly publicKeyFingerprint: string;
  readonly attestationEvidenceHash: string;
  readonly verificationStatus: 'VERIFIED_SIMULATION' | 'UNVERIFIED' | 'REJECTED';
  readonly verifiedBy: string;
  readonly simulation: boolean;
};

export type CeremonyApproval = {
  readonly approvalId: string;
  readonly operation: string;
  readonly actorParticipantId: string;
  readonly actorRole: CeremonyRole;
  readonly actorKind: CeremonyActorKind;
  readonly payloadHash: string;
  readonly signatureHex: string;
  readonly publicKeyHex: string;
};

export type GenesisBinding = {
  readonly genesisCandidateHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly validatorSetHash: string;
  readonly assetAllocationManifestHash: string;
  readonly cryptoPolicyHash: string;
  readonly moduleHashes: readonly string[];
  readonly bindingHash: string;
  readonly signatureHex: string;
  readonly authorityPublicKeyHex: string;
};

export type KeyRotationRecord = {
  readonly currentKeyId: string;
  readonly futureKeyId: string;
  readonly authority: RootOfTrustAuthority;
  readonly effectiveEpoch: number | null;
  readonly effectiveHeight: number | null;
  readonly approvals: readonly string[];
  readonly attestationRef: string;
  readonly retirementState: RootKeyState;
};

export type RootOfTrustCompromiseRecord = {
  readonly compromiseId: string;
  readonly suspectedKeyId: string;
  readonly authority: RootOfTrustAuthority;
  readonly providerDisableRequested: boolean;
  readonly authorityRestricted: boolean;
  readonly replacementKeyId: string | null;
  readonly changeRequest: string;
  readonly evidenceRef: string;
  readonly historyErased: false;
};

export type CeremonyTranscriptEntry = {
  readonly sequence: number;
  readonly actionType: string;
  readonly actorRole: CeremonyRole | 'SYSTEM';
  readonly actorKind: CeremonyActorKind | 'SYSTEM';
  readonly publicArtifactHashes: readonly string[];
  readonly priorTranscriptHash: string;
  readonly entryHash: string;
  readonly result: 'OK' | 'REJECTED';
  readonly occurredAtUtc: string;
  readonly evidenceReference: string;
};

export type CeremonyTranscript = {
  readonly ceremonyId: string;
  readonly schemaVersion: typeof CEREMONY_SCHEMA_VERSION;
  readonly entries: readonly CeremonyTranscriptEntry[];
  readonly finalized: boolean;
  readonly transcriptHash: string | null;
};

export type OfflinePackageKind =
  | 'PUBLIC_KEYS'
  | 'ATTESTATIONS'
  | 'GENESIS_CANDIDATE_HASHES'
  | 'APPROVAL_REQUESTS'
  | 'RELEASE_CANDIDATE_HASHES';

export type CeremonyOfflinePackage = {
  readonly schemaVersion: typeof CEREMONY_SCHEMA_VERSION;
  readonly kind: 'SUNREY_CEREMONY_OFFLINE_PACKAGE';
  readonly packageKind: OfflinePackageKind;
  readonly payload: unknown;
  readonly payloadHash: string;
  readonly signatureHex: string | null;
  readonly signerPublicKeyHex: string | null;
  readonly containsPrivateKeys: false;
};

export type CeremonyReleaseAuthorityBinding = {
  readonly kind: 'SOFTWARE_RELEASE_AUTHORITY';
  readonly authorityClass: 'RELEASE_AUTHORITY';
  readonly authorityId: string;
  readonly publicKeyHex: string;
  readonly suiteId: CryptoSuiteId;
  readonly notAppAuthorityGrant: true;
  readonly notValidatorGovernance: true;
  readonly notCustodySigner: true;
  readonly notWalletSigner: true;
  readonly mayChangeBlockchainState: false;
};

export type PqCapabilityAssessment = {
  readonly software: PqHardwareReadiness;
  readonly hardware: PqHardwareReadiness;
  readonly hybridSoftwareAvailable: boolean;
  readonly hardwareEvidenceRefs: readonly string[];
  readonly note: string;
};

export type PublicCeremonyReport = {
  readonly ceremonyId: string;
  readonly participantRoles: readonly CeremonyRole[];
  readonly publicFingerprints: readonly {
    readonly authority: RootOfTrustAuthority;
    readonly purpose: KeyPurpose;
    readonly fingerprint: string;
    readonly algorithm: string;
  }[];
  readonly attestationStatus: readonly string[];
  readonly genesisCandidateHashReference: string | null;
  readonly transcriptHash: string | null;
  readonly approvalCount: number;
  readonly softwareVersions: readonly string[];
  readonly simulation: true;
  readonly productionAuthorityActive: false;
};
