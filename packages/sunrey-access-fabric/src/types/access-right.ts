import type { UtcInstant } from '../../../domain/src/time.ts';

/** ACCESS-09. A scoped entitlement to consume a provider resource. */
export const ACCESS_RIGHT_STATES = ['ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'] as const;
export type AccessRightState = (typeof ACCESS_RIGHT_STATES)[number];

export const ACCESS_RESOURCE_KINDS = [
  'TRANSPORTATION',
  'LODGING',
  'MOBILITY',
  'VEHICLE_CAPACITY',
  'FOOD_ACCESS',
  'EXPERIENCE',
  'RECURRING_SUBSCRIPTION',
] as const;
export type AccessResourceKind = (typeof ACCESS_RESOURCE_KINDS)[number];

export type AccessRight = {
  readonly accessRightId: string;
  readonly subjectRef: string;
  readonly providerId: string;
  readonly resourceKind: AccessResourceKind;
  readonly scope: Readonly<Record<string, string>>;
  readonly state: AccessRightState;
  readonly consumptionLimit: number | null;
  readonly consumedUnits: number;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly evidenceId: string | null;
};

export function freezeAccessRight(row: AccessRight): AccessRight {
  if (row.consumedUnits < 0) {
    throw new Error('consumedUnits cannot be negative');
  }
  if (row.consumptionLimit !== null && row.consumedUnits > row.consumptionLimit) {
    throw new Error('consumedUnits exceeds consumptionLimit');
  }
  return Object.freeze({ ...row, scope: Object.freeze({ ...row.scope }) });
}
