import type { PersonalDataCategory } from '@solstice/kernel';
import { assertSyntheticProvenance, asSyntheticLabel, type SyntheticLabel } from '../provenance.ts';

/**
 * Classified vault write. Unclassified data cannot be stored.
 * Attributes are integer or string tokens only — never floating-point money.
 * The record is branded SYNTHETIC at the type level.
 */
export type ClassifiedAttributeValue = string | bigint;

export type ClassifiedAttributes = Readonly<Record<string, ClassifiedAttributeValue>>;

export type ClassifiedSyntheticRecord = {
  readonly recordId: string;
  readonly subjectRef: string;
  readonly category: PersonalDataCategory;
  readonly attributes: ClassifiedAttributes;
  readonly classifiedAt: string;
} & SyntheticLabel;

export type UnclassifiedWrite = {
  readonly recordId?: string;
  readonly subjectRef?: string;
  readonly category?: unknown;
  readonly attributes?: unknown;
  readonly provenance?: unknown;
};

export function classifySyntheticWrite(input: {
  readonly recordId: string;
  readonly subjectRef: string;
  readonly category: PersonalDataCategory;
  readonly attributes: ClassifiedAttributes;
  readonly classifiedAt: string;
  readonly provenance: 'SYNTHETIC';
}): ClassifiedSyntheticRecord {
  assertSyntheticProvenance(input);
  if (input.recordId.length === 0 || input.subjectRef.length === 0) {
    throw new Error('classified write requires recordId and subjectRef');
  }
  const attrs: Record<string, ClassifiedAttributeValue> = {};
  for (const [key, value] of Object.entries(input.attributes)) {
    if (typeof value === 'number') {
      throw new Error('floating-point attribute values are forbidden on vault writes');
    }
    attrs[key] = value;
  }
  return Object.freeze({
    recordId: input.recordId,
    subjectRef: input.subjectRef,
    category: input.category,
    attributes: Object.freeze({ ...attrs }),
    classifiedAt: input.classifiedAt,
    ...asSyntheticLabel(),
  });
}

export function rejectUnclassified(input: UnclassifiedWrite): never {
  throw new Error(
    `unclassified data cannot be stored: missing or invalid classification (${JSON.stringify({
      hasCategory: input.category !== undefined,
      hasProvenance: input.provenance !== undefined,
      hasAttributes: input.attributes !== undefined,
    })})`,
  );
}
