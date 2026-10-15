/**
 * Local EKG-aligned identifiers for HELIOS AAF03 (no cross-package deep import).
 * Materialization matches packages/economic-asset-registry knowledge-graph ids.ts.
 */

import { createHash } from 'node:crypto';

export const HELIOS_EKG_ISSUER_MATERIAL_PREFIX = 'helios:market:issuer:' as const;

/** Matches Economic Knowledge Graph `ekg_ent_*` canonical entity ids. */
export type EconomicKnowledgeCanonicalEntityId = string & {
  readonly __economicKnowledgeCanonicalEntityId?: unique symbol;
};

export type HeliosExternalIdentifier = {
  readonly system: string;
  readonly id: string;
  readonly authorityClass: 'AUTHORITATIVE' | 'PROVIDER' | 'DERIVED' | 'INFERRED';
};

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

export function heliosIssuerCanonicalEntityId(issuerKey: string): EconomicKnowledgeCanonicalEntityId {
  const normalized = issuerKey.trim().toLowerCase().replace(/\s+/g, '_');
  const material = `${HELIOS_EKG_ISSUER_MATERIAL_PREFIX}${normalized}`;
  return `ekg_ent_${digest(material)}` as EconomicKnowledgeCanonicalEntityId;
}

export function heliosExternalIdentifier(
  system: string,
  id: string,
  authorityClass: HeliosExternalIdentifier['authorityClass'] = 'PROVIDER',
): HeliosExternalIdentifier {
  return Object.freeze({ system, id, authorityClass });
}
