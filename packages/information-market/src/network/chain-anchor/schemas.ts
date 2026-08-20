import { classifyWrite } from '../../../../sunrey-chain/src/classification.ts';
import { FORBIDDEN_PAYLOAD_KEYS } from '../../../../sunrey-chain/src/taxonomy.ts';
import type { ChainRecordSchema } from '../../../../sunrey-chain/src/types.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { HIN_ANCHOR_FORBIDDEN_KEYS } from './policy.ts';
import type { HinAnchorFailure } from './types.ts';

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /\b\+?\d{1,3}[-. ]?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/;
const SENSITIVE_VALUE_MARKERS = [
  'legal name',
  'pdv payload',
  'raw pdv',
  'health record',
  'genetic',
  'private_key',
  'api credential',
  'kyc payload',
];

function walkKeys(value: unknown, out: string[]): void {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeys(item, out);
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.push(key);
    walkKeys(child, out);
  }
}

function walkStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkStrings(item, out);
    }
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    walkStrings(child, out);
  }
}

export function assertPrivacySafeAnchorMaterial(value: unknown): Result<true, HinAnchorFailure> {
  const keys: string[] = [];
  walkKeys(value, keys);
  const forbidden = new Set<string>([...HIN_ANCHOR_FORBIDDEN_KEYS, ...FORBIDDEN_PAYLOAD_KEYS]);
  for (const key of keys) {
    if (forbidden.has(key)) {
      return err({
        code: 'HIN_ANCHOR_PRIVACY_VIOLATION',
        message: `field ${key} is off-chain only and cannot be anchored`,
      });
    }
  }
  const strings: string[] = [];
  walkStrings(value, strings);
  for (const text of strings) {
    const lowered = text.toLowerCase();
    if (EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text)) {
      return err({
        code: 'HIN_ANCHOR_PRIVACY_VIOLATION',
        message: 'direct identifiers cannot appear on a chain anchor',
      });
    }
    if (SENSITIVE_VALUE_MARKERS.some((marker) => lowered.includes(marker))) {
      return err({
        code: 'HIN_ANCHOR_PRIVACY_VIOLATION',
        message: 'raw sensitive personal information cannot appear on a chain anchor',
      });
    }
  }
  return ok(true);
}

export function classifyHinSchema(schema: ChainRecordSchema): Result<true, HinAnchorFailure> {
  const privacy = assertPrivacySafeAnchorMaterial(schema);
  if (!privacy.ok) {
    return privacy;
  }
  const classified = classifyWrite({
    recordType: schema.recordType,
    dataClass: schema.dataClass,
    schema,
  });
  if (classified) {
    if (
      classified.code === 'FORBIDDEN_ON_CHAIN_FIELD' ||
      classified.code === 'RAW_SENSITIVE_DATA_DENIED' ||
      classified.code === 'DATA_CLASSIFICATION_DENIED'
    ) {
      return err({
        code: 'HIN_ANCHOR_PRIVACY_VIOLATION',
        message: classified.message,
      });
    }
    return err({
      code: 'HIN_ANCHOR_SCHEMA_INVALID',
      message: classified.message,
    });
  }
  return ok(true);
}

export function buildConsentAnchorSchema(fields: {
  readonly consentId: string;
  readonly consentVersion: string;
  readonly consentHash: string;
  readonly purposeId: string;
  readonly purposeVersion: string;
  readonly subjectReference: string;
  readonly recipientClass: string;
  readonly scopeCommitment: string;
  readonly effectiveState: string;
  readonly expirationReference: string;
  readonly timestamp: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'CONSENT_RECEIPT',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      consentId: fields.consentId,
      consentVersion: fields.consentVersion,
      consentHash: fields.consentHash,
      purposeId: fields.purposeId,
      purposeVersion: fields.purposeVersion,
      subjectReference: fields.subjectReference,
      recipientClass: fields.recipientClass,
      scopeCommitment: fields.scopeCommitment,
      effectiveState: fields.effectiveState,
      expirationReference: fields.expirationReference,
      timestamp: fields.timestamp,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildRevocationAnchorSchema(fields: {
  readonly consentId: string;
  readonly consentVersion: string;
  readonly revocationId: string;
  readonly subjectReference: string;
  readonly revokedAt: string;
  readonly priorReceiptCommitment: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'CONSENT_REVOCATION',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      consentId: fields.consentId,
      consentVersion: fields.consentVersion,
      revocationId: fields.revocationId,
      subjectReference: fields.subjectReference,
      revokedAt: fields.revokedAt,
      priorReceiptCommitment: fields.priorReceiptCommitment,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildRightStateAnchorSchema(fields: {
  readonly rightCommitment: string;
  readonly status: string;
  readonly policyVersion: string;
  readonly purposeCommitment: string;
  readonly consentReference: string;
  readonly expirationReference: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'EVIDENCE_ANCHOR',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: 'INFORMATION_RIGHT_STATE',
      rightCommitment: fields.rightCommitment,
      status: fields.status,
      policyVersion: fields.policyVersion,
      purposeCommitment: fields.purposeCommitment,
      consentReference: fields.consentReference,
      expirationReference: fields.expirationReference,
      transfersOwnership: false,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildPurposeGrantAnchorSchema(fields: {
  readonly grantReference: string;
  readonly purposeCommitment: string;
  readonly status: string;
  readonly policyVersion: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'EVIDENCE_ANCHOR',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      evidenceKind: 'PURPOSE_GRANT',
      grantReference: fields.grantReference,
      purposeCommitment: fields.purposeCommitment,
      status: fields.status,
      policyVersion: fields.policyVersion,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildUsageReceiptAnchorSchema(fields: {
  readonly receiptHash: string;
  readonly requesterReference: string;
  readonly purpose: string;
  readonly privacyPolicyVersion: string;
  readonly resultCommitment: string;
  readonly timestamp: string;
  readonly hasComputation: boolean;
  readonly outputClass: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = fields.hasComputation
    ? {
        recordType: 'COMPUTATION_RECEIPT',
        dataClass: 'ON_CHAIN_SAFE',
        fields: {
          receiptHash: fields.receiptHash,
          requesterReference: fields.requesterReference,
          purpose: fields.purpose,
          privacyPolicyVersion: fields.privacyPolicyVersion,
          resultCommitment: fields.resultCommitment,
          timestamp: fields.timestamp,
        },
      }
    : {
        recordType: 'EVIDENCE_ANCHOR',
        dataClass: 'ON_CHAIN_SAFE',
        fields: {
          evidenceKind: 'USAGE_RECEIPT',
          receiptHash: fields.receiptHash,
          requesterReference: fields.requesterReference,
          purposeCommitment: fields.purpose,
          privacyPolicyVersion: fields.privacyPolicyVersion,
          resultCommitment: fields.resultCommitment,
          outputClass: fields.outputClass,
          timestamp: fields.timestamp,
        },
      };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildComputationAnchorSchema(fields: {
  readonly receiptHash: string;
  readonly requesterReference: string;
  readonly purpose: string;
  readonly privacyPolicyVersion: string;
  readonly resultCommitment: string;
  readonly timestamp: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'COMPUTATION_RECEIPT',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      receiptHash: fields.receiptHash,
      requesterReference: fields.requesterReference,
      purpose: fields.purpose,
      privacyPolicyVersion: fields.privacyPolicyVersion,
      resultCommitment: fields.resultCommitment,
      timestamp: fields.timestamp,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildProvenanceAnchorSchema(fields: {
  readonly sourceCommitment: string;
  readonly transformationReference: string;
  readonly authorizationReference: string;
  readonly outputCommitment: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'PROVENANCE',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      sourceCommitment: fields.sourceCommitment,
      transformationReference: fields.transformationReference,
      authorizationReference: fields.authorizationReference,
      outputCommitment: fields.outputCommitment,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildContributionProofAnchorSchema(fields: {
  readonly contributionCommitment: string;
  readonly subjectReference: string;
  readonly purpose: string;
  readonly receiptReference: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'PROOF_OF_CONTRIBUTION',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      contributionCommitment: fields.contributionCommitment,
      subjectReference: fields.subjectReference,
      purpose: fields.purpose,
      receiptReference: fields.receiptReference,
      doesNotMint: true,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}

export function buildSettlementReferenceAnchorSchema(fields: {
  readonly journalId: string;
  readonly transferId: string;
  readonly assetCommitment: string;
}): Result<ChainRecordSchema, HinAnchorFailure> {
  const schema: ChainRecordSchema = {
    recordType: 'DIGITAL_ASSET_SETTLEMENT',
    dataClass: 'ON_CHAIN_SAFE',
    fields: {
      journalId: fields.journalId,
      transferId: fields.transferId,
      assetCommitment: fields.assetCommitment,
      authoritativeLedger: 'canonical-internal-ledger',
      chainBalanceAuthoritative: false,
    },
  };
  const checked = classifyHinSchema(schema);
  return checked.ok ? ok(schema) : checked;
}
