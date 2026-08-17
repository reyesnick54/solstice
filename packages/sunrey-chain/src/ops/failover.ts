export type RpcInstance = {
  readonly instanceId: string;
  readonly domainId: string;
  healthy: boolean;
  readonly canSignConsensus: false;
};

export type ExplorerInstance = {
  readonly instanceId: string;
  readonly domainId: string;
  healthy: boolean;
  readonly canMutateChain: false;
  indexedHeight: bigint;
};

export type RelayerInstance = {
  readonly instanceId: string;
  readonly domainId: string;
  healthy: boolean;
  readonly untrusted: true;
};

export type OracleAdapterInstance = {
  readonly instanceId: string;
  readonly domainId: string;
  healthy: boolean;
};

export function routeHealthyRpc(instances: readonly RpcInstance[]): readonly RpcInstance[] {
  const healthy = instances.filter((row) => row.healthy);
  if (healthy.some((row) => row.canSignConsensus !== false)) {
    throw new Error('RPC failover cannot sign consensus');
  }
  return healthy;
}

export function assertRpcCannotSign(instances: readonly RpcInstance[]): void {
  for (const instance of instances) {
    if (instance.canSignConsensus !== false) {
      throw new Error('RPC failover cannot sign consensus');
    }
  }
}

export function assertExplorerCannotMutate(instances: readonly ExplorerInstance[]): void {
  for (const instance of instances) {
    if (instance.canMutateChain !== false) {
      throw new Error('Explorer failover cannot mutate chain');
    }
  }
}

export function idempotentIndex(
  existing: Readonly<Record<string, string>>,
  eventId: string,
  payload: string,
): Record<string, string> {
  if (existing[eventId] !== undefined) {
    return { ...existing };
  }
  return { ...existing, [eventId]: payload };
}

export function duplicateRelayerSubmissionSafe(seen: ReadonlySet<string>, packetId: string): ReadonlySet<string> {
  const next = new Set(seen);
  next.add(packetId);
  return next;
}
