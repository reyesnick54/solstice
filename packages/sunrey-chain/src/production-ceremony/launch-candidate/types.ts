/**
 * Chunk 165 — frozen-candidate production ceremony and launch
 * authorization rehearsal types.
 *
 * Extends Chunk 85. This is not a second genesis ceremony. A sealed
 * launch-authorization candidate still does not start validators, write
 * genesis, flip LIVE_* flags, connect providers, or mint.
 */

import type { GenesisTimePolicy } from '../types.ts';
import type {
  ProductionCeremonyActorKind,
  ProductionCeremonyRole,
  ProductionCeremonyTranscript,
  ProductionHsmAttestation,
  RequiredProductionHumanRole,
} from '../types.ts';

export const LAUNCH_CEREMONY_SCHEMA_VERSION = 1 as const;
export const LAUNCH_CEREMONY_TOOL_VERSION = 'sunrey-ceremony/launch-candidate/1' as const;
export const LAUNCH_CEREMONY_BINDING_DOMAIN = 'SUNREY_PRODUCTION_LAUNCH_CEREMONY_BINDING_V1' as const;
export const LAUNCH_CEREMONY_PLAN_DOMAIN = 'SUNREY_PRODUCTION_LAUNCH_CEREMONY_PLAN_V1' as const;
export const LAUNCH_OFFLINE_PAYLOAD_DOMAIN = 'SUNREY_LAUNCH_AUTHORIZATION_OFFLINE_PAYLOAD_V1' as const;
export const LAUNCH_CEREMONY_CAPABILITY = 'sunrey-production-genesis-ceremony' as const;

export const LAUNCH_CEREMONY_MAINNET_ENABLED = false as const;
export const LAUNCH_CEREMONY_PRODUCTION_ACTIVATED = false as const;
export const LAUNCH_CEREMONY_EQUALS_ACTIVATION = false as const;
export const AI_SATISFIES_HUMAN_ROLE = false as const;
export const REAL_PRODUCTION_KEYS_CREATED = false as const;

export const LAUNCH_CEREMONY_STATES = [
  'PLANNED',
  'REHEARSAL_READY',
  'REHEARSAL_IN_PROGRESS',
  'REHEARSAL_COMPLETE',
  'AWAITING_REAL_EXTERNAL_EVIDENCE',
  'AWAITING_REAL_HSM',
  'AWAITING_HUMAN_SIGNATURES',
  'LAUNCH_AUTHORIZATION_CANDIDATE',
  'ABORTED',
  'SUPERSEDED',
] as const;
export type LaunchCeremonyState = (typeof LAUNCH_CEREMONY_STATES)[number];

export const LAUNCH_APPROVAL_STATEMENTS = [
  'APPROVE_ECONOMIC_PARAMETER_PACKAGE',
  'APPROVE_GENESIS_CANDIDATE',
  'APPROVE_LAUNCH_AUTHORIZATION',
] as const;
export type LaunchApprovalStatement = (typeof LAUNCH_APPROVAL_STATEMENTS)[number];

export const LAUNCH_APPROVAL_SCOPES = [
  'ECONOMIC_PARAMETER_PACKAGE',
  'GENESIS_CANDIDATE',
  'LAUNCH_AUTHORIZATION',
  'OBSERVER',
] as const;
export type LaunchApprovalScope = (typeof LAUNCH_APPROVAL_SCOPES)[number];

export const LAUNCH_SIGNATURE_CLASSES = ['FIXTURE_REHEARSAL', 'REAL_HUMAN'] as const;
export type LaunchSignatureClass = (typeof LAUNCH_SIGNATURE_CLASSES)[number];

export const LAUNCH_AUTHORIZATION_CLASSES = ['REHEARSAL_PACKAGE', 'LAUNCH_AUTHORIZATION_CANDIDATE'] as const;
export type LaunchAuthorizationClass = (typeof LAUNCH_AUTHORIZATION_CLASSES)[number];

export const LAUNCH_CEREMONY_ABORT_CODES = [
  'CEREMONY_CANDIDATE_MISMATCH',
  'EXTERNAL_EVIDENCE_EXPIRED',
  'EXTERNAL_EVIDENCE_REVOKED',
  'SESSION_MISMATCH',
  'SIGNATURE_ROLE_MISMATCH',
  'APPROVAL_EXPIRED',
  'ECONOMIC_SIGNATURE_NOT_GENESIS',
  'HUMAN_ROLE_UNSATISFIED',
  'SIMULATION_HSM_NOT_PRODUCTION',
  'FIXTURE_HSM_NOT_QUALIFIED',
  'CEREMONY_ABORTED',
] as const;
export type LaunchCeremonyAbortCode = (typeof LAUNCH_CEREMONY_ABORT_CODES)[number];

export const REQUIRED_LAUNCH_HUMAN_ROLES = [
  'GENESIS_AUTHORITY',
  'PROTOCOL_AUTHORITY',
  'SECURITY_AUTHORITY',
  'RELEASE_AUTHORITY',
] as const satisfies readonly RequiredProductionHumanRole[];
export type RequiredLaunchHumanRole = (typeof REQUIRED_LAUNCH_HUMAN_ROLES)[number];

export const PRESERVED_ECONOMIC_AUTHORIZATION_ROLES = [
  'ECONOMIC_POLICY_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
  'OPERATIONS_AUTHORITY',
] as const;
export type PreservedEconomicAuthorizationRole = (typeof PRESERVED_ECONOMIC_AUTHORIZATION_ROLES)[number];

export type RoleOverlapPolicy = {
  readonly allowIndependentRoleOverlap: boolean;
};

export type ProductionLaunchCeremonyBinding = {
  readonly schemaVersion: typeof LAUNCH_CEREMONY_SCHEMA_VERSION;
  readonly launchFreezeId: string;
  readonly launchFreezeHash: string;
  readonly mainnetRcHash: string;
  readonly economicRcHash: string;
  readonly economicAuthorizationHash: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly cryptoPolicyHash: string;
  readonly externalEvidenceSnapshotHash: string;
  readonly operatingScopeSnapshotHash: string;
  readonly providerBindingSnapshotHash: string;
  readonly sourceCommit: string;
};

export type LaunchCeremonyPlan = {
  readonly schemaVersion: typeof LAUNCH_CEREMONY_SCHEMA_VERSION;
  readonly planId: string;
  readonly planVersion: number;
  readonly environmentClass: 'DRESS_REHEARSAL' | 'PRODUCTION';
  readonly binding: ProductionLaunchCeremonyBinding;
  readonly planHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly requiredHumanRoles: readonly RequiredLaunchHumanRole[];
  readonly roleOverlapPolicy: RoleOverlapPolicy;
  readonly genesisTimePolicy: GenesisTimePolicy;
  readonly usableForProduction: false;
  readonly realProductionKeysCreated: false;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
};

export type LaunchCeremonySessionIdentity = {
  readonly sessionId: string;
  readonly planHash: string;
  readonly launchFreezeHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly genesisHashCandidate: string;
};

export type LaunchCeremonyParticipant = {
  readonly participantId: string;
  readonly displayName: string;
  readonly role: ProductionCeremonyRole | PreservedEconomicAuthorizationRole;
  readonly actorKind: ProductionCeremonyActorKind;
  readonly publicIdentityCommitment: string;
  readonly publicSigningDescriptor: string;
  readonly approvalScope: LaunchApprovalScope;
};

export type CeremonyEvidenceWatch = {
  readonly snapshotHash: string;
  readonly expiresAtUtc: string | null;
  readonly revoked: boolean;
  readonly fixture: boolean;
  readonly class: 'EXTERNAL_EVIDENCE' | 'HSM_KEY_MANAGEMENT';
};

export type LaunchOfflineSigningPayload = {
  readonly domain: typeof LAUNCH_OFFLINE_PAYLOAD_DOMAIN;
  readonly sessionId: string;
  readonly launchFreezeHash: string;
  readonly genesisCandidateHash: string;
  readonly validatorSetHash: string;
  readonly economicAuthorizationHash: string;
  readonly approvalRole: ProductionCeremonyRole | PreservedEconomicAuthorizationRole;
  readonly approvalStatement: LaunchApprovalStatement;
  readonly validFromUtc: string;
  readonly expiresAtUtc: string;
  readonly cryptoSuiteId: string;
  readonly payloadHash: string;
};

export type LaunchOfflineSigningPackage = {
  readonly packageId: string;
  readonly sessionId: string;
  readonly participantId: string;
  readonly payload: LaunchOfflineSigningPayload;
  readonly publicSigningDescriptor: string;
  readonly publicKeyFingerprint: string;
  readonly containsSecretKeyMaterial: false;
  readonly containsPrivateKey: false;
  readonly humanReadableNote: string;
};

export type LaunchApprovalSignature = {
  readonly participantId: string;
  readonly role: ProductionCeremonyRole | PreservedEconomicAuthorizationRole;
  readonly actorKind: ProductionCeremonyActorKind;
  readonly sessionId: string;
  readonly payloadHash: string;
  readonly approvalStatement: LaunchApprovalStatement;
  readonly publicKeyHex: string;
  readonly publicKeyFingerprint: string;
  readonly signatureHex: string;
  readonly cryptoSuiteId: string;
  readonly signedAtUtc: string;
  readonly signatureClass: LaunchSignatureClass;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type CeremonyAbortRecord = {
  readonly code: LaunchCeremonyAbortCode;
  readonly reason: string;
  readonly sessionId: string;
  readonly lastValidTranscriptHash: string;
  readonly candidateFreezeHash: string;
  readonly affectedArtifacts: readonly string[];
  readonly transcriptPreserved: true;
  readonly signaturesPreserved: true;
  readonly privateKeysReused: false;
  readonly productionActivated: false;
  readonly restartRequired: true;
  readonly abortedAtUtc: string;
};

export type LaunchAuthorizationCandidate = {
  readonly schemaVersion: typeof LAUNCH_CEREMONY_SCHEMA_VERSION;
  readonly class: LaunchAuthorizationClass;
  readonly sessionId: string;
  readonly binding: ProductionLaunchCeremonyBinding;
  readonly transcriptHash: string;
  readonly acceptedRoles: readonly string[];
  readonly realHumanSignaturesCollected: false;
  readonly fixtureSignaturesOnly: boolean;
  readonly usableForProduction: false;
  readonly startsValidators: false;
  readonly writesGenesis: false;
  readonly connectsProviders: false;
  readonly mintsPostGenesisCoins: false;
  readonly changesFlags: false;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
  readonly ceremonyAuthorizationEqualsActivation: false;
};

export type LaunchAuthorizationCeremonySession = {
  readonly sessionId: string;
  readonly identity: LaunchCeremonySessionIdentity;
  readonly plan: LaunchCeremonyPlan;
  readonly binding: ProductionLaunchCeremonyBinding;
  readonly participants: readonly LaunchCeremonyParticipant[];
  readonly state: LaunchCeremonyState;
  readonly transcript: ProductionCeremonyTranscript;
  readonly offlinePackages: readonly LaunchOfflineSigningPackage[];
  readonly signatures: readonly LaunchApprovalSignature[];
  readonly evidence: CeremonyEvidenceWatch;
  readonly hsmAttestation: ProductionHsmAttestation | null;
  readonly hsmClass: 'SIMULATION_HSM' | 'REAL_PROVIDER_HSM';
  readonly abort: CeremonyAbortRecord | null;
  readonly authorization: LaunchAuthorizationCandidate | null;
  readonly realProductionKeysCreated: false;
  readonly realHumanSignaturesCollected: false;
  readonly aiSatisfiesHumanRole: false;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
};

export type LaunchCeremonyVerificationReport = {
  readonly schemaVersion: typeof LAUNCH_CEREMONY_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly state: LaunchCeremonyState;
  readonly freezeHashBound: boolean;
  readonly transcriptIntegrity: boolean;
  readonly candidateChangeRequiresRestart: true;
  readonly simulationHsmIsRealHsm: false;
  readonly fixtureSignatureIsRealHumanAuthorization: false;
  readonly economicSignatureIsAutomaticGenesisSignature: false;
  readonly ceremonyAuthorizationEqualsActivation: false;
  readonly realProductionKeysCreated: false;
  readonly realHumanSignaturesCollected: false;
  readonly aiSatisfiesHumanRole: false;
  readonly mainnetEnabled: false;
  readonly productionActivated: false;
  readonly abort: CeremonyAbortRecord | null;
};

export type LaunchAuthorizationDressRehearsal = {
  readonly rehearsalId: string;
  readonly session: LaunchAuthorizationCeremonySession;
  readonly report: LaunchCeremonyVerificationReport;
  readonly changedFreezeRejection: CeremonyAbortRecord;
  readonly transcriptIntegrity: true;
  readonly candidateChangeRequiresRestart: true;
  readonly realProductionKeysCreated: false;
  readonly realHumanSignaturesCollected: false;
  readonly aiSatisfiesHumanRole: false;
  readonly ceremonyAuthorizationEqualsActivation: false;
  readonly mainnetEnabled: false;
  readonly productionActive: false;
};

