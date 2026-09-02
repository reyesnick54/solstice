/**
 * Deterministic canonical encoding for consensus-critical protocol state.
 *
 * Field order is fixed. Integers are unsigned big-endian. Strings are
 * length-prefixed UTF-8. Repeated fields are sorted before encoding.
 */

import type {
  CanonicalAccountNonce,
  CanonicalAccountPosition,
  CanonicalProtocolState,
  CanonicalSupplyBook,
} from './types.ts';
import { CANONICAL_STATE_SCHEMA_VERSION } from './types.ts';

function encodeU32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0);
  return out;
}

function decodeU32(buf: Buffer, offset: number): { value: number; offset: number } {
  if (offset + 4 > buf.length) {
    throw new TypeError('truncated u32');
  }
  return { value: buf.readUInt32BE(offset), offset: offset + 4 };
}

function encodeU64(value: bigint): Buffer {
  const out = Buffer.alloc(8);
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new TypeError('u64 out of range');
  }
  out.writeBigUInt64BE(value);
  return out;
}

function decodeU64(buf: Buffer, offset: number): { value: bigint; offset: number } {
  if (offset + 8 > buf.length) {
    throw new TypeError('truncated u64');
  }
  return { value: buf.readBigUInt64BE(offset), offset: offset + 8 };
}

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 65_535) {
    throw new TypeError('string exceeds 65535 bytes');
  }
  return Buffer.concat([encodeU32(bytes.length), bytes]);
}

function decodeString(buf: Buffer, offset: number): { value: string; offset: number } {
  const len = decodeU32(buf, offset);
  const start = len.offset;
  const end = start + len.value;
  if (end > buf.length) {
    throw new TypeError('truncated string');
  }
  return { value: buf.subarray(start, end).toString('utf8'), offset: end };
}

function encodeOptionalString(value: string | null): Buffer {
  if (value === null) {
    return encodeU32(0);
  }
  return Buffer.concat([encodeU32(1), encodeString(value)]);
}

function decodeOptionalString(buf: Buffer, offset: number): { value: string | null; offset: number } {
  const flag = decodeU32(buf, offset);
  if (flag.value === 0) {
    return { value: null, offset: flag.offset };
  }
  if (flag.value !== 1) {
    throw new TypeError('invalid optional string flag');
  }
  const decoded = decodeString(buf, flag.offset);
  return { value: decoded.value, offset: decoded.offset };
}

function encodePosition(position: CanonicalAccountPosition): Buffer {
  return Buffer.concat([
    encodeString(position.account),
    encodeString(position.assetId),
    encodeU64(position.circulating),
    encodeU64(position.locked),
    encodeU64(position.escrowed),
    encodeU64(position.feeReserved),
  ]);
}

function decodePosition(buf: Buffer, offset: number): { value: CanonicalAccountPosition; offset: number } {
  const account = decodeString(buf, offset);
  const assetId = decodeString(buf, account.offset);
  const circulating = decodeU64(buf, assetId.offset);
  const locked = decodeU64(buf, circulating.offset);
  const escrowed = decodeU64(buf, locked.offset);
  const feeReserved = decodeU64(buf, escrowed.offset);
  if (assetId.value !== 'SUNREY_COIN' && assetId.value !== 'MOONREY_COIN') {
    throw new TypeError('unknown asset id in canonical position');
  }
  return {
    value: Object.freeze({
      account: account.value,
      assetId: assetId.value,
      circulating: circulating.value,
      locked: locked.value,
      escrowed: escrowed.value,
      feeReserved: feeReserved.value,
    }),
    offset: feeReserved.offset,
  };
}

function encodeSupplyBook(book: CanonicalSupplyBook): Buffer {
  const chunks = [
    encodeString(book.assetId),
    encodeString(book.policyVersion),
    encodeU64(book.genesisAllocated),
    encodeU64(book.issuedPostGenesis),
    encodeU64(book.burned),
    encodeU64(book.circulating),
    encodeU64(book.locked),
    encodeU64(book.escrowed),
    encodeU64(book.feeReserved),
    encodeU32(book.positions.length),
    ...book.positions.map((position) => encodePosition(position)),
    encodeU32(book.usedReplayIds.length),
    ...book.usedReplayIds.map((id) => encodeString(id)),
  ];
  return Buffer.concat(chunks);
}

function decodeSupplyBook(buf: Buffer, offset: number): { value: CanonicalSupplyBook; offset: number } {
  const assetId = decodeString(buf, offset);
  const policyVersion = decodeString(buf, assetId.offset);
  const genesisAllocated = decodeU64(buf, policyVersion.offset);
  const issuedPostGenesis = decodeU64(buf, genesisAllocated.offset);
  const burned = decodeU64(buf, issuedPostGenesis.offset);
  const circulating = decodeU64(buf, burned.offset);
  const locked = decodeU64(buf, circulating.offset);
  const escrowed = decodeU64(buf, locked.offset);
  const feeReserved = decodeU64(buf, escrowed.offset);
  const positionCount = decodeU32(buf, feeReserved.offset);
  const positions: CanonicalAccountPosition[] = [];
  let cursor = positionCount.offset;
  for (let index = 0; index < positionCount.value; index += 1) {
    const decoded = decodePosition(buf, cursor);
    positions.push(decoded.value);
    cursor = decoded.offset;
  }
  const replayCount = decodeU32(buf, cursor);
  const usedReplayIds: string[] = [];
  cursor = replayCount.offset;
  for (let index = 0; index < replayCount.value; index += 1) {
    const decoded = decodeString(buf, cursor);
    usedReplayIds.push(decoded.value);
    cursor = decoded.offset;
  }
  if (assetId.value !== 'SUNREY_COIN' && assetId.value !== 'MOONREY_COIN') {
    throw new TypeError('unknown asset id in canonical supply book');
  }
  return {
    value: Object.freeze({
      assetId: assetId.value,
      policyVersion: policyVersion.value,
      genesisAllocated: genesisAllocated.value,
      issuedPostGenesis: issuedPostGenesis.value,
      burned: burned.value,
      circulating: circulating.value,
      locked: locked.value,
      escrowed: escrowed.value,
      feeReserved: feeReserved.value,
      positions: Object.freeze(positions),
      usedReplayIds: Object.freeze(usedReplayIds),
    }),
    offset: cursor,
  };
}

function encodeNonce(entry: CanonicalAccountNonce): Buffer {
  return Buffer.concat([encodeString(entry.account), encodeU64(entry.nonce)]);
}

function decodeNonce(buf: Buffer, offset: number): { value: CanonicalAccountNonce; offset: number } {
  const account = decodeString(buf, offset);
  const nonce = decodeU64(buf, account.offset);
  return {
    value: Object.freeze({ account: account.value, nonce: nonce.value }),
    offset: nonce.offset,
  };
}

export function encodeCanonicalState(state: CanonicalProtocolState): Uint8Array {
  if (state.schemaVersion !== CANONICAL_STATE_SCHEMA_VERSION) {
    throw new TypeError('unsupported canonical state schema version');
  }
  const chunks = [
    encodeU32(state.schemaVersion),
    encodeU32(state.protocolVersion),
    encodeString(state.networkId),
    encodeString(state.chainId),
    encodeU64(state.height),
    encodeOptionalString(state.finalizedBlockId),
    encodeString(state.policyState),
    encodeSupplyBook(state.supplies[0]),
    encodeSupplyBook(state.supplies[1]),
    encodeU32(state.accountNonces.length),
    ...state.accountNonces.map((entry) => encodeNonce(entry)),
    encodeU32(state.executedTransactionIds.length),
    ...state.executedTransactionIds.map((id) => encodeString(id)),
    encodeU32(state.executedIssuanceAuthorizationIds.length),
    ...state.executedIssuanceAuthorizationIds.map((id) => encodeString(id)),
    encodeU32(state.governanceAuthorizationRefs.length),
    ...state.governanceAuthorizationRefs.map((id) => encodeString(id)),
  ];
  return Uint8Array.from(Buffer.concat(chunks));
}

export function decodeCanonicalState(bytes: Uint8Array): CanonicalProtocolState {
  const buf = Buffer.from(bytes);
  const schemaVersion = decodeU32(buf, 0);
  if (schemaVersion.value !== CANONICAL_STATE_SCHEMA_VERSION) {
    throw new TypeError('unsupported canonical state schema version');
  }
  const protocolVersion = decodeU32(buf, schemaVersion.offset);
  const networkId = decodeString(buf, protocolVersion.offset);
  const chainId = decodeString(buf, networkId.offset);
  const height = decodeU64(buf, chainId.offset);
  const finalizedBlockId = decodeOptionalString(buf, height.offset);
  const policyState = decodeString(buf, finalizedBlockId.offset);
  const supplyLeft = decodeSupplyBook(buf, policyState.offset);
  const supplyRight = decodeSupplyBook(buf, supplyLeft.offset);
  const nonceCount = decodeU32(buf, supplyRight.offset);
  const accountNonces: CanonicalAccountNonce[] = [];
  let cursor = nonceCount.offset;
  for (let index = 0; index < nonceCount.value; index += 1) {
    const decoded = decodeNonce(buf, cursor);
    accountNonces.push(decoded.value);
    cursor = decoded.offset;
  }
  const txCount = decodeU32(buf, cursor);
  const executedTransactionIds: string[] = [];
  cursor = txCount.offset;
  for (let index = 0; index < txCount.value; index += 1) {
    const decoded = decodeString(buf, cursor);
    executedTransactionIds.push(decoded.value);
    cursor = decoded.offset;
  }
  const issuanceCount = decodeU32(buf, cursor);
  const executedIssuanceAuthorizationIds: string[] = [];
  cursor = issuanceCount.offset;
  for (let index = 0; index < issuanceCount.value; index += 1) {
    const decoded = decodeString(buf, cursor);
    executedIssuanceAuthorizationIds.push(decoded.value);
    cursor = decoded.offset;
  }
  const governanceCount = decodeU32(buf, cursor);
  const governanceAuthorizationRefs: string[] = [];
  cursor = governanceCount.offset;
  for (let index = 0; index < governanceCount.value; index += 1) {
    const decoded = decodeString(buf, cursor);
    governanceAuthorizationRefs.push(decoded.value);
    cursor = decoded.offset;
  }
  if (cursor !== buf.length) {
    throw new TypeError('trailing bytes in canonical state encoding');
  }
  const supplies =
    supplyLeft.value.assetId === 'SUNREY_COIN'
      ? ([supplyLeft.value, supplyRight.value] as const)
      : ([supplyRight.value, supplyLeft.value] as const);
  if (supplies[0].assetId !== 'SUNREY_COIN' || supplies[1].assetId !== 'MOONREY_COIN') {
    throw new TypeError('canonical supplies must contain SUNREY_COIN and MOONREY_COIN');
  }
  return Object.freeze({
    schemaVersion: CANONICAL_STATE_SCHEMA_VERSION,
    protocolVersion: protocolVersion.value,
    networkId: networkId.value,
    chainId: chainId.value,
    height: height.value,
    finalizedBlockId: finalizedBlockId.value,
    policyState: policyState.value as CanonicalProtocolState['policyState'],
    supplies: Object.freeze(supplies),
    accountNonces: Object.freeze(accountNonces),
    executedTransactionIds: Object.freeze(executedTransactionIds),
    executedIssuanceAuthorizationIds: Object.freeze(executedIssuanceAuthorizationIds),
    governanceAuthorizationRefs: Object.freeze(governanceAuthorizationRefs),
  });
}
