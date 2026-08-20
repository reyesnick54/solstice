import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { familyForFactType, familyForSourceCategory } from '../economic-data-fabric/routing.ts';
import type { ProviderFamilyId } from '../economic-data-fabric/types.ts';
import {
  candidateRejection,
  type ExternalProviderFeedProfile,
  type ProviderCandidateRejection,
  type ProviderFamilyRoute,
} from './types.ts';

const ROUTE_TO_FAMILY: Readonly<Record<ProviderFamilyRoute, ProviderFamilyId>> = Object.freeze({
  energy: 'ENERGY',
  compute: 'COMPUTE',
  ai: 'AI_COMPUTE',
  manufacturing: 'MANUFACTURING',
  logistics: 'LOGISTICS',
  storage: 'STORAGE',
  resources: 'MINERALS_RESOURCES',
  agriculture: 'AGRICULTURE_FOOD',
  food: 'AGRICULTURE_FOOD',
  water: 'WATER',
  'real-estate': 'REAL_ESTATE',
  infrastructure: 'INFRASTRUCTURE',
  bandwidth: 'BANDWIDTH',
  goods: 'GOODS',
  services: 'SERVICES',
  'reference-data': 'REFERENCE_DATA',
});

export function familyForRoute(route: ProviderFamilyRoute): ProviderFamilyId {
  return ROUTE_TO_FAMILY[route];
}

export function routeFamily(
  feed: Pick<ExternalProviderFeedProfile, 'familyRoute' | 'dataSourceCategory' | 'factType' | 'isReferencePrice'>,
): Result<ProviderFamilyId, ProviderCandidateRejection> {
  const byRoute = familyForRoute(feed.familyRoute);
  if (feed.isReferencePrice || feed.factType === 'REFERENCE_PRICE') {
    if (byRoute !== 'REFERENCE_DATA') {
      return err(candidateRejection('REFERENCE_PRICE_IS_NOT_PRODUCTIVE', 'reference price must route to reference-data'));
    }
    return ok('REFERENCE_DATA');
  }
  const bySource = familyForSourceCategory(feed.dataSourceCategory);
  const byFact = familyForFactType(feed.factType);
  if (!byFact) {
    return err(candidateRejection('FAMILY_ROUTING_INVALID', `fact type ${feed.factType} has no family`));
  }
  if (bySource !== byFact) {
    return err(
      candidateRejection(
        'FAMILY_ROUTING_INVALID',
        `source category ${feed.dataSourceCategory} and fact ${feed.factType} disagree`,
      ),
    );
  }
  if (byRoute !== bySource) {
    return err(
      candidateRejection('FAMILY_ROUTING_INVALID', `route ${feed.familyRoute} does not match taxonomy family ${bySource}`),
    );
  }
  return ok(byRoute);
}

export function referencePriceCannotCreateProductiveOutput(feed: ExternalProviderFeedProfile): boolean {
  return feed.isReferencePrice || feed.factType === 'REFERENCE_PRICE';
}
