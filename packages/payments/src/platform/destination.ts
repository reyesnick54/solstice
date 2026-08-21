/**
 * Future destination taxonomy for beneficiaries.
 * PERSON/BUSINESS remain the legal kind. Destination type is where funds go.
 */

export const BENEFICIARY_DESTINATION_TYPES = [
  'SUNREY_USER',
  'DOMESTIC_BANK',
  'INTERNATIONAL_BANK',
  'WALLET',
] as const;
export type BeneficiaryDestinationType = (typeof BENEFICIARY_DESTINATION_TYPES)[number];

export const DESTINATION_COORDINATE_SCHEMES = [
  'SUNREY_ACCOUNT',
  'WALLET_REF',
  'SA_IBAN',
  'US_ABA',
  'GB_SORT',
  'AE_IBAN',
  'IBAN',
] as const;
export type DestinationCoordinateScheme = (typeof DESTINATION_COORDINATE_SCHEMES)[number];

export function destinationTypeFromScheme(
  scheme: string,
  ownerCountry: string,
  destinationCountry: string,
): BeneficiaryDestinationType {
  if (scheme === 'SUNREY_ACCOUNT') {
    return 'SUNREY_USER';
  }
  if (scheme === 'WALLET_REF') {
    return 'WALLET';
  }
  return ownerCountry === destinationCountry ? 'DOMESTIC_BANK' : 'INTERNATIONAL_BANK';
}

export function isSunReyDestination(type: BeneficiaryDestinationType): boolean {
  return type === 'SUNREY_USER';
}

export function isExternalRailDestination(type: BeneficiaryDestinationType): boolean {
  return type === 'DOMESTIC_BANK' || type === 'INTERNATIONAL_BANK' || type === 'WALLET';
}

/** Ledger destinations: same-owner cash vs another SunRey customer. */
export function ledgerDestinationType(sameOwner: boolean): 'OWN_ACCOUNT' | 'SUNREY_USER' {
  return sameOwner ? 'OWN_ACCOUNT' : 'SUNREY_USER';
}
