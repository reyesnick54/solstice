/**
 * Named SDK network for Chunk 51 / testnet clients.
 *
 * RPC, Explorer, and faucet URLs are configurable. No public domain
 * is hard-coded unless an operator deliberately supplies one.
 */

import {
  SUNREY_TESTNET_1_CHAIN_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  SUNREY_TESTNET_1_SDK_NAME,
  TESTNET_ADDRESS_HRP,
} from './identity.ts';

export type SunReyNamedNetwork = 'SUNREY_TESTNET_1';

export type SunReySdkNetworkConfig = {
  readonly name: SunReyNamedNetwork;
  readonly displayName: 'SunRey Testnet 1';
  readonly banner: 'SUNREY TESTNET';
  readonly networkId: typeof SUNREY_TESTNET_1_NETWORK_ID;
  readonly chainId: typeof SUNREY_TESTNET_1_CHAIN_ID;
  readonly addressHrp: typeof TESTNET_ADDRESS_HRP;
  readonly rpcUrl: string;
  readonly explorerUrl: string;
  readonly faucetUrl: string;
  readonly genesisHash: string;
  readonly productionBankingRails: false;
};

export function sunreyTestnet1SdkConfig(input?: {
  readonly rpcUrl?: string;
  readonly explorerUrl?: string;
  readonly faucetUrl?: string;
  readonly genesisHash?: string;
}): SunReySdkNetworkConfig {
  return Object.freeze({
    name: SUNREY_TESTNET_1_SDK_NAME,
    displayName: 'SunRey Testnet 1',
    banner: 'SUNREY TESTNET',
    networkId: SUNREY_TESTNET_1_NETWORK_ID,
    chainId: SUNREY_TESTNET_1_CHAIN_ID,
    addressHrp: TESTNET_ADDRESS_HRP,
    rpcUrl: input?.rpcUrl ?? '',
    explorerUrl: input?.explorerUrl ?? '',
    faucetUrl: input?.faucetUrl ?? '',
    genesisHash: input?.genesisHash ?? '',
    productionBankingRails: false,
  });
}

export class TestnetSdkClient {
  readonly config: SunReySdkNetworkConfig;
  private connected = false;

  constructor(config: SunReySdkNetworkConfig = sunreyTestnet1SdkConfig()) {
    this.config = config;
  }

  connect(): { readonly ok: true; readonly network: SunReyNamedNetwork } {
    this.connected = true;
    return { ok: true, network: this.config.name };
  }

  isConnected(): boolean {
    return this.connected;
  }
}
