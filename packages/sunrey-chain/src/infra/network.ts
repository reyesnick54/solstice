/**
 * Production-candidate network zones, allowed paths, and egress classes.
 * Consensus execution never performs arbitrary external network requests.
 */

import {
  EGRESS_CLASSES,
  infraErr,
  infraOk,
  NETWORK_ZONES,
  type EgressClass,
  type InfraResult,
  type NetworkZone,
} from './types.ts';

export type NetworkPath = {
  readonly from: NetworkZone;
  readonly to: NetworkZone;
  readonly purpose: string;
};

export const ALLOWED_NETWORK_PATHS: readonly NetworkPath[] = Object.freeze([
  { from: 'PUBLIC_EDGE', to: 'PUBLIC_RPC', purpose: 'public → RPC' },
  { from: 'SENTRY', to: 'VALIDATOR_PRIVATE', purpose: 'sentry → validator P2P' },
  { from: 'VALIDATOR_PRIVATE', to: 'SIGNER_PRIVATE', purpose: 'validator → signer' },
  { from: 'DATA_PRIVATE', to: 'CUSTODY_PRIVATE', purpose: 'Exchange → custody API' },
  { from: 'OPERATIONS_PRIVATE', to: 'PUBLIC_EDGE', purpose: 'oracle collector → configured external source' },
  { from: 'PUBLIC_EDGE', to: 'DATA_PRIVATE', purpose: 'Explorer → finalized-data interface' },
  { from: 'OBSERVABILITY', to: 'PUBLIC_RPC', purpose: 'monitoring scrape of public RPC health' },
  { from: 'OBSERVABILITY', to: 'SENTRY', purpose: 'monitoring scrape of sentry health' },
  { from: 'BACKUP', to: 'DATA_PRIVATE', purpose: 'backup of verified snapshots' },
  { from: 'OPERATIONS_PRIVATE', to: 'BACKUP', purpose: 'release/backup orchestration' },
]);

export const FORBIDDEN_NETWORK_PATHS: readonly NetworkPath[] = Object.freeze([
  { from: 'PUBLIC_EDGE', to: 'SIGNER_PRIVATE', purpose: 'public → signer' },
  { from: 'PUBLIC_EDGE', to: 'VALIDATOR_PRIVATE', purpose: 'public → validator administration' },
  { from: 'PUBLIC_RPC', to: 'SIGNER_PRIVATE', purpose: 'RPC → HSM / signer' },
  { from: 'PUBLIC_EDGE', to: 'CUSTODY_PRIVATE', purpose: 'Explorer → custody signer' },
  { from: 'OPERATIONS_PRIVATE', to: 'SIGNER_PRIVATE', purpose: 'relayer → governance signer' },
  { from: 'PUBLIC_RPC', to: 'CUSTODY_PRIVATE', purpose: 'RPC → custody HSM' },
]);

export const EGRESS_CLASS_OWNERS: Readonly<Record<EgressClass, string>> = Object.freeze({
  ORACLE_COLLECTOR_SOURCE: 'oracle collector off-chain adapter',
  COMPLIANCE_PROVIDER: 'compliance provider off-chain adapter',
  RELEASE_INFRASTRUCTURE: 'release service',
  OBJECT_STORAGE_BACKUP: 'backup service',
  LOG_EXPORT: 'monitoring',
  METRICS_EXPORT: 'monitoring',
  CONTAINER_REGISTRY_PULL: 'release service',
  DNS_RESOLUTION: 'edge / RPC / Explorer',
});

export const CONSENSUS_ARBITRARY_EGRESS_FORBIDDEN = true as const;

export type NetworkPolicyDecision = {
  readonly allowed: boolean;
  readonly from: NetworkZone;
  readonly to: NetworkZone;
  readonly reason: string;
};

export function assertKnownZone(zone: string): NetworkZone {
  if (!(NETWORK_ZONES as readonly string[]).includes(zone)) {
    throw new TypeError(`unknown network zone ${zone}`);
  }
  return zone as NetworkZone;
}

export function evaluateNetworkPath(from: NetworkZone, to: NetworkZone): NetworkPolicyDecision {
  const forbidden = FORBIDDEN_NETWORK_PATHS.find((row) => row.from === from && row.to === to);
  if (forbidden) {
    return Object.freeze({
      allowed: false,
      from,
      to,
      reason: `forbidden: ${forbidden.purpose}`,
    });
  }
  const allowed = ALLOWED_NETWORK_PATHS.find((row) => row.from === from && row.to === to);
  if (allowed) {
    return Object.freeze({
      allowed: true,
      from,
      to,
      reason: allowed.purpose,
    });
  }
  return Object.freeze({
    allowed: false,
    from,
    to,
    reason: `denied by default: ${from} → ${to}`,
  });
}

export function authorizeNetworkPath(from: NetworkZone, to: NetworkZone): InfraResult<NetworkPolicyDecision> {
  const decision = evaluateNetworkPath(from, to);
  if (!decision.allowed) {
    return infraErr('NETWORK_ZONE_VIOLATION', decision.reason);
  }
  return infraOk(decision);
}

export function assertConsensusHasNoArbitraryEgress(): InfraResult<true> {
  if (!CONSENSUS_ARBITRARY_EGRESS_FORBIDDEN) {
    return infraErr('EGRESS_POLICY', 'consensus execution must never perform arbitrary external requests');
  }
  return infraOk(true);
}

export function documentedEgressClasses(): readonly {
  readonly egressClass: EgressClass;
  readonly owner: string;
  readonly consensusExecution: false;
}[] {
  return Object.freeze(
    EGRESS_CLASSES.map((egressClass) =>
      Object.freeze({
        egressClass,
        owner: EGRESS_CLASS_OWNERS[egressClass],
        consensusExecution: false as const,
      }),
    ),
  );
}
