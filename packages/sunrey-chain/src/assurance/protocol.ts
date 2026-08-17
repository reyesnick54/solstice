import {
  MAX_ENVELOPE_BYTES,
  decode,
  decodeEnvelope,
  decodeEconomicObject,
  encodeEnvelope,
  injectUnknownField,
  processTransaction,
  ProtocolState,
} from '../protocol/index.ts';
import { signedTransferEnvelope } from '../protocol/fixtures.ts';
import type { ProtocolExecutionContext } from '../protocol/state.ts';
import { ASSURANCE_CHAIN_ID, ASSURANCE_NETWORK_ID } from './types.ts';
import type { SeededRng } from './rng.ts';

const CONTEXT: ProtocolExecutionContext = {
  networkId: ASSURANCE_NETWORK_ID,
  chainId: ASSURANCE_CHAIN_ID,
  blockTimeUnixSeconds: 1_750_000_000n,
};

export const PROTOCOL_BOUNDS = Object.freeze({
  maxEnvelopeBytes: MAX_ENVELOPE_BYTES,
  maxNestedLists: 16,
  maxUnknownTags: 8,
});

export function fuzzDecodeEnvelope(bytes: Uint8Array): { readonly rejected: boolean } {
  const result = decode(bytes);
  if (!result.ok) {
    return { rejected: true };
  }
  return { rejected: false };
}

export function fuzzProcessTransaction(bytes: Uint8Array): { readonly rejected: boolean } {
  const result = processTransaction(bytes, new ProtocolState(), CONTEXT);
  return { rejected: !result.ok };
}

export function mutateCanonicalBytes(rng: SeededRng, bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) {
    return rng.bytes(rng.int(1, 64));
  }
  const out = Uint8Array.from(bytes);
  const mode = rng.int(0, 5);
  if (mode === 0) {
    out[rng.int(0, out.length - 1)] ^= 1 << rng.int(0, 7);
    return out;
  }
  if (mode === 1) {
    return injectUnknownField(out);
  }
  if (mode === 2) {
    return out.subarray(0, Math.max(1, out.length - rng.int(1, 8)));
  }
  if (mode === 3) {
    const extra = rng.bytes(rng.int(1, 32));
    const merged = new Uint8Array(out.length + extra.length);
    merged.set(out);
    merged.set(extra, out.length);
    return merged;
  }
  if (mode === 4) {
    const huge = new Uint8Array(PROTOCOL_BOUNDS.maxEnvelopeBytes + 8);
    huge.set(out.subarray(0, Math.min(out.length, huge.length)));
    return huge;
  }
  return rng.bytes(rng.int(0, 128));
}

export function validSignedTransferBytes(): Uint8Array {
  return encodeEnvelope(signedTransferEnvelope());
}

export function protocolFuzzNeverPanics(rng: SeededRng, cases: number): number {
  const seed = validSignedTransferBytes();
  let rejected = 0;
  for (let i = 0; i < cases; i += 1) {
    const bytes = i === 0 ? seed : mutateCanonicalBytes(rng.child(`proto:${i}`), seed);
    const decoded = fuzzDecodeEnvelope(bytes);
    fuzzProcessTransaction(bytes);
    if (decoded.rejected) {
      rejected += 1;
    }
    if (bytes.length > 0) {
      try {
        decodeEnvelope(bytes);
      } catch {
        rejected += 1;
      }
      try {
        decodeEconomicObject(bytes);
      } catch {
        // expected for most mutations
      }
    }
  }
  return rejected;
}

export function assertBoundedAllocation(bytes: Uint8Array): void {
  if (bytes.byteLength > PROTOCOL_BOUNDS.maxEnvelopeBytes * 4) {
    throw new TypeError('fuzz input exceeded explicit allocation bound');
  }
}
