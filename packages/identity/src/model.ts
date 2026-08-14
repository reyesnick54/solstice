import type { CustomerId } from '../../domain/src/customer.ts';
import type { Jurisdiction, Residency } from '../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { BusinessIdentityId, SolsticeIdentityId } from './ids.ts';

export const IDENTITY_STATUSES = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
  'CLOSED',
] as const;

export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

export const IDENTITY_KINDS = ['PERSON', 'BUSINESS'] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];

export const ATTRIBUTE_PROVENANCE = [
  'UNDECLARED',
  'SELF_ASSERTED',
  'PROVIDER_VERIFIED',
  'EXPIRED',
] as const;

export type AttributeProvenance = (typeof ATTRIBUTE_PROVENANCE)[number];

export type AttributeRef = {
  readonly status: AttributeProvenance;
  readonly reference: string | null;
  readonly verifiedAt: UtcInstant | null;
};

export function undeclaredAttribute(): AttributeRef {
  return Object.freeze({ status: 'UNDECLARED', reference: null, verifiedAt: null });
}

/**
 * Personal attributes held as provenance and opaque references.
 * Raw legal names, dates of birth, and document images are not stored here.
 */
export type PersonalIdentityAttributes = {
  readonly legalName: AttributeRef;
  readonly dateOfBirth: AttributeRef;
  readonly residency: Residency | null;
  readonly citizenships: readonly string[];
  readonly taxResidences: readonly string[];
  readonly country: string | null;
  readonly address: AttributeRef;
  readonly identityDocument: AttributeRef;
};

export function emptyPersonalAttributes(): PersonalIdentityAttributes {
  return Object.freeze({
    legalName: undeclaredAttribute(),
    dateOfBirth: undeclaredAttribute(),
    residency: null,
    citizenships: Object.freeze([]),
    taxResidences: Object.freeze([]),
    country: null,
    address: undeclaredAttribute(),
    identityDocument: undeclaredAttribute(),
  });
}

export type PersonIdentity = {
  readonly id: SolsticeIdentityId;
  readonly kind: 'PERSON';
  readonly status: IdentityStatus;
  readonly homeJurisdiction: Jurisdiction;
  readonly attributes: PersonalIdentityAttributes;
  readonly customerId: CustomerId | null;
  readonly createdAt: UtcInstant;
  readonly version: number;
};

export type BusinessRepresentativeRef = {
  readonly identityId: SolsticeIdentityId;
  readonly role: 'AUTHORIZED_REPRESENTATIVE' | 'CONTROL_PERSON';
};

export type BusinessIdentity = {
  readonly id: BusinessIdentityId;
  readonly subjectId: SolsticeIdentityId;
  readonly kind: 'BUSINESS';
  readonly legalNameRef: string;
  readonly registrationRef: string | null;
  readonly jurisdiction: Jurisdiction;
  readonly businessStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISSOLVED';
  readonly authorizedRepresentatives: readonly BusinessRepresentativeRef[];
  readonly beneficialOwnerRefs: readonly string[];
  readonly controlPersonRefs: readonly string[];
  readonly verificationState: AttributeProvenance;
  readonly createdAt: UtcInstant;
  readonly version: number;
};

export type IdentitySubject = PersonIdentity | (PersonIdentity & { readonly business: BusinessIdentity });

export function isUsableIdentityStatus(status: IdentityStatus): boolean {
  return status === 'ACTIVE';
}

export function isBlockedIdentityStatus(status: IdentityStatus): boolean {
  return status === 'SUSPENDED' || status === 'LOCKED' || status === 'CLOSED';
}
