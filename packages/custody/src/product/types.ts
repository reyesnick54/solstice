/**
 * Client-safe wallet resources for BFF / SDK / Lovable.
 * Balances are read models. Provider balance is never truth.
 * No signing material. No percentage-return fields.
 */

import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { WalletFeeQuote } from './fees.ts';
import type {
  ClientFinalityState,
  CustodyModel,
  TravelRuleCustomerState,
  WalletAddressStatus,
  WalletNetworkId,
  WalletReconciliationPlane,
  WalletStatus,
  WalletTransactionKind,
} from './taxonomy.ts';

export type WalletBalanceReadModel = {
  readonly totalMinorUnits: string;
  readonly availableMinorUnits: string;
  readonly pendingMinorUnits: string;
  readonly assetId: NativeCustodyAssetId;
  readonly source: 'CUSTODY_READ_MODEL';
  readonly providerBalanceIsTruth: false;
  readonly blendedReturn: null;
};

export type ConsumerWallet = {
  readonly schema: 'sunrey.consumer.wallet.v1';
  readonly walletId: string;
  readonly ownerId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly networkId: WalletNetworkId;
  readonly custodyModel: CustodyModel;
  readonly status: WalletStatus;
  readonly withdrawalEnabled: boolean;
  readonly addressRefs: readonly string[];
  readonly balance: WalletBalanceReadModel;
  readonly providerRef: string | null;
  readonly custodyAccountId: string;
  readonly createdAt: string;
  readonly productionSigningAuthorized: false;
  readonly productionMoneyMovement: false;
};

export type DepositAddress = {
  readonly schema: 'sunrey.consumer.deposit-address.v1';
  readonly addressId: string;
  readonly walletId: string;
  readonly address: string;
  readonly networkId: WalletNetworkId;
  readonly assetId: NativeCustodyAssetId;
  readonly status: WalletAddressStatus;
  readonly qrPayload: string;
  readonly createdAt: string;
  readonly belongsToWallet: true;
};

export type WalletTransaction = {
  readonly schema: 'sunrey.consumer.wallet-transaction.v1';
  readonly transactionId: string;
  readonly walletId: string;
  readonly kind: WalletTransactionKind;
  readonly assetId: NativeCustodyAssetId;
  readonly networkId: WalletNetworkId;
  readonly amountMinorUnits: string;
  readonly counterpartyHint: string;
  readonly finality: ClientFinalityState;
  readonly travelRule: TravelRuleCustomerState;
  readonly createdAt: string;
  readonly txRef: string | null;
  readonly productionMoneyMovement: false;
};

export type WithdrawalQuote = {
  readonly schema: 'sunrey.consumer.withdrawal-quote.v1';
  readonly quoteId: string;
  readonly walletId: string;
  readonly ownerId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly networkId: WalletNetworkId;
  readonly destination: string;
  readonly amountMinorUnits: string;
  readonly fees: WalletFeeQuote;
  readonly travelRule: TravelRuleCustomerState;
  readonly travelRuleRequired: boolean;
  readonly risk: 'CLEAR' | 'REVIEW' | 'BLOCK';
  readonly requiredApproval: 'CUSTOMER_CONFIRMATION' | 'STEP_UP_AUTHENTICATION' | 'MANUAL_REVIEW';
  readonly expiresAt: string;
  readonly estimate: true;
  readonly productionMoneyMovement: false;
};

export type WithdrawalResource = {
  readonly schema: 'sunrey.consumer.withdrawal.v1';
  readonly withdrawalId: string;
  readonly quoteId: string | null;
  readonly walletId: string;
  readonly ownerId: string;
  readonly assetId: NativeCustodyAssetId;
  readonly networkId: WalletNetworkId;
  readonly destinationHint: string;
  readonly amountMinorUnits: string;
  readonly fees: WalletFeeQuote;
  readonly travelRule: TravelRuleCustomerState;
  readonly risk: 'CLEAR' | 'REVIEW' | 'BLOCK';
  readonly requiredApproval: string;
  readonly finality: ClientFinalityState;
  readonly status: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly txRef: string | null;
  readonly originatedFromAgent: boolean;
  readonly productionMoneyMovement: false;
  readonly productionSigningAuthorized: false;
};

export type AssetDetail = {
  readonly schema: 'sunrey.consumer.asset-detail.v1';
  readonly assetId: NativeCustodyAssetId;
  readonly displayName: string;
  readonly networkId: WalletNetworkId;
  readonly wallet: ConsumerWallet | null;
  readonly marketPrice: {
    readonly label: string;
    readonly source: string;
    readonly asOf: string;
    readonly indicative: true;
  } | null;
  readonly marketData: { readonly freshness: 'SANDBOX_FIXTURE'; readonly commercialPricing: false };
  readonly supplyData: { readonly circulating: null; readonly reason: string };
  readonly networkStatus: 'SIMULATION' | 'OUTAGE';
  readonly recentActivity: readonly WalletTransaction[];
  readonly eligibility: {
    readonly depositAvailable: boolean;
    readonly withdrawalAvailable: boolean;
    readonly exchangeAvailable: boolean;
  };
  readonly productionMoneyMovement: false;
};

export type WalletReconciliationBreak = {
  readonly breakId: string;
  readonly walletId: string;
  readonly left: WalletReconciliationPlane;
  readonly right: WalletReconciliationPlane;
  readonly note: string;
  readonly autoCorrected: false;
  readonly createdAt: string;
};

export type WalletProductFailure = {
  readonly code: string;
  readonly message: string;
};

export type WalletProductOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string; readonly message: string };
