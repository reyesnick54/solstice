/**
 * Deterministic non-production custody adapters A/B.
 * Clearly not a live custodian. Used for contract and replacement tests.
 */

import type { NativeCustodyAssetId } from '../native-assets.ts';
import {
  emptyBalance,
  mapProviderDepositLifecycle,
  mapProviderWithdrawalLifecycle,
  type CustodyProviderCapability,
  type CustodyProviderContract,
  type NormalizedCustodyBalance,
  type NormalizedCustodyTransaction,
  type NormalizedCustodyWallet,
  type NormalizedNetworkFee,
} from './contract.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export type CustodySandboxScenario =
  | 'healthy'
  | 'unavailable'
  | 'pending'
  | 'rejected'
  | 'failed'
  | 'unknown_transaction'
  | 'duplicate_webhook'
  | 'wrong_environment';

type StoredWallet = Omit<NormalizedCustodyWallet, 'balance'> & { balance: bigint };
type StoredTx = NormalizedCustodyTransaction;

export class DeterministicCustodyAdapter implements CustodyProviderContract {
  readonly productionAuthorized = false as const;
  readonly liveProviderConnected = false as const;
  readonly environment: 'SIMULATION' | 'SANDBOX' = 'SANDBOX';
  readonly capabilities: readonly CustodyProviderCapability[] = [
    'CREATE_VAULT',
    'CREATE_WALLET',
    'GET_WALLET',
    'GET_BALANCE',
    'GET_ADDRESS',
    'CREATE_DEPOSIT_ADDRESS',
    'CREATE_WITHDRAWAL',
    'APPROVE_WITHDRAWAL',
    'GET_TRANSACTION',
    'GET_TRANSACTION_STATUS',
    'GET_NETWORK_FEE',
    'LIST_TRANSACTIONS',
    'CONFIGURE_POLICY',
    'INGEST_WEBHOOK',
  ];

  readonly #vaults = new Set<string>();
  readonly #wallets = new Map<string, StoredWallet>();
  readonly #txs = new Map<string, StoredTx>();
  #scenario: CustodySandboxScenario = 'healthy';

  readonly providerId: string;
  readonly adapterId: string;

  constructor(providerId: string, adapterId: string) {
    this.providerId = providerId;
    this.adapterId = adapterId;
  }

  setScenario(scenario: CustodySandboxScenario): void {
    this.#scenario = scenario;
  }

  createVault(input: { readonly vaultId: string; readonly label: string }): CustodyCandidateResult<{ readonly vaultId: string }> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    this.#vaults.add(input.vaultId);
    return candidateOk(Object.freeze({ vaultId: input.vaultId }));
  }

  createWallet(input: {
    readonly vaultId: string;
    readonly walletId: string;
    readonly assetId: NativeCustodyAssetId;
    readonly network: string;
  }): CustodyCandidateResult<NormalizedCustodyWallet> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    if (!this.#vaults.has(input.vaultId)) {
      this.#vaults.add(input.vaultId);
    }
    const wallet: StoredWallet = {
      walletId: input.walletId,
      vaultId: input.vaultId,
      assetId: input.assetId,
      address: `${this.providerId}:${input.network}:${input.walletId}`,
      network: input.network,
      providerWalletRef: `${this.adapterId}:${input.walletId}`,
      isChainState: false,
      isCustomerProductBalance: false,
      balance: 0n,
    };
    this.#wallets.set(input.walletId, wallet);
    return candidateOk(this.#publicWallet(wallet));
  }

  getWallet(walletId: string): CustodyCandidateResult<NormalizedCustodyWallet> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    const wallet = this.#wallets.get(walletId);
    if (!wallet) return candidateErr('WALLET_NOT_FOUND', 'wallet not found');
    return candidateOk(this.#publicWallet(wallet));
  }

  getAddress(walletId: string): CustodyCandidateResult<{ readonly address: string }> {
    const wallet = this.getWallet(walletId);
    if (!wallet.ok) return wallet;
    return candidateOk(Object.freeze({ address: wallet.value.address }));
  }

  createDepositAddress(walletId: string): CustodyCandidateResult<{ readonly address: string; readonly walletId: string }> {
    const wallet = this.getWallet(walletId);
    if (!wallet.ok) return wallet;
    return candidateOk(Object.freeze({ address: wallet.value.address, walletId }));
  }

  getBalance(walletId: string): CustodyCandidateResult<NormalizedCustodyBalance> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    const wallet = this.#wallets.get(walletId);
    if (!wallet) return candidateOk(emptyBalance('SUNREY_COIN'));
    return candidateOk(
      Object.freeze({
        ...emptyBalance(wallet.assetId),
        quantity: wallet.balance,
      }),
    );
  }

  getNetworkFee(assetId: NativeCustodyAssetId): CustodyCandidateResult<NormalizedNetworkFee> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    return candidateOk(
      Object.freeze({
        assetId,
        quantity: 1n,
        estimated: true,
        source: 'CUSTODY_PROVIDER',
      }),
    );
  }

  simulateDeposit(walletId: string, quantity: bigint, transactionRef: string): CustodyCandidateResult<NormalizedCustodyTransaction> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    const wallet = this.#wallets.get(walletId);
    if (!wallet) return candidateErr('WALLET_NOT_FOUND', 'wallet not found');
    wallet.balance += quantity;
    const tx = this.#tx({
      transactionRef,
      kind: 'DEPOSIT',
      assetId: wallet.assetId,
      quantity,
      depositLifecycle: 'confirmed',
      withdrawalLifecycle: null,
      confirmations: 6,
      unknownTransaction: false,
      providerStatus: 'CONFIRMED',
    });
    this.#txs.set(transactionRef, tx);
    return candidateOk(tx);
  }

  createWithdrawal(input: {
    readonly withdrawalId: string;
    readonly walletId: string;
    readonly destination: string;
    readonly assetId: NativeCustodyAssetId;
    readonly quantity: bigint;
  }): CustodyCandidateResult<NormalizedCustodyTransaction> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    if (this.#scenario === 'rejected') {
      return candidateOk(
        this.#storeTx(
          this.#tx({
            transactionRef: input.withdrawalId,
            kind: 'WITHDRAWAL',
            assetId: input.assetId,
            quantity: input.quantity,
            depositLifecycle: null,
            withdrawalLifecycle: 'rejected',
            confirmations: 0,
            unknownTransaction: false,
            providerStatus: 'REJECTED',
          }),
        ),
      );
    }
    if (this.#scenario === 'failed') {
      return candidateOk(
        this.#storeTx(
          this.#tx({
            transactionRef: input.withdrawalId,
            kind: 'WITHDRAWAL',
            assetId: input.assetId,
            quantity: input.quantity,
            depositLifecycle: null,
            withdrawalLifecycle: 'failed',
            confirmations: 0,
            unknownTransaction: false,
            providerStatus: 'FAILED',
          }),
        ),
      );
    }
    const wallet = this.#wallets.get(input.walletId);
    if (!wallet) return candidateErr('WALLET_NOT_FOUND', 'wallet not found');
    const lifecycle = this.#scenario === 'pending' ? 'pending' : 'requested';
    const tx = this.#tx({
      transactionRef: input.withdrawalId,
      kind: 'WITHDRAWAL',
      assetId: input.assetId,
      quantity: input.quantity,
      depositLifecycle: null,
      withdrawalLifecycle: lifecycle,
      confirmations: 0,
      unknownTransaction: false,
      providerStatus: lifecycle.toUpperCase(),
    });
    this.#txs.set(input.withdrawalId, tx);
    return candidateOk(tx);
  }

  approveWithdrawal(withdrawalId: string): CustodyCandidateResult<NormalizedCustodyTransaction> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    const existing = this.#txs.get(withdrawalId);
    if (!existing) return candidateErr('WITHDRAWAL_NOT_FOUND', 'withdrawal not found');
    if (this.#scenario === 'rejected' || existing.withdrawalLifecycle === 'rejected') {
      return candidateErr('WITHDRAWAL_REJECTED', 'provider rejected withdrawal');
    }
    const wallet = [...this.#wallets.values()].find((row) => row.assetId === existing.assetId);
    if (wallet && wallet.balance >= existing.quantity) {
      wallet.balance -= existing.quantity;
    }
    const tx = this.#tx({
      ...existing,
      withdrawalLifecycle: 'finalized',
      confirmations: 1,
      providerStatus: 'FINALIZED',
    });
    this.#txs.set(withdrawalId, tx);
    return candidateOk(tx);
  }

  getTransaction(transactionRef: string): CustodyCandidateResult<NormalizedCustodyTransaction> {
    const blocked = this.#blocked();
    if (blocked) return blocked;
    if (this.#scenario === 'unknown_transaction') {
      return candidateErr('UNKNOWN_TRANSACTION', 'provider does not recognize transaction');
    }
    const tx = this.#txs.get(transactionRef);
    if (!tx) return candidateErr('UNKNOWN_TRANSACTION', 'provider does not recognize transaction');
    return candidateOk(tx);
  }

  getTransactionStatus(transactionRef: string): CustodyCandidateResult<NormalizedCustodyTransaction> {
    return this.getTransaction(transactionRef);
  }

  listTransactions(walletId: string): CustodyCandidateResult<readonly NormalizedCustodyTransaction[]> {
    const wallet = this.#wallets.get(walletId);
    if (!wallet) return candidateOk(Object.freeze([]));
    return candidateOk(Object.freeze([...this.#txs.values()].filter((row) => row.assetId === wallet.assetId)));
  }

  configurePolicy(input: { readonly walletId: string; readonly policyRef: string }): CustodyCandidateResult<{ readonly policyRef: string }> {
    const wallet = this.getWallet(input.walletId);
    if (!wallet.ok) return wallet;
    return candidateOk(Object.freeze({ policyRef: input.policyRef }));
  }

  #blocked(): CustodyCandidateResult<never> | null {
    if (this.#scenario === 'unavailable') {
      return candidateErr('CUSTODY_UNAVAILABLE', 'custody provider unavailable');
    }
    if (this.#scenario === 'wrong_environment') {
      return candidateErr('WRONG_ENVIRONMENT', 'sandbox credentials cannot target production');
    }
    return null;
  }

  #publicWallet(wallet: StoredWallet): NormalizedCustodyWallet {
    const { balance: _balance, ...pub } = wallet;
    return Object.freeze(pub);
  }

  #tx(input: {
    readonly transactionRef: string;
    readonly kind: 'DEPOSIT' | 'WITHDRAWAL' | 'UNKNOWN';
    readonly assetId: NativeCustodyAssetId;
    readonly quantity: bigint;
    readonly depositLifecycle: StoredTx['depositLifecycle'];
    readonly withdrawalLifecycle: StoredTx['withdrawalLifecycle'];
    readonly confirmations: number;
    readonly unknownTransaction: boolean;
    readonly providerStatus: string;
  }): StoredTx {
    return Object.freeze({
      transactionRef: input.transactionRef,
      kind: input.kind,
      assetId: input.assetId,
      quantity: input.quantity,
      depositLifecycle: input.depositLifecycle,
      withdrawalLifecycle: input.withdrawalLifecycle,
      custodyDepositState: input.depositLifecycle ? mapProviderDepositLifecycle(input.depositLifecycle) : null,
      custodyWithdrawalState: input.withdrawalLifecycle
        ? mapProviderWithdrawalLifecycle(input.withdrawalLifecycle)
        : null,
      confirmations: input.confirmations,
      unknownTransaction: input.unknownTransaction,
      providerStatus: input.providerStatus,
    });
  }

  #storeTx(tx: StoredTx): StoredTx {
    this.#txs.set(tx.transactionRef, tx);
    return tx;
  }
}

export function createCustodyProviderA(): DeterministicCustodyAdapter {
  return new DeterministicCustodyAdapter('fixture-custody-a', 'adapter.custody.a');
}

export function createCustodyProviderB(): DeterministicCustodyAdapter {
  return new DeterministicCustodyAdapter('fixture-custody-b', 'adapter.custody.b');
}
