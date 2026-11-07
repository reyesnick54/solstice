/**
 * Read-only market-data failover — Execution Authority remains separately gated.
 */

import type { UtcInstant } from '@solstice/domain';
import { HELIOS_MD05_SCHEMA } from './taxonomy.ts';
import type { FailoverDecision, FeedArbitrationState, FeedReplica } from './types.ts';
import { compareProviderTrust } from './trust.ts';

export function decideReadOnlyFailover(input: {
  readonly state: FeedArbitrationState;
  readonly now: UtcInstant;
  readonly reason: string;
}): FailoverDecision | null {
  const active = input.state.replicas.find((replica) => replica.replicaId === input.state.activeReadReplicaId);
  const candidates = input.state.replicas.filter((replica) => replica.health !== 'UNAVAILABLE');

  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((left, right) => {
    const leftTrust = input.state.providerTrust[left.providerId];
    const rightTrust = input.state.providerTrust[right.providerId];
    if (!leftTrust || !rightTrust) {
      return 0;
    }
    return compareProviderTrust(leftTrust, rightTrust);
  });

  const best = sorted[0]!;
  if (active?.replicaId === best.replicaId) {
    return null;
  }

  const failoverNeeded =
    !active ||
    active.health === 'UNAVAILABLE' ||
    active.health === 'STALE' ||
    (input.state.providerTrust[active.providerId]?.compositeBand === 'FAILED');

  if (!failoverNeeded) {
    return null;
  }

  return Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    scope: 'READ_ONLY_MARKET_DATA',
    fromReplicaId: active?.replicaId ?? null,
    toReplicaId: best.replicaId,
    toRole: best.role,
    decidedAt: input.now,
    reason: input.reason,
    executionAuthorityImplicated: false,
  });
}

export function applyFailoverDecision(
  state: FeedArbitrationState,
  decision: FailoverDecision,
): FeedArbitrationState {
  const replicas: FeedReplica[] = state.replicas.map((replica) =>
    Object.freeze({
      ...replica,
      active: replica.replicaId === decision.toReplicaId,
      health: replica.replicaId === decision.toReplicaId ? 'ACTIVE' : replica.health,
    }),
  );
  return Object.freeze({
    ...state,
    activeReadReplicaId: decision.toReplicaId,
    activeReadRole: decision.toRole,
    replicas: Object.freeze(replicas),
    lastFailoverAt: decision.decidedAt,
  });
}
