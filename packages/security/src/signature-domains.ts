/**
 * Canonical signature domain registry.
 *
 * Every signed blockchain artifact commits to an explicit domain using
 * length-prefixed deterministic encoding. Domains are not arbitrary
 * human-readable prefixes.
 */

export const SIGNATURE_DOMAINS = Object.freeze({
  TRANSACTION: 'sunrey.sig.transaction.v1',
  BLOCK: 'sunrey.sig.block.v1',
  CONSENSUS_PROPOSAL: 'sunrey.consensus.proposal.v1',
  CONSENSUS_PREVOTE: 'sunrey.consensus.prevote.v1',
  CONSENSUS_PRECOMMIT: 'sunrey.consensus.precommit.v1',
  VALIDATOR_REGISTRATION: 'sunrey.validator.record.v1',
  NODE_IDENTITY: 'sunrey.node.identity.v1',
  INTEROP_MESSAGE: 'sunrey.interop.message.v1',
} as const);

export type SignatureDomain = (typeof SIGNATURE_DOMAINS)[keyof typeof SIGNATURE_DOMAINS];

export const SIGNATURE_DOMAIN_VALUES = Object.freeze(
  Object.values(SIGNATURE_DOMAINS) as readonly SignatureDomain[],
);

export function isSignatureDomain(value: unknown): value is SignatureDomain {
  return typeof value === 'string' && (SIGNATURE_DOMAIN_VALUES as readonly string[]).includes(value);
}

function encodeU32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}

function encodeString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length > 65_535) {
    throw new TypeError('signature domain string exceeds u16 bound');
  }
  return Buffer.concat([encodeU32(bytes.length), bytes]);
}

/**
 * Deterministic domain commit: length-prefixed domain + payload.
 * Matches the SunRey chain canonical encoding used in validators/canonical.ts.
 */
export function encodeSignatureDomainCommit(domain: SignatureDomain, payload: Uint8Array | Buffer): Buffer {
  if (!isSignatureDomain(domain)) {
    throw new TypeError(`unknown signature domain: ${String(domain)}`);
  }
  return Buffer.concat([encodeString(domain), Buffer.from(payload)]);
}

export function consensusDomainForMessageType(
  messageType: 'PROPOSAL' | 'PREVOTE' | 'PRECOMMIT',
): SignatureDomain {
  if (messageType === 'PROPOSAL') {
    return SIGNATURE_DOMAINS.CONSENSUS_PROPOSAL;
  }
  if (messageType === 'PREVOTE') {
    return SIGNATURE_DOMAINS.CONSENSUS_PREVOTE;
  }
  return SIGNATURE_DOMAINS.CONSENSUS_PRECOMMIT;
}
