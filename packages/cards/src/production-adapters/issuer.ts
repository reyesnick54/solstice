/**
 * Production card issuer / processor contract.
 * Extends the canonical CardProcessor. Simulation and future vendors
 * implement this same surface.
 */

import type { CardProcessor } from '../processor.ts';
import type { WalletProvider } from '../wallet/token.ts';
import type { CardProviderLifecycle } from './types.ts';

export type WalletTokenLifecycleResult = {
  readonly outcome: 'ACCEPTED' | 'NOT_ELIGIBLE' | 'FAILED';
  readonly status: 'SUSPENDED' | 'ACTIVE' | 'DELETED' | 'NOT_ELIGIBLE';
  readonly providerReference: string;
};

export type ProductionCardIssuer = CardProcessor & {
  readonly providerId: string;
  readonly lifecycle: CardProviderLifecycle;
  readonly canPostLedger: false;
  readonly canIssueExecutionAuthority: false;
  readonly producesProductionCard: false;
  suspendWalletToken(input: {
    readonly processorCardRef: string;
    readonly walletProvider: WalletProvider;
  }): WalletTokenLifecycleResult;
  resumeWalletToken(input: {
    readonly processorCardRef: string;
    readonly walletProvider: WalletProvider;
  }): WalletTokenLifecycleResult;
  deleteWalletToken(input: {
    readonly processorCardRef: string;
    readonly walletProvider: WalletProvider;
  }): WalletTokenLifecycleResult;
};
