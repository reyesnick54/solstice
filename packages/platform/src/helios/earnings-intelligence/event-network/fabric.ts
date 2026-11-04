/**
 * EARN08 earnings event network fabric — temporal graph + peer diagnostics.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { computeEarningsAttentionState, type EarningsAttentionStateInput } from './attention-state.ts';
import { buildPEADConditionalState, type BuildPEADConditionalStateInput } from './pead-diagnostic.ts';
import { computePeerReadThrough, type PeerReadThroughInput } from './peer-read-through.ts';
import {
  createEarningsEventNetworkStore,
  type EarningsEventNetworkStore,
  type RegisterEarningsPeerRelationshipInput,
} from './relationship-store.ts';
import { decomposeExpectedReturn, buildOrthogonalizedResearchFeatures, type ReturnDecompositionInput } from './return-decomposition.ts';
import { HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA } from './taxonomy.ts';
import type {
  EarningsEventNetworkSnapshot,
  EarningsEventRecord,
  EarningsPeerRelationshipEdge,
  PeerReadThroughSnapshot,
} from './types.ts';

export type HeliosEarningsEventNetworkFabricOptions = {
  readonly entityGraph: TemporalEntityGraphStore;
  readonly networkStore?: EarningsEventNetworkStore;
};

export type HeliosEarningsEventNetworkFabric = {
  readonly entityGraph: TemporalEntityGraphStore;
  readonly networkStore: EarningsEventNetworkStore;
  readonly registerRelationship: (
    input: RegisterEarningsPeerRelationshipInput,
  ) => ReturnType<EarningsEventNetworkStore['registerRelationship']>;
  readonly ingestEvent: (event: EarningsEventRecord) => { readonly ok: true } | { readonly ok: false; readonly message: string };
  readonly listEvents: () => readonly EarningsEventRecord[];
  readonly peerReadThrough: (
    input: Omit<PeerReadThroughInput, 'allEvents' | 'relationships'>,
  ) => PeerReadThroughSnapshot;
  readonly attentionState: (input: Omit<EarningsAttentionStateInput, 'events'>) => ReturnType<typeof computeEarningsAttentionState>;
  readonly peadConditional: (
    input: Omit<BuildPEADConditionalStateInput, 'event'> & { readonly eventId: string },
  ) => ReturnType<typeof buildPEADConditionalState> | null;
  readonly decomposeReturn: (input: ReturnDecompositionInput) => ReturnType<typeof decomposeExpectedReturn>;
  readonly orthogonalResearchFeatures: (
    input: Parameters<typeof buildOrthogonalizedResearchFeatures>[0],
  ) => ReturnType<typeof buildOrthogonalizedResearchFeatures>;
  readonly snapshot: (sealedAt: UtcInstant) => EarningsEventNetworkSnapshot;
};

function digestEvents(events: readonly EarningsEventRecord[], relationships: readonly EarningsPeerRelationshipEdge[]): string {
  const material = JSON.stringify({
    events: events.map((e) => e.eventId).sort(),
    relationships: relationships.map((r) => r.edgeId).sort(),
  });
  return createHash('sha256').update(material).digest('hex');
}

export function createHeliosEarningsEventNetworkFabric(
  options: HeliosEarningsEventNetworkFabricOptions,
): HeliosEarningsEventNetworkFabric {
  const entityGraph = options.entityGraph;
  const networkStore = options.networkStore ?? createEarningsEventNetworkStore();
  const events: EarningsEventRecord[] = [];

  return Object.freeze({
    entityGraph,
    networkStore,
    registerRelationship(input) {
      return networkStore.registerRelationship(entityGraph, input);
    },
    ingestEvent(event) {
      if (event.schema !== HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA) {
        return { ok: false, message: 'invalid schema on earnings event' };
      }
      const node = entityGraph.getNode(event.securityNodeId);
      if (!node || node.kind !== 'SECURITY') {
        return { ok: false, message: 'securityNodeId must exist on temporal entity graph' };
      }
      if (events.some((e) => e.eventId === event.eventId)) {
        return { ok: false, message: 'duplicate eventId' };
      }
      events.push(Object.freeze({ ...event }));
      return { ok: true };
    },
    listEvents() {
      return Object.freeze([...events]);
    },
    peerReadThrough(input) {
      return computePeerReadThrough({
        ...input,
        allEvents: events,
        relationships: networkStore.listRelationships(),
      });
    },
    attentionState(input) {
      return computeEarningsAttentionState({ ...input, events });
    },
    peadConditional(input) {
      const event = events.find((e) => e.eventId === input.eventId);
      if (!event) return null;
      return buildPEADConditionalState({ ...input, event });
    },
    decomposeReturn(input) {
      return decomposeExpectedReturn(input);
    },
    orthogonalResearchFeatures(input) {
      return buildOrthogonalizedResearchFeatures(input);
    },
    snapshot(sealedAt) {
      const ev = Object.freeze([...events]);
      const rel = networkStore.snapshotRelationships();
      return Object.freeze({
        schemaVersion: HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA,
        sealedAt,
        events: ev,
        relationships: rel,
        contentDigest: digestEvents(ev, rel),
      });
    },
  });
}
