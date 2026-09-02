/**
 * Wave 8 — formal wallet architecture vocabulary.
 *
 * Distinguishes blockchain accounts, user wallets, custody models, and
 * application/fiat/exchange accounts without implying regulated custody
 * exists when no provider is connected.
 */

import type { CustodyModel } from './taxonomy.ts';

export const WALLET_ARCHITECTURE_KINDS = [
  'BLOCKCHAIN_ACCOUNT',
  'USER_WALLET',
  'CUSTODIAL_WALLET',
  'NON_CUSTODIAL_WALLET',
  'APPLICATION_ACCOUNT',
  'FIAT_ACCOUNT',
  'EXCHANGE_ACCOUNT',
] as const;
export type WalletArchitectureKind = (typeof WALLET_ARCHITECTURE_KINDS)[number];

export const BALANCE_AUTHORITY_SOURCES = [
  'NATIVE_BLOCKCHAIN_AUTHORITY',
  'CURRENT_APPLICATION_AUTHORITY',
  'CUSTODY_PROVIDER_REPORTED_STATE',
  'EXCHANGE_INTERNAL_POSITION',
  'REBUILDABLE_PROJECTION',
] as const;
export type BalanceAuthoritySource = (typeof BALANCE_AUTHORITY_SOURCES)[number];

export type WalletArchitectureDescriptor = {
  readonly kind: WalletArchitectureKind;
  readonly walletId: string;
  readonly accountId: string;
  readonly assetId: string;
  readonly custodyModel: CustodyModel | null;
  readonly balanceAuthority: BalanceAuthoritySource;
  readonly regulatedCustodyConnected: false;
  readonly productionMoneyMovement: false;
  readonly mutableBalanceFieldIsTruth: false;
};

export function describeBlockchainAccount(input: {
  readonly walletId: string;
  readonly accountId: string;
  readonly assetId: string;
}): WalletArchitectureDescriptor {
  return Object.freeze({
    kind: 'BLOCKCHAIN_ACCOUNT',
    walletId: input.walletId,
    accountId: input.accountId,
    assetId: input.assetId,
    custodyModel: null,
    balanceAuthority: 'NATIVE_BLOCKCHAIN_AUTHORITY',
    regulatedCustodyConnected: false,
    productionMoneyMovement: false,
    mutableBalanceFieldIsTruth: false,
  });
}

export function describeCustodialWallet(input: {
  readonly walletId: string;
  readonly accountId: string;
  readonly assetId: string;
  readonly custodyModel: CustodyModel;
}): WalletArchitectureDescriptor {
  return Object.freeze({
    kind: 'CUSTODIAL_WALLET',
    walletId: input.walletId,
    accountId: input.accountId,
    assetId: input.assetId,
    custodyModel: input.custodyModel,
    balanceAuthority: 'CUSTODY_PROVIDER_REPORTED_STATE',
    regulatedCustodyConnected: false,
    productionMoneyMovement: false,
    mutableBalanceFieldIsTruth: false,
  });
}

export function describeExchangeAccount(input: {
  readonly walletId: string;
  readonly accountId: string;
  readonly assetId: string;
}): WalletArchitectureDescriptor {
  return Object.freeze({
    kind: 'EXCHANGE_ACCOUNT',
    walletId: input.walletId,
    accountId: input.accountId,
    assetId: input.assetId,
    custodyModel: null,
    balanceAuthority: 'EXCHANGE_INTERNAL_POSITION',
    regulatedCustodyConnected: false,
    productionMoneyMovement: false,
    mutableBalanceFieldIsTruth: false,
  });
}

export function describeFiatAccount(input: {
  readonly walletId: string;
  readonly accountId: string;
  readonly assetId: string;
}): WalletArchitectureDescriptor {
  return Object.freeze({
    kind: 'FIAT_ACCOUNT',
    walletId: input.walletId,
    accountId: input.accountId,
    assetId: input.assetId,
    custodyModel: null,
    balanceAuthority: 'CURRENT_APPLICATION_AUTHORITY',
    regulatedCustodyConnected: false,
    productionMoneyMovement: false,
    mutableBalanceFieldIsTruth: false,
  });
}

export function custodyModelForKind(kind: WalletArchitectureKind): CustodyModel | null {
  if (kind === 'CUSTODIAL_WALLET') {
    return 'SUNREY_NATIVE';
  }
  if (kind === 'NON_CUSTODIAL_WALLET') {
    return 'SUNREY_NATIVE';
  }
  return null;
}
