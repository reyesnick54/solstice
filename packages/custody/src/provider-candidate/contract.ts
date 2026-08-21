/**
 * Phase D productized custody provider contract.
 *
 * Extends the existing provider-candidate owner. Does not replace
 * CustodyProviderPort or create a second custody domain. Vendor
 * vocabulary is normalized here; adapters never become Ledger, Chain,
 * Exchange, or customer-product truth.
 */

import { assertSimulationOnly } from '../../../config/src/flags.ts';
import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { DepositState, WithdrawalState } from '../taxonomy.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export const CUSTODY_CONTRACT_VERSION = 'sunrey-custody-provider-contract/1' as const;
export const CUSTODY_PROVIDER_IS_NOT_LEDGER = true as const;
export const CUSTODY_PROVIDER_IS_NOT_CHAIN = true as const;

export const CUSTODY_PROVIDER_CAPABILITIES = [
  'CREATE_VAULT',
  'CREATE_WALLET',
  'GET_WALLET',
  'GET_BALANCE',
  'GET_ADDRESS',
  'CREATE_DEPOSIT_ADDRESS',
  'CREATE_WITHDRAWAL',
  'APPROVE_WITHDRAWAL',
  'SIGN_WITHDRAWAL',
  'GET_TRANSACTION',
  'GET_TRANSACTION_STATUS',
  'GET_NETWORK_FEE',
  'LIST_TRANSACTIONS',
  'CONFIGURE_POLICY',
  'INGEST_WEBHOOK',
] as const;
export type CustodyProviderCapability = (typeof CUSTODY_PROVIDER_CAPABILITIES)[number];

export const PROVIDER_DEPOSIT_LIFECYCLE = [
  'detected',
  'confirming',
  'confirmed',
  'credited',
  'reorg_review',
  'failed',
  'review',
] as const;
export type ProviderDepositLifecycle = (typeof PROVIDER_DEPOSIT_LIFECYCLE)[number];

export const PROVIDER_WITHDRAWAL_LIFECYCLE = [
  'requested',
  'pending',
  'approved',
  'rejected',
  'submitted',
  'confirming',
  'finalized',
  'failed',
] as const;
export type ProviderWithdrawalLifecycle = (typeof PROVIDER_WITHDRAWAL_LIFECYCLE)[number];

export type NormalizedCustodyWallet = {
  readonly walletId: string;
  readonly vaultId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly address: string;
  readonly network: string;
  readonly providerWalletRef: string;
  readonly isChainState: false;
  readonly isCustomerProductBalance: false;
};

export type NormalizedCustodyBalance = {
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly plane: 'CUSTODY_PROVIDER_REPORTED_STATE';
  readonly isFiatLedgerBalance: false;
  readonly isAssetSupplyBook: false;
  readonly isExchangeInternalPosition: false;
  readonly isCustomerProductReadModel: false;
};

export type NormalizedNetworkFee = {
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly estimated: true;
  readonly source: 'CUSTODY_PROVIDER';
};

export type NormalizedCustodyTransaction = {
  readonly transactionRef: string;
  readonly kind: 'DEPOSIT' | 'WITHDRAWAL' | 'UNKNOWN';
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
  readonly depositLifecycle: ProviderDepositLifecycle | null;
  readonly withdrawalLifecycle: ProviderWithdrawalLifecycle | null;
  readonly custodyDepositState: DepositState | null;
  readonly custodyWithdrawalState: WithdrawalState | null;
  readonly confirmations: number;
  readonly unknownTransaction: boolean;
  readonly providerStatus: string;
};

export type CustodyProviderContract = {
  readonly providerId: string;
  readonly adapterId: string;
  readonly environment: 'SIMULATION' | 'SANDBOX';
  readonly productionAuthorized: false;
  readonly liveProviderConnected: false;
  readonly capabilities: readonly CustodyProviderCapability[];
  createVault(input: { readonly vaultId: string; readonly label: string }): CustodyCandidateResult<{ readonly vaultId: string }>;
  createWallet(input: {
    readonly vaultId: string;
    readonly walletId: string;
    readonly assetId: NativeCustodyAssetId;
    readonly network: string;
  }): CustodyCandidateResult<NormalizedCustodyWallet>;
  getWallet(walletId: string): CustodyCandidateResult<NormalizedCustodyWallet>;
  getAddress(walletId: string): CustodyCandidateResult<{ readonly address: string }>;
  createDepositAddress(walletId: string): CustodyCandidateResult<{ readonly address: string; readonly walletId: string }>;
  getBalance(walletId: string): CustodyCandidateResult<NormalizedCustodyBalance>;
  getNetworkFee(assetId: NativeCustodyAssetId): CustodyCandidateResult<NormalizedNetworkFee>;
  createWithdrawal(input: {
    readonly withdrawalId: string;
    readonly walletId: string;
    readonly destination: string;
    readonly assetId: NativeCustodyAssetId;
    readonly quantity: bigint;
  }): CustodyCandidateResult<NormalizedCustodyTransaction>;
  approveWithdrawal(withdrawalId: string): CustodyCandidateResult<NormalizedCustodyTransaction>;
  getTransaction(transactionRef: string): CustodyCandidateResult<NormalizedCustodyTransaction>;
  getTransactionStatus(transactionRef: string): CustodyCandidateResult<NormalizedCustodyTransaction>;
  listTransactions(walletId: string): CustodyCandidateResult<readonly NormalizedCustodyTransaction[]>;
  configurePolicy(input: { readonly walletId: string; readonly policyRef: string }): CustodyCandidateResult<{ readonly policyRef: string }>;
};

export function mapProviderDepositLifecycle(state: ProviderDepositLifecycle): DepositState {
  switch (state) {
    case 'detected':
      return 'NOTICE_RECEIVED';
    case 'confirming':
      return 'AWAITING_FINALITY';
    case 'confirmed':
      return 'FINAL';
    case 'credited':
      return 'CREDITED';
    case 'reorg_review':
    case 'review':
      return 'SCREENED';
    case 'failed':
      return 'BLOCKED';
  }
}

export function mapProviderWithdrawalLifecycle(state: ProviderWithdrawalLifecycle): WithdrawalState {
  switch (state) {
    case 'requested':
      return 'REQUESTED';
    case 'pending':
      return 'POLICY_CHECKED';
    case 'approved':
      return 'AUTHORIZED';
    case 'rejected':
      return 'BLOCKED';
    case 'submitted':
      return 'SUBMITTED';
    case 'confirming':
      return 'SUBMISSION_UNKNOWN';
    case 'finalized':
      return 'FINALIZED';
    case 'failed':
      return 'BLOCKED';
  }
}

export function rejectUnverifiedDepositCredit(): CustodyCandidateResult<never> {
  assertSimulationOnly();
  return candidateErr('UNVERIFIED_DEPOSIT', 'deposit detection requires verified provider/network evidence');
}

export function rejectAiCustodyBypass(): CustodyCandidateResult<never> {
  return candidateErr('AI_CANNOT_BYPASS_CUSTODY_WORKFLOW', 'AI Agent cannot bypass custody withdrawal workflow');
}

export function emptyBalance(assetId: NativeCustodyAssetId): NormalizedCustodyBalance {
  return Object.freeze({
    assetId,
    quantity: 0n,
    plane: 'CUSTODY_PROVIDER_REPORTED_STATE',
    isFiatLedgerBalance: false,
    isAssetSupplyBook: false,
    isExchangeInternalPosition: false,
    isCustomerProductReadModel: false,
  });
}

export function contractOk<T>(value: T): CustodyCandidateResult<T> {
  return candidateOk(value);
}

export function contractErr(code: string, message: string): CustodyCandidateResult<never> {
  return candidateErr(code, message);
}
