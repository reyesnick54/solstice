/**
 * Sensitive-field encryption inventory. Envelope encryption uses
 * DATA_ENCRYPTION. Do not double-encrypt without a key-management design.
 */

export const SENSITIVE_FIELD_OWNERS = [
  'identity',
  'personal-data-vault',
  'compliance',
  'payments',
  'provider-configuration',
  'agent',
] as const;
export type SensitiveFieldOwner = (typeof SENSITIVE_FIELD_OWNERS)[number];

export type FieldEncryptionRequirement = {
  readonly owner: SensitiveFieldOwner;
  readonly fields: readonly string[];
  readonly atRest: 'ENVELOPE_AES_256_GCM' | 'DATABASE_TLS_PLUS_DISK' | 'HASH_ONLY';
  readonly purpose: 'DATA_ENCRYPTION' | 'SESSION_SIGNING' | 'NONE';
  readonly doubleEncrypt: false;
  readonly notes: string;
};

export const FIELD_ENCRYPTION_INVENTORY: readonly FieldEncryptionRequirement[] = Object.freeze([
  {
    owner: 'identity',
    fields: ['passwordDigest', 'totpSecretEnvelope', 'recoveryTokenHash', 'loginHandleHmac'],
    atRest: 'ENVELOPE_AES_256_GCM',
    purpose: 'DATA_ENCRYPTION',
    doubleEncrypt: false,
    notes: 'TOTP secret is envelope-encrypted; passwords are scrypt digests, not reversible encryption',
  },
  {
    owner: 'personal-data-vault',
    fields: ['subjectBlob', 'exportPackage'],
    atRest: 'ENVELOPE_AES_256_GCM',
    purpose: 'DATA_ENCRYPTION',
    doubleEncrypt: false,
    notes: 'PDV uses KeyProvider DATA_ENCRYPTION; no second vault cipher',
  },
  {
    owner: 'compliance',
    fields: ['screeningPayload', 'caseAttachmentRef'],
    atRest: 'DATABASE_TLS_PLUS_DISK',
    purpose: 'DATA_ENCRYPTION',
    doubleEncrypt: false,
    notes: 'provider callbacks store hashes / descriptors; raw vendor credentials stay SecretReference',
  },
  {
    owner: 'payments',
    fields: ['beneficiaryAccountRef', 'railCredentialRef'],
    atRest: 'DATABASE_TLS_PLUS_DISK',
    purpose: 'NONE',
    doubleEncrypt: false,
    notes: 'account numbers are tokenized / referenced; rail secrets are SecretReference',
  },
  {
    owner: 'provider-configuration',
    fields: ['credentialDescriptor', 'webhookSecretRef'],
    atRest: 'DATABASE_TLS_PLUS_DISK',
    purpose: 'NONE',
    doubleEncrypt: false,
    notes: 'Chunk 149 descriptors only; plaintext credentials never enter domain configuration',
  },
  {
    owner: 'agent',
    fields: ['mandateText', 'conversationMemory'],
    atRest: 'DATABASE_TLS_PLUS_DISK',
    purpose: 'NONE',
    doubleEncrypt: false,
    notes: 'Agent memory is redacted; secrets and private keys are stripped before model context',
  },
]);
