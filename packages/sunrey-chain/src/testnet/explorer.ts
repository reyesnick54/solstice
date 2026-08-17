/**
 * Read-only Explorer for SunRey Testnet 1.
 *
 * Displays SUNREY TESTNET prominently. Does not label testnet supply
 * as production circulation. Cannot mutate the chain.
 */

import { SUNREY_TESTNET_1_BANNER, SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_DISPLAY_NAME, SUNREY_TESTNET_1_NETWORK_ID } from './identity.ts';
import { explorerMayMutate } from './security.ts';
import type { TestnetValidatorPublic } from './types.ts';

export type ExplorerTx = {
  readonly txId: string;
  readonly height: number;
  readonly from: string;
  readonly to: string;
  readonly asset: string;
  readonly quantity: string;
  readonly finalized: boolean;
  readonly kind: 'FAUCET' | 'TRANSFER' | 'PRODUCTIVE_ISSUANCE' | 'GOVERNANCE';
};

export type ExplorerAttribution = {
  readonly contributionId: string;
  readonly recipient: string;
  readonly asset: 'MOONREY_COIN';
  readonly quantity: string;
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly circulationLabel: 'TESTNET_DEVELOPMENT_UNITS';
};

export type ExplorerView = {
  readonly banner: typeof SUNREY_TESTNET_1_BANNER;
  readonly networkName: typeof SUNREY_TESTNET_1_DISPLAY_NAME;
  readonly networkId: typeof SUNREY_TESTNET_1_NETWORK_ID;
  readonly chainId: typeof SUNREY_TESTNET_1_CHAIN_ID;
  readonly height: number;
  readonly validators: readonly { readonly validatorId: string; readonly votingPower: string; readonly status: string }[];
  readonly governance: { readonly thresholdModel: string; readonly automaticBinaryUpgrade: false };
  readonly assets: readonly {
    readonly assetId: string;
    readonly tickerStatus: 'NOT_ASSIGNED';
    readonly testSupply: string;
    readonly productionCirculation: false;
  }[];
  readonly transactions: readonly ExplorerTx[];
  readonly attributions: readonly ExplorerAttribution[];
};

export class TestnetExplorer {
  readonly mayMutate = explorerMayMutate();
  private height = 0;
  private indexedHeight = 0;
  private readonly txs: ExplorerTx[] = [];
  private readonly attributions: ExplorerAttribution[] = [];
  private readonly validators: readonly TestnetValidatorPublic[];

  constructor(validators: readonly TestnetValidatorPublic[]) {
    this.validators = validators;
  }

  indexBlock(height: number, txs: readonly ExplorerTx[]): void {
    this.height = Math.max(this.height, height);
    this.indexedHeight = this.height;
    for (const tx of txs) {
      this.txs.push(tx);
    }
  }

  indexAttribution(row: ExplorerAttribution): void {
    this.attributions.push(row);
  }

  lag(): number {
    return Math.max(0, this.height - this.indexedHeight);
  }

  view(): ExplorerView {
    return {
      banner: SUNREY_TESTNET_1_BANNER,
      networkName: SUNREY_TESTNET_1_DISPLAY_NAME,
      networkId: SUNREY_TESTNET_1_NETWORK_ID,
      chainId: SUNREY_TESTNET_1_CHAIN_ID,
      height: this.height,
      validators: this.validators.map((row) => ({
        validatorId: row.validatorId,
        votingPower: row.votingPower.toString(),
        status: 'ACTIVE',
      })),
      governance: { thresholdModel: 'VALIDATOR_SUPERMAJORITY', automaticBinaryUpgrade: false },
      assets: [
        {
          assetId: 'SUNREY_COIN',
          tickerStatus: 'NOT_ASSIGNED',
          testSupply: this.txs
            .filter((tx) => tx.asset === 'SUNREY_COIN' && tx.finalized)
            .reduce((sum, tx) => sum + BigInt(tx.quantity), 0n)
            .toString(),
          productionCirculation: false,
        },
        {
          assetId: 'MOONREY_COIN',
          tickerStatus: 'NOT_ASSIGNED',
          testSupply: this.attributions.reduce((sum, row) => sum + BigInt(row.quantity), 0n).toString(),
          productionCirculation: false,
        },
      ],
      transactions: this.txs,
      attributions: this.attributions,
    };
  }

  findTx(txId: string): ExplorerTx | undefined {
    return this.txs.find((tx) => tx.txId === txId);
  }
}
