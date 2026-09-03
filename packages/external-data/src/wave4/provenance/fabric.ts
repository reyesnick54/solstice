/**
 * Wave 4 economic event and provenance fabric.
 * Integrates canonical domain events, durable outbox, idempotency, and lineage.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import {
  type ProvenanceEnvelopeToolkit,
  type ProvenanceEventBus,
  type ProvenanceEventEnvelope,
} from './event-ports.ts';
import {
  createEconomicProvenanceEvent,
  type ClaimLifecyclePayload,
  type EconomicProvenanceEvent,
  type EconomicProvenanceRefs,
  type EvidenceCreatedPayload,
  type FactVerifiedPayload,
  type ObservationLifecyclePayload,
  type ProviderRecordReceivedPayload,
} from '../../../../provider-sdk/src/economic-events.ts';
import type { ExternalObservation } from '../../../../provider-sdk/src/types.ts';
import { buildDeduplicationKey, DEFAULT_DEDUPLICATION_POLICIES } from '../../../../provider-sdk/src/deduplication.ts';
import { commitPublicContent, commitTransformation } from './content-hash.ts';
import { createInMemoryProvenanceGraphStore, type ProvenanceGraphStore } from './graph.ts';
import {
  buildProcessingIdempotencyKey,
  buildTransportIdempotencyKey,
  type IdempotencyStore,
  InMemoryIdempotencyStore,
} from './idempotency.ts';
import {
  InMemoryQuarantineStore,
  quarantineFailedObservation,
  type QuarantineStore,
} from './quarantine.ts';
import { asProvenanceNodeId, type ProvenanceEdge, type ProvenanceNode } from './types.ts';

export type EconomicProvenanceFabricOptions = {
  readonly eventBus: ProvenanceEventBus;
  readonly envelopeToolkit: ProvenanceEnvelopeToolkit;
  readonly graph?: ProvenanceGraphStore;
  readonly idempotency?: IdempotencyStore;
  readonly quarantine?: QuarantineStore;
  readonly now?: () => string;
};

export type ProviderRecordInput = {
  readonly providerId: string;
  readonly capability: string;
  readonly dataset: string;
  readonly transportEventId: string;
  readonly rawPayloadHash: string;
  readonly requestId?: string | null;
};

export type NormalizationResult =
  | {
      readonly ok: true;
      readonly observation: ExternalObservation<unknown>;
      readonly normalizedNodeId: string;
      readonly providerRecordNodeId: string;
      readonly event: ProvenanceEventEnvelope;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly quarantineId: string;
      readonly event: ProvenanceEventEnvelope;
    };

export type EvidenceChainResult = {
  readonly evidenceNodeId: string;
  readonly factNodeId: string;
  readonly claimNodeId: string;
  readonly events: readonly ProvenanceEventEnvelope[];
};

function baseRefs(input: {
  readonly providerId: string;
  readonly capability: string;
  readonly dataset: string;
  readonly providerRecordId?: string | null;
  readonly observationId?: string | null;
  readonly normalizedObservationId?: string | null;
  readonly evidenceId?: string | null;
  readonly factId?: string | null;
  readonly claimId?: string | null;
  readonly entityId?: string | null;
  readonly requestId?: string | null;
  readonly idempotencyKey: string;
  readonly rawPayloadHash?: string | null;
  readonly contentCommitment?: string | null;
  readonly parentNodeIds?: readonly string[];
  readonly correlationId?: string | null;
}): EconomicProvenanceRefs {
  return Object.freeze({
    providerId: input.providerId,
    capability: input.capability,
    dataset: input.dataset,
    providerRecordId: input.providerRecordId ?? null,
    observationId: input.observationId ?? null,
    normalizedObservationId: input.normalizedObservationId ?? null,
    evidenceId: input.evidenceId ?? null,
    factId: input.factId ?? null,
    claimId: input.claimId ?? null,
    entityId: input.entityId ?? null,
    requestId: input.requestId ?? null,
    idempotencyKey: input.idempotencyKey,
    rawPayloadHash: input.rawPayloadHash ?? null,
    contentCommitment: input.contentCommitment ?? null,
    parentNodeIds: Object.freeze([...(input.parentNodeIds ?? [])]),
    correlationId: input.correlationId ?? null,
  });
}

export class EconomicProvenanceFabric {
  readonly #eventBus: ProvenanceEventBus;
  readonly #envelopeToolkit: ProvenanceEnvelopeToolkit;
  readonly #graph: ProvenanceGraphStore;
  readonly #idempotency: IdempotencyStore;
  readonly #quarantine: QuarantineStore;
  readonly #now: () => string;
  #sequence = 0;

  constructor(options: EconomicProvenanceFabricOptions) {
    this.#eventBus = options.eventBus;
    this.#envelopeToolkit = options.envelopeToolkit;
    this.#graph = options.graph ?? createInMemoryProvenanceGraphStore();
    this.#idempotency = options.idempotency ?? new InMemoryIdempotencyStore();
    this.#quarantine = options.quarantine ?? new InMemoryQuarantineStore();
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  get graph(): ProvenanceGraphStore {
    return this.#graph;
  }

  get quarantineStore(): QuarantineStore {
    return this.#quarantine;
  }

  async receiveProviderRecord(input: ProviderRecordInput): Promise<{
    readonly duplicate: boolean;
    readonly providerRecordNodeId: string;
    readonly event: ProvenanceEventEnvelope | null;
  }> {
    const idempotencyKey = buildTransportIdempotencyKey({
      providerId: input.providerId,
      capability: input.capability,
      transportEventId: input.transportEventId,
    });
    const claim = await this.#idempotency.tryClaim({
      idempotencyKey,
      eventId: this.#envelopeToolkit.newEventId(),
      now: this.#now(),
    });
    if (claim === 'duplicate') {
      return { duplicate: true, providerRecordNodeId: '', event: null };
    }

    const providerRecordId = `pr_${randomUUID()}`;
    const providerRecordNodeId = asProvenanceNodeId(`node:${providerRecordId}`);
    const contentCommitment = commitPublicContent({
      providerId: input.providerId,
      capability: input.capability,
      dataset: input.dataset,
      rawPayloadHash: input.rawPayloadHash,
    }).digest;

    const node: ProvenanceNode = Object.freeze({
      nodeId: providerRecordNodeId,
      kind: 'provider_record',
      contentCommitment,
      rawPayloadHash: input.rawPayloadHash,
      providerId: input.providerId,
      capability: input.capability,
      dataset: input.dataset,
      createdAt: this.#now(),
      metadata: Object.freeze({ transportEventId: input.transportEventId }),
    });
    this.#graph.addNode(node);

    const event = await this.#publish(
      createEconomicProvenanceEvent('ProviderRecordReceived', asUtcInstant(this.#now()), {
        ...baseRefs({
          providerId: input.providerId,
          capability: input.capability,
          dataset: input.dataset,
          providerRecordId,
          requestId: input.requestId ?? null,
          idempotencyKey,
          rawPayloadHash: input.rawPayloadHash,
          contentCommitment,
        }),
        receivedAt: this.#now(),
        transportEventId: input.transportEventId,
      } as ProviderRecordReceivedPayload),
      providerRecordId,
    );

    await this.#idempotency.complete(idempotencyKey, 'accepted', this.#now());
    return { duplicate: false, providerRecordNodeId, event };
  }

  async normalizeObservation(input: {
    readonly providerRecordNodeId: string;
    readonly observation: ExternalObservation<unknown>;
    readonly providerRecordId: string;
  }): Promise<NormalizationResult> {
    const observation = input.observation;
    const dedupKey = buildDeduplicationKey(observation, DEFAULT_DEDUPLICATION_POLICIES.exactPayload);
    const processingKey = buildProcessingIdempotencyKey({
      stage: 'normalize',
      nodeId: dedupKey.digest,
    });
    const claim = await this.#idempotency.tryClaim({
      idempotencyKey: processingKey,
      eventId: this.#envelopeToolkit.newEventId(),
      now: this.#now(),
    });
    if (claim === 'duplicate') {
      const duplicateEvent = await this.#publish(
        createEconomicProvenanceEvent('ObservationDeduplicated', asUtcInstant(this.#now()), {
          ...baseRefs({
            providerId: observation.providerId,
            capability: observation.capability,
            dataset: observation.source.dataset,
            providerRecordId: input.providerRecordId,
            observationId: observation.observationId,
            requestId: observation.provenance.requestId,
            idempotencyKey: processingKey,
            rawPayloadHash: observation.provenance.rawPayloadHash,
            parentNodeIds: [input.providerRecordNodeId],
          }),
          transformationKind: 'deduplicate',
          reasonCode: 'DUPLICATE_TRANSPORT',
          detail: 'duplicate observation suppressed',
        } as ObservationLifecyclePayload),
        observation.observationId,
      );
      return {
        ok: false,
        code: 'DUPLICATE',
        message: 'duplicate observation',
        quarantineId: '',
        event: duplicateEvent,
      };
    }

    const normalizedId = `norm_${observation.observationId}`;
    const normalizedNodeId = asProvenanceNodeId(`node:${normalizedId}`);
    const outputCommitment = commitPublicContent({
      observationId: observation.observationId,
      providerId: observation.providerId,
      capability: observation.capability,
      rawPayloadHash: observation.provenance.rawPayloadHash,
    }).digest;
    const transformCommitment = commitTransformation({
      transformationKind: 'normalize',
      inputCommitments: [input.providerRecordNodeId],
      outputCommitment,
      normalizationVersion: observation.provenance.normalizationVersion,
    }).digest;

    const normalizedNode: ProvenanceNode = Object.freeze({
      nodeId: normalizedNodeId,
      kind: 'normalized_observation',
      contentCommitment: transformCommitment,
      rawPayloadHash: observation.provenance.rawPayloadHash,
      providerId: observation.providerId,
      capability: observation.capability,
      dataset: observation.source.dataset,
      createdAt: this.#now(),
      metadata: Object.freeze({ observationId: observation.observationId }),
    });
    this.#graph.addNode(normalizedNode);

    const edges: ProvenanceEdge[] = [
      Object.freeze({
        edgeId: `edge:${normalizedId}:from:${input.providerRecordNodeId}`,
        kind: 'NORMALIZED_TO',
        fromNodeId: normalizedNodeId,
        toNodeId: asProvenanceNodeId(input.providerRecordNodeId),
        createdAt: this.#now(),
        eventId: null,
      }),
    ];
    const edgeResult = this.#graph.addEdges(edges);
    if (!edgeResult.ok) {
      const quarantineId =
        this.#quarantine instanceof InMemoryQuarantineStore
          ? this.#quarantine.nextQuarantineId()
          : `quarantine_${randomUUID()}`;
      await quarantineFailedObservation({
        store: this.#quarantine,
        quarantineId,
        failureCode: edgeResult.error.code,
        failureMessage: edgeResult.error.message,
        idempotencyKey: processingKey,
        providerId: observation.providerId,
        capability: observation.capability,
        rawPayloadHash: observation.provenance.rawPayloadHash,
        eventId: null,
        now: this.#now(),
      });
      const rejectEvent = await this.#publish(
        createEconomicProvenanceEvent('ObservationRejected', asUtcInstant(this.#now()), {
          ...baseRefs({
            providerId: observation.providerId,
            capability: observation.capability,
            dataset: observation.source.dataset,
            providerRecordId: input.providerRecordId,
            observationId: observation.observationId,
            requestId: observation.provenance.requestId,
            idempotencyKey: processingKey,
            rawPayloadHash: observation.provenance.rawPayloadHash,
            parentNodeIds: [input.providerRecordNodeId],
          }),
          transformationKind: 'normalize',
          reasonCode: edgeResult.error.code,
          detail: edgeResult.error.message,
        } as ObservationLifecyclePayload),
        observation.observationId,
      );
      await this.#idempotency.complete(processingKey, 'quarantined', this.#now());
      return { ok: false, code: edgeResult.error.code, message: edgeResult.error.message, quarantineId, event: rejectEvent };
    }

    const event = await this.#publish(
      createEconomicProvenanceEvent('ObservationNormalized', asUtcInstant(this.#now()), {
        ...baseRefs({
          providerId: observation.providerId,
          capability: observation.capability,
          dataset: observation.source.dataset,
          providerRecordId: input.providerRecordId,
          observationId: observation.observationId,
          normalizedObservationId: normalizedId,
          requestId: observation.provenance.requestId,
          idempotencyKey: processingKey,
          rawPayloadHash: observation.provenance.rawPayloadHash,
          contentCommitment: transformCommitment,
          parentNodeIds: [input.providerRecordNodeId],
        }),
        transformationKind: 'normalize',
        reasonCode: null,
        detail: null,
      } as ObservationLifecyclePayload),
      normalizedId,
    );
    await this.#idempotency.complete(processingKey, 'accepted', this.#now());
    return {
      ok: true,
      observation,
      normalizedNodeId,
      providerRecordNodeId: input.providerRecordNodeId,
      event,
    };
  }

  async rejectNormalization(input: {
    readonly providerId: string;
    readonly capability: string;
    readonly dataset: string;
    readonly providerRecordId: string;
    readonly providerRecordNodeId: string;
    readonly failureCode: string;
    readonly failureMessage: string;
    readonly rawPayloadHash: string | null;
    readonly requestId?: string | null;
  }): Promise<ProvenanceEventEnvelope> {
    const quarantineId =
      this.#quarantine instanceof InMemoryQuarantineStore
        ? this.#quarantine.nextQuarantineId()
        : `quarantine_${randomUUID()}`;
    await quarantineFailedObservation({
      store: this.#quarantine,
      quarantineId,
      failureCode: input.failureCode,
      failureMessage: input.failureMessage,
      idempotencyKey: buildProcessingIdempotencyKey({ stage: 'reject', nodeId: quarantineId }),
      providerId: input.providerId,
      capability: input.capability,
      rawPayloadHash: input.rawPayloadHash,
      eventId: null,
      now: this.#now(),
    });
    return this.#publish(
      createEconomicProvenanceEvent('ObservationRejected', asUtcInstant(this.#now()), {
        ...baseRefs({
          providerId: input.providerId,
          capability: input.capability,
          dataset: input.dataset,
          providerRecordId: input.providerRecordId,
          requestId: input.requestId ?? null,
          idempotencyKey: quarantineId,
          rawPayloadHash: input.rawPayloadHash,
          parentNodeIds: [input.providerRecordNodeId],
        }),
        transformationKind: 'normalize',
        reasonCode: input.failureCode,
        detail: input.failureMessage,
      } as ObservationLifecyclePayload),
      input.providerRecordId,
    );
  }

  async buildEvidenceChain(input: {
    readonly normalizedNodeId: string;
    readonly normalizedObservationId: string;
    readonly providerId: string;
    readonly capability: string;
    readonly dataset: string;
    readonly rawPayloadHash: string;
    readonly claimKind: string;
    readonly parentNodeIds: readonly string[];
  }): Promise<EvidenceChainResult> {
    const evidenceId = `ev_${randomUUID()}`;
    const factId = `fact_${randomUUID()}`;
    const claimId = `claim_${randomUUID()}`;
    const evidenceNodeId = asProvenanceNodeId(`node:${evidenceId}`);
    const factNodeId = asProvenanceNodeId(`node:${factId}`);
    const claimNodeId = asProvenanceNodeId(`node:${claimId}`);

    const evidenceCommitment = commitPublicContent({ evidenceId, normalizedObservationId: input.normalizedObservationId }).digest;
    const factCommitment = commitPublicContent({ factId, evidenceId }).digest;
    const claimCommitment = commitPublicContent({ claimId, factId, claimKind: input.claimKind }).digest;

    const now = this.#now();
    this.#graph.addNode(
      Object.freeze({
        nodeId: evidenceNodeId,
        kind: 'evidence',
        contentCommitment: evidenceCommitment,
        rawPayloadHash: input.rawPayloadHash,
        providerId: input.providerId,
        capability: input.capability,
        dataset: input.dataset,
        createdAt: now,
        metadata: Object.freeze({ evidenceId }),
      }),
    );
    this.#graph.addNode(
      Object.freeze({
        nodeId: factNodeId,
        kind: 'verified_fact',
        contentCommitment: factCommitment,
        rawPayloadHash: null,
        providerId: input.providerId,
        capability: input.capability,
        dataset: input.dataset,
        createdAt: now,
        metadata: Object.freeze({ factId }),
      }),
    );
    this.#graph.addNode(
      Object.freeze({
        nodeId: claimNodeId,
        kind: 'economic_claim',
        contentCommitment: claimCommitment,
        rawPayloadHash: null,
        providerId: input.providerId,
        capability: input.capability,
        dataset: input.dataset,
        createdAt: now,
        metadata: Object.freeze({ claimId, claimKind: input.claimKind }),
      }),
    );

    this.#graph.addEdges([
      Object.freeze({
        edgeId: `edge:${evidenceId}:from:${input.normalizedNodeId}`,
        kind: 'EVIDENCE_FROM',
        fromNodeId: evidenceNodeId,
        toNodeId: asProvenanceNodeId(input.normalizedNodeId),
        createdAt: now,
        eventId: null,
      }),
      Object.freeze({
        edgeId: `edge:${factId}:from:${evidenceId}`,
        kind: 'VERIFIED_FROM',
        fromNodeId: factNodeId,
        toNodeId: evidenceNodeId,
        createdAt: now,
        eventId: null,
      }),
      Object.freeze({
        edgeId: `edge:${claimId}:from:${factId}`,
        kind: 'CLAIM_FROM',
        fromNodeId: claimNodeId,
        toNodeId: factNodeId,
        createdAt: now,
        eventId: null,
      }),
    ]);

    const parentNodeIds = [...input.parentNodeIds, input.normalizedNodeId];
    const refs = baseRefs({
      providerId: input.providerId,
      capability: input.capability,
      dataset: input.dataset,
      normalizedObservationId: input.normalizedObservationId,
      evidenceId,
      factId,
      claimId,
      idempotencyKey: buildProcessingIdempotencyKey({ stage: 'claim', nodeId: claimId }),
      rawPayloadHash: input.rawPayloadHash,
      parentNodeIds,
    });

    const events: ProvenanceEventEnvelope[] = [];
    events.push(
      await this.#publish(
        createEconomicProvenanceEvent('EvidenceCreated', asUtcInstant(now), {
          ...refs,
          evidenceKind: 'economic_observation_evidence',
          grantsDecision: false,
        } as EvidenceCreatedPayload),
        evidenceId,
      ),
    );
    events.push(
      await this.#publish(
        createEconomicProvenanceEvent('FactVerified', asUtcInstant(now), {
          ...refs,
          verificationMethod: 'wave4-simulation-verifier',
          verifierRef: 'simulation/verifier/v1',
        } as FactVerifiedPayload),
        factId,
      ),
    );
    events.push(
      await this.#publish(
        createEconomicProvenanceEvent('ClaimCreated', asUtcInstant(now), {
          ...refs,
          claimKind: input.claimKind,
          challengeReason: null,
          resolutionOutcome: null,
        } as ClaimLifecyclePayload),
        claimId,
      ),
    );

    return Object.freeze({ evidenceNodeId, factNodeId, claimNodeId, events });
  }

  async linkObservations(input: {
    readonly sourceNodeId: string;
    readonly targetNodeId: string;
    readonly providerId: string;
    readonly capability: string;
    readonly dataset: string;
    readonly observationId: string;
  }): Promise<ProvenanceEventEnvelope> {
    const edge: ProvenanceEdge = Object.freeze({
      edgeId: `edge:link:${input.sourceNodeId}:${input.targetNodeId}`,
      kind: 'LINKED_TO',
      fromNodeId: asProvenanceNodeId(input.sourceNodeId),
      toNodeId: asProvenanceNodeId(input.targetNodeId),
      createdAt: this.#now(),
      eventId: null,
    });
    const result = this.#graph.addEdges([edge]);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return this.#publish(
      createEconomicProvenanceEvent('ObservationLinked', asUtcInstant(this.#now()), {
        ...baseRefs({
          providerId: input.providerId,
          capability: input.capability,
          dataset: input.dataset,
          observationId: input.observationId,
          idempotencyKey: edge.edgeId,
          parentNodeIds: [input.sourceNodeId, input.targetNodeId],
        }),
        transformationKind: 'link',
        reasonCode: null,
        detail: null,
      } as ObservationLifecyclePayload),
      input.observationId,
    );
  }

  async #publish(event: EconomicProvenanceEvent, aggregateId: string): Promise<ProvenanceEventEnvelope> {
    this.#sequence += 1;
    const sealed = this.#envelopeToolkit.sealEnvelope(
      {
        eventType: event.eventType,
        schemaVersion: event.schemaVersion,
        occurredAt: event.occurredAt,
        payload: event.payload,
        aggregateType: 'economic_provenance',
        aggregateId,
        producer: 'sunrey.external-data.wave4',
      },
      this.#sequence,
    );
    await this.#eventBus.publish(sealed);
    return sealed;
  }
}

export function createEconomicProvenanceFabric(
  options: EconomicProvenanceFabricOptions,
): EconomicProvenanceFabric {
  return new EconomicProvenanceFabric(options);
}
