/**
 * On-chain payloads may contain only these reference kinds.
 * There is no field, constructor, or overload for a raw record.
 * A raw personal-data payload cannot be expressed as a ChainReference.
 */
export const PERMITTED_CHAIN_REFERENCE_KINDS = [
  'HASH',
  'PROOF_IDENTIFIER',
  'CONSENT_REFERENCE',
  'SETTLEMENT_EVENT',
  'PROVENANCE_IDENTIFIER',
] as const;

export type PermittedChainReferenceKind = (typeof PERMITTED_CHAIN_REFERENCE_KINDS)[number];

const HEX64 = /^[0-9a-f]{64}$/;
const REF_ID = /^[A-Za-z0-9_.:-]+$/;

function assertHex64(value: string): void {
  if (!HEX64.test(value)) {
    throw new TypeError('HASH references must be a 64-character lowercase hex digest');
  }
}

function assertRefId(value: string, kind: PermittedChainReferenceKind): void {
  if (value.length === 0 || !REF_ID.test(value)) {
    throw new TypeError(`${kind} value must be a non-empty identifier, not a record`);
  }
}

/**
 * The only value the chain adapter will accept.
 * Constructible solely through the five static factories below.
 * `new ChainReference` is not callable from outside this module.
 */
export class ChainReference {
  readonly kind: PermittedChainReferenceKind;
  readonly value: string;

  private constructor(kind: PermittedChainReferenceKind, value: string) {
    this.kind = kind;
    this.value = value;
    Object.freeze(this);
  }

  static hash(hexDigest: string): ChainReference {
    assertHex64(hexDigest);
    return new ChainReference('HASH', hexDigest);
  }

  static proofIdentifier(id: string): ChainReference {
    assertRefId(id, 'PROOF_IDENTIFIER');
    return new ChainReference('PROOF_IDENTIFIER', id);
  }

  static consentReference(id: string): ChainReference {
    assertRefId(id, 'CONSENT_REFERENCE');
    return new ChainReference('CONSENT_REFERENCE', id);
  }

  static settlementEvent(id: string): ChainReference {
    assertRefId(id, 'SETTLEMENT_EVENT');
    return new ChainReference('SETTLEMENT_EVENT', id);
  }

  static provenanceIdentifier(id: string): ChainReference {
    assertRefId(id, 'PROVENANCE_IDENTIFIER');
    return new ChainReference('PROVENANCE_IDENTIFIER', id);
  }
}

export type ChainSubmitPayload = ChainReference;

export type ForbiddenChainFields =
  | 'raw'
  | 'rawRecord'
  | 'record'
  | 'data'
  | 'payload'
  | 'personalData'
  | 'profile'
  | 'wellness'
  | 'body';

export type ChainReferenceHasNoRawFields =
  Extract<keyof ChainReference, ForbiddenChainFields> extends never ? true : false;
