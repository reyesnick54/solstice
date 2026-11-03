/**
 * Bridge metadata for HELIOS AAF03 temporal entity resolution.
 *
 * Reuses Economic Knowledge Graph canonical entity IDs for organizations and issuers.
 * Does not create a second identity authority — customer identity remains packages/identity.
 */

import type { CanonicalEntityId } from './ids.ts';
import { canonicalEntityIdFor } from './ids.ts';
import type { ExternalIdentifier } from './types.ts';

export const HELIOS_TEMPORAL_ENTITY_BRIDGE_ID = 'sunrey.helios.temporal-entity-resolution-bridge.v1' as const;

/** Material prefix for issuer / legal-entity nodes linked into the EKG alias plane. */
export const HELIOS_EKG_ISSUER_MATERIAL_PREFIX = 'helios:market:issuer:' as const;

export function heliosIssuerCanonicalEntityId(issuerKey: string): CanonicalEntityId {
  const normalized = issuerKey.trim().toLowerCase().replace(/\s+/g, '_');
  return canonicalEntityIdFor(`${HELIOS_EKG_ISSUER_MATERIAL_PREFIX}${normalized}`);
}

export function heliosExternalIdentifier(
  system: string,
  id: string,
  authorityClass: ExternalIdentifier['authorityClass'] = 'PROVIDER',
): ExternalIdentifier {
  return Object.freeze({
    system,
    id,
    authorityClass,
  });
}
