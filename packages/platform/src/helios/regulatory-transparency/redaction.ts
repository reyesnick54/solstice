import { sha256Hex } from '../../../../security/src/hash.ts';
import { REDACTION_RULE_VERSION } from './taxonomy.ts';
import type { ExportArtifact, RedactionRecord } from './types.ts';
import type { ArtifactClass } from './taxonomy.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
}

export function pseudonymizeCustomerId(customerId: string): string {
  return `pseudo_${sha256Hex(customerId).slice(0, 16)}`;
}

export function applyRedaction(
  artifactClass: ArtifactClass,
  payload: Readonly<Record<string, unknown>>,
  sourceEvidenceRef: string,
  identified: boolean,
): { readonly artifact: Readonly<Record<string, unknown>>; readonly redaction: RedactionRecord } {
  const clone = { ...payload };
  let transformation: RedactionRecord['exportTransformation'] = 'IDENTIFIED';

  if (!identified && (artifactClass === 'CUSTOMER_ACCOUNT' || 'customerId' in clone)) {
    if (typeof clone.customerId === 'string') {
      clone.customerId = pseudonymizeCustomerId(clone.customerId);
    }
    if (typeof clone.accountId === 'string' && clone.accountId.includes('@')) {
      clone.accountId = pseudonymizeCustomerId(clone.accountId);
    }
    transformation = 'PSEUDONYMIZED';
  }

  if ('rawSecret' in clone || 'privateKey' in clone) {
    delete clone.rawSecret;
    delete clone.privateKey;
    if (transformation === 'IDENTIFIED') {
      transformation = 'REDACTED';
    }
  }

  const artifactHash = sha256Hex(canonicalJson(clone));
  const redaction: RedactionRecord = Object.freeze({
    originalEvidenceRef: sourceEvidenceRef,
    exportTransformation: transformation,
    redactionRuleVersion: REDACTION_RULE_VERSION,
    artifactHash,
  });

  return Object.freeze({ artifact: Object.freeze(clone), redaction });
}

export function buildExportArtifact(
  artifactClass: ArtifactClass,
  payload: Readonly<Record<string, unknown>>,
  sourceEvidenceRef: string,
  identified: boolean,
): ExportArtifact {
  const { artifact, redaction } = applyRedaction(artifactClass, payload, sourceEvidenceRef, identified);
  return Object.freeze({
    artifactClass,
    contentHash: redaction.artifactHash,
    sourceEvidenceRefs: Object.freeze([sourceEvidenceRef]),
    redaction,
    payload: artifact,
  });
}
