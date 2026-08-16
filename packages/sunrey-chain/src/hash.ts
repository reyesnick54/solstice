import { canonicalJson } from '../../evidence/src/vault.ts';
import { sha256Hex } from '../../security/src/hash.ts';
import type { ChainRecordSchema, ScopedSubjectReference } from './types.ts';

export function commitCanonical(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function commitRecordSchema(schema: ChainRecordSchema): string {
  return commitCanonical({
    recordType: schema.recordType,
    dataClass: schema.dataClass,
    fields: schema.fields,
  });
}

export function scopedSubjectCommitment(input: {
  readonly kind: ScopedSubjectReference['kind'];
  readonly rawSubjectId: string;
  readonly recipientContext: string;
  readonly purpose: string;
  readonly jurisdictionCell: string;
  readonly keyVersion: number;
}): string {
  return commitCanonical({
    kind: input.kind,
    rawSubjectId: input.rawSubjectId,
    recipientContext: input.recipientContext,
    purpose: input.purpose,
    jurisdictionCell: input.jurisdictionCell,
    keyVersion: input.keyVersion,
  });
}
