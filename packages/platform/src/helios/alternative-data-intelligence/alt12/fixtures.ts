/**
 * HELIOS ALT12 deterministic fixtures.
 */

import type { UtcInstant } from '@solstice/domain';
import type { AltModalityInput } from './types.ts';
import type { AltModalityId } from '../taxonomy.ts';

export const ALT12_FIXTURE_ENTITY_ID = 'helios-alt12-demo-issuer' as const;
export const ALT12_FIXTURE_AS_OF = '2024-09-30T16:00:00.000Z' as UtcInstant;

function modality(
  modalityId: AltModalityId,
  featureValue: number,
  providerId: string,
  trust = 0.82,
): AltModalityInput {
  return Object.freeze({
    modality: modalityId,
    featureValue,
    featureUncertainty: 0.12,
    evaluatedAt: ALT12_FIXTURE_AS_OF,
    providerId,
    missingReason: null,
    reliability: Object.freeze({
      trustScore: trust,
      coverageScore: 0.85,
      latencyScore: 0.9,
      calibrationScore: 0.8,
    }),
  });
}

export function alt12FullModalityInputs(): readonly AltModalityInput[] {
  return Object.freeze([
    modality('workforce', 0.42, 'fixture.jobs.v1'),
    modality('digital_demand', 0.55, 'fixture.search.v1'),
    modality('product_demand', 0.48, 'fixture.product.v1'),
    modality('logistics', 0.31, 'fixture.logistics.v1'),
    modality('satellite_geospatial', 0.37, 'fixture.satellite.v1'),
    modality('patents', 0.22, 'fixture.patents.v1'),
    modality('procurement', 0.28, 'fixture.procurement.v1'),
    modality('supply_chain_graph', 0.33, 'fixture.graph.v1'),
    modality('macro', 0.18, 'fixture.macro.v1'),
    modality('market', 0.61, 'fixture.market.v1'),
    modality('fundamentals', 0.52, 'fixture.fundamentals.v1'),
  ]);
}

export function alt12SparseModalityInputs(): readonly AltModalityInput[] {
  return Object.freeze([
    modality('market', 0.58, 'fixture.market.v1'),
    modality('fundamentals', 0.51, 'fixture.fundamentals.v1'),
    modality('macro', 0.2, 'fixture.macro.v1'),
    Object.freeze({
      modality: 'digital_demand' as const,
      featureValue: null,
      featureUncertainty: null,
      evaluatedAt: null,
      providerId: 'fixture.search.v1',
      missingReason: 'PROVIDER_OUTAGE' as const,
      reliability: Object.freeze({
        trustScore: 0.1,
        coverageScore: 0.1,
        latencyScore: 0.1,
        calibrationScore: 0.1,
      }),
    }),
  ]);
}
