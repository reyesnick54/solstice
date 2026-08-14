import { type Brand, brandAs } from './brand.ts';
import type { Jurisdiction } from './jurisdiction.ts';

/**
 * Identifier of the named legal entity that a customer belongs to.
 * Solstice itself is never a legal actor; every customer is owned by an entity.
 */
export type LegalEntityId = Brand<string, 'LegalEntityId'>;

export function asLegalEntityId(value: string): LegalEntityId {
  if (value.length === 0) {
    throw new TypeError('LegalEntityId must be a non-empty string');
  }
  return brandAs<string, 'LegalEntityId'>(value);
}

/**
 * Named legal actor in a single jurisdiction. Customers and accounts bind
 * to this entity; Solstice is never the legal actor.
 */
export type LegalEntity = {
  readonly id: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
};

export type CreateLegalEntityInput = {
  readonly id: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
};

export function createLegalEntity(input: CreateLegalEntityInput): LegalEntity {
  return Object.freeze({
    id: input.id,
    jurisdiction: input.jurisdiction,
  });
}
