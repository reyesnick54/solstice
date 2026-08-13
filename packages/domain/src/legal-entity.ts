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

export const LEGAL_ENTITY_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export type LegalEntityStatus = (typeof LEGAL_ENTITY_STATUSES)[number];

/**
 * Named legal entity that owns customer relationships in a jurisdiction.
 * Added without changing LegalEntityId.
 */
export type LegalEntity = {
  readonly id: LegalEntityId;
  readonly name: string;
  readonly jurisdiction: Jurisdiction;
  readonly status: LegalEntityStatus;
};

export function freezeLegalEntity(entity: LegalEntity): LegalEntity {
  return Object.freeze({
    id: entity.id,
    name: entity.name,
    jurisdiction: entity.jurisdiction,
    status: entity.status,
  });
}
