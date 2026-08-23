/**
 * Phase G Prompt 3 — canonical SunRey network identity.
 *
 * Transactions signed for one network must not replay on another.
 * MAINNET remains reserved and inactive.
 */

export const NETWORK_ENVIRONMENTS = [
  'LOCAL',
  'DEVNET',
  'TESTNET',
  'PREPRODUCTION',
  'MAINNET',
] as const;
export type NetworkEnvironment = (typeof NETWORK_ENVIRONMENTS)[number];

export type NetworkIdentity = {
  readonly environment: NetworkEnvironment;
  readonly networkId: string;
  readonly chainId: string;
  readonly canonical: boolean;
  readonly deployable: boolean;
  readonly mainnetActive: false;
  readonly productionNetworkEnabled: false;
};

export const NETWORK_REGISTRY: readonly NetworkIdentity[] = [
  {
    environment: 'LOCAL',
    networkId: 'net_sunrey_local',
    chainId: 'chn_sunrey_local',
    canonical: true,
    deployable: true,
    mainnetActive: false,
    productionNetworkEnabled: false,
  },
  {
    environment: 'LOCAL',
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    canonical: false,
    deployable: true,
    mainnetActive: false,
    productionNetworkEnabled: false,
  },
  {
    environment: 'DEVNET',
    networkId: 'net_sunrey_development',
    chainId: 'chn_sunrey_development',
    canonical: true,
    deployable: true,
    mainnetActive: false,
    productionNetworkEnabled: false,
  },
  {
    environment: 'TESTNET',
    networkId: 'net_sunrey_testnet_1',
    chainId: 'chn_sunrey_testnet_1',
    canonical: true,
    deployable: true,
    mainnetActive: false,
    productionNetworkEnabled: false,
  },
  {
    environment: 'PREPRODUCTION',
    networkId: 'net_sunrey_preproduction',
    chainId: 'chn_sunrey_preproduction',
    canonical: true,
    deployable: false,
    mainnetActive: false,
    productionNetworkEnabled: false,
  },
  {
    environment: 'MAINNET',
    networkId: 'net_sunrey_mainnet',
    chainId: 'chn_sunrey_mainnet',
    canonical: true,
    deployable: false,
    mainnetActive: false,
    productionNetworkEnabled: false,
  },
];

export function identityFor(
  networkId: string,
  chainId: string,
): NetworkIdentity | undefined {
  return NETWORK_REGISTRY.find((row) => row.networkId === networkId && row.chainId === chainId);
}

export function canonicalIdentity(environment: NetworkEnvironment): NetworkIdentity {
  const found = NETWORK_REGISTRY.find((row) => row.environment === environment && row.canonical);
  if (!found) {
    throw new Error('NETWORK_IDENTITY_MISSING');
  }
  return found;
}

export function replayBinding(networkId: string, chainId: string): string {
  return `sunrey.replay.v1|${networkId}|${chainId}`;
}

export function rejectCrossNetworkReplay(input: {
  readonly signedNetworkId: string;
  readonly signedChainId: string;
  readonly localNetworkId: string;
  readonly localChainId: string;
}): 'OK' | 'WRONG_NETWORK' | 'WRONG_CHAIN' {
  if (input.signedNetworkId !== input.localNetworkId) {
    return 'WRONG_NETWORK';
  }
  if (input.signedChainId !== input.localChainId) {
    return 'WRONG_CHAIN';
  }
  return 'OK';
}

export const ACTIVE_DEPLOYABLE_NETWORK: NetworkEnvironment = 'TESTNET';
export const MAINNET_INACTIVE = true;
