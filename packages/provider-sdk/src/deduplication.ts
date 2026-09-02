/**
 * Deduplication hooks and policies.
 * No one-size-fits-all rule — adapters choose or compose policies.
 */

import type { ExternalObservation } from './types.ts';

export type DeduplicationKeyPart =
  | 'providerId'
  | 'dataset'
  | 'sourceTimestamp'
  | 'entityId'
  | 'rawPayloadHash'
  | 'capability'
  | 'observationId'
  | 'transportRetryIdentity';

export type DeduplicationPolicy = {
  readonly policyId: string;
  readonly keyParts: readonly DeduplicationKeyPart[];
};

export type DeduplicationKey = {
  readonly policyId: string;
  readonly digest: string;
};

export type DeduplicationContext = {
  readonly entityId?: string | null;
  readonly transportRetryIdentity?: string | null;
};

export const DEFAULT_DEDUPLICATION_POLICIES = Object.freeze({
  exactPayload: Object.freeze({
    policyId: 'exact-payload',
    keyParts: ['providerId', 'dataset', 'rawPayloadHash'] as const,
  }),
  sourceTimestampEntity: Object.freeze({
    policyId: 'source-timestamp-entity',
    keyParts: ['providerId', 'dataset', 'sourceTimestamp', 'entityId'] as const,
  }),
  capabilityPayload: Object.freeze({
    policyId: 'capability-payload',
    keyParts: ['providerId', 'capability', 'rawPayloadHash'] as const,
  }),
  transportRetry: Object.freeze({
    policyId: 'transport-retry',
    keyParts: ['providerId', 'transportRetryIdentity', 'rawPayloadHash'] as const,
  }),
});

export function buildDeduplicationKey<T>(
  observation: ExternalObservation<T>,
  policy: DeduplicationPolicy,
  context: DeduplicationContext = {},
): DeduplicationKey {
  const parts: string[] = [policy.policyId];
  for (const part of policy.keyParts) {
    parts.push(resolveKeyPart(observation, part, context));
  }
  return Object.freeze({
    policyId: policy.policyId,
    digest: parts.join('|'),
  });
}

export type DeduplicationRegistry = {
  hasSeen(key: DeduplicationKey): boolean;
  markSeen(key: DeduplicationKey): void;
};

export function createInMemoryDeduplicationRegistry(): DeduplicationRegistry {
  const seen = new Set<string>();
  return Object.freeze({
    hasSeen(key: DeduplicationKey): boolean {
      return seen.has(key.digest);
    },
    markSeen(key: DeduplicationKey): void {
      seen.add(key.digest);
    },
  });
}

export function isDuplicate<T>(
  observation: ExternalObservation<T>,
  policy: DeduplicationPolicy,
  registry: DeduplicationRegistry,
  context: DeduplicationContext = {},
): boolean {
  const key = buildDeduplicationKey(observation, policy, context);
  if (registry.hasSeen(key)) {
    return true;
  }
  registry.markSeen(key);
  return false;
}

function resolveKeyPart<T>(
  observation: ExternalObservation<T>,
  part: DeduplicationKeyPart,
  context: DeduplicationContext,
): string {
  switch (part) {
    case 'providerId':
      return observation.providerId;
    case 'dataset':
      return observation.source.dataset;
    case 'sourceTimestamp':
      return observation.time.sourceTimestamp ?? '';
    case 'entityId':
      return context.entityId ?? '';
    case 'rawPayloadHash':
      return observation.provenance.rawPayloadHash;
    case 'capability':
      return observation.capability;
    case 'observationId':
      return observation.observationId;
    case 'transportRetryIdentity':
      return context.transportRetryIdentity ?? '';
    default: {
      const _exhaustive: never = part;
      return String(_exhaustive);
    }
  }
}
