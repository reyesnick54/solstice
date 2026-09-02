/**
 * Economic Awareness Fabric orchestrator.
 *
 * Federated-information-style processing between external sources and
 * Wave 3 economic proof. Does not mint or authorize monetary mutation.
 */

import { WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY } from './capability.ts';
import { capabilityBlocksMonetaryMutation } from './authority/information-authority.ts';
import { FAIL_CLOSED_RULES } from './authority/fail-closed.ts';
import type { FabricProviderRegistry } from './providers/registry.ts';
import { InMemoryFabricProviderRegistry } from './providers/registry.ts';
import type { ConnectorExecutor } from './connectors/executor.ts';
import { InMemoryConnectorExecutor } from './connectors/executor.ts';
import { createIngestionPipeline } from './ingestion/pipeline.ts';
import type { FabricEventRouter } from './events/router.ts';
import { createFabricEventRouter } from './events/router.ts';
import type { ProvenanceChain } from './provenance/chain.ts';
import { createProvenanceChain } from './provenance/chain.ts';
import type { FederatedQueryEngine } from './federation/query.ts';
import { createFederatedQueryEngine } from './federation/query.ts';
import type { EconomicGraphProjection } from './graph/projection.ts';
import { createEconomicGraphProjection } from './graph/projection.ts';
import type { SourceReputationStore } from './reputation/scores.ts';
import { createSourceReputationStore } from './reputation/scores.ts';
import type { CanonicalObservationEnvelope } from './normalization/envelope.ts';
import type { FabricConfig } from './config/loader.ts';
import { DEFAULT_FABRIC_CONFIG } from './config/defaults.ts';

export type EconomicAwarenessFabricPorts = {
  readonly providers: FabricProviderRegistry;
  readonly connectors: ConnectorExecutor;
  readonly events: FabricEventRouter;
  readonly provenance: ProvenanceChain;
  readonly federation: FederatedQueryEngine;
  readonly graph: EconomicGraphProjection;
  readonly reputation: SourceReputationStore;
  readonly envelopes: Map<string, CanonicalObservationEnvelope>;
};

export type EconomicAwarenessFabric = {
  readonly capability: typeof WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY;
  readonly config: FabricConfig;
  readonly ports: EconomicAwarenessFabricPorts;
  readonly authorityIntact: boolean;
  readonly failClosedRules: typeof FAIL_CLOSED_RULES;
};

export function createEconomicAwarenessFabric(
  config: FabricConfig = DEFAULT_FABRIC_CONFIG,
): EconomicAwarenessFabric {
  if (!capabilityBlocksMonetaryMutation()) {
    throw new Error('Economic Awareness Fabric capability must block monetary mutation');
  }

  const ports: EconomicAwarenessFabricPorts = Object.freeze({
    providers: new InMemoryFabricProviderRegistry(),
    connectors: new InMemoryConnectorExecutor(),
    events: createFabricEventRouter(),
    provenance: createProvenanceChain(),
    federation: createFederatedQueryEngine(),
    graph: createEconomicGraphProjection(),
    reputation: createSourceReputationStore(),
    envelopes: new Map(),
  });

  return Object.freeze({
    capability: WAVE4_ECONOMIC_AWARENESS_FABRIC_CAPABILITY,
    config,
    ports,
    authorityIntact: true,
    failClosedRules: FAIL_CLOSED_RULES,
  });
}
