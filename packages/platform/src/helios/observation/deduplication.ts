/**
 * Canonical duplicate/event identity — same upstream event must not count twice.
 */

import {
  buildDeduplicationKey,
  createInMemoryDeduplicationRegistry,
  DEFAULT_DEDUPLICATION_POLICIES,
  type DeduplicationRegistry,
} from '../../../../provider-sdk/src/deduplication.ts';
import type { ExternalObservation } from '../../../../provider-sdk/src/types.ts';

export type HeliosDeduplicationState = {
  readonly registry: DeduplicationRegistry;
  readonly eventKeys: Set<string>;
};

export function createHeliosDeduplicationState(): HeliosDeduplicationState {
  return Object.freeze({
    registry: createInMemoryDeduplicationRegistry(),
    eventKeys: new Set<string>(),
  });
}

export function checkDuplicate<T>(
  observation: ExternalObservation<T>,
  state: HeliosDeduplicationState,
  duplicateEventKey: string | null,
): boolean {
  const transportKey = buildDeduplicationKey(
    observation,
    DEFAULT_DEDUPLICATION_POLICIES.sourceTimestampEntity,
    { entityId: duplicateEventKey },
  );
  if (state.registry.hasSeen(transportKey)) {
    return true;
  }
  state.registry.markSeen(transportKey);

  const payloadKey = buildDeduplicationKey(
    observation,
    DEFAULT_DEDUPLICATION_POLICIES.exactPayload,
  );
  if (state.registry.hasSeen(payloadKey)) {
    return true;
  }
  state.registry.markSeen(payloadKey);

  if (duplicateEventKey && state.eventKeys.has(duplicateEventKey)) {
    return true;
  }
  if (duplicateEventKey) {
    state.eventKeys.add(duplicateEventKey);
  }

  return false;
}

export function snapshotDeduplicationState(state: HeliosDeduplicationState): {
  readonly eventKeys: readonly string[];
} {
  return Object.freeze({
    eventKeys: Object.freeze([...state.eventKeys]),
  });
}

export function restoreDeduplicationState(snapshot: {
  readonly eventKeys: readonly string[];
}): HeliosDeduplicationState {
  const restored = createHeliosDeduplicationState();
  for (const key of snapshot.eventKeys) {
    restored.eventKeys.add(key);
  }
  return restored;
}
