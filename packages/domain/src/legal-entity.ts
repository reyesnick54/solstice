import { type Brand, brandAs } from './brand.ts';

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
