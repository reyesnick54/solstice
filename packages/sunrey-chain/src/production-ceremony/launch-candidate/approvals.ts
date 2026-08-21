/**
 * Multi-party launch approvals.
 *
 * Chunk 163 economic approvals and genesis/launch ceremony approvals
 * are different statements. An economic-parameter signature does not
 * count as a genesis signature unless the signed payload explicitly
 * binds both. Fixture signatures are never real human authorization.
 */

import {
  createEd25519SignatureProvider,
  SUITE_SUNREY_ED25519_V1,
} from '../../../../security/src/index.ts';
import { sha256Bytes } from '../../validators/canonical.ts';
import { fingerprintOf } from '../keys.ts';
import { payloadBindsGenesis } from './offline.ts';
import { assertNoSecretMaterial } from './transcript.ts';
import type {
  LaunchApprovalSignature,
  LaunchCeremonyParticipant,
  LaunchCeremonySessionIdentity,
  LaunchOfflineSigningPackage,
  LaunchSignatureClass,
} from './types.ts';

const FIXTURE_KEY_LABEL = 'SUNREY_LAUNCH_AUTH_REHEARSAL_NOT_FOR_PRODUCTION';

export function fixtureSigningLabel(participantId: string): string {
  return `${FIXTURE_KEY_LABEL}|${participantId}`;
}

export function deriveFixturePublicKey(participantId: string): string {
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(fixtureSigningLabel(participantId), 'utf8'));
  const derived = provider.fromSeed(
    seed.toString('hex'),
    'GENESIS_SIGNING',
    SUITE_SUNREY_ED25519_V1,
    `launch-auth-${participantId}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return derived.value.publicKey.publicKeyHex;
}

export function signFixturePayload(participantId: string, payloadHash: string): string {
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(fixtureSigningLabel(participantId), 'utf8'));
  const derived = provider.fromSeed(
    seed.toString('hex'),
    'GENESIS_SIGNING',
    SUITE_SUNREY_ED25519_V1,
    `launch-auth-${participantId}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  const signed = provider.signRaw(
    derived.value.privateKey.reveal().toString('hex'),
    derived.value.publicKey.publicKeyHex,
    Buffer.from(payloadHash, 'hex'),
  );
  if (!signed.ok) {
    throw new Error(signed.error.message);
  }
  return signed.value.toString('hex');
}

export function verifyLaunchSignature(
  publicKeyHex: string,
  payloadHash: string,
  signatureHex: string,
): boolean {
  const provider = createEd25519SignatureProvider();
  const verified = provider.verifyRaw(publicKeyHex, Buffer.from(payloadHash, 'hex'), signatureHex);
  return verified.ok;
}

export function createFixtureApprovalSignature(input: {
  readonly participant: LaunchCeremonyParticipant;
  readonly pkg: LaunchOfflineSigningPackage;
  readonly identity: LaunchCeremonySessionIdentity;
  readonly signedAtUtc: string;
  readonly signatureClass?: LaunchSignatureClass;
}): LaunchApprovalSignature {
  if (input.participant.participantId !== input.pkg.participantId) {
    throw new TypeError('SIGNATURE_ROLE_MISMATCH: participant does not own the offline package');
  }
  if (input.identity.sessionId !== input.pkg.sessionId) {
    throw new TypeError('SESSION_MISMATCH: signature session does not match offline package');
  }
  const publicKeyHex = deriveFixturePublicKey(input.participant.participantId);
  const signatureHex = signFixturePayload(input.participant.participantId, input.pkg.payload.payloadHash);
  const record: LaunchApprovalSignature = Object.freeze({
    participantId: input.participant.participantId,
    role: input.participant.role,
    actorKind: input.participant.actorKind,
    sessionId: input.identity.sessionId,
    payloadHash: input.pkg.payload.payloadHash,
    approvalStatement: input.pkg.payload.approvalStatement,
    publicKeyHex,
    publicKeyFingerprint: fingerprintOf(publicKeyHex),
    signatureHex,
    cryptoSuiteId: String(SUITE_SUNREY_ED25519_V1),
    signedAtUtc: input.signedAtUtc,
    signatureClass: input.signatureClass ?? 'FIXTURE_REHEARSAL',
    accepted: false,
    rejectionReason: null,
  });
  assertNoSecretMaterial(record, 'approval signature');
  return record;
}

export function economicSignatureCountsAsGenesis(signature: LaunchApprovalSignature): boolean {
  if (signature.approvalStatement === 'APPROVE_ECONOMIC_PARAMETER_PACKAGE') {
    return false;
  }
  return payloadBindsGenesis({
    domain: 'SUNREY_LAUNCH_AUTHORIZATION_OFFLINE_PAYLOAD_V1',
    sessionId: signature.sessionId,
    launchFreezeHash: '',
    genesisCandidateHash: '',
    validatorSetHash: '',
    economicAuthorizationHash: '',
    approvalRole: signature.role,
    approvalStatement: signature.approvalStatement,
    validFromUtc: '',
    expiresAtUtc: '',
    cryptoSuiteId: signature.cryptoSuiteId,
    payloadHash: signature.payloadHash,
  });
}

export function fixtureSignatureIsRealHumanAuthorization(signature: LaunchApprovalSignature): false {
  void signature;
  return false;
}
