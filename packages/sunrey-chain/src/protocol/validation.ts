import { err, ok, type Result } from '../../../domain/src/result.ts';
import { actorIsUnrestrictedWallet, actorRequiresCapability } from './actor.ts';
import { moonreyIssuanceActivated } from './assets.ts';
import { CodecError, decodeEnvelope, encodeUnsignedEnvelope } from './codec.ts';
import { SENSITIVE_FIELD_MARKERS } from './constants.ts';
import { objectRequiresCommitment } from './economic-object.ts';
import type { EnvelopeV1, NativeAssetBody, TransactionBodyV1 } from './envelope.ts';
import { bodyHeaderOf } from './envelope.ts';
import { transactionIdFromCanonicalBytes, transactionIdOf } from './hash.ts';
import { verifyEnvelopeSignature } from './authentication.ts';
import {
  protocolRejection,
  type ProtocolRejection,
  type ProtocolValidationStage,
} from './rejection.ts';
import type { RightObject } from './rights.ts';
import { familyIsActivated } from './transaction-family.ts';
import {
  ProtocolState,
  type ProtocolEvent,
  type ProtocolExecutionContext,
  type StateTransitionResult,
} from './state.ts';

const AUTHORIZED_PURPOSES = new Set([
  'sunrey.native-asset.transfer',
  'sunrey.identity.reference',
  'sunrey.attestation.anchor',
  'sunrey.rights.grant',
  'sunrey.consent.reference',
  'sunrey.productive-capacity.record',
  'sunrey.delivery.claim',
  'sunrey.evidence.anchor',
]);

function reject(code: ProtocolRejection['code'], stage: ProtocolValidationStage): Result<never, ProtocolRejection> {
  return err(protocolRejection(code, stage));
}

function walkStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkStrings(item, out);
    }
    return;
  }
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out.push(key);
    walkStrings((value as Record<string, unknown>)[key], out);
  }
}

function containsSensitivePayload(body: TransactionBodyV1): boolean {
  const strings: string[] = [];
  walkStrings(body, strings);
  return strings.some((item) => {
    const lower = item.toLowerCase();
    return SENSITIVE_FIELD_MARKERS.some((marker) => {
      const needle = marker.toLowerCase();
      if (needle.length <= 3) {
        return lower === needle || lower.startsWith(`${needle}=`) || lower.startsWith(`${needle}:`);
      }
      return lower.includes(needle);
    });
  });
}

export function decode(bytes: Uint8Array): Result<EnvelopeV1, ProtocolRejection> {
  try {
    return ok(decodeEnvelope(bytes));
  } catch (error) {
    if (error instanceof CodecError) {
      return reject(error.code, 'decode');
    }
    return reject('MALFORMED', 'decode');
  }
}

export function validateEnvelope(
  envelope: EnvelopeV1,
  context: ProtocolExecutionContext,
): Result<EnvelopeV1, ProtocolRejection> {
  if (envelope.schemaVersion !== 1) {
    return reject('INVALID_VERSION', 'validateEnvelope');
  }
  if (envelope.networkId !== context.networkId) {
    return reject('WRONG_NETWORK', 'validateEnvelope');
  }
  if (envelope.chainId !== context.chainId) {
    return reject('WRONG_CHAIN', 'validateEnvelope');
  }
  if (envelope.body.family !== envelope.transactionType) {
    return reject('MALFORMED', 'validateEnvelope');
  }
  return ok(envelope);
}

export function validateStateless(envelope: EnvelopeV1): Result<EnvelopeV1, ProtocolRejection> {
  if (!familyIsActivated(envelope.transactionType)) {
    return reject('TRANSACTION_NOT_ACTIVATED', 'validateStateless');
  }
  const header = bodyHeaderOf(envelope.body);
  if (header.schemaVersion !== 1 || header.actor.schemaVersion !== 1) {
    return reject('INVALID_VERSION', 'validateStateless');
  }
  if (header.sequence === 0n) {
    return reject('INVALID_SEQUENCE', 'validateStateless');
  }
  if (header.actor.actorId.length === 0) {
    return reject('UNKNOWN_ACTOR', 'validateStateless');
  }
  if (header.actor.revocationState === 'REVOKED') {
    return reject('UNKNOWN_ACTOR', 'validateStateless');
  }
  if (actorIsUnrestrictedWallet(header.actor)) {
    return reject('CAPABILITY_INVALID', 'validateStateless');
  }
  if (actorRequiresCapability(header.actor.actorType)) {
    if (header.capabilityRef.length === 0 || !header.actor.capabilityRefs.includes(header.capabilityRef)) {
      return reject('CAPABILITY_INVALID', 'validateStateless');
    }
  }
  if (!AUTHORIZED_PURPOSES.has(header.purpose)) {
    return reject('PURPOSE_NOT_AUTHORIZED', 'validateStateless');
  }
  if (containsSensitivePayload(envelope.body)) {
    return reject('INVALID_OBJECT_TYPE', 'validateStateless');
  }
  if (envelope.body.family === 'NATIVE_ASSET') {
    const native = envelope.body;
    if (native.operation === 'ISSUE' && native.amount?.assetId === 'MOONREY_COIN') {
      if (!moonreyIssuanceActivated()) {
        return reject('TRANSACTION_NOT_ACTIVATED', 'validateStateless');
      }
    }
    if (native.operation === 'ISSUE' || native.operation === 'BURN') {
      return reject('TRANSACTION_NOT_ACTIVATED', 'validateStateless');
    }
    if (native.amount && native.amount.scaledUnits <= 0n) {
      return reject('INVALID_QUANTITY', 'validateStateless');
    }
    if (native.fee && (native.fee.scaledUnits < 0n || native.fee.assetId === 'MOONREY_COIN')) {
      return reject('INVALID_FEE', 'validateStateless');
    }
    if (native.economicObject && native.economicObject.schemaVersion !== 1) {
      return reject('INVALID_VERSION', 'validateStateless');
    }
  }
  if (envelope.body.family === 'ATTESTATION' && !objectRequiresCommitment(envelope.body.attestation.objectType)) {
    return reject('INVALID_OBJECT_TYPE', 'validateStateless');
  }
  if (envelope.body.family === 'ATTESTATION' && envelope.body.attestation.commitmentHex.length === 0) {
    return reject('INVALID_OBJECT_TYPE', 'validateStateless');
  }
  if (envelope.body.family === 'ORACLE' && envelope.body.header.purpose.length > 0) {
    return reject('ORACLE_REFERENCE_INVALID', 'validateStateless');
  }
  return ok(envelope);
}

export function validateAuthentication(envelope: EnvelopeV1): Result<EnvelopeV1, ProtocolRejection> {
  if (!verifyEnvelopeSignature(envelope)) {
    return reject('INVALID_SIGNATURE', 'validateAuthentication');
  }
  return ok(envelope);
}

export function validateReplay(
  envelope: EnvelopeV1,
  state: ProtocolState,
  context: ProtocolExecutionContext,
): Result<EnvelopeV1, ProtocolRejection> {
  const header = bodyHeaderOf(envelope.body);
  if (header.expirationUnixSeconds !== 0n && header.expirationUnixSeconds < context.blockTimeUnixSeconds) {
    return reject('EXPIRED', 'validateReplay');
  }
  const transactionId = transactionIdOf(envelope);
  if (state.hasTransactionId(transactionId)) {
    return reject('REPLAY', 'validateReplay');
  }
  if (header.idempotencyKey.length > 0 && state.hasIdempotencyKey(header.idempotencyKey)) {
    return reject('REPLAY', 'validateReplay');
  }
  const expected = state.lastSequence(header.actor.actorId) + 1n;
  if (header.sequence !== expected) {
    return reject('INVALID_SEQUENCE', 'validateReplay');
  }
  return ok(envelope);
}

function rightHeld(state: ProtocolState, holderId: string, exercised: readonly RightObject[]): boolean {
  if (exercised.length === 0) {
    return true;
  }
  const held = state.heldRights(holderId);
  return exercised.every((needed) =>
    held.some(
      (right) =>
        right.rightId === needed.rightId &&
        right.rightType === needed.rightType &&
        right.holderId === holderId &&
        right.revocationState === 'ACTIVE' &&
        (right.purpose.length === 0 || right.purpose === needed.purpose),
    ),
  );
}

export function validateStateful(
  envelope: EnvelopeV1,
  state: ProtocolState,
): Result<EnvelopeV1, ProtocolRejection> {
  const header = bodyHeaderOf(envelope.body);
  const known = state.actorOf(header.actor.actorId);
  if (!known) {
    return reject('UNKNOWN_ACTOR', 'validateStateful');
  }
  if (known.actorType !== header.actor.actorType) {
    return reject('UNKNOWN_ACTOR', 'validateStateful');
  }
  if (header.policyRef.length > 0 && !state.hasPolicy(header.policyRef)) {
    return reject('POLICY_REFERENCE_INVALID', 'validateStateful');
  }
  if (header.consentRef.length > 0 && !state.hasConsent(header.consentRef)) {
    return reject('CONSENT_REFERENCE_INVALID', 'validateStateful');
  }
  if (envelope.body.family === 'NATIVE_ASSET') {
    const native: NativeAssetBody = envelope.body;
    if (!rightHeld(state, header.actor.actorId, native.rightsExercised)) {
      return reject('RIGHT_NOT_HELD', 'validateStateful');
    }
  }
  if (envelope.body.family === 'PRODUCTIVE_CAPACITY') {
    const capacity = envelope.body;
    if (!rightHeld(state, header.actor.actorId, capacity.rightsExercised)) {
      return reject('RIGHT_NOT_HELD', 'validateStateful');
    }
    if (capacity.quantity && capacity.quantity.scaledUnits > state.capacityOf(capacity.capacity.objectId)) {
      return reject('INSUFFICIENT_ASSET', 'validateStateful');
    }
  }
  if (envelope.body.family === 'DELIVERY' && !rightHeld(state, header.actor.actorId, envelope.body.rightsExercised)) {
    return reject('RIGHT_NOT_HELD', 'validateStateful');
  }
  if (envelope.body.family === 'RIGHTS' && envelope.body.grantOrRevoke === 'REVOKE') {
    const existing = state.rightOf(envelope.body.right.rightId);
    if (!existing || existing.holderId !== header.actor.actorId) {
      return reject('RIGHT_NOT_HELD', 'validateStateful');
    }
  }
  return ok(envelope);
}

export function applyStateTransition(
  envelope: EnvelopeV1,
  state: ProtocolState,
): Result<StateTransitionResult, ProtocolRejection> {
  const header = bodyHeaderOf(envelope.body);
  const transactionId = transactionIdOf(envelope);
  const events: ProtocolEvent[] = [
    Object.freeze({
      kind: `${envelope.transactionType}_APPLIED`,
      transactionId,
      family: envelope.transactionType,
      objectId:
        envelope.body.family === 'NATIVE_ASSET'
          ? envelope.body.economicObject?.objectId ?? null
          : envelope.body.family === 'PRODUCTIVE_CAPACITY'
            ? envelope.body.capacity.objectId
            : envelope.body.family === 'ATTESTATION'
              ? envelope.body.attestation.objectId
              : envelope.body.family === 'EVIDENCE_ANCHOR'
                ? envelope.body.anchor.objectId
                : envelope.body.family === 'DELIVERY'
                  ? envelope.body.deliveryClaim.objectId
                  : null,
      chainBalanceAuthoritative: false,
      ledgerSupplyChanged: false,
    }),
  ];
  if (envelope.body.family === 'IDENTITY') {
    state.registerActor(envelope.body.subject);
  }
  if (envelope.body.family === 'RIGHTS' && envelope.body.grantOrRevoke === 'GRANT') {
    state.grantRight(envelope.body.right);
  }
  if (envelope.body.family === 'ATTESTATION') {
    state.putObject(envelope.body.attestation);
  }
  if (envelope.body.family === 'PRODUCTIVE_CAPACITY') {
    state.putObject(envelope.body.capacity);
  }
  if (envelope.body.family === 'EVIDENCE_ANCHOR') {
    state.putObject(envelope.body.anchor);
  }
  state.recordAccepted({
    actorId: header.actor.actorId,
    sequence: header.sequence,
    transactionId,
    idempotencyKey: header.idempotencyKey,
  });
  return ok(
    Object.freeze({
      accepted: true as const,
      transactionId,
      events: Object.freeze(events),
    }),
  );
}

export function processTransaction(
  bytes: Uint8Array,
  state: ProtocolState,
  context: ProtocolExecutionContext,
): Result<StateTransitionResult, ProtocolRejection> {
  const decoded = decode(bytes);
  if (!decoded.ok) {
    return decoded;
  }
  const enveloped = validateEnvelope(decoded.value, context);
  if (!enveloped.ok) {
    return enveloped;
  }
  const stateless = validateStateless(enveloped.value);
  if (!stateless.ok) {
    return stateless;
  }
  const authenticated = validateAuthentication(stateless.value);
  if (!authenticated.ok) {
    return authenticated;
  }
  const replay = validateReplay(authenticated.value, state, context);
  if (!replay.ok) {
    return replay;
  }
  const stateful = validateStateful(replay.value, state);
  if (!stateful.ok) {
    return stateful;
  }
  return applyStateTransition(stateful.value, state);
}

export function canonicalTransactionId(bytes: Uint8Array, networkId: string, chainId: string): string {
  return transactionIdFromCanonicalBytes(networkId, chainId, bytes);
}

export function unsignedCanonicalBytes(envelope: EnvelopeV1): Uint8Array {
  return encodeUnsignedEnvelope(envelope);
}
