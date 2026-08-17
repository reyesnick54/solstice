import { opsErr, opsOk, type OpsResult, type SentryNodeConfig, type SentryTopology } from './types.ts';

export function validateSentryTopology(topology: SentryTopology): OpsResult<true> {
  if (topology.sentries.length < 2) {
    return opsErr('INSUFFICIENT_SENTRIES', 'at least two sentries are required per validator');
  }
  const ids = new Set<string>();
  for (const sentry of topology.sentries) {
    if (sentry.sentryId === topology.validatorId || sentry.peerId === topology.validatorPeerId) {
      return opsErr('UNSAFE_CONFIG', 'a sentry cannot share the validator identity');
    }
    if (ids.has(sentry.peerId)) {
      return opsErr('UNSAFE_CONFIG', 'sentry peer paths must be diverse');
    }
    ids.add(sentry.peerId);
  }
  return opsOk(true);
}

export function developmentSentryTopology(validatorId = 'val_dev_a'): SentryTopology {
  return Object.freeze({
    validatorId,
    validatorPeerId: `node_${validatorId}`,
    sentries: Object.freeze([
      Object.freeze({ sentryId: `${validatorId}_sentry_1`, peerId: 'sentry_a', address: '10.0.0.11:26656' }),
      Object.freeze({ sentryId: `${validatorId}_sentry_2`, peerId: 'sentry_b', address: '10.0.0.12:26656' }),
    ]),
  });
}

export function developmentSentryConfig(
  topology: SentryTopology,
  sentryIndex: 0 | 1,
): SentryNodeConfig {
  const sentry = topology.sentries[sentryIndex]!;
  return Object.freeze({
    schemaVersion: 1,
    role: 'SENTRY',
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    p2pListen: sentry.address,
    validatorPeerId: topology.validatorPeerId,
    publicPeers: Object.freeze(['0.0.0.0:26656']),
    hasConsensusVotingKey: false,
  });
}

export function sentryCanSign(_config: SentryNodeConfig): OpsResult<never> {
  return opsErr('SENTRY_CANNOT_SIGN', 'a compromised sentry must not be able to forge validator votes');
}

export function availableSentryCount(
  topology: SentryTopology,
  unavailable: ReadonlySet<string>,
): number {
  return topology.sentries.filter((sentry) => !unavailable.has(sentry.sentryId)).length;
}

export function validatorPublicExposureMinimized(topology: SentryTopology): boolean {
  return topology.sentries.length >= 2 && topology.sentries.every((sentry) => sentry.address !== '');
}
