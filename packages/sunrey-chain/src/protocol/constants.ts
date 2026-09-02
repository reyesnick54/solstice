export const PROTOCOL_SCHEMA_VERSION = 1 as const;
export const PROTOCOL_CODEC_ID = 'sunrey.protobuf.canonical.v1' as const;

export const PROTOCOL_NETWORK_ID = 'net_sunrey_simulation' as const;
export const PROTOCOL_CHAIN_ID = 'chn_sunrey_simulation' as const;

export const MAX_ENVELOPE_BYTES = 16_384;
export const MAX_BODY_BYTES = 8_192;
export const MAX_STRING_BYTES = 256;
export const MAX_BYTES_FIELD = 512;
export const MAX_REPEATED = 16;
export const MAX_QUANTITY_DIGITS = 38;
export const MAX_SCALED_UNITS = 10n ** 38n - 1n;
export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;
export const SHA256_BYTES = 32;

export const HASH_DOMAINS = [
  'SUNREY_TX_V1',
  'SUNREY_BLOCK_V1',
  'SUNREY_OBJECT_V1',
  'SUNREY_ATTESTATION_V1',
  'SUNREY_ORACLE_V1',
  'SUNREY_GOVERNANCE_V1',
  'SUNREY_VALIDATOR_V1',
  'SUNREY_EVIDENCE_V1',
  'SUNREY_MONETARY_STATE_V1',
] as const;
export type HashDomain = (typeof HASH_DOMAINS)[number];

export const SIGNATURE_ALGORITHM_ED25519 = 1 as const;

export const SENSITIVE_FIELD_MARKERS = [
  'rawPdv',
  'raw_pdv',
  'rawPayload',
  'raw_payload',
  'plaintext',
  'pan',
  'cvv',
  'privateKey',
  'private_key',
  'seedPhrase',
  'legalName',
  'ssn',
  'nationalId',
  'iban',
  'healthRecord',
  'geneticData',
] as const;
