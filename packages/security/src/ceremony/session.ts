/**
 * Ceremony plan, session state machine, contributions, approvals,
 * genesis binding, rotation, compromise, and transcript finalization.
 */

import { SUITE_SUNREY_ED25519_V1, type CryptoSuiteId } from '../crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { HsmKeyHandle, HsmKmsProvider } from '../hsm-kms.ts';
import { sha256Hex } from '../hash.ts';
import type { KeyPurpose } from '../purposes.ts';
import { secureRandomHex } from '../random.ts';
import { assertAiCannot, assertHumanApprover, defaultApprovalThreshold } from './access.ts';
import {
  assertAuthorityPurpose,
  assertAuthoritySeparation,
  assertHumanGovernanceRole,
  purposeForAuthority,
  recoveryCannotBecomeGovernance,
} from './authorities.ts';
import { artifactHash, publicKeyFingerprint } from './canonical.ts';
import type { CeremonySimulationHsm } from './provider.ts';
import {
  CEREMONY_SCHEMA_VERSION,
  type CeremonyActorKind,
  type CeremonyApproval,
  type CeremonyNetworkProfile,
  type CeremonyOfflinePackage,
  type CeremonyParticipant,
  type CeremonyPlan,
  type CeremonyReleaseAuthorityBinding,
  type CeremonyRole,
  type CeremonyState,
  type CeremonyTranscript,
  type CeremonyTranscriptEntry,
  type GenesisBinding,
  type HsmAttestationRecord,
  type KeyRotationRecord,
  type OfflinePackageKind,
  type PublicCeremonyReport,
  type PublicKeyContribution,
  type RegisteredAuthorityKey,
  type RootKeyState,
  type RootOfTrustAuthority,
  type RootOfTrustCompromiseRecord,
} from './types.ts';

const STATE_ORDER: readonly CeremonyState[] = [
  'PLANNED',
  'PARTICIPANTS_VERIFIED',
  'PROVIDER_VERIFIED',
  'KEYS_GENERATED',
  'PUBLIC_DESCRIPTORS_COLLECTED',
  'ATTESTATIONS_VERIFIED',
  'TRANSCRIPT_FINALIZED',
  'REHEARSAL_COMPLETE',
  'AWAITING_EXTERNAL_PRODUCTION_EVENT',
];

export function createDefaultCeremonyPlan(input: {
  readonly ceremonyId?: string;
  readonly networkCandidate?: string;
  readonly requiredApprovals?: number;
  readonly networkProfile?: CeremonyNetworkProfile;
}): CeremonyPlan {
  return Object.freeze({
    ceremonyId: input.ceremonyId ?? `cerm_${secureRandomHex(8)}`,
    purpose: 'SunRey production-candidate root-of-trust rehearsal',
    environmentClass: 'REHEARSAL',
    networkCandidate: input.networkCandidate ?? 'net_sunrey_rehearsal_1',
    participantRoles: Object.freeze([
      'CEREMONY_COORDINATOR',
      'SECURITY_OFFICER',
      'VALIDATOR_OPERATOR',
      'GOVERNANCE_SIGNER',
      'RELEASE_SIGNER',
      'WITNESS',
      'INDEPENDENT_OBSERVER',
    ]),
    requiredApprovals: input.requiredApprovals ?? 2,
    keyPurposes: Object.freeze([
      'VALIDATOR_CONSENSUS_SIGNING',
      'P2P_IDENTITY',
      'GOVERNANCE_SIGNING',
      'RELEASE_SIGNING',
      'GENESIS_SIGNING',
      'RECOVERY_SIGNING',
    ]),
    authorities: Object.freeze([
      'GENESIS_AUTHORITY',
      'PROTOCOL_GOVERNANCE_AUTHORITY',
      'SECURITY_GOVERNANCE_AUTHORITY',
      'RELEASE_AUTHORITY',
      'VALIDATOR_CONSENSUS_AUTHORITY',
      'VALIDATOR_GOVERNANCE_AUTHORITY',
      'VALIDATOR_P2P_IDENTITY',
      'RECOVERY_AUTHORITY',
    ]),
    cryptoSuites: Object.freeze([SUITE_SUNREY_ED25519_V1]),
    providerRequirements: Object.freeze(['ED25519', 'NON_EXPORTABLE', 'ATTESTATION']),
    steps: Object.freeze([
      { stepId: 'plan', description: 'create ceremony plan', requiredRole: 'CEREMONY_COORDINATOR', highImpact: false },
      { stepId: 'participants', description: 'register participants', requiredRole: 'CEREMONY_COORDINATOR', highImpact: false },
      { stepId: 'provider', description: 'verify simulated HSM', requiredRole: 'SECURITY_OFFICER', highImpact: false },
      { stepId: 'generate', description: 'generate authority keys', requiredRole: 'SECURITY_OFFICER', highImpact: true },
      { stepId: 'contribute', description: 'collect public descriptors', requiredRole: 'VALIDATOR_OPERATOR', highImpact: false },
      { stepId: 'attest', description: 'verify attestations', requiredRole: 'SECURITY_OFFICER', highImpact: false },
      { stepId: 'genesis', description: 'bind genesis candidate hash', requiredRole: 'GOVERNANCE_SIGNER', highImpact: true },
      { stepId: 'approve', description: 'collect multi-person approvals', requiredRole: 'SECURITY_OFFICER', highImpact: true },
      { stepId: 'transcript', description: 'finalize transcript', requiredRole: 'WITNESS', highImpact: false },
    ]),
    expectedPublicArtifacts: Object.freeze([
      'public-descriptors',
      'attestations',
      'genesis-binding',
      'transcript-hash',
    ]),
    evidenceRequirements: Object.freeze(['attestation-hash', 'transcript-hash', 'approval-set']),
    recoveryPlan: 'replacement-key ceremony; recovery authority cannot become protocol governance',
    networkProfile: input.networkProfile ?? 'DEVELOPMENT_SIMULATION',
    schemaVersion: CEREMONY_SCHEMA_VERSION,
    requiresPublicRpc: false,
  });
}

export function genesisBindingHash(input: Omit<GenesisBinding, 'bindingHash' | 'signatureHex' | 'authorityPublicKeyHex'>): string {
  return artifactHash({
    genesisCandidateHash: input.genesisCandidateHash,
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    validatorSetHash: input.validatorSetHash,
    assetAllocationManifestHash: input.assetAllocationManifestHash,
    cryptoPolicyHash: input.cryptoPolicyHash,
    moduleHashes: input.moduleHashes,
  });
}

export class CeremonySession {
  readonly plan: CeremonyPlan;
  private state: CeremonyState = 'PLANNED';
  private readonly participants = new Map<string, CeremonyParticipant>();
  private readonly identityHandles = new Map<string, HsmKeyHandle>();
  private readonly keyHandles = new Map<string, HsmKeyHandle>();
  private readonly keys: RegisteredAuthorityKey[] = [];
  private readonly contributions: PublicKeyContribution[] = [];
  private readonly attestations: HsmAttestationRecord[] = [];
  private readonly approvals: CeremonyApproval[] = [];
  private readonly rotations: KeyRotationRecord[] = [];
  private readonly compromises: RootOfTrustCompromiseRecord[] = [];
  private readonly transcriptEntries: CeremonyTranscriptEntry[] = [];
  private genesis: GenesisBinding | null = null;
  private releaseBinding: CeremonyReleaseAuthorityBinding | null = null;
  private transcriptFinalized = false;
  private transcriptHash: string | null = null;
  private provider: CeremonySimulationHsm | null = null;
  private readonly now: () => string;

  constructor(plan: CeremonyPlan, options: { readonly clock?: () => string } = {}) {
    this.plan = plan;
    this.now = options.clock ?? (() => new Date().toISOString());
    this.append('PLAN_CREATED', 'SYSTEM', 'SYSTEM', [artifactHash(plan)], 'OK', 'plan');
  }

  getState(): CeremonyState {
    return this.state;
  }

  listParticipants(): readonly CeremonyParticipant[] {
    return [...this.participants.values()];
  }

  listKeys(): readonly RegisteredAuthorityKey[] {
    return [...this.keys];
  }

  listApprovals(): readonly CeremonyApproval[] {
    return [...this.approvals];
  }

  listAttestations(): readonly HsmAttestationRecord[] {
    return [...this.attestations];
  }

  listContributions(): readonly PublicKeyContribution[] {
    return [...this.contributions];
  }

  getGenesisBinding(): GenesisBinding | null {
    return this.genesis;
  }

  getReleaseBinding(): CeremonyReleaseAuthorityBinding | null {
    return this.releaseBinding;
  }

  getTranscript(): CeremonyTranscript {
    return Object.freeze({
      ceremonyId: this.plan.ceremonyId,
      schemaVersion: CEREMONY_SCHEMA_VERSION,
      entries: [...this.transcriptEntries],
      finalized: this.transcriptFinalized,
      transcriptHash: this.transcriptHash,
    });
  }

  registerParticipant(input: {
    readonly participantId: string;
    readonly displayName: string;
    readonly role: CeremonyRole;
    readonly actorKind: CeremonyActorKind;
  }): SecurityResult<CeremonyParticipant> {
    if (this.transcriptFinalized) {
      return securityErr('CEREMONY_STATE_INVALID', 'transcript is finalized');
    }
    const participant: CeremonyParticipant = Object.freeze({
      ...input,
      identityPublicKeyHex: null,
      identityFingerprint: null,
    });
    this.participants.set(input.participantId, participant);
    this.append('PARTICIPANT_REGISTERED', input.role, input.actorKind, [artifactHash(participant)], 'OK', input.participantId);
    return securityOk(participant);
  }

  verifyParticipants(): SecurityResult<CeremonyState> {
    const missing = this.plan.participantRoles.filter(
      (role) => ![...this.participants.values()].some((participant) => participant.role === role),
    );
    if (missing.length > 0) {
      return securityErr('CEREMONY_STATE_INVALID', `missing roles: ${missing.join(',')}`);
    }
    return this.advance('PARTICIPANTS_VERIFIED', 'PARTICIPANTS_VERIFIED');
  }

  verifyProvider(provider: CeremonySimulationHsm): SecurityResult<CeremonyState> {
    if (!provider.simulation || provider.implementationState !== 'SIMULATION') {
      return securityErr('PRODUCTION_CLAIM_FORBIDDEN', 'CI/rehearsal accepts simulation providers only');
    }
    const health = provider.healthCheck();
    if (!health.ok) {
      return health;
    }
    const capabilities = provider.capabilities();
    if (capabilities.privateMaterialExportSupported !== false || capabilities.nonExportable !== true) {
      return securityErr('POLICY_REJECTED', 'provider must be non-exportable');
    }
    if (capabilities.simulationClass !== 'SIMULATION') {
      return securityErr('PRODUCTION_CLAIM_FORBIDDEN', 'provider capability class must be SIMULATION');
    }
    if ('extractPrivateKey' in provider || 'exportKey' in provider) {
      return securityErr('POLICY_REJECTED', 'generic private-key export is forbidden');
    }
    this.provider = provider;
    this.append('PROVIDER_VERIFIED', 'SECURITY_OFFICER', 'HUMAN', [artifactHash(capabilities)], 'OK', provider.providerId);
    return this.advance('PROVIDER_VERIFIED', 'PROVIDER_VERIFIED');
  }

  issueIdentityKey(participantId: string): SecurityResult<CeremonyParticipant> {
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    const participant = this.participants.get(participantId);
    if (!participant) {
      return securityErr('KEY_NOT_FOUND', `unknown participant ${participantId}`);
    }
    const generated = provider.value.generateKey({
      purpose: 'ATTESTATION_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
      keyId: `identity:${participantId}`,
    });
    if (!generated.ok) {
      return generated;
    }
    const descriptor = provider.value.getPublicDescriptor(generated.value);
    if (!descriptor.ok) {
      return descriptor;
    }
    this.identityHandles.set(participantId, generated.value);
    const updated: CeremonyParticipant = Object.freeze({
      ...participant,
      identityPublicKeyHex: descriptor.value.publicKeyHex,
      identityFingerprint: publicKeyFingerprint(descriptor.value.publicKeyHex),
    });
    this.participants.set(participantId, updated);
    return securityOk(updated);
  }

  generateAuthorityKey(input: {
    readonly ownerParticipantId: string;
    readonly authority: RootOfTrustAuthority;
    readonly suiteId?: CryptoSuiteId;
    readonly keyId?: string;
  }): SecurityResult<RegisteredAuthorityKey> {
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    const owner = this.participants.get(input.ownerParticipantId);
    if (!owner) {
      return securityErr('KEY_NOT_FOUND', `unknown owner ${input.ownerParticipantId}`);
    }
    const human = assertHumanGovernanceRole(input.authority, owner.actorKind);
    if (!human.ok) {
      return human;
    }
    const purpose = purposeForAuthority(input.authority);
    const purposeCheck = assertAuthorityPurpose(input.authority, purpose);
    if (!purposeCheck.ok) {
      return purposeCheck;
    }
    const generated = provider.value.generateKey({
      purpose,
      suiteId: input.suiteId ?? SUITE_SUNREY_ED25519_V1,
      keyId: input.keyId ?? `${input.authority.toLowerCase()}:${input.ownerParticipantId}:${secureRandomHex(4)}`,
    });
    if (!generated.ok) {
      return generated;
    }
    const descriptor = provider.value.getPublicDescriptor(generated.value);
    if (!descriptor.ok) {
      return descriptor;
    }
    const fingerprint = publicKeyFingerprint(descriptor.value.publicKeyHex);
    const separation = assertAuthoritySeparation(fingerprint, input.authority, this.keys);
    if (!separation.ok) {
      return separation;
    }
    const attestation = provider.value.getAttestationMetadata(generated.value);
    if (!attestation.ok) {
      return attestation;
    }
    const backup = provider.value.getBackupReference(generated.value);
    if (!backup.ok) {
      return backup;
    }
    this.keyHandles.set(generated.value.keyId, generated.value);
    const record: RegisteredAuthorityKey = Object.freeze({
      keyId: generated.value.keyId,
      authority: input.authority,
      purpose,
      suiteId: generated.value.suiteId,
      publicKeyHex: descriptor.value.publicKeyHex,
      fingerprint,
      keyVersion: generated.value.keyVersion,
      state: 'ACTIVE',
      ownerParticipantId: input.ownerParticipantId,
      providerId: provider.value.providerId,
      attestationRef: artifactHash(attestation.value),
      backupRef: backup.value.backupHandleRef,
      historical: false,
    });
    this.keys.push(record);
    this.append('KEY_GENERATED', owner.role, owner.actorKind, [record.fingerprint], 'OK', record.keyId);
    if (this.keys.length > 0 && STATE_ORDER.indexOf(this.state) < STATE_ORDER.indexOf('KEYS_GENERATED')) {
      this.state = 'KEYS_GENERATED';
    }
    return securityOk(record);
  }

  contributePublicKeys(input: {
    readonly operatorParticipantId: string;
    readonly validatorId: string | null;
    readonly consensusKeyId?: string;
    readonly p2pKeyId?: string;
    readonly governanceKeyId?: string;
  }): SecurityResult<PublicKeyContribution> {
    const operator = this.participants.get(input.operatorParticipantId);
    if (!operator) {
      return securityErr('KEY_NOT_FOUND', 'unknown operator');
    }
    const identity = this.identityHandles.get(input.operatorParticipantId);
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    if (!identity || !operator.identityPublicKeyHex) {
      return securityErr('CEREMONY_STATE_INVALID', 'operator identity key is required before contribution');
    }
    const consensus = input.consensusKeyId ? this.keys.find((key) => key.keyId === input.consensusKeyId) : undefined;
    const p2p = input.p2pKeyId ? this.keys.find((key) => key.keyId === input.p2pKeyId) : undefined;
    const governance = input.governanceKeyId ? this.keys.find((key) => key.keyId === input.governanceKeyId) : undefined;
    const payload = {
      validatorId: input.validatorId,
      operatorParticipantId: input.operatorParticipantId,
      consensusPublicKeyHex: consensus?.publicKeyHex ?? null,
      p2pPublicKeyHex: p2p?.publicKeyHex ?? null,
      governancePublicKeyHex: governance?.publicKeyHex ?? null,
    };
    const digest = Buffer.from(artifactHash(payload), 'hex');
    const signed = provider.value.signCanonicalDigest({
      handle: identity,
      digest,
      purpose: 'ATTESTATION_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    if (!signed.ok) {
      return signed;
    }
    const contribution: PublicKeyContribution = Object.freeze({
      ...payload,
      suiteId: SUITE_SUNREY_ED25519_V1,
      providerCapabilityStatement: 'SIMULATION ceremony HSM; hardware PQC unconfirmed',
      attestationReference: consensus?.attestationRef ?? p2p?.attestationRef ?? 'none',
      operatorApprovalSignatureHex: signed.value.signatureHex,
      operatorPublicKeyHex: operator.identityPublicKeyHex,
    });
    this.contributions.push(contribution);
    this.append('PUBLIC_CONTRIBUTION', operator.role, operator.actorKind, [artifactHash(contribution)], 'OK', input.validatorId ?? input.operatorParticipantId);
    if (STATE_ORDER.indexOf(this.state) < STATE_ORDER.indexOf('PUBLIC_DESCRIPTORS_COLLECTED') && this.contributions.length > 0) {
      this.state = 'PUBLIC_DESCRIPTORS_COLLECTED';
    }
    return securityOk(contribution);
  }

  attestKey(keyId: string, verifiedBy: string): SecurityResult<HsmAttestationRecord> {
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    const key = this.keys.find((item) => item.keyId === keyId);
    const handle = this.keyHandles.get(keyId);
    if (!key || !handle) {
      return securityErr('KEY_NOT_FOUND', `unknown key ${keyId}`);
    }
    const metadata = provider.value.getAttestationMetadata(handle);
    if (!metadata.ok) {
      return metadata;
    }
    const record: HsmAttestationRecord = Object.freeze({
      providerType: 'SIMULATION_HSM',
      deviceModel: 'sunrey-ceremony-simulator',
      firmwareVersion: metadata.value.providerVersion,
      keyId: key.keyId,
      keyPurpose: key.purpose,
      authority: key.authority,
      algorithm: key.suiteId,
      publicKeyFingerprint: key.fingerprint,
      attestationEvidenceHash: artifactHash(metadata.value),
      verificationStatus: 'VERIFIED_SIMULATION',
      verifiedBy,
      simulation: true,
    });
    this.attestations.push(record);
    this.append('ATTESTATION_RECORDED', 'SECURITY_OFFICER', 'HUMAN', [record.attestationEvidenceHash], 'OK', keyId);
    return securityOk(record);
  }

  verifyAttestations(): SecurityResult<CeremonyState> {
    if (this.attestations.length === 0) {
      return securityErr('CEREMONY_ATTESTATION_INVALID', 'no attestations recorded');
    }
    const invalid = this.attestations.find((item) => item.verificationStatus === 'REJECTED');
    if (invalid) {
      return securityErr('CEREMONY_ATTESTATION_INVALID', `attestation rejected for ${invalid.keyId}`);
    }
    this.append('ATTESTATIONS_VERIFIED', 'SECURITY_OFFICER', 'HUMAN', this.attestations.map((item) => item.attestationEvidenceHash), 'OK', 'attest');
    return this.advance('ATTESTATIONS_VERIFIED', 'ATTESTATIONS_VERIFIED');
  }

  approve(input: {
    readonly actorParticipantId: string;
    readonly operation: string;
    readonly payloadHash?: string;
  }): SecurityResult<CeremonyApproval> {
    const actor = this.participants.get(input.actorParticipantId);
    if (!actor) {
      return securityErr('KEY_NOT_FOUND', 'unknown approver');
    }
    const human = assertHumanApprover(actor.actorKind, actor.role);
    if (!human.ok) {
      this.append('APPROVAL_REJECTED', actor.role, actor.actorKind, [], 'REJECTED', input.operation);
      return human;
    }
    const identity = this.identityHandles.get(input.actorParticipantId);
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    if (!identity || !actor.identityPublicKeyHex) {
      return securityErr('CEREMONY_STATE_INVALID', 'approver identity key is required');
    }
    const payloadHash = input.payloadHash ?? artifactHash({ operation: input.operation, ceremonyId: this.plan.ceremonyId });
    const signed = provider.value.signCanonicalDigest({
      handle: identity,
      digest: Buffer.from(payloadHash, 'hex'),
      purpose: 'ATTESTATION_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    if (!signed.ok) {
      return signed;
    }
    const approval: CeremonyApproval = Object.freeze({
      approvalId: `apr_${secureRandomHex(6)}`,
      operation: input.operation,
      actorParticipantId: actor.participantId,
      actorRole: actor.role,
      actorKind: actor.actorKind,
      payloadHash,
      signatureHex: signed.value.signatureHex,
      publicKeyHex: actor.identityPublicKeyHex,
    });
    this.approvals.push(approval);
    this.append('APPROVAL_RECORDED', actor.role, actor.actorKind, [artifactHash(approval)], 'OK', input.operation);
    return securityOk(approval);
  }

  assertApprovals(operation: string): SecurityResult<true> {
    const needed = defaultApprovalThreshold(operation, this.plan.requiredApprovals);
    const unique = new Set(
      this.approvals
        .filter((item) => item.operation === operation && item.actorKind === 'HUMAN')
        .map((item) => item.actorParticipantId),
    );
    if (unique.size < needed) {
      return securityErr(
        'CEREMONY_APPROVAL_REJECTED',
        `${operation} requires ${needed} distinct human approvals; have ${unique.size}`,
      );
    }
    return securityOk(true);
  }

  bindGenesisCandidate(input: {
    readonly actorParticipantId: string;
    readonly genesisCandidateHash: string;
    readonly networkId: string;
    readonly chainId: string;
    readonly protocolVersion: string;
    readonly validatorSetHash: string;
    readonly assetAllocationManifestHash: string;
    readonly cryptoPolicyHash: string;
    readonly moduleHashes: readonly string[];
  }): SecurityResult<GenesisBinding> {
    const approvals = this.assertApprovals('ACTIVATE_GENESIS_SIGNING_SESSION');
    if (!approvals.ok) {
      return approvals;
    }
    const genesisKey = this.keys.find((key) => key.authority === 'GENESIS_AUTHORITY' && key.state === 'ACTIVE');
    const handle = genesisKey ? this.keyHandles.get(genesisKey.keyId) : undefined;
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    if (!genesisKey || !handle) {
      return securityErr('KEY_NOT_FOUND', 'GENESIS_AUTHORITY key is required');
    }
    const actor = this.participants.get(input.actorParticipantId);
    if (!actor) {
      return securityErr('KEY_NOT_FOUND', 'unknown genesis actor');
    }
    const bindingHash = genesisBindingHash(input);
    const signed = provider.value.signCanonicalDigest({
      handle,
      digest: Buffer.from(bindingHash, 'hex'),
      purpose: 'GENESIS_SIGNING',
      suiteId: genesisKey.suiteId,
    });
    if (!signed.ok) {
      return signed;
    }
    this.genesis = Object.freeze({
      ...input,
      bindingHash,
      signatureHex: signed.value.signatureHex,
      authorityPublicKeyHex: genesisKey.publicKeyHex,
    });
    this.append('GENESIS_BOUND', actor.role, actor.actorKind, [bindingHash], 'OK', input.genesisCandidateHash);
    return securityOk(this.genesis);
  }

  authorizeWithKey(keyId: string, requiredAuthority: RootOfTrustAuthority, digestHex: string): SecurityResult<true> {
    const key = this.keys.find((item) => item.keyId === keyId);
    const handle = this.keyHandles.get(keyId);
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    if (!key || !handle) {
      return securityErr('KEY_NOT_FOUND', `unknown key ${keyId}`);
    }
    if (key.authority !== requiredAuthority) {
      return securityErr(
        'AUTHORITY_SEPARATION',
        `${key.authority} cannot authorize an operation that requires ${requiredAuthority}`,
      );
    }
    if (key.purpose !== purposeForAuthority(requiredAuthority)) {
      return securityErr('PURPOSE_MISMATCH', 'key purpose does not match required authority');
    }
    const signed = provider.value.signCanonicalDigest({
      handle,
      digest: Buffer.from(digestHex, 'hex'),
      purpose: key.purpose,
      suiteId: key.suiteId,
    });
    if (!signed.ok) {
      return signed;
    }
    return securityOk(true);
  }

  bindReleaseAuthority(keyId: string): SecurityResult<CeremonyReleaseAuthorityBinding> {
    const key = this.keys.find((item) => item.keyId === keyId && item.authority === 'RELEASE_AUTHORITY');
    if (!key) {
      return securityErr('PURPOSE_MISMATCH', 'release binding requires RELEASE_AUTHORITY');
    }
    const approvals = this.assertApprovals('ROTATE_RELEASE_AUTHORITY');
    if (!approvals.ok) {
      const createApprovals = this.assertApprovals('CREATE_ROOT_GOVERNANCE_KEY');
      if (!createApprovals.ok) {
        return approvals;
      }
    }
    this.releaseBinding = Object.freeze({
      kind: 'SOFTWARE_RELEASE_AUTHORITY',
      authorityClass: 'RELEASE_AUTHORITY',
      authorityId: key.keyId,
      publicKeyHex: key.publicKeyHex,
      suiteId: key.suiteId,
      notAppAuthorityGrant: true,
      notValidatorGovernance: true,
      notCustodySigner: true,
      notWalletSigner: true,
      mayChangeBlockchainState: false,
    });
    this.append('RELEASE_BOUND', 'RELEASE_SIGNER', 'HUMAN', [key.fingerprint], 'OK', key.keyId);
    return securityOk(this.releaseBinding);
  }

  rotateAuthorityKey(input: {
    readonly currentKeyId: string;
    readonly ownerParticipantId: string;
    readonly effectiveEpoch?: number;
    readonly effectiveHeight?: number;
  }): SecurityResult<KeyRotationRecord> {
    const current = this.keys.find((item) => item.keyId === input.currentKeyId);
    if (!current) {
      return securityErr('KEY_NOT_FOUND', 'current key missing');
    }
    const replacement = this.generateAuthorityKey({
      ownerParticipantId: input.ownerParticipantId,
      authority: current.authority,
      suiteId: current.suiteId,
    });
    if (!replacement.ok) {
      return replacement;
    }
    const index = this.keys.findIndex((item) => item.keyId === current.keyId);
    this.keys[index] = Object.freeze({ ...current, state: 'RETIRED_FOR_NEW_USE', historical: true });
    const handle = this.keyHandles.get(current.keyId);
    if (handle && this.provider) {
      this.provider.disableKey(handle);
    }
    const record: KeyRotationRecord = Object.freeze({
      currentKeyId: current.keyId,
      futureKeyId: replacement.value.keyId,
      authority: current.authority,
      effectiveEpoch: input.effectiveEpoch ?? null,
      effectiveHeight: input.effectiveHeight ?? null,
      approvals: this.approvals.filter((item) => item.operation === 'ROTATE_RELEASE_AUTHORITY').map((item) => item.approvalId),
      attestationRef: replacement.value.attestationRef ?? 'none',
      retirementState: 'RETIRED_FOR_NEW_USE',
    });
    this.rotations.push(record);
    this.append('KEY_ROTATED', 'SECURITY_OFFICER', 'HUMAN', [current.fingerprint, replacement.value.fingerprint], 'OK', current.keyId);
    return securityOk(record);
  }

  recordCompromise(input: {
    readonly suspectedKeyId: string;
    readonly changeRequest: string;
    readonly replacementOwnerParticipantId?: string;
  }): SecurityResult<RootOfTrustCompromiseRecord> {
    const suspected = this.keys.find((item) => item.keyId === input.suspectedKeyId);
    if (!suspected) {
      return securityErr('KEY_NOT_FOUND', 'suspected key missing');
    }
    const handle = this.keyHandles.get(suspected.keyId);
    if (handle && this.provider) {
      this.provider.markCompromised(handle);
    }
    const index = this.keys.findIndex((item) => item.keyId === suspected.keyId);
    this.keys[index] = Object.freeze({ ...suspected, state: 'COMPROMISED', historical: true });
    let replacementKeyId: string | null = null;
    if (input.replacementOwnerParticipantId) {
      const replacement = this.generateAuthorityKey({
        ownerParticipantId: input.replacementOwnerParticipantId,
        authority: suspected.authority,
        suiteId: suspected.suiteId,
      });
      if (!replacement.ok) {
        return replacement;
      }
      replacementKeyId = replacement.value.keyId;
    }
    const record: RootOfTrustCompromiseRecord = Object.freeze({
      compromiseId: `cmp_${secureRandomHex(6)}`,
      suspectedKeyId: suspected.keyId,
      authority: suspected.authority,
      providerDisableRequested: true,
      authorityRestricted: true,
      replacementKeyId,
      changeRequest: input.changeRequest,
      evidenceRef: `compromise:${suspected.keyId}`,
      historyErased: false,
    });
    this.compromises.push(record);
    this.append('COMPROMISE_RECORDED', 'SECURITY_OFFICER', 'HUMAN', [suspected.fingerprint], 'OK', suspected.keyId);
    return securityOk(record);
  }

  refuseAuthorityPromotion(from: RootOfTrustAuthority, to: RootOfTrustAuthority): SecurityResult<true> {
    if (recoveryCannotBecomeGovernance(from, to)) {
      return securityErr('AUTHORITY_SEPARATION', 'recovery authority cannot become protocol governance');
    }
    if (from !== to) {
      return securityErr('AUTHORITY_SEPARATION', `${from} cannot be promoted to ${to}`);
    }
    return securityOk(true);
  }

  markDestroyed(keyId: string, providerConfirmed: boolean): SecurityResult<RegisteredAuthorityKey> {
    const index = this.keys.findIndex((item) => item.keyId === keyId);
    if (index < 0) {
      return securityErr('KEY_NOT_FOUND', 'key missing');
    }
    const current = this.keys[index]!;
    const state: RootKeyState = providerConfirmed ? 'DESTROYED_PROVIDER_CONFIRMED' : 'RETIRED_FOR_NEW_USE';
    if (!providerConfirmed) {
      this.append('DESTROY_UNCONFIRMED', 'SYSTEM', 'SYSTEM', [current.fingerprint], 'REJECTED', keyId);
      return securityErr(
        'PRODUCTION_CLAIM_FORBIDDEN',
        'software cannot claim hardware destruction without provider/human evidence',
      );
    }
    const updated = Object.freeze({ ...current, state, historical: true });
    this.keys[index] = updated;
    return securityOk(updated);
  }

  finalizeTranscript(actorParticipantId: string): SecurityResult<CeremonyTranscript> {
    const actor = this.participants.get(actorParticipantId);
    if (!actor) {
      return securityErr('KEY_NOT_FOUND', 'unknown finalizer');
    }
    const hash = this.computeTranscriptHash();
    this.transcriptHash = hash;
    this.transcriptFinalized = true;
    this.append('TRANSCRIPT_FINALIZED', actor.role, actor.actorKind, [hash], 'OK', 'transcript');
    this.transcriptHash = this.computeTranscriptHash();
    this.state = 'TRANSCRIPT_FINALIZED';
    return securityOk(this.getTranscript());
  }

  markRehearsalComplete(): SecurityResult<CeremonyState> {
    if (!this.transcriptFinalized || !this.transcriptHash) {
      return securityErr('CEREMONY_STATE_INVALID', 'transcript must be finalized first');
    }
    this.state = 'REHEARSAL_COMPLETE';
    this.append('REHEARSAL_COMPLETE', 'SYSTEM', 'SYSTEM', [this.transcriptHash], 'OK', 'rehearsal');
    return securityOk(this.state);
  }

  awaitExternalProductionEvent(): SecurityResult<CeremonyState> {
    return securityErr(
      'PRODUCTION_CLAIM_FORBIDDEN',
      'repository rehearsal cannot claim a real production ceremony event',
    );
  }

  buildOfflinePackage(
    packageKind: OfflinePackageKind,
    payload: unknown,
    signerParticipantId?: string,
  ): SecurityResult<CeremonyOfflinePackage> {
    const leakage = JSON.stringify(payload);
    if (/privateKey|secretKey|mnemonic|seedPhrase/i.test(leakage)) {
      return securityErr('PRIVATE_KEY_LEAKAGE', 'offline package must not contain private keys');
    }
    const payloadHash = artifactHash(payload);
    let signatureHex: string | null = null;
    let signerPublicKeyHex: string | null = null;
    if (signerParticipantId) {
      const identity = this.identityHandles.get(signerParticipantId);
      const participant = this.participants.get(signerParticipantId);
      const provider = this.requireProvider();
      if (!provider.ok) {
        return provider;
      }
      if (!identity || !participant?.identityPublicKeyHex) {
        return securityErr('CEREMONY_STATE_INVALID', 'signer identity required for signed package');
      }
      const signed = provider.value.signCanonicalDigest({
        handle: identity,
        digest: Buffer.from(payloadHash, 'hex'),
        purpose: 'ATTESTATION_SIGNING',
        suiteId: SUITE_SUNREY_ED25519_V1,
      });
      if (!signed.ok) {
        return signed;
      }
      signatureHex = signed.value.signatureHex;
      signerPublicKeyHex = participant.identityPublicKeyHex;
    }
    return securityOk(
      Object.freeze({
        schemaVersion: CEREMONY_SCHEMA_VERSION,
        kind: 'SUNREY_CEREMONY_OFFLINE_PACKAGE',
        packageKind,
        payload,
        payloadHash,
        signatureHex,
        signerPublicKeyHex,
        containsPrivateKeys: false,
      }),
    );
  }

  publicReport(): PublicCeremonyReport {
    return Object.freeze({
      ceremonyId: this.plan.ceremonyId,
      participantRoles: [...new Set([...this.participants.values()].map((item) => item.role))],
      publicFingerprints: this.keys.map((key) => ({
        authority: key.authority,
        purpose: key.purpose,
        fingerprint: key.fingerprint,
        algorithm: key.suiteId,
      })),
      attestationStatus: this.attestations.map((item) => `${item.keyId}:${item.verificationStatus}`),
      genesisCandidateHashReference: this.genesis?.genesisCandidateHash ?? null,
      transcriptHash: this.transcriptHash,
      approvalCount: this.approvals.length,
      softwareVersions: Object.freeze([
        'sunrey-ceremony-hsm-sim-v1',
        'sunrey-ed25519-v1',
        '@noble/post-quantum@0.5.4',
      ]),
      simulation: true,
      productionAuthorityActive: false,
    });
  }

  verifyIndependently(transcript: CeremonyTranscript = this.getTranscript()): SecurityResult<true> {
    if (transcript.entries.length === 0) {
      return securityErr('CEREMONY_TRANSCRIPT_TAMPERED', 'empty transcript');
    }
    let prior = 'GENESIS';
    for (const [index, entry] of transcript.entries.entries()) {
      if (entry.sequence !== index + 1 || entry.priorTranscriptHash !== prior) {
        return securityErr('CEREMONY_TRANSCRIPT_TAMPERED', `transcript sequence broken at ${entry.sequence}`);
      }
      const expected = sha256Hex(
        `${entry.sequence}|${entry.actionType}|${entry.actorRole}|${entry.publicArtifactHashes.join(',')}|${entry.priorTranscriptHash}|${entry.result}|${entry.occurredAtUtc}|${entry.evidenceReference}`,
      );
      if (expected !== entry.entryHash) {
        return securityErr('CEREMONY_TRANSCRIPT_TAMPERED', `transcript hash mismatch at ${entry.sequence}`);
      }
      prior = entry.entryHash;
    }
    if (transcript.finalized) {
      const last = transcript.entries[transcript.entries.length - 1];
      if (!last || transcript.transcriptHash !== last.entryHash) {
        return securityErr('CEREMONY_TRANSCRIPT_TAMPERED', 'final transcript hash does not match chain tip');
      }
    }
    return this.verifyPublicArtifacts();
  }

  verifyPublicArtifacts(overrides?: {
    readonly contribution?: PublicKeyContribution;
    readonly attestation?: HsmAttestationRecord;
    readonly genesis?: GenesisBinding;
    readonly approval?: CeremonyApproval;
  }): SecurityResult<true> {
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    const contribution = overrides?.contribution ?? this.contributions[0];
    if (contribution) {
      const payload = {
        validatorId: contribution.validatorId,
        operatorParticipantId: contribution.operatorParticipantId,
        consensusPublicKeyHex: contribution.consensusPublicKeyHex,
        p2pPublicKeyHex: contribution.p2pPublicKeyHex,
        governancePublicKeyHex: contribution.governancePublicKeyHex,
      };
      const verified = provider.value.verifyDigest(
        contribution.operatorPublicKeyHex,
        Buffer.from(artifactHash(payload), 'hex'),
        contribution.operatorApprovalSignatureHex,
      );
      if (!verified.ok) {
        return securityErr('SIGNATURE_INVALID', 'public key contribution signature is invalid');
      }
    }
    const attestation = overrides?.attestation ?? this.attestations[0];
    if (attestation) {
      const key = this.keys.find((item) => item.keyId === attestation.keyId);
      if (!key || key.fingerprint !== attestation.publicKeyFingerprint) {
        return securityErr('CEREMONY_ATTESTATION_INVALID', 'attestation fingerprint does not match registered key');
      }
    }
    const genesis = overrides?.genesis ?? this.genesis;
    if (genesis) {
      const expected = genesisBindingHash(genesis);
      if (expected !== genesis.bindingHash) {
        return securityErr('BINDING_MISMATCH', 'genesis candidate hash binding does not match exact fields');
      }
      const verified = provider.value.verifyDigest(
        genesis.authorityPublicKeyHex,
        Buffer.from(genesis.bindingHash, 'hex'),
        genesis.signatureHex,
      );
      if (!verified.ok) {
        return securityErr('SIGNATURE_INVALID', 'genesis binding signature is invalid');
      }
    }
    const approval = overrides?.approval ?? this.approvals[0];
    if (approval) {
      if (approval.actorKind === 'AI') {
        return securityErr('AI_ROLE_FORBIDDEN', 'AI approval is rejected');
      }
      const verified = provider.value.verifyDigest(
        approval.publicKeyHex,
        Buffer.from(approval.payloadHash, 'hex'),
        approval.signatureHex,
      );
      if (!verified.ok) {
        return securityErr('SIGNATURE_INVALID', 'approval signature is invalid');
      }
    }
    return securityOk(true);
  }

  verifyHistoricalSignature(keyId: string, digestHex: string, signatureHex: string): SecurityResult<true> {
    const key = this.keys.find((item) => item.keyId === keyId);
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    if (!key) {
      return securityErr('KEY_NOT_FOUND', 'historical key missing');
    }
    return provider.value.verifyDigest(key.publicKeyHex, Buffer.from(digestHex, 'hex'), signatureHex);
  }

  signWithKey(keyId: string, purpose: KeyPurpose, digestHex: string): SecurityResult<string> {
    const key = this.keys.find((item) => item.keyId === keyId);
    const handle = this.keyHandles.get(keyId);
    const provider = this.requireProvider();
    if (!provider.ok) {
      return provider;
    }
    if (!key || !handle) {
      return securityErr('KEY_NOT_FOUND', 'key missing');
    }
    if (key.purpose !== purpose) {
      return securityErr('PURPOSE_MISMATCH', 'wrong-purpose signature is rejected');
    }
    const signed = provider.value.signCanonicalDigest({
      handle,
      digest: Buffer.from(digestHex, 'hex'),
      purpose,
      suiteId: key.suiteId,
    });
    if (!signed.ok) {
      return signed;
    }
    return securityOk(signed.value.signatureHex);
  }

  private requireProvider(): SecurityResult<CeremonySimulationHsm> {
    if (!this.provider) {
      return securityErr('PROVIDER_UNAVAILABLE', 'ceremony provider is not verified');
    }
    return securityOk(this.provider);
  }

  private advance(next: CeremonyState, action: string): SecurityResult<CeremonyState> {
    this.state = next;
    this.append(action, 'SYSTEM', 'SYSTEM', [next], 'OK', next);
    return securityOk(next);
  }

  private computeTranscriptHash(): string {
    const last = this.transcriptEntries[this.transcriptEntries.length - 1];
    return last?.entryHash ?? sha256Hex('empty');
  }

  private append(
    actionType: string,
    actorRole: CeremonyRole | 'SYSTEM',
    actorKind: CeremonyActorKind | 'SYSTEM',
    publicArtifactHashes: readonly string[],
    result: 'OK' | 'REJECTED',
    evidenceReference: string,
  ): void {
    const prior = this.transcriptEntries[this.transcriptEntries.length - 1]?.entryHash ?? 'GENESIS';
    const sequence = this.transcriptEntries.length + 1;
    const occurredAtUtc = this.now();
    const entryHash = sha256Hex(
      `${sequence}|${actionType}|${actorRole}|${publicArtifactHashes.join(',')}|${prior}|${result}|${occurredAtUtc}|${evidenceReference}`,
    );
    this.transcriptEntries.push(
      Object.freeze({
        sequence,
        actionType,
        actorRole,
        actorKind,
        publicArtifactHashes,
        priorTranscriptHash: prior,
        entryHash,
        result,
        occurredAtUtc,
        evidenceReference,
      }),
    );
  }
}

export function verifyOfflinePackage(
  pkg: CeremonyOfflinePackage,
  verify: (publicKeyHex: string, digest: Buffer, signatureHex: string) => SecurityResult<true>,
): SecurityResult<true> {
  if (pkg.containsPrivateKeys !== false || pkg.kind !== 'SUNREY_CEREMONY_OFFLINE_PACKAGE') {
    return securityErr('PRIVATE_KEY_LEAKAGE', 'offline package is malformed');
  }
  if (artifactHash(pkg.payload) !== pkg.payloadHash) {
    return securityErr('BINDING_MISMATCH', 'offline package payload hash mismatch');
  }
  if (pkg.signatureHex && pkg.signerPublicKeyHex) {
    return verify(pkg.signerPublicKeyHex, Buffer.from(pkg.payloadHash, 'hex'), pkg.signatureHex);
  }
  return securityOk(true);
}

export type { HsmKmsProvider };
