/**
 * Read-only canonical chain queries.
 *
 * Queries never mutate state. Only finalized history is authoritative.
 */

import type { MonetaryStateStore } from './monetary-state.ts';
import type {
  FinalizedBlock,
  NetworkStatus,
  TransactionLifecycleRecord,
  ValidatorPower,
} from './types.ts';
import { isCanonicalTruth } from './lifecycle.ts';

export type ChainQuerySurface = {
  networkStatus(): NetworkStatus;
  latestFinalizedBlock(): FinalizedBlock | null;
  blockByHeight(height: bigint): FinalizedBlock | null;
  blockByHash(blockHash: string): FinalizedBlock | null;
  transactionById(txId: string): TransactionLifecycleRecord | null;
  transactionStatus(txId: string): TransactionLifecycleRecord | null;
  accountBalance(accountId: string, assetId: 'SUNREY_COIN' | 'MOONREY_COIN'): bigint;
  accountNonce(accountId: string): bigint;
  nativeAssetSupply(assetId: 'SUNREY_COIN' | 'MOONREY_COIN'): {
    readonly issued: bigint;
    readonly burned: bigint;
    readonly circulating: bigint;
    readonly locked: bigint;
  };
  protocolVersion(): string;
  validatorConsensusStatus(): {
    readonly validatorCount: number;
    readonly totalVotingPower: string;
    readonly quorumPower: string;
    readonly latestFinalizedHeight: string;
  };
};

export function createChainQueries(input: {
  readonly identity: { readonly networkId: string; readonly chainId: string; readonly protocolVersion: string };
  readonly finalizedBlocks: ReadonlyMap<string, FinalizedBlock>;
  readonly finalizedByHeight: ReadonlyMap<string, FinalizedBlock>;
  readonly lifecycle: ReadonlyMap<string, TransactionLifecycleRecord>;
  readonly canonicalState: MonetaryStateStore;
  readonly validators: readonly ValidatorPower[];
  readonly quorumPower: bigint;
}): ChainQuerySurface {
  const latest = [...input.finalizedByHeight.values()].sort((left, right) =>
    left.header.height === right.header.height ? 0 : left.header.height < right.header.height ? -1 : 1,
  ).at(-1) ?? null;

  return {
    networkStatus(): NetworkStatus {
      return {
        networkId: input.identity.networkId,
        chainId: input.identity.chainId,
        protocolVersion: input.identity.protocolVersion,
        latestFinalizedHeight: latest?.header.height ?? 0n,
        latestFinalizedBlockHash: latest?.blockHash ?? null,
        resultingStateCommitment: latest ? hashFromState(input.canonicalState) : null,
        validatorSetHash: latest ? hashToHex(latest.header.validatorSetHash) : null,
        consensusModel: 'BFT_DETERMINISTIC',
      };
    },
    latestFinalizedBlock() {
      return latest;
    },
    blockByHeight(height: bigint) {
      return input.finalizedByHeight.get(String(height)) ?? null;
    },
    blockByHash(blockHash: string) {
      return input.finalizedBlocks.get(blockHash) ?? null;
    },
    transactionById(txId: string) {
      return input.lifecycle.get(txId) ?? null;
    },
    transactionStatus(txId: string) {
      const row = input.lifecycle.get(txId);
      if (!row) {
        return null;
      }
      if (!isCanonicalTruth(row.status)) {
        return row;
      }
      return row;
    },
    accountBalance(accountId, assetId) {
      return input.canonicalState.availableBalance(accountId, assetId);
    },
    accountNonce(accountId) {
      return input.canonicalState.nonceOf(accountId);
    },
    nativeAssetSupply(assetId) {
      const supply = input.canonicalState.supplyOf(assetId);
      return {
        issued: supply.issued,
        burned: supply.burned,
        circulating: supply.circulating,
        locked: supply.locked,
      };
    },
    protocolVersion() {
      return input.identity.protocolVersion;
    },
    validatorConsensusStatus() {
      const total = input.validators.reduce((sum, row) => sum + row.votingPower, 0n);
      return {
        validatorCount: input.validators.length,
        totalVotingPower: total.toString(),
        quorumPower: input.quorumPower.toString(),
        latestFinalizedHeight: (latest?.header.height ?? 0n).toString(),
      };
    },
  };
}

function hashFromState(state: MonetaryStateStore): string {
  return state.commitment();
}

function hashToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}
