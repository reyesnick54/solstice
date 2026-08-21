/**
 * Deterministic offline signing packages.
 *
 * Signed meaning is the structured payload hash. Mutable human-readable
 * text is never the only signed meaning. Private keys and secrets never
 * enter the package.
 */

import { SUITE_SUNREY_ED25519_V1 } from '../../../../security/src/index.ts';
import { encodeString, sha256Hex } from '../../validators/canonical.ts';
import { fingerprintOf } from '../keys.ts';
import { assertNoSecretMaterial } from './transcript.ts';
import {
  LAUNCH_OFFLINE_PAYLOAD_DOMAIN,
  type LaunchApprovalStatement,
  type LaunchCeremonyParticipant,
  type LaunchCeremonySessionIdentity,
  type LaunchOfflineSigningPackage,
  type LaunchOfflineSigningPayload,
  type ProductionLaunchCeremonyBinding,
} from './types.ts';

export function launchOfflinePayloadHash(
  payload: Omit<LaunchOfflineSigningPayload, 'payloadHash'>,
): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(payload.domain),
      encodeString(payload.sessionId),
      encodeString(payload.launchFreezeHash),
      encodeString(payload.genesisCandidateHash),
      encodeString(payload.validatorSetHash),
      encodeString(payload.economicAuthorizationHash),
      encodeString(payload.approvalRole),
      encodeString(payload.approvalStatement),
      encodeString(payload.validFromUtc),
      encodeString(payload.expiresAtUtc),
      encodeString(payload.cryptoSuiteId),
    ]),
  );
}

export function createOfflineSigningPayload(input: {
  readonly identity: LaunchCeremonySessionIdentity;
  readonly binding: ProductionLaunchCeremonyBinding;
  readonly approvalRole: LaunchOfflineSigningPayload['approvalRole'];
  readonly approvalStatement: LaunchApprovalStatement;
  readonly validFromUtc: string;
  readonly expiresAtUtc: string;
}): LaunchOfflineSigningPayload {
  const draft: Omit<LaunchOfflineSigningPayload, 'payloadHash'> = {
    domain: LAUNCH_OFFLINE_PAYLOAD_DOMAIN,
    sessionId: input.identity.sessionId,
    launchFreezeHash: input.binding.launchFreezeHash,
    genesisCandidateHash: input.binding.genesisHash,
    validatorSetHash: input.binding.validatorSetHash,
    economicAuthorizationHash: input.binding.economicAuthorizationHash,
    approvalRole: input.approvalRole,
    approvalStatement: input.approvalStatement,
    validFromUtc: input.validFromUtc,
    expiresAtUtc: input.expiresAtUtc,
    cryptoSuiteId: String(SUITE_SUNREY_ED25519_V1),
  };
  return Object.freeze({
    ...draft,
    payloadHash: launchOfflinePayloadHash(draft),
  });
}

export function exportOfflineSigningPackage(input: {
  readonly identity: LaunchCeremonySessionIdentity;
  readonly binding: ProductionLaunchCeremonyBinding;
  readonly participant: LaunchCeremonyParticipant;
  readonly approvalStatement: LaunchApprovalStatement;
  readonly validFromUtc: string;
  readonly expiresAtUtc: string;
}): LaunchOfflineSigningPackage {
  const payload = createOfflineSigningPayload({
    identity: input.identity,
    binding: input.binding,
    approvalRole: input.participant.role,
    approvalStatement: input.approvalStatement,
    validFromUtc: input.validFromUtc,
    expiresAtUtc: input.expiresAtUtc,
  });
  const pkg: LaunchOfflineSigningPackage = Object.freeze({
    packageId: `offline:${input.identity.sessionId}:${input.participant.participantId}`,
    sessionId: input.identity.sessionId,
    participantId: input.participant.participantId,
    payload,
    publicSigningDescriptor: input.participant.publicSigningDescriptor,
    publicKeyFingerprint: fingerprintOf(input.participant.publicSigningDescriptor),
    containsSecretKeyMaterial: false,
    containsPrivateKey: false,
    humanReadableNote:
      'Human-readable note is not the signed meaning. Verify payloadHash and structured fields.',
  });
  assertNoSecretMaterial(pkg, 'offline package');
  return pkg;
}

export function statementForScope(
  scope: LaunchCeremonyParticipant['approvalScope'],
): LaunchApprovalStatement {
  if (scope === 'ECONOMIC_PARAMETER_PACKAGE') {
    return 'APPROVE_ECONOMIC_PARAMETER_PACKAGE';
  }
  if (scope === 'GENESIS_CANDIDATE') {
    return 'APPROVE_GENESIS_CANDIDATE';
  }
  return 'APPROVE_LAUNCH_AUTHORIZATION';
}

export function payloadBindsGenesis(payload: LaunchOfflineSigningPayload): boolean {
  return (
    payload.approvalStatement === 'APPROVE_GENESIS_CANDIDATE' ||
    payload.approvalStatement === 'APPROVE_LAUNCH_AUTHORIZATION'
  );
}

export function payloadBindsEconomic(payload: LaunchOfflineSigningPayload): boolean {
  return (
    payload.approvalStatement === 'APPROVE_ECONOMIC_PARAMETER_PACKAGE' ||
    payload.approvalStatement === 'APPROVE_LAUNCH_AUTHORIZATION'
  );
}
