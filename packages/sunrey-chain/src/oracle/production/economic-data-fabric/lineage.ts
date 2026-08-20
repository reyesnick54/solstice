/**
 * Cross-domain lineage. Lineage is not ownership transfer.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import type { CrossDomainLineageLink, EconomicDataCollectionEnvelope, ProviderFamilyId } from './types.ts';

const LINEAGE_RELATIONS: Readonly<
  Record<string, CrossDomainLineageLink['relation']>
> = Object.freeze({
  'ENERGY>MANUFACTURING': 'ENERGY_INPUT',
  'WATER>AGRICULTURE_FOOD': 'WATER_IRRIGATION_INPUT',
  'MINERALS_RESOURCES>MANUFACTURING': 'RESOURCE_INPUT',
  'AGRICULTURE_FOOD>GOODS': 'FOOD_PROCESSING_INPUT',
  'MANUFACTURING>GOODS': 'GOODS_BATCH',
  'GOODS>LOGISTICS': 'LOGISTICS_SHIPMENT',
  'LOGISTICS>STORAGE': 'WAREHOUSE_STORAGE',
  'COMPUTE>AI_COMPUTE': 'AI_SERVICE_EXECUTION',
  'AI_COMPUTE>SERVICES': 'AI_SERVICE_EXECUTION',
});

export function lineageRelation(
  fromFamilyId: ProviderFamilyId,
  toFamilyId: ProviderFamilyId,
): CrossDomainLineageLink['relation'] | null {
  return LINEAGE_RELATIONS[`${fromFamilyId}>${toFamilyId}`] ?? null;
}

export function linkLineage(
  from: EconomicDataCollectionEnvelope,
  to: EconomicDataCollectionEnvelope,
): CrossDomainLineageLink | null {
  const relation = lineageRelation(from.familyId, to.familyId);
  if (!relation) {
    return null;
  }
  return Object.freeze({
    linkId: sha256Hex(`edf.lineage.v1:${from.envelopeId}:${to.envelopeId}:${relation}`),
    fromFamilyId: from.familyId,
    toFamilyId: to.familyId,
    fromEnvelopeId: from.envelopeId,
    toEnvelopeId: to.envelopeId,
    relation,
    ownershipTransferred: false,
  });
}

export function collectLineage(
  envelopes: readonly EconomicDataCollectionEnvelope[],
): readonly CrossDomainLineageLink[] {
  const links: CrossDomainLineageLink[] = [];
  for (let i = 0; i < envelopes.length; i += 1) {
    for (let j = 0; j < envelopes.length; j += 1) {
      if (i === j) {
        continue;
      }
      const link = linkLineage(envelopes[i]!, envelopes[j]!);
      if (link) {
        links.push(link);
      }
    }
  }
  return Object.freeze(links);
}
