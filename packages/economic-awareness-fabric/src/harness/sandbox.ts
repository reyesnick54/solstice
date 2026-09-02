/**
 * Safe development harness for Wave 4 fabric testing.
 * Fixture/sandbox providers only — no live API reliance.
 */

import { buildExternalObservation } from '../../../provider-sdk/src/observation.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import type { FabricConnector, ConnectorRequest, ConnectorResult } from '../connectors/executor.ts';
import type { FabricProviderRegistration } from '../providers/registry.ts';
import { InMemoryFabricProviderRegistry } from '../providers/registry.ts';
import { InMemoryConnectorExecutor } from '../connectors/executor.ts';
import { createIngestionPipeline } from '../ingestion/pipeline.ts';
import { normalizeToEnvelope } from '../normalization/envelope.ts';
import { createFabricEventRouter } from '../events/router.ts';
import { createProvenanceChain } from '../provenance/chain.ts';
import { createFederatedQueryEngine } from '../federation/query.ts';
import { createEconomicGraphProjection } from '../graph/projection.ts';
import { createSourceReputationStore } from '../reputation/scores.ts';
import type { ProviderTrustState } from '../authority/fail-closed.ts';
import type { CanonicalObservationEnvelope } from '../normalization/envelope.ts';

export type SandboxHarness = {
  readonly registry: InMemoryFabricProviderRegistry;
  readonly connectors: InMemoryConnectorExecutor;
  readonly events: ReturnType<typeof createFabricEventRouter>;
  readonly provenance: ReturnType<typeof createProvenanceChain>;
  readonly federation: ReturnType<typeof createFederatedQueryEngine>;
  readonly graph: ReturnType<typeof createEconomicGraphProjection>;
  readonly reputation: ReturnType<typeof createSourceReputationStore>;
  readonly envelopes: Map<string, CanonicalObservationEnvelope>;
  registerFixtureProvider(registration: FabricProviderRegistration, payload: unknown): void;
  ingestFixture(providerId: string, capability: string, payload: unknown, trust?: ProviderTrustState): Promise<{
    ok: boolean;
    envelope?: CanonicalObservationEnvelope;
    error?: string;
  }>;
};

export function createSandboxHarness(): SandboxHarness {
  const registry = new InMemoryFabricProviderRegistry();
  const connectors = new InMemoryConnectorExecutor();
  const events = createFabricEventRouter();
  const provenance = createProvenanceChain();
  const federation = createFederatedQueryEngine();
  const graph = createEconomicGraphProjection();
  const reputation = createSourceReputationStore();
  const envelopes = new Map<string, CanonicalObservationEnvelope>();
  const ingestion = createIngestionPipeline();
  const fixturePayloads = new Map<string, unknown>();

  function registerFixtureProvider(registration: FabricProviderRegistration, payload: unknown): void {
    registry.register(registration);
    fixturePayloads.set(registration.providerId, payload);

    const connector: FabricConnector = {
      connectorId: registration.connectorId,
      providerId: registration.providerId,
      mode: 'fixture',
      async execute(request: ConnectorRequest): Promise<ConnectorResult> {
        const data = fixturePayloads.get(request.providerId) ?? { fixture: true };
        const built = buildExternalObservation({
          providerId: request.providerId,
          providerCategory: 'macroeconomics',
          capability: request.capability,
          data,
          source: { provider: request.providerId, dataset: request.capability },
          time: { retrievedAt: asUtcInstant('2026-01-01T00:00:00.000Z') },
          authorityClass: 'reference_data',
          provenance: {
            rawPayload: JSON.stringify(data),
            providerSchemaVersion: '1.0.0',
          },
        });
        if (!built.ok) {
          return { ok: false, code: built.code, message: built.message };
        }
        return { ok: true, observation: built.value, mode: 'fixture' };
      },
    };
    connectors.register(connector);
  }

  async function ingestFixture(
    providerId: string,
    capability: string,
    payload: unknown,
    trust: ProviderTrustState = 'catalog_registered',
  ) {
    const registration = registry.get(providerId);
    if (!registration) {
      return { ok: false, error: `unknown provider: ${providerId}` };
    }

    const connectorResult = await connectors.execute(
      { providerId, capability, parameters: {}, requestId: `req_${providerId}` },
      registration,
    );

    const ingested = ingestion.ingest(connectorResult, registration, trust);
    if (!ingested.ok) {
      reputation.recordFailure(providerId, '2026-01-01T00:00:00.000Z', ingested.message);
      return { ok: false, error: ingested.message };
    }

    const envelope = normalizeToEnvelope({
      envelopeId: `env_${ingested.ingestionId}`,
      providerId,
      economicDomain: registration.economicDomain,
      sourceClass: registration.sourceClass,
      capability,
      payload,
      rawPayload: JSON.stringify(payload),
      retrievedAtUtc: '2026-01-01T00:00:00.000Z',
    });

    envelopes.set(envelope.envelopeId, envelope);
    provenance.append({
      provenanceId: `prov_${envelope.envelopeId}`,
      sourceId: providerId,
      method: 'fixture-ingest',
      collectedAtUtc: '2026-01-01T00:00:00.000Z',
      parentProvenanceId: null,
    });

    graph.addNode({
      nodeId: envelope.envelopeId,
      kind: 'observation',
      ref: envelope.envelopeId,
      economicDomain: registration.economicDomain,
      committedAtUtc: '2026-01-01T00:00:00.000Z',
    });

    events.publish({
      eventId: `evt_${envelope.envelopeId}`,
      kind: 'provider.ingested',
      occurredAtUtc: '2026-01-01T00:00:00.000Z',
      correlationId: ingested.ingestionId,
      payloadDigest: envelope.provenanceDigest,
      economicDomain: registration.economicDomain,
    });

    reputation.recordSuccess(providerId, '2026-01-01T00:00:00.000Z');
    return { ok: true, envelope };
  }

  return Object.freeze({
    registry,
    connectors,
    events,
    provenance,
    federation,
    graph,
    reputation,
    envelopes,
    registerFixtureProvider,
    ingestFixture,
  });
}

export const FIXTURE_ENERGY_PROVIDER: FabricProviderRegistration = Object.freeze({
  providerId: 'eia-fixture',
  displayName: 'EIA Fixture',
  category: 'energy',
  economicDomain: 'energy',
  sourceClass: 'GRID_METER',
  trustTier: 'catalog_registered',
  connectorId: 'fixture',
  normalizationSchema: 'sunrey.fabric.observation-envelope.v1',
  licensingRequired: true,
  active: true,
  simulationOnly: true as const,
});

export const FIXTURE_MACRO_PROVIDER: FabricProviderRegistration = Object.freeze({
  providerId: 'fred-fixture',
  displayName: 'FRED Fixture',
  category: 'macroeconomics',
  economicDomain: 'macroeconomics',
  sourceClass: 'MACRO_INDICATOR',
  trustTier: 'catalog_registered',
  connectorId: 'fixture',
  normalizationSchema: 'sunrey.fabric.observation-envelope.v1',
  licensingRequired: true,
  active: true,
  simulationOnly: true as const,
});
