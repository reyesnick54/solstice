/**
 * Replica topology and staleness. Financial writes always route to PRIMARY.
 * Mutation eligibility must never depend on a stale read replica.
 */

import type { ConsistencyLevel, ReplicaEndpoint, ReplicaRole } from './profile.ts';

export type ReplicaReadRequest = {
  readonly role: ReplicaRole;
  readonly observedLagMs: bigint;
  readonly consistency: ConsistencyLevel;
  readonly financialMutation: boolean;
};

export type ReplicaRoutingDecision = {
  readonly allowed: boolean;
  readonly route: ReplicaRole;
  readonly reason: string;
};

export function routeFinancialWrite(topology: readonly ReplicaEndpoint[]): ReplicaRoutingDecision {
  const primary = topology.find((row) => row.role === 'PRIMARY' && row.writable);
  if (!primary) {
    return { allowed: false, route: 'PRIMARY', reason: 'no writable primary' };
  }
  return { allowed: true, route: 'PRIMARY', reason: 'financial writes use canonical write authority' };
}

export function acceptReplicaRead(
  topology: readonly ReplicaEndpoint[],
  request: ReplicaReadRequest,
): ReplicaRoutingDecision {
  if (request.financialMutation) {
    return {
      allowed: false,
      route: 'PRIMARY',
      reason: 'financial mutation eligibility must not depend on a replica read',
    };
  }
  const endpoint = topology.find((row) => row.role === request.role);
  if (!endpoint) {
    return { allowed: false, route: 'PRIMARY', reason: 'unknown replica role' };
  }
  if (request.consistency === 'CANONICAL' && request.role !== 'PRIMARY' && request.role !== 'SYNC_REPLICA') {
    return { allowed: false, route: 'PRIMARY', reason: 'canonical consistency requires primary or sync replica' };
  }
  if (request.observedLagMs > endpoint.lagBudgetMs) {
    return { allowed: false, route: 'PRIMARY', reason: 'replica exceeds declared lag budget' };
  }
  return { allowed: true, route: request.role, reason: 'read within declared consistency' };
}

export function replicaIsStale(endpoint: ReplicaEndpoint, observedLagMs: bigint): boolean {
  return observedLagMs > endpoint.lagBudgetMs;
}
