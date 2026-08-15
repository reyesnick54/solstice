import type { CardId, NetworkTokenReference, ProcessorCardReference } from '../ids.ts';
import type { DevicePaymentTokenId, WalletProviderReference } from './ids.ts';
import type { DevicePaymentTokenStatus, WalletProvider } from './token.ts';

/**
 * Provider-neutral issuer-side wallet provisioning port.
 * Adapters must not issue Execution Authority, post journals, or receive
 * mobile-application backend secrets.
 */
export type WalletProvisionRequest = {
  readonly tokenId: DevicePaymentTokenId;
  readonly cardId: CardId;
  readonly processorCardRef: ProcessorCardReference;
  readonly deviceId: string;
  readonly walletProvider: WalletProvider;
  readonly networkTokenReference: NetworkTokenReference;
};

export type WalletProvisionResult = {
  readonly providerReference: WalletProviderReference;
  readonly networkTokenReference: NetworkTokenReference;
  readonly status: Extract<DevicePaymentTokenStatus, 'REQUESTED' | 'PENDING_VERIFICATION'>;
};

export type WalletStatusUpdate = {
  readonly providerReference: WalletProviderReference;
  readonly status: DevicePaymentTokenStatus;
};

export type WalletProvisioningPort = {
  readonly provider: WalletProvider;
  provision(request: WalletProvisionRequest): WalletProvisionResult;
  updateStatus(update: WalletStatusUpdate): WalletStatusUpdate;
};

export function assertAdapterCannotExecute(adapterSource: string): void {
  if (/issuer\.issue|AuthorityIssuer|postJournal|postCardJournal/.test(adapterSource)) {
    throw new Error('wallet adapter must not issue Execution Authority or post journals');
  }
}
