/**
 * In-process seven-validator testnet: genesis, seed/RPC/faucet/explorer,
 * SDK wallets, transfers, events, productive attribution, fault and upgrade.
 */

import { createHash } from 'node:crypto';

import { encodeFromPublicKey, publicDescriptorFromSeed, seedFromLabel } from '../wallet/index.ts';
import { runEnergyDemo } from '../productive/demo.ts';
import { TestnetExplorer, type ExplorerTx } from './explorer.ts';
import { TestnetFaucet } from './faucet.ts';
import { buildGenesis, testnet1GenesisInput } from './genesis.ts';
import { SUNREY_TESTNET_1_NETWORK_ID } from './identity.ts';
import { TestnetSdkClient, sunreyTestnet1SdkConfig } from './sdk-config.ts';
import { testnetHealth } from './status.ts';
import { bftQuorumSatisfied, sevenValidatorFixture } from './validators.ts';
import {
  activateUpgrade,
  authorizeUpgrade,
  catchUpIncompatible,
  proposeParameterUpgrade,
  scheduleUpgrade,
} from './upgrade.ts';
import type { TestnetGenesisBundle, TestnetHealth, TestnetValidatorPublic } from './types.ts';

export type ReplicaState = {
  readonly validatorId: string;
  height: number;
  stateRoot: string;
  online: boolean;
  protocolParam: number;
};

export type FinalizedTx = {
  readonly txId: string;
  readonly height: number;
  readonly from: string;
  readonly to: string;
  readonly asset: string;
  readonly quantity: bigint;
  readonly kind: ExplorerTx['kind'];
};

export type EventRecord = {
  readonly type: 'FINALITY';
  readonly txId: string;
  readonly height: number;
};

export class TestnetNetwork {
  readonly genesis: TestnetGenesisBundle;
  readonly validators: readonly TestnetValidatorPublic[];
  readonly faucet: TestnetFaucet;
  readonly explorer: TestnetExplorer;
  readonly sdk: TestnetSdkClient;
  readonly replicas: ReplicaState[];
  readonly events: EventRecord[] = [];
  readonly balances = new Map<string, { sunrey: bigint; moonrey: bigint }>();
  private height = 0;
  private txs: FinalizedTx[] = [];
  private seedOnline = true;
  private rpcOnline = true;

  constructor() {
    this.validators = sevenValidatorFixture();
    this.genesis = buildGenesis(testnet1GenesisInput(this.validators));
    this.faucet = new TestnetFaucet({ networkId: SUNREY_TESTNET_1_NETWORK_ID });
    this.explorer = new TestnetExplorer(this.validators);
    this.sdk = new TestnetSdkClient(
      sunreyTestnet1SdkConfig({
        rpcUrl: 'http://127.0.0.1:26657',
        explorerUrl: 'http://127.0.0.1:8080',
        faucetUrl: 'http://127.0.0.1:8787',
        genesisHash: this.genesis.genesisHash,
      }),
    );
    this.replicas = this.validators.map((row) => ({
      validatorId: row.validatorId,
      height: 0,
      stateRoot: this.genesis.genesisHash,
      online: true,
      protocolParam: 1000,
    }));
  }

  launch(): void {
    this.sdk.connect();
    this.seedOnline = true;
    this.rpcOnline = true;
    this.finalizeEmpty();
  }

  createWallet(label: string): { readonly address: string; readonly accountId: string } {
    const descriptor = publicDescriptorFromSeed(label, seedFromLabel(`testnet-wallet-${label}`));
    const address = encodeFromPublicKey(SUNREY_TESTNET_1_NETWORK_ID, 'SINGLE_KEY_ACCOUNT', descriptor);
    this.balances.set(address.text, { sunrey: 0n, moonrey: 0n });
    return { address: address.text, accountId: `bca.${label}` };
  }

  requestFaucet(address: string, asset: 'SUNREY_COIN' | 'MOONREY_COIN', quantity: bigint, clientId: string, nowMs: number): FinalizedTx {
    const issued = this.faucet.request({ address, asset, quantity, clientId, nowMs });
    if (!issued.ok) {
      throw new Error(`faucet refused: ${issued.code}`);
    }
    return this.commitTx({
      txId: issued.tx.txId,
      from: this.faucet.authorityId,
      to: address,
      asset,
      quantity,
      kind: 'FAUCET',
    });
  }

  transfer(from: string, to: string, quantity: bigint): FinalizedTx {
    const source = this.balances.get(from);
    if (!source || source.sunrey < quantity) {
      throw new Error('insufficient test SunRey');
    }
    return this.commitTx({
      txId: `tx.transfer.${this.txs.length + 1}`,
      from,
      to,
      asset: 'SUNREY_COIN',
      quantity,
      kind: 'TRANSFER',
    });
  }

  setValidatorOnline(validatorId: string, online: boolean): void {
    const replica = this.replicas.find((row) => row.validatorId === validatorId);
    if (replica) {
      replica.online = online;
    }
  }

  onlinePower(): bigint {
    return this.replicas.filter((row) => row.online).reduce((sum, row) => {
      const validator = this.validators.find((item) => item.validatorId === row.validatorId);
      return sum + (validator?.votingPower ?? 0n);
    }, 0n);
  }

  tryFinalizeEmpty(): { readonly finalized: boolean; readonly conflicting: boolean } {
    const power = this.onlinePower();
    const total = this.validators.reduce((sum, row) => sum + row.votingPower, 0n);
    if (!bftQuorumSatisfied(power, total)) {
      return { finalized: false, conflicting: false };
    }
    this.finalizeEmpty();
    return { finalized: true, conflicting: false };
  }

  partitionWithoutQuorum(left: readonly string[], right: readonly string[]): { readonly leftFinalized: boolean; readonly rightFinalized: boolean; readonly conflicting: boolean } {
    const leftPower = this.powerOf(left);
    const rightPower = this.powerOf(right);
    const total = this.validators.reduce((sum, row) => sum + row.votingPower, 0n);
    return {
      leftFinalized: bftQuorumSatisfied(leftPower, total),
      rightFinalized: bftQuorumSatisfied(rightPower, total),
      conflicting: false,
    };
  }

  runGovernedUpgrade(): {
    readonly authorized: boolean;
    readonly activated: boolean;
    readonly incompatibleIdentified: boolean;
    readonly networkContinues: boolean;
    readonly caughtUp: boolean;
  } {
    const proposed = proposeParameterUpgrade({
      upgradeId: 'upg.testnet.param.1',
      activationHeight: this.height + 4,
      currentHeight: this.height,
      minActivationLead: 4,
      parameter: 'timeoutProposeMs',
      nextValue: 250,
    });
    if ('ok' in proposed) {
      throw new Error('upgrade lead too short');
    }
    const voters = this.validators.slice(0, 5).map((row) => row.validatorId);
    const authorized = authorizeUpgrade(proposed, voters, this.validators);
    const scheduled = scheduleUpgrade(authorized);
    this.height = scheduled.activationHeight;
    const nodes = this.validators.map((row, index) => ({
      validatorId: row.validatorId,
      binaryVersion: index === 6 ? 'incompatible' : 'compatible',
    }));
    const activated = activateUpgrade(scheduled, this.height, nodes);
    const incompatible = activated.nodes.find((row) => !row.compatible);
    const recovered = incompatible ? catchUpIncompatible(incompatible) : null;
    return {
      authorized: authorized.status === 'AUTHORIZED',
      activated: activated.plan.status === 'ACTIVATED',
      incompatibleIdentified: incompatible?.mismatch === 'PROTOCOL_PARAMETER_MISMATCH',
      networkContinues: activated.networkContinues,
      caughtUp: recovered?.caughtUp === true,
    };
  }

  runMoonReyContribution(): { readonly quantity: string; readonly graphHash: string } {
    const demo = runEnergyDemo();
    const quantity = demo.supply.issued.toString();
    this.explorer.indexAttribution({
      contributionId: demo.objectId,
      recipient: 'alice',
      asset: 'MOONREY_COIN',
      quantity,
      tickerStatus: 'NOT_ASSIGNED',
      circulationLabel: 'TESTNET_DEVELOPMENT_UNITS',
    });
    return { quantity, graphHash: demo.graphHash };
  }

  replicasAgree(): boolean {
    const roots = new Set(this.replicas.filter((row) => row.online).map((row) => row.stateRoot));
    const heights = new Set(this.replicas.filter((row) => row.online).map((row) => row.height));
    return roots.size === 1 && heights.size === 1;
  }

  health(): TestnetHealth {
    return testnetHealth({
      height: this.height,
      finalizedHeight: this.height,
      onlineValidators: this.replicas.filter((row) => row.online).length,
      totalValidators: this.validators.length,
      onlinePower: this.onlinePower(),
      totalPower: this.validators.reduce((sum, row) => sum + row.votingPower, 0n),
      quorumSatisfied: bftQuorumSatisfied(
        this.onlinePower(),
        this.validators.reduce((sum, row) => sum + row.votingPower, 0n),
      ),
      rpcHealth: this.rpcOnline ? 'UP' : 'DOWN',
      explorerLag: this.explorer.lag(),
      faucetHealth: this.faucet.health(),
      genesisHash: this.genesis.genesisHash,
    });
  }

  seedIsOnline(): boolean {
    return this.seedOnline;
  }

  private powerOf(ids: readonly string[]): bigint {
    return ids.reduce((sum, id) => {
      const validator = this.validators.find((row) => row.validatorId === id);
      return sum + (validator?.votingPower ?? 0n);
    }, 0n);
  }

  private commitTx(input: {
    readonly txId: string;
    readonly from: string;
    readonly to: string;
    readonly asset: string;
    readonly quantity: bigint;
    readonly kind: ExplorerTx['kind'];
  }): FinalizedTx {
    if (!this.tryFinalizeEmpty().finalized) {
      throw new Error('no BFT quorum');
    }
    const fromBal = this.balances.get(input.from) ?? { sunrey: 0n, moonrey: 0n };
    const toBal = this.balances.get(input.to) ?? { sunrey: 0n, moonrey: 0n };
    if (input.kind === 'TRANSFER' && input.asset === 'SUNREY_COIN') {
      fromBal.sunrey -= input.quantity;
    }
    if (input.asset === 'SUNREY_COIN') {
      toBal.sunrey += input.quantity;
    } else {
      toBal.moonrey += input.quantity;
    }
    this.balances.set(input.from, fromBal);
    this.balances.set(input.to, toBal);
    const finalized: FinalizedTx = {
      txId: input.txId,
      height: this.height,
      from: input.from,
      to: input.to,
      asset: input.asset,
      quantity: input.quantity,
      kind: input.kind,
    };
    this.txs.push(finalized);
    this.explorer.indexBlock(this.height, [
      {
        txId: finalized.txId,
        height: finalized.height,
        from: finalized.from,
        to: finalized.to,
        asset: finalized.asset,
        quantity: finalized.quantity.toString(),
        finalized: true,
        kind: finalized.kind,
      },
    ]);
    this.events.push({ type: 'FINALITY', txId: finalized.txId, height: finalized.height });
    this.faucet.markFinal(finalized.txId, finalized.height);
    return finalized;
  }

  private finalizeEmpty(): void {
    this.height += 1;
    const root = createHash('sha256')
      .update(`${this.genesis.genesisHash}:${this.height}:${this.txs.length}`)
      .digest('hex');
    for (const replica of this.replicas) {
      if (replica.online) {
        replica.height = this.height;
        replica.stateRoot = root;
      }
    }
  }
}

export function runFullTestnetE2e(): {
  readonly ok: boolean;
  readonly genesisHash: string;
  readonly alice: string;
  readonly bob: string;
  readonly faucetTx: string;
  readonly transferTx: string;
  readonly explorerHasTransfer: boolean;
  readonly eventFinality: boolean;
  readonly moonreyAttributed: boolean;
  readonly replicasAgree: boolean;
  readonly banner: string;
} {
  const net = new TestnetNetwork();
  net.launch();
  const alice = net.createWallet('alice');
  const bob = net.createWallet('bob');
  const faucetTx = net.requestFaucet(alice.address, 'SUNREY_COIN', 1_000n, 'client-alice', 10_000);
  const transfer = net.transfer(alice.address, bob.address, 250n);
  const moonrey = net.runMoonReyContribution();
  const view = net.explorer.view();
  return {
    ok:
      net.sdk.isConnected() &&
      net.replicasAgree() &&
      Boolean(net.explorer.findTx(transfer.txId)) &&
      net.events.some((event) => event.txId === transfer.txId && event.type === 'FINALITY') &&
      view.banner === 'SUNREY TESTNET' &&
      view.assets.every((asset) => asset.productionCirculation === false) &&
      BigInt(moonrey.quantity) > 0n,
    genesisHash: net.genesis.genesisHash,
    alice: alice.address,
    bob: bob.address,
    faucetTx: faucetTx.txId,
    transferTx: transfer.txId,
    explorerHasTransfer: Boolean(net.explorer.findTx(transfer.txId)),
    eventFinality: net.events.some((event) => event.txId === transfer.txId),
    moonreyAttributed: view.attributions.length > 0,
    replicasAgree: net.replicasAgree(),
    banner: view.banner,
  };
}
