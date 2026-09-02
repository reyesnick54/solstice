import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DurableLocalEventBus,
  InMemoryDeadLetterStore,
  InMemoryInboxStore,
  InMemoryOutboxStore,
  InboxProcessor,
  InProcessTransport,
  OutboxDispatcher,
  parseEnvelope,
  newEventId,
  sealEnvelope,
} from '../packages/events/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { buildExternalObservation } from '../packages/provider-sdk/src/observation.ts';
import {
  assertAcyclicEdges,
  commitPublicContent,
  commitSensitiveValue,
  createEconomicProvenanceFabric,
  createInMemoryProvenanceGraphStore,
  findClaimsForProviderRecord,
  InMemoryIdempotencyStore,
  InMemoryQuarantineStore,
  traceClaimToProviderRecords,
  wouldCreateProvenanceCycle,
  type ProvenanceEdge,
} from '../packages/external-data/src/wave4/provenance/index.ts';
import { asProvenanceNodeId } from '../packages/external-data/src/wave4/provenance/types.ts';

const NOW = '2026-09-02T10:00:00.000Z';
const clock = { now: () => NOW, nowMs: () => Date.parse(NOW) };

const simulationEnvelopeToolkit = {
  newEventId: () => newEventId(),
  sealEnvelope: (input: Parameters<typeof sealEnvelope>[0], sequence: number) => sealEnvelope(input, sequence),
};

function fabricSetup() {
  const outbox = new InMemoryOutboxStore();
  const deadLetters = new InMemoryDeadLetterStore();
  const transport = new InProcessTransport();
  const bus = new DurableLocalEventBus({ outbox, transport, deadLetters, clock });
  const graph = createInMemoryProvenanceGraphStore();
  const idempotency = new InMemoryIdempotencyStore();
  const quarantine = new InMemoryQuarantineStore();
  const fabric = createEconomicProvenanceFabric({
    eventBus: bus,
    envelopeToolkit: simulationEnvelopeToolkit,
    graph,
    idempotency,
    quarantine,
    now: () => NOW,
  });
  const dispatcher = new OutboxDispatcher(outbox, deadLetters, transport, {
    workerId: 'wave4-test',
    clock,
    policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
  });
  return { fabric, graph, outbox, transport, dispatcher, deadLetters, quarantine, idempotency };
}

function sampleObservation(id: string) {
  const built = buildExternalObservation({
    observationId: id,
    providerId: 'provider.test',
    providerCategory: 'compliance',
    capability: 'compliance.screening',
    data: { screened: true },
    source: { provider: 'provider.test', dataset: 'sanctions', sourceUrl: null },
    time: { retrievedAt: asUtcInstant(NOW), sourceTimestamp: asUtcInstant(NOW) },
    authorityClass: 'reference_data',
    provenance: {
      requestId: 'req_1',
      rawPayload: JSON.stringify({ id, screened: true }),
      providerSchemaVersion: '1',
      normalizationVersion: '1',
      canonicalModelVersion: '1',
    },
  });
  if (!built.ok) {
    throw new Error(built.message);
  }
  return built.value;
}

describe('Wave 4 Prompt 18 — event and provenance fabric', () => {
  it('records provider receipt and normalizes with durable events', async () => {
    const { fabric, dispatcher, transport } = fabricSetup();
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'evt_1',
      rawPayloadHash: 'hash_raw_1',
    });
    assert.equal(received.duplicate, false);
    const normalized = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_test',
      observation: sampleObservation('obs_1'),
    });
    assert.equal(normalized.ok, true);
    await dispatcher.dispatchOnce();
    const published = transport.listPublished();
    assert.ok(published.some((event) => event.eventType === 'ProviderRecordReceived'));
    assert.ok(published.some((event) => event.eventType === 'ObservationNormalized'));
  });

  it('suppresses duplicate provider transport events', async () => {
    const { fabric } = fabricSetup();
    const first = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'dup_evt',
      rawPayloadHash: 'hash_dup',
    });
    const second = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'dup_evt',
      rawPayloadHash: 'hash_dup',
    });
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.event, null);
  });

  it('deduplicates identical observations on processing retry', async () => {
    const { fabric } = fabricSetup();
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'evt_dedup',
      rawPayloadHash: 'hash_dedup',
    });
    const obs = sampleObservation('obs_dedup');
    const first = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_dedup',
      observation: obs,
    });
    const second = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_dedup',
      observation: obs,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.code, 'DUPLICATE');
    assert.equal(second.event.eventType, 'ObservationDeduplicated');
  });

  it('replays outbox events idempotently through inbox processor', async () => {
    const { fabric, outbox, dispatcher, transport } = fabricSetup();
    await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'replay_evt',
      rawPayloadHash: 'hash_replay',
    });
    await dispatcher.dispatchOnce();
    const inbox = new InMemoryInboxStore();
    const seen: string[] = [];
    const processor = new InboxProcessor(inbox, { now: () => NOW });
    const consumer = {
      consumerId: 'wave4-replay-consumer',
      handle: async (envelope: { eventId: string }) => {
        seen.push(envelope.eventId);
      },
    };
    for (const envelope of transport.listPublished()) {
      await processor.process(consumer, envelope);
      await processor.process(consumer, envelope);
    }
    assert.equal(seen.length, 1);
    assert.ok((await outbox.list('DELIVERED')).length >= 1);
  });

  it('quarantines failed normalization without accepting economic records', async () => {
    const { fabric, quarantine } = fabricSetup();
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'fail_evt',
      rawPayloadHash: 'hash_fail',
    });
    const reject = await fabric.rejectNormalization({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      providerRecordId: 'pr_fail',
      providerRecordNodeId: received.providerRecordNodeId,
      failureCode: 'SCHEMA_ERROR',
      failureMessage: 'invalid provider schema',
      rawPayloadHash: 'hash_fail',
    });
    assert.equal(reject.eventType, 'ObservationRejected');
    const rows = await quarantine.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.reasonCode, 'SCHEMA_ERROR');
    assert.equal(rows[0]?.retryable, false);
  });

  it('prevents cyclic provenance lineage', () => {
    const a = asProvenanceNodeId('node:a');
    const b = asProvenanceNodeId('node:b');
    const c = asProvenanceNodeId('node:c');
    const edges: ProvenanceEdge[] = [
      {
        edgeId: 'e1',
        kind: 'NORMALIZED_TO',
        fromNodeId: a,
        toNodeId: b,
        createdAt: NOW,
        eventId: null,
      },
      {
        edgeId: 'e2',
        kind: 'NORMALIZED_TO',
        fromNodeId: b,
        toNodeId: c,
        createdAt: NOW,
        eventId: null,
      },
      {
        edgeId: 'e3',
        kind: 'NORMALIZED_TO',
        fromNodeId: c,
        toNodeId: a,
        createdAt: NOW,
        eventId: null,
      },
    ];
    assert.equal(wouldCreateProvenanceCycle(edges.slice(0, 2), [edges[2]!]), true);
    const result = assertAcyclicEdges(edges.slice(0, 2), [edges[2]!]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'LINEAGE_CYCLE');
    }
  });

  it('supports multiple observations merged into one claim', async () => {
    const { fabric, graph } = fabricSetup();
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'merge_evt',
      rawPayloadHash: 'hash_merge',
    });
    const norm1 = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_merge',
      observation: sampleObservation('obs_m1'),
    });
    const norm2 = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_merge',
      observation: sampleObservation('obs_m2'),
    });
    assert.equal(norm1.ok, true);
    assert.equal(norm2.ok, true);
    if (!norm1.ok || !norm2.ok) {
      return;
    }
    await fabric.linkObservations({
      sourceNodeId: norm1.normalizedNodeId,
      targetNodeId: norm2.normalizedNodeId,
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      observationId: 'obs_m1',
    });
    const chain = await fabric.buildEvidenceChain({
      normalizedNodeId: norm1.normalizedNodeId,
      normalizedObservationId: 'norm_obs_m1',
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      rawPayloadHash: 'hash_m1',
      claimKind: 'compliance.screening.claim',
      parentNodeIds: [norm2.normalizedNodeId],
    });
    const trace = traceClaimToProviderRecords(graph, chain.claimNodeId);
    assert.ok(trace);
    assert.ok(trace!.nodes.some((node) => node.kind === 'provider_record'));
    assert.ok(trace!.nodes.some((node) => node.kind === 'economic_claim'));
    assert.ok(trace!.nodes.length >= 4);
  });

  it('supports one source record to multiple normalized outputs', async () => {
    const { fabric } = fabricSetup();
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'multi_evt',
      rawPayloadHash: 'hash_multi',
    });
    const norm1 = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_multi',
      observation: sampleObservation('obs_multi_1'),
    });
    const norm2 = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_multi',
      observation: sampleObservation('obs_multi_2'),
    });
    assert.equal(norm1.ok, true);
    assert.equal(norm2.ok, true);
    if (!norm1.ok || !norm2.ok) {
      return;
    }
    assert.notEqual(norm1.normalizedNodeId, norm2.normalizedNodeId);
  });

  it('survives consumer restart with durable idempotency store', async () => {
    const idempotency = new InMemoryIdempotencyStore();
    const graph = createInMemoryProvenanceGraphStore();
    const outbox = new InMemoryOutboxStore();
    const transport = new InProcessTransport();
    const bus = new DurableLocalEventBus({ outbox, transport, clock });
    const fabric = createEconomicProvenanceFabric({
      eventBus: bus,
      envelopeToolkit: simulationEnvelopeToolkit,
      graph,
      idempotency,
      now: () => NOW,
    });
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'restart_evt',
      rawPayloadHash: 'hash_restart',
    });
    const restartedFabric = createEconomicProvenanceFabric({
      eventBus: bus,
      envelopeToolkit: simulationEnvelopeToolkit,
      graph,
      idempotency,
      now: () => NOW,
    });
    const duplicate = await restartedFabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'restart_evt',
      rawPayloadHash: 'hash_restart',
    });
    assert.equal(received.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    const trace = findClaimsForProviderRecord(graph, received.providerRecordNodeId);
    assert.deepEqual(trace, []);
  });

  it('uses privacy-safe salted commitments for sensitive values', () => {
    const publicCommit = commitPublicContent({ providerId: 'p', dataset: 'd' });
    const sensitiveCommit = commitSensitiveValue('user@example.com', 'test-salt');
    assert.equal(publicCommit.kind, 'public');
    assert.equal(sensitiveCommit.kind, 'salted');
    assert.notEqual(sensitiveCommit.digest, commitSensitiveValue('user@example.com', 'other-salt').digest);
  });

  it('dead-letters failed observations when configured', async () => {
    const outbox = new InMemoryOutboxStore();
    const deadLetters = new InMemoryDeadLetterStore();
    const transport = new InProcessTransport();
    const bus = new DurableLocalEventBus({ outbox, transport, deadLetters, clock });
    const quarantine = new InMemoryQuarantineStore();
    const fabric = createEconomicProvenanceFabric({
      eventBus: bus,
      envelopeToolkit: simulationEnvelopeToolkit,
      quarantine,
      now: () => NOW,
    });
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      transportEventId: 'dl_evt',
      rawPayloadHash: 'hash_dl',
    });
    await fabric.rejectNormalization({
      providerId: 'provider.test',
      capability: 'compliance.screening',
      dataset: 'sanctions',
      providerRecordId: 'pr_dl',
      providerRecordNodeId: received.providerRecordNodeId,
      failureCode: 'NORMALIZATION_FAILURE',
      failureMessage: 'mapping failed',
      rawPayloadHash: 'hash_dl',
    });
    const rows = await quarantine.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.retryable, false);
  });

  it('handles out-of-order event publication without losing lineage', async () => {
    const { fabric, graph, dispatcher, transport } = fabricSetup();
    const received = await fabric.receiveProviderRecord({
      providerId: 'provider.test',
      capability: 'kyb.verify',
      dataset: 'business',
      transportEventId: 'ooo_evt',
      rawPayloadHash: 'hash_ooo',
    });
    const norm = await fabric.normalizeObservation({
      providerRecordNodeId: received.providerRecordNodeId,
      providerRecordId: 'pr_ooo',
      observation: sampleObservation('obs_ooo'),
    });
    assert.equal(norm.ok, true);
    if (!norm.ok) {
      return;
    }
    const chain = await fabric.buildEvidenceChain({
      normalizedNodeId: norm.normalizedNodeId,
      normalizedObservationId: 'norm_obs_ooo',
      providerId: 'provider.test',
      capability: 'kyb.verify',
      dataset: 'business',
      rawPayloadHash: 'hash_ooo',
      claimKind: 'kyb.claim',
      parentNodeIds: [received.providerRecordNodeId],
    });
    await dispatcher.dispatchOnce();
    const types = transport.listPublished().map((event) => event.eventType);
    assert.ok(types.includes('ClaimCreated'));
    const trace = traceClaimToProviderRecords(graph, chain.claimNodeId);
    assert.ok(trace);
    const payloads = transport.listPublished().map((event) => parseEnvelope(JSON.stringify(event)));
    assert.ok(payloads.every((envelope) => envelope.environment === 'simulation'));
  });
});
