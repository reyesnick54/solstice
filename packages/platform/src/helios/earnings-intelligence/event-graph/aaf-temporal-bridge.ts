/**
 * Bridge earnings events to AAF V2 temporal entity resolution (issuer binding).
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsExternalObservation } from '@solstice/external-data';
import { HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA } from '../../feature-fabric/entity-resolution/types.ts';

export const HELIOS_EARNINGS_TEMPORAL_ENTITY_BRIDGE_ID =
  'sunrey.helios.earnings-temporal-entity-bridge.v1' as const;

export type EarningsTemporalEntityBinding = {
  readonly bridgeId: typeof HELIOS_EARNINGS_TEMPORAL_ENTITY_BRIDGE_ID;
  readonly temporalGraphSchema: typeof HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA;
  readonly canonicalEntityId: string;
  readonly earningsEventKey: string;
  readonly boundAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export function bindEarningsEventToTemporalEntity(
  observation: Pick<EarningsExternalObservation, 'canonicalEntityId' | 'earningsEventKey' | 'times'>,
  boundAt: UtcInstant = observation.times.knowableAt,
): EarningsTemporalEntityBinding {
  return Object.freeze({
    bridgeId: HELIOS_EARNINGS_TEMPORAL_ENTITY_BRIDGE_ID,
    temporalGraphSchema: HELIOS_TEMPORAL_ENTITY_GRAPH_SCHEMA,
    canonicalEntityId: observation.canonicalEntityId,
    earningsEventKey: observation.earningsEventKey,
    boundAt,
    grantsExecutionAuthority: false,
  });
}
