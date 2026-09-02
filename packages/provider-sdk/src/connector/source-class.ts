/**
 * Wave 4 — economic information source classes for Information Consensus independence.
 *
 * Source independence is not inferred from provider name alone. Two different
 * providerIds may share the same upstream dataset (see lineage registry).
 */

export const ECONOMIC_SOURCE_CLASSES = [
  'GOVERNMENT',
  'PRIMARY_OPERATOR',
  'DIRECT_SENSOR',
  'ENTERPRISE_SYSTEM',
  'ACADEMIC',
  'RESEARCH_DATABASE',
  'SATELLITE',
  'PUBLIC_DATASET',
  'AGGREGATOR',
  'DERIVED_MODEL',
  'MARKET',
  'USER_ATTESTATION',
  'THIRD_PARTY_ATTESTATION',
] as const;

export type EconomicSourceClass = (typeof ECONOMIC_SOURCE_CLASSES)[number];

/** Extensible custom source class — must be prefixed to avoid collision with canonical set. */
export const CUSTOM_SOURCE_CLASS_PREFIX = 'CUSTOM:' as const;

export type ExtensibleSourceClass = EconomicSourceClass | `${typeof CUSTOM_SOURCE_CLASS_PREFIX}${string}`;

export function isEconomicSourceClass(value: string): value is EconomicSourceClass {
  return (ECONOMIC_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isExtensibleSourceClass(value: string): value is ExtensibleSourceClass {
  return isEconomicSourceClass(value) || value.startsWith(CUSTOM_SOURCE_CLASS_PREFIX);
}

export function assertExtensibleSourceClass(value: string): ExtensibleSourceClass {
  if (!isExtensibleSourceClass(value)) {
    throw new TypeError(`invalid source class '${value}'`);
  }
  return value;
}

/** Default mapping hints from catalog authority_class — override per provider when known. */
export function defaultSourceClassForAuthority(
  authorityClass: string,
): EconomicSourceClass {
  switch (authorityClass) {
    case 'authoritative_official':
      return 'GOVERNMENT';
    case 'regulated_provider':
      return 'ENTERPRISE_SYSTEM';
    case 'research_data':
      return 'RESEARCH_DATABASE';
    case 'community_data':
      return 'PUBLIC_DATASET';
    case 'derived_data':
      return 'DERIVED_MODEL';
    case 'reference_data':
      return 'PUBLIC_DATASET';
    default:
      return 'AGGREGATOR';
  }
}
