import {
  actorTypeFromId,
  ACTOR_TYPE_IDS,
  revocationStateFromId,
  REVOCATION_STATE_IDS,
  type ActorDescriptor,
} from './actor.ts';
import {
  nativeAssetIdFromProto,
  nativeAssetOperationFromId,
  NATIVE_ASSET_OPERATION_IDS,
  NATIVE_ASSET_PROTO_IDS,
  type NativeAssetOperation,
} from './assets.ts';
import {
  MAX_BODY_BYTES,
  MAX_BYTES_FIELD,
  MAX_ENVELOPE_BYTES,
  MAX_REPEATED,
  MAX_STRING_BYTES,
  PROTOCOL_CODEC_ID,
  PROTOCOL_SCHEMA_VERSION,
} from './constants.ts';
import {
  ECONOMIC_OBJECT_TYPE_IDS,
  economicObjectTypeFromId,
  type EconomicObject,
} from './economic-object.ts';
import type {
  AttestationBody,
  Authentication,
  BlockHeaderV1,
  BodyHeader,
  ConsentReferenceBody,
  DeliveryBody,
  EnvelopeV1,
  EvidenceAnchorBody,
  IdentityBody,
  NativeAssetBody,
  ProductiveCapacityBody,
  ReservedBody,
  RightsBody,
  TransactionBodyV1,
} from './envelope.ts';
import { formatScaledUnits, parseScaledUnits, type ProtocolQuantity } from './quantity.ts';
import type { ProtocolRejectionCode } from './rejection.ts';
import { RIGHT_TYPE_IDS, rightTypeFromId, type RightObject } from './rights.ts';
import { TRANSACTION_FAMILY_IDS, transactionFamilyFromId, type TransactionFamily } from './transaction-family.ts';

export class CodecError extends Error {
  readonly code: ProtocolRejectionCode;

  constructor(code: ProtocolRejectionCode) {
    super(code);
    this.name = 'CodecError';
    this.code = code;
  }
}

function fail(code: ProtocolRejectionCode): never {
  throw new CodecError(code);
}

function encodeVarint(value: bigint): Buffer {
  if (value < 0n) {
    fail('MALFORMED');
  }
  const bytes: number[] = [];
  let current = value;
  while (current >= 0x80n) {
    bytes.push(Number(current & 0x7fn) | 0x80);
    current >>= 7n;
  }
  bytes.push(Number(current));
  return Buffer.from(bytes);
}

function decodeVarint(buf: Buffer, start: number): { value: bigint; offset: number } {
  let result = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < buf.length) {
    const byte = buf[offset];
    if (byte === undefined) {
      fail('MALFORMED');
    }
    offset += 1;
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: result, offset };
    }
    shift += 7n;
    if (shift > 63n) {
      fail('OVERSIZED');
    }
  }
  fail('MALFORMED');
}

type WireField =
  | { readonly tag: number; readonly kind: 'varint'; readonly value: bigint }
  | { readonly tag: number; readonly kind: 'bytes'; readonly value: Buffer };

function writeFields(fields: readonly WireField[]): Buffer {
  const ordered = [...fields].sort((left, right) => left.tag - right.tag);
  const parts: Buffer[] = [];
  for (const field of ordered) {
    if (field.kind === 'varint') {
      parts.push(encodeVarint(BigInt((field.tag << 3) | 0)));
      parts.push(encodeVarint(field.value));
    } else {
      if (field.value.length > MAX_ENVELOPE_BYTES) {
        fail('OVERSIZED');
      }
      parts.push(encodeVarint(BigInt((field.tag << 3) | 2)));
      parts.push(encodeVarint(BigInt(field.value.length)));
      parts.push(field.value);
    }
  }
  return Buffer.concat(parts);
}

function readFields(buf: Buffer, known: ReadonlySet<number>): Map<number, WireField[]> {
  const out = new Map<number, WireField[]>();
  let offset = 0;
  while (offset < buf.length) {
    const key = decodeVarint(buf, offset);
    offset = key.offset;
    const tag = Number(key.value >> 3n);
    const wire = Number(key.value & 7n);
    if (!known.has(tag)) {
      fail('MALFORMED');
    }
    if (wire === 0) {
      const decoded = decodeVarint(buf, offset);
      offset = decoded.offset;
      const list = out.get(tag) ?? [];
      list.push({ tag, kind: 'varint', value: decoded.value });
      out.set(tag, list);
    } else if (wire === 2) {
      const length = decodeVarint(buf, offset);
      offset = length.offset;
      if (length.value > BigInt(MAX_BODY_BYTES)) {
        fail('OVERSIZED');
      }
      const end = offset + Number(length.value);
      if (end > buf.length) {
        fail('MALFORMED');
      }
      const list = out.get(tag) ?? [];
      list.push({ tag, kind: 'bytes', value: buf.subarray(offset, end) });
      out.set(tag, list);
      offset = end;
    } else {
      fail('MALFORMED');
    }
  }
  return out;
}

function utf8(value: string): Buffer {
  if (value.normalize('NFC') !== value) {
    fail('MALFORMED');
  }
  const encoded = Buffer.from(value, 'utf8');
  if (encoded.length > MAX_STRING_BYTES) {
    fail('OVERSIZED');
  }
  if (encoded.toString('utf8') !== value) {
    fail('MALFORMED');
  }
  return encoded;
}

function readString(field: WireField | undefined): string {
  if (!field) {
    return '';
  }
  if (field.kind !== 'bytes') {
    fail('MALFORMED');
  }
  const text = field.value.toString('utf8');
  if (text.normalize('NFC') !== text) {
    fail('MALFORMED');
  }
  if (field.value.length > MAX_STRING_BYTES) {
    fail('OVERSIZED');
  }
  return text;
}

function readBytes(field: WireField | undefined): Buffer {
  if (!field) {
    return Buffer.alloc(0);
  }
  if (field.kind !== 'bytes') {
    fail('MALFORMED');
  }
  if (field.value.length > MAX_BYTES_FIELD) {
    fail('OVERSIZED');
  }
  return field.value;
}

function readUint(field: WireField | undefined): bigint {
  if (!field) {
    return 0n;
  }
  if (field.kind !== 'varint') {
    fail('MALFORMED');
  }
  return field.value;
}

function first(fields: Map<number, WireField[]>, tag: number): WireField | undefined {
  return fields.get(tag)?.[0];
}

function all(fields: Map<number, WireField[]>, tag: number): WireField[] {
  const list = fields.get(tag) ?? [];
  if (list.length > MAX_REPEATED) {
    fail('OVERSIZED');
  }
  return list;
}

function requireVersion(value: bigint): 1 {
  if (value === 0n) {
    fail('INVALID_VERSION');
  }
  if (value !== BigInt(PROTOCOL_SCHEMA_VERSION)) {
    fail('INVALID_VERSION');
  }
  return PROTOCOL_SCHEMA_VERSION;
}

function encodeActor(actor: ActorDescriptor): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'varint', value: BigInt(actor.schemaVersion) },
    { tag: 2, kind: 'bytes', value: utf8(actor.actorId) },
    { tag: 3, kind: 'varint', value: BigInt(ACTOR_TYPE_IDS[actor.actorType]) },
    { tag: 9, kind: 'varint', value: BigInt(REVOCATION_STATE_IDS[actor.revocationState]) },
  ];
  if (actor.ownerControllerId) {
    fields.push({ tag: 4, kind: 'bytes', value: utf8(actor.ownerControllerId) });
  }
  for (const ref of actor.credentialRefs) {
    fields.push({ tag: 5, kind: 'bytes', value: utf8(ref) });
  }
  for (const ref of actor.capabilityRefs) {
    fields.push({ tag: 6, kind: 'bytes', value: utf8(ref) });
  }
  if (actor.modelFirmwareRef) {
    fields.push({ tag: 7, kind: 'bytes', value: utf8(actor.modelFirmwareRef) });
  }
  if (actor.jurisdiction) {
    fields.push({ tag: 8, kind: 'bytes', value: utf8(actor.jurisdiction) });
  }
  if (actor.identitySystemRef) {
    fields.push({ tag: 10, kind: 'bytes', value: utf8(actor.identitySystemRef) });
  }
  return writeFields(fields);
}

function decodeActor(buf: Buffer): ActorDescriptor {
  const fields = readFields(buf, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  const actorType = actorTypeFromId(Number(readUint(first(fields, 3))));
  const revocation = revocationStateFromId(Number(readUint(first(fields, 9))));
  const actorId = readString(first(fields, 2));
  if (!actorType || !revocation || actorId.length === 0) {
    fail('MALFORMED');
  }
  return Object.freeze({
    schemaVersion: requireVersion(readUint(first(fields, 1))),
    actorId,
    actorType,
    ownerControllerId: readString(first(fields, 4)),
    credentialRefs: Object.freeze(all(fields, 5).map(readString)),
    capabilityRefs: Object.freeze(all(fields, 6).map(readString)),
    modelFirmwareRef: readString(first(fields, 7)),
    jurisdiction: readString(first(fields, 8)),
    revocationState: revocation,
    identitySystemRef: readString(first(fields, 10)),
  });
}

function encodeQuantity(quantity: ProtocolQuantity): Buffer {
  return writeFields([
    { tag: 1, kind: 'varint', value: BigInt(quantity.schemaVersion) },
    { tag: 2, kind: 'varint', value: BigInt(NATIVE_ASSET_PROTO_IDS[quantity.assetId]) },
    { tag: 3, kind: 'bytes', value: utf8(formatScaledUnits(quantity.scaledUnits)) },
  ]);
}

function decodeQuantity(buf: Buffer): ProtocolQuantity {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const assetId = nativeAssetIdFromProto(Number(readUint(first(fields, 2))));
  const scaled = parseScaledUnits(readString(first(fields, 3)));
  if (!assetId || scaled === null) {
    fail('INVALID_QUANTITY');
  }
  return Object.freeze({
    schemaVersion: requireVersion(readUint(first(fields, 1))),
    assetId,
    scaledUnits: scaled,
  });
}

function encodeRight(right: RightObject): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'varint', value: BigInt(right.schemaVersion) },
    { tag: 2, kind: 'bytes', value: utf8(right.rightId) },
    { tag: 3, kind: 'varint', value: BigInt(RIGHT_TYPE_IDS[right.rightType]) },
    { tag: 14, kind: 'varint', value: BigInt(REVOCATION_STATE_IDS[right.revocationState]) },
  ];
  if (right.subjectId) {
    fields.push({ tag: 4, kind: 'bytes', value: utf8(right.subjectId) });
  }
  if (right.objectId) {
    fields.push({ tag: 5, kind: 'bytes', value: utf8(right.objectId) });
  }
  if (right.holderId) {
    fields.push({ tag: 6, kind: 'bytes', value: utf8(right.holderId) });
  }
  if (right.issuerId) {
    fields.push({ tag: 7, kind: 'bytes', value: utf8(right.issuerId) });
  }
  if (right.scope) {
    fields.push({ tag: 8, kind: 'bytes', value: utf8(right.scope) });
  }
  if (right.purpose) {
    fields.push({ tag: 9, kind: 'bytes', value: utf8(right.purpose) });
  }
  for (const operation of right.permittedOperations) {
    fields.push({ tag: 10, kind: 'bytes', value: utf8(operation) });
  }
  if (right.jurisdiction) {
    fields.push({ tag: 11, kind: 'bytes', value: utf8(right.jurisdiction) });
  }
  if (right.startUnixSeconds !== 0n) {
    fields.push({ tag: 12, kind: 'varint', value: right.startUnixSeconds });
  }
  if (right.expirationUnixSeconds !== 0n) {
    fields.push({ tag: 13, kind: 'varint', value: right.expirationUnixSeconds });
  }
  if (right.transferable) {
    fields.push({ tag: 15, kind: 'varint', value: 1n });
  }
  if (right.compensationRef) {
    fields.push({ tag: 16, kind: 'bytes', value: utf8(right.compensationRef) });
  }
  if (right.provenanceRef) {
    fields.push({ tag: 17, kind: 'bytes', value: utf8(right.provenanceRef) });
  }
  return writeFields(fields);
}

function decodeRight(buf: Buffer): RightObject {
  const fields = readFields(buf, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]));
  const rightType = rightTypeFromId(Number(readUint(first(fields, 3))));
  const revocation = revocationStateFromId(Number(readUint(first(fields, 14))));
  const rightId = readString(first(fields, 2));
  if (!rightType || !revocation || rightId.length === 0) {
    fail('MALFORMED');
  }
  return Object.freeze({
    schemaVersion: requireVersion(readUint(first(fields, 1))),
    rightId,
    rightType,
    subjectId: readString(first(fields, 4)),
    objectId: readString(first(fields, 5)),
    holderId: readString(first(fields, 6)),
    issuerId: readString(first(fields, 7)),
    scope: readString(first(fields, 8)),
    purpose: readString(first(fields, 9)),
    permittedOperations: Object.freeze(all(fields, 10).map(readString)),
    jurisdiction: readString(first(fields, 11)),
    startUnixSeconds: readUint(first(fields, 12)),
    expirationUnixSeconds: readUint(first(fields, 13)),
    revocationState: revocation,
    transferable: readUint(first(fields, 15)) === 1n,
    compensationRef: readString(first(fields, 16)),
    provenanceRef: readString(first(fields, 17)),
  });
}

function encodeObject(object: EconomicObject): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'varint', value: BigInt(object.schemaVersion) },
    { tag: 2, kind: 'bytes', value: utf8(object.objectId) },
    { tag: 3, kind: 'varint', value: BigInt(ECONOMIC_OBJECT_TYPE_IDS[object.objectType]) },
    { tag: 8, kind: 'varint', value: BigInt(REVOCATION_STATE_IDS[object.revocationState]) },
  ];
  if (object.commitmentHex) {
    fields.push({ tag: 4, kind: 'bytes', value: utf8(object.commitmentHex) });
  }
  if (object.schemaRef) {
    fields.push({ tag: 5, kind: 'bytes', value: utf8(object.schemaRef) });
  }
  if (object.issuerRef) {
    fields.push({ tag: 6, kind: 'bytes', value: utf8(object.issuerRef) });
  }
  if (object.subjectRef) {
    fields.push({ tag: 7, kind: 'bytes', value: utf8(object.subjectRef) });
  }
  if (object.jurisdiction) {
    fields.push({ tag: 9, kind: 'bytes', value: utf8(object.jurisdiction) });
  }
  if (object.quantity) {
    fields.push({ tag: 10, kind: 'bytes', value: encodeQuantity(object.quantity) });
  }
  if (object.attestationRef) {
    fields.push({ tag: 11, kind: 'bytes', value: utf8(object.attestationRef) });
  }
  if (object.evidenceRef) {
    fields.push({ tag: 12, kind: 'bytes', value: utf8(object.evidenceRef) });
  }
  return writeFields(fields);
}

function decodeObject(buf: Buffer): EconomicObject {
  const fields = readFields(buf, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  const objectType = economicObjectTypeFromId(Number(readUint(first(fields, 3))));
  const revocation = revocationStateFromId(Number(readUint(first(fields, 8))));
  const objectId = readString(first(fields, 2));
  if (!objectType || !revocation || objectId.length === 0) {
    fail('INVALID_OBJECT_TYPE');
  }
  const quantityField = first(fields, 10);
  return Object.freeze({
    schemaVersion: requireVersion(readUint(first(fields, 1))),
    objectId,
    objectType,
    commitmentHex: readString(first(fields, 4)),
    schemaRef: readString(first(fields, 5)),
    issuerRef: readString(first(fields, 6)),
    subjectRef: readString(first(fields, 7)),
    revocationState: revocation,
    jurisdiction: readString(first(fields, 9)),
    quantity: quantityField && quantityField.kind === 'bytes' ? decodeQuantity(quantityField.value) : null,
    attestationRef: readString(first(fields, 11)),
    evidenceRef: readString(first(fields, 12)),
  });
}

function encodeAuth(auth: Authentication, includeSignature: boolean): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'varint', value: BigInt(auth.schemaVersion) },
    { tag: 2, kind: 'varint', value: BigInt(auth.algorithmId) },
    { tag: 3, kind: 'bytes', value: Buffer.from(auth.publicKey) },
  ];
  if (includeSignature && auth.signature.length > 0) {
    fields.push({ tag: 4, kind: 'bytes', value: Buffer.from(auth.signature) });
  }
  if (auth.keyVersion !== 0) {
    fields.push({ tag: 5, kind: 'varint', value: BigInt(auth.keyVersion) });
  }
  return writeFields(fields);
}

function decodeAuth(buf: Buffer): Authentication {
  const fields = readFields(buf, new Set([1, 2, 3, 4, 5]));
  const algorithm = Number(readUint(first(fields, 2)));
  if (algorithm !== 1) {
    fail('INVALID_SIGNATURE');
  }
  return Object.freeze({
    schemaVersion: requireVersion(readUint(first(fields, 1))),
    algorithmId: 1 as const,
    publicKey: new Uint8Array(readBytes(first(fields, 3))),
    signature: new Uint8Array(readBytes(first(fields, 4))),
    keyVersion: Number(readUint(first(fields, 5))),
  });
}

function encodeHeader(header: BodyHeader): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'varint', value: BigInt(header.schemaVersion) },
    { tag: 3, kind: 'bytes', value: encodeActor(header.actor) },
    { tag: 4, kind: 'varint', value: header.sequence },
  ];
  if (header.clientTxId) {
    fields.push({ tag: 2, kind: 'bytes', value: utf8(header.clientTxId) });
  }
  if (header.idempotencyKey) {
    fields.push({ tag: 5, kind: 'bytes', value: utf8(header.idempotencyKey) });
  }
  if (header.purpose) {
    fields.push({ tag: 6, kind: 'bytes', value: utf8(header.purpose) });
  }
  if (header.jurisdiction) {
    fields.push({ tag: 7, kind: 'bytes', value: utf8(header.jurisdiction) });
  }
  if (header.expirationUnixSeconds !== 0n) {
    fields.push({ tag: 8, kind: 'varint', value: header.expirationUnixSeconds });
  }
  if (header.legalEntityRef) {
    fields.push({ tag: 9, kind: 'bytes', value: utf8(header.legalEntityRef) });
  }
  if (header.policyRef) {
    fields.push({ tag: 10, kind: 'bytes', value: utf8(header.policyRef) });
  }
  if (header.consentRef) {
    fields.push({ tag: 11, kind: 'bytes', value: utf8(header.consentRef) });
  }
  if (header.capabilityRef) {
    fields.push({ tag: 12, kind: 'bytes', value: utf8(header.capabilityRef) });
  }
  return writeFields(fields);
}

function decodeHeader(buf: Buffer): BodyHeader {
  const fields = readFields(buf, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
  const actorField = first(fields, 3);
  if (!actorField || actorField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    schemaVersion: requireVersion(readUint(first(fields, 1))),
    clientTxId: readString(first(fields, 2)),
    actor: decodeActor(actorField.value),
    sequence: readUint(first(fields, 4)),
    idempotencyKey: readString(first(fields, 5)),
    purpose: readString(first(fields, 6)),
    jurisdiction: readString(first(fields, 7)),
    expirationUnixSeconds: readUint(first(fields, 8)),
    legalEntityRef: readString(first(fields, 9)),
    policyRef: readString(first(fields, 10)),
    consentRef: readString(first(fields, 11)),
    capabilityRef: readString(first(fields, 12)),
  });
}

function encodeNativeAsset(body: NativeAssetBody): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 6, kind: 'varint', value: BigInt(NATIVE_ASSET_OPERATION_IDS[body.operation]) },
  ];
  if (body.economicObject) {
    fields.push({ tag: 2, kind: 'bytes', value: encodeObject(body.economicObject) });
  }
  for (const right of body.rightsExercised) {
    fields.push({ tag: 3, kind: 'bytes', value: encodeRight(right) });
  }
  if (body.amount) {
    fields.push({ tag: 4, kind: 'bytes', value: encodeQuantity(body.amount) });
  }
  if (body.fee) {
    fields.push({ tag: 5, kind: 'bytes', value: encodeQuantity(body.fee) });
  }
  if (body.counterpartyActorId) {
    fields.push({ tag: 7, kind: 'bytes', value: utf8(body.counterpartyActorId) });
  }
  if (body.executionConditions) {
    fields.push({ tag: 8, kind: 'bytes', value: utf8(body.executionConditions) });
  }
  for (const requirement of body.evidenceRequirements) {
    fields.push({ tag: 9, kind: 'bytes', value: utf8(requirement) });
  }
  return writeFields(fields);
}

function decodeQuantityField(field: WireField | undefined): ProtocolQuantity | null {
  if (!field) {
    return null;
  }
  if (field.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return decodeQuantity(field.value);
}

function decodeObjectField(field: WireField | undefined): EconomicObject | null {
  if (!field) {
    return null;
  }
  if (field.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return decodeObject(field.value);
}

function decodeRights(fields: Map<number, WireField[]>, tag: number): readonly RightObject[] {
  return Object.freeze(
    all(fields, tag).map((field) => {
      if (field.kind !== 'bytes') {
        fail('MALFORMED');
      }
      return decodeRight(field.value);
    }),
  );
}

function decodeNativeAsset(buf: Buffer): NativeAssetBody {
  const fields = readFields(buf, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const headerField = first(fields, 1);
  if (!headerField || headerField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  const operation = nativeAssetOperationFromId(Number(readUint(first(fields, 6))));
  if (!operation) {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'NATIVE_ASSET',
    header: decodeHeader(headerField.value),
    economicObject: decodeObjectField(first(fields, 2)),
    rightsExercised: decodeRights(fields, 3),
    amount: decodeQuantityField(first(fields, 4)),
    fee: decodeQuantityField(first(fields, 5)),
    operation,
    counterpartyActorId: readString(first(fields, 7)),
    executionConditions: readString(first(fields, 8)),
    evidenceRequirements: Object.freeze(all(fields, 9).map(readString)),
  });
}

function encodeIdentity(body: IdentityBody): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: encodeActor(body.subject) },
  ];
  if (body.credentialRef) {
    fields.push({ tag: 3, kind: 'bytes', value: utf8(body.credentialRef) });
  }
  return writeFields(fields);
}

function decodeIdentity(buf: Buffer): IdentityBody {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const headerField = first(fields, 1);
  const subjectField = first(fields, 2);
  if (!headerField || headerField.kind !== 'bytes' || !subjectField || subjectField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'IDENTITY',
    header: decodeHeader(headerField.value),
    subject: decodeActor(subjectField.value),
    credentialRef: readString(first(fields, 3)),
  });
}

function encodeAttestation(body: AttestationBody): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: encodeObject(body.attestation) },
  ];
  if (body.issuerRef) {
    fields.push({ tag: 3, kind: 'bytes', value: utf8(body.issuerRef) });
  }
  return writeFields(fields);
}

function decodeAttestation(buf: Buffer): AttestationBody {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const headerField = first(fields, 1);
  const objectField = first(fields, 2);
  if (!headerField || headerField.kind !== 'bytes' || !objectField || objectField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'ATTESTATION',
    header: decodeHeader(headerField.value),
    attestation: decodeObject(objectField.value),
    issuerRef: readString(first(fields, 3)),
  });
}

function encodeRightsBody(body: RightsBody): Buffer {
  return writeFields([
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: encodeRight(body.right) },
    { tag: 3, kind: 'bytes', value: utf8(body.grantOrRevoke) },
  ]);
}

function decodeRightsBody(buf: Buffer): RightsBody {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const headerField = first(fields, 1);
  const rightField = first(fields, 2);
  const action = readString(first(fields, 3));
  if (
    !headerField ||
    headerField.kind !== 'bytes' ||
    !rightField ||
    rightField.kind !== 'bytes' ||
    (action !== 'GRANT' && action !== 'REVOKE')
  ) {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'RIGHTS',
    header: decodeHeader(headerField.value),
    right: decodeRight(rightField.value),
    grantOrRevoke: action,
  });
}

function encodeConsent(body: ConsentReferenceBody): Buffer {
  return writeFields([
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: utf8(body.consentReceiptCommitment) },
    { tag: 3, kind: 'bytes', value: utf8(body.purposeId) },
  ]);
}

function decodeConsent(buf: Buffer): ConsentReferenceBody {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const headerField = first(fields, 1);
  if (!headerField || headerField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'CONSENT_REFERENCE',
    header: decodeHeader(headerField.value),
    consentReceiptCommitment: readString(first(fields, 2)),
    purposeId: readString(first(fields, 3)),
  });
}

function encodeCapacity(body: ProductiveCapacityBody): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: encodeObject(body.capacity) },
  ];
  for (const right of body.rightsExercised) {
    fields.push({ tag: 3, kind: 'bytes', value: encodeRight(right) });
  }
  if (body.quantity) {
    fields.push({ tag: 4, kind: 'bytes', value: encodeQuantity(body.quantity) });
  }
  return writeFields(fields);
}

function decodeCapacity(buf: Buffer): ProductiveCapacityBody {
  const fields = readFields(buf, new Set([1, 2, 3, 4]));
  const headerField = first(fields, 1);
  const objectField = first(fields, 2);
  if (!headerField || headerField.kind !== 'bytes' || !objectField || objectField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'PRODUCTIVE_CAPACITY',
    header: decodeHeader(headerField.value),
    capacity: decodeObject(objectField.value),
    rightsExercised: decodeRights(fields, 3),
    quantity: decodeQuantityField(first(fields, 4)),
  });
}

function encodeDelivery(body: DeliveryBody): Buffer {
  const fields: WireField[] = [
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: encodeObject(body.deliveryClaim) },
  ];
  for (const right of body.rightsExercised) {
    fields.push({ tag: 3, kind: 'bytes', value: encodeRight(right) });
  }
  return writeFields(fields);
}

function decodeDelivery(buf: Buffer): DeliveryBody {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const headerField = first(fields, 1);
  const objectField = first(fields, 2);
  if (!headerField || headerField.kind !== 'bytes' || !objectField || objectField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'DELIVERY',
    header: decodeHeader(headerField.value),
    deliveryClaim: decodeObject(objectField.value),
    rightsExercised: decodeRights(fields, 3),
  });
}

function encodeEvidence(body: EvidenceAnchorBody): Buffer {
  return writeFields([
    { tag: 1, kind: 'bytes', value: encodeHeader(body.header) },
    { tag: 2, kind: 'bytes', value: encodeObject(body.anchor) },
    { tag: 3, kind: 'bytes', value: utf8(body.vaultRecordHash) },
  ]);
}

function decodeEvidence(buf: Buffer): EvidenceAnchorBody {
  const fields = readFields(buf, new Set([1, 2, 3]));
  const headerField = first(fields, 1);
  const objectField = first(fields, 2);
  if (!headerField || headerField.kind !== 'bytes' || !objectField || objectField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family: 'EVIDENCE_ANCHOR',
    header: decodeHeader(headerField.value),
    anchor: decodeObject(objectField.value),
    vaultRecordHash: readString(first(fields, 3)),
  });
}

function encodeReserved(body: ReservedBody): Buffer {
  return writeFields([{ tag: 1, kind: 'bytes', value: encodeHeader(body.header) }]);
}

function decodeReserved(buf: Buffer, family: ReservedBody['family']): ReservedBody {
  const fields = readFields(buf, new Set([1]));
  const headerField = first(fields, 1);
  if (!headerField || headerField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  return Object.freeze({
    family,
    header: decodeHeader(headerField.value),
  });
}

function encodeBody(body: TransactionBodyV1): Buffer {
  switch (body.family) {
    case 'NATIVE_ASSET':
      return encodeNativeAsset(body);
    case 'IDENTITY':
      return encodeIdentity(body);
    case 'ATTESTATION':
      return encodeAttestation(body);
    case 'RIGHTS':
      return encodeRightsBody(body);
    case 'CONSENT_REFERENCE':
      return encodeConsent(body);
    case 'PRODUCTIVE_CAPACITY':
      return encodeCapacity(body);
    case 'DELIVERY':
      return encodeDelivery(body);
    case 'EVIDENCE_ANCHOR':
      return encodeEvidence(body);
    default:
      return encodeReserved(body);
  }
}

function decodeBody(family: TransactionFamily, buf: Buffer): TransactionBodyV1 {
  switch (family) {
    case 'NATIVE_ASSET':
      return decodeNativeAsset(buf);
    case 'IDENTITY':
      return decodeIdentity(buf);
    case 'ATTESTATION':
      return decodeAttestation(buf);
    case 'RIGHTS':
      return decodeRightsBody(buf);
    case 'CONSENT_REFERENCE':
      return decodeConsent(buf);
    case 'PRODUCTIVE_CAPACITY':
      return decodeCapacity(buf);
    case 'DELIVERY':
      return decodeDelivery(buf);
    case 'EVIDENCE_ANCHOR':
      return decodeEvidence(buf);
    case 'SYSTEM':
    case 'ORACLE':
    case 'EXCHANGE_SETTLEMENT':
    case 'GOVERNANCE':
    case 'VALIDATOR':
      return decodeReserved(buf, family);
    default:
      fail('UNKNOWN_TRANSACTION_TYPE');
  }
}

function encodeEnvelopeFields(envelope: EnvelopeV1, includeSignature: boolean): Buffer {
  const body = encodeBody(envelope.body);
  if (body.length > MAX_BODY_BYTES) {
    fail('OVERSIZED');
  }
  return writeFields([
    { tag: 1, kind: 'bytes', value: utf8(envelope.networkId) },
    { tag: 2, kind: 'bytes', value: utf8(envelope.chainId) },
    { tag: 3, kind: 'bytes', value: utf8(envelope.codecId) },
    { tag: 4, kind: 'varint', value: BigInt(envelope.schemaVersion) },
    { tag: 5, kind: 'varint', value: BigInt(TRANSACTION_FAMILY_IDS[envelope.transactionType]) },
    { tag: 6, kind: 'bytes', value: body },
    { tag: 7, kind: 'bytes', value: encodeAuth(envelope.authentication, includeSignature) },
  ]);
}

export function encodeEnvelope(envelope: EnvelopeV1): Uint8Array {
  const bytes = encodeEnvelopeFields(envelope, true);
  if (bytes.length > MAX_ENVELOPE_BYTES) {
    fail('OVERSIZED');
  }
  return new Uint8Array(bytes);
}

export function encodeUnsignedEnvelope(envelope: EnvelopeV1): Uint8Array {
  const bytes = encodeEnvelopeFields(envelope, false);
  if (bytes.length > MAX_ENVELOPE_BYTES) {
    fail('OVERSIZED');
  }
  return new Uint8Array(bytes);
}

export function decodeEnvelope(bytes: Uint8Array): EnvelopeV1 {
  if (bytes.length > MAX_ENVELOPE_BYTES) {
    fail('OVERSIZED');
  }
  if (bytes.length === 0) {
    fail('MALFORMED');
  }
  const fields = readFields(Buffer.from(bytes), new Set([1, 2, 3, 4, 5, 6, 7]));
  const family = transactionFamilyFromId(Number(readUint(first(fields, 5))));
  if (!family) {
    fail('UNKNOWN_TRANSACTION_TYPE');
  }
  const bodyField = first(fields, 6);
  const authField = first(fields, 7);
  if (!bodyField || bodyField.kind !== 'bytes' || !authField || authField.kind !== 'bytes') {
    fail('MALFORMED');
  }
  if (bodyField.value.length > MAX_BODY_BYTES) {
    fail('OVERSIZED');
  }
  const codecId = readString(first(fields, 3));
  if (codecId !== PROTOCOL_CODEC_ID) {
    fail('UNKNOWN_CODEC');
  }
  const body = decodeBody(family, bodyField.value);
  if (body.family !== family) {
    fail('MALFORMED');
  }
  return Object.freeze({
    networkId: readString(first(fields, 1)),
    chainId: readString(first(fields, 2)),
    codecId,
    schemaVersion: requireVersion(readUint(first(fields, 4))),
    transactionType: family,
    body,
    authentication: decodeAuth(authField.value),
  });
}

export function encodeBlockHeader(header: BlockHeaderV1): Uint8Array {
  return new Uint8Array(
    writeFields([
      { tag: 1, kind: 'bytes', value: utf8(header.networkId) },
      { tag: 2, kind: 'bytes', value: utf8(header.chainId) },
      { tag: 3, kind: 'bytes', value: utf8(header.codecId) },
      { tag: 4, kind: 'varint', value: BigInt(header.schemaVersion) },
      { tag: 5, kind: 'varint', value: header.height },
      { tag: 6, kind: 'bytes', value: Buffer.from(header.previousBlockHash) },
      { tag: 7, kind: 'bytes', value: Buffer.from(header.appHash) },
      { tag: 8, kind: 'bytes', value: Buffer.from(header.transactionRoot) },
      { tag: 9, kind: 'bytes', value: Buffer.from(header.validatorSetHash) },
      { tag: 10, kind: 'bytes', value: Buffer.from(header.consensusParametersHash) },
      { tag: 11, kind: 'varint', value: header.timeUnixSeconds },
    ]),
  );
}

export function encodeEconomicObject(object: EconomicObject): Uint8Array {
  return new Uint8Array(encodeObject(object));
}

export function decodeEconomicObject(bytes: Uint8Array): EconomicObject {
  return decodeObject(Buffer.from(bytes));
}

export function injectUnknownField(bytes: Uint8Array): Uint8Array {
  const extra = writeFields([{ tag: 99, kind: 'varint', value: 1n }]);
  return new Uint8Array(Buffer.concat([Buffer.from(bytes), extra]));
}
