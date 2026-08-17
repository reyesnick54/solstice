import {
  DEFAULT_LOG_POLICY,
  DEFAULT_RESOURCE_LIMITS,
  FORBIDDEN_VALIDATOR_HOSTED_SERVICES,
  OPS_SCHEMA_VERSION,
  opsErr,
  opsOk,
  type OpsResult,
  type PeerDescriptor,
  type PeerPolicy,
  type RpcBinding,
  type SignerEndpoint,
  type ValidatorNodeConfig,
} from './types.ts';

const PRIVATE_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'unix']);

function isPrivateHost(host: string): boolean {
  if (PRIVATE_HOSTS.has(host)) {
    return true;
  }
  if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.')) {
    return true;
  }
  return host.startsWith('/');
}

export function defaultPeerPolicy(sentryPeerIds: readonly string[]): PeerPolicy {
  return Object.freeze({
    persistentSentryPeers: [...sentryPeerIds],
    allowedPrivatePeers: [...sentryPeerIds],
    maxConnections: 64,
    scoreThreshold: 20,
    temporaryBanMs: 30_000,
    diversityWarnBelow: 2,
  });
}

export function developmentValidatorConfig(input: {
  readonly dataDirectory: string;
  readonly sentryPeers?: readonly PeerDescriptor[];
  readonly signer?: Partial<SignerEndpoint>;
  readonly rpc?: Partial<RpcBinding>;
  readonly hostedServices?: readonly string[];
  readonly maintenanceMode?: boolean;
}): ValidatorNodeConfig {
  const sentries = input.sentryPeers ?? [
    Object.freeze({ peerId: 'sentry_a', kind: 'SENTRY' as const, address: '10.0.0.11:26656', persistent: true }),
    Object.freeze({ peerId: 'sentry_b', kind: 'SENTRY' as const, address: '10.0.0.12:26656', persistent: true }),
  ];
  return Object.freeze({
    schemaVersion: OPS_SCHEMA_VERSION,
    role: 'VALIDATOR',
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    protocolVersion: '1',
    dataDirectory: input.dataDirectory,
    p2pListen: '10.0.0.2:26656',
    sentryPeers: Object.freeze([...sentries]),
    signer: Object.freeze({
      transport: input.signer?.transport ?? 'UNIX_DOMAIN_SOCKET',
      endpoint: input.signer?.endpoint ?? `${input.dataDirectory}/signer.sock`,
      clientId: input.signer?.clientId ?? 'validator-client-a',
      serverName: input.signer?.serverName,
    }),
    rpc: Object.freeze({
      host: input.rpc?.host ?? '127.0.0.1',
      port: input.rpc?.port ?? 26657,
      public: input.rpc?.public ?? false,
    }),
    metricsEndpoint: '127.0.0.1:9100',
    stateSync: Object.freeze({
      mode: 'GENESIS_BLOCK_SYNC',
      trustedHeight: 0n,
      trustedBlockId: 'GENESIS',
      trustedStateRoot: '0'.repeat(64),
    }),
    snapshot: Object.freeze({
      directory: `${input.dataDirectory}/snapshots`,
      retain: 3,
    }),
    logPolicy: DEFAULT_LOG_POLICY,
    resourceLimits: DEFAULT_RESOURCE_LIMITS,
    peerPolicy: defaultPeerPolicy(sentries.map((peer) => peer.peerId)),
    hostedServices: Object.freeze([...(input.hostedServices ?? [])]),
    maintenanceMode: input.maintenanceMode ?? false,
  });
}

export function validateValidatorConfig(config: ValidatorNodeConfig): OpsResult<true> {
  if (config.role === 'VALIDATOR') {
    for (const service of config.hostedServices) {
      if ((FORBIDDEN_VALIDATOR_HOSTED_SERVICES as readonly string[]).includes(service)) {
        return opsErr(
          'FORBIDDEN_HOSTED_SERVICE',
          `validator trust zone cannot host ${service}`,
        );
      }
    }
    if (config.rpc.public) {
      return opsErr('UNSAFE_CONFIG', 'validator profile must not bind public RPC');
    }
    if (!isPrivateHost(config.rpc.host)) {
      return opsErr(
        'UNSAFE_CONFIG',
        'validator ordinary RPC must bind locally or to a private operator network',
      );
    }
    const sentries = config.sentryPeers.filter((peer) => peer.kind === 'SENTRY');
    if (sentries.length < 2) {
      return opsErr('INSUFFICIENT_SENTRIES', 'validator deployment requires at least two sentries');
    }
    if (config.signer.transport === 'MTLS' && !config.signer.serverName) {
      return opsErr('UNSAFE_CONFIG', 'mTLS signer endpoint requires a server name');
    }
    if (config.signer.transport === 'UNIX_DOMAIN_SOCKET' && !config.signer.endpoint.startsWith('/')) {
      return opsErr('UNSAFE_CONFIG', 'UDS signer endpoint must be an absolute path');
    }
  }
  if (config.peerPolicy.maxConnections < 1) {
    return opsErr('UNSAFE_CONFIG', 'max connections must be positive');
  }
  if (config.resourceLimits.diskWarnRatio <= 0 || config.resourceLimits.diskWarnRatio >= 1) {
    return opsErr('UNSAFE_CONFIG', 'disk warn ratio is an operator threshold, not a protocol rule');
  }
  return opsOk(true);
}
