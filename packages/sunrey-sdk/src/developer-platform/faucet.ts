import { TestnetFaucet } from '../../../sunrey-chain/src/testnet/faucet.ts';
import { SUNREY_TESTNET_1_NETWORK_ID, isTestnetNetworkId } from '../../../sunrey-chain/src/testnet/identity.ts';
import type { NativeAssetId } from '../../../sunrey-chain/src/protocol/assets.ts';

export const PRODUCTION_NETWORK_IDS = Object.freeze(['net_sunrey_mainnet_1', 'chn_sunrey_mainnet_1']);

export type DeveloperFaucetRequest = {
  readonly appId: string;
  readonly address: string;
  readonly asset: NativeAssetId | string;
  readonly quantity: bigint;
  readonly networkId?: string;
  readonly nowMs?: number;
};

export type DeveloperFaucetRejection =
  | 'PRODUCTION_ASSET_FORBIDDEN'
  | 'PRODUCTION_NETWORK_FORBIDDEN'
  | 'QUOTA_EXCEEDED'
  | 'FAUCET_REJECTED';

export class DeveloperFaucet {
  readonly faucet: TestnetFaucet;

  constructor(faucet?: TestnetFaucet) {
    this.faucet = faucet ?? new TestnetFaucet({ networkId: SUNREY_TESTNET_1_NETWORK_ID });
  }

  request(input: DeveloperFaucetRequest):
    | { readonly ok: true; readonly txId: string; readonly networkId: string; readonly asset: NativeAssetId }
    | { readonly ok: false; readonly reason: DeveloperFaucetRejection; readonly detail?: string } {
    const networkId = input.networkId ?? this.faucet.networkId;
    if (PRODUCTION_NETWORK_IDS.includes(networkId) || !isTestnetNetworkId(networkId)) {
      return { ok: false, reason: 'PRODUCTION_NETWORK_FORBIDDEN' };
    }
    if (input.asset !== 'SUNREY_COIN' && input.asset !== 'MOONREY_COIN') {
      return { ok: false, reason: 'PRODUCTION_ASSET_FORBIDDEN' };
    }
    const issued = this.faucet.request({
      address: input.address,
      asset: input.asset,
      quantity: input.quantity,
      clientId: input.appId,
      nowMs: input.nowMs ?? Date.now(),
    });
    if (!issued.ok) {
      return { ok: false, reason: 'FAUCET_REJECTED', detail: issued.code };
    }
    return {
      ok: true,
      txId: issued.tx.txId,
      networkId: issued.tx.networkId,
      asset: issued.tx.asset,
    };
  }

  status(): 'UP' | 'DOWN' | 'EMPTY' {
    return this.faucet.health();
  }
}
