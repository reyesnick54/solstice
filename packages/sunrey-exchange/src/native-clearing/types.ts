import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import type { ExchangeAccountId, ExchangeMarketId, OrderId, SettlementId, TradeId } from '../ids.ts';
import type { ExchangePrice } from '../price.ts';
import type { NativeFinality, NativeSettlementStatus } from '../taxonomy.ts';

export const NATIVE_TICKER_STATUS = 'NOT_ASSIGNED' as const;
export const NATIVE_SETTLEMENT_POLICY = 'sunrey.exchange.settlement.policy.v1' as const;
export const NATIVE_FEE_POLICY = 'sunrey.exchange.fee.policy.v1' as const;
export const EXCHANGE_SETTLEMENT_ISSUER = 'sunrey.exchange.settlement.authority' as const;

export type MarketDefinition = {
  readonly marketId: ExchangeMarketId;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly quantityIncrement: bigint;
  readonly priceIncrement: bigint;
  readonly minimumQuantity: bigint;
  readonly maximumQuantity: bigint;
  readonly feePolicy: typeof NATIVE_FEE_POLICY;
  readonly settlementPolicy: typeof NATIVE_SETTLEMENT_POLICY;
  readonly listingVersion: number;
  readonly status: 'SIMULATION_LISTED';
  readonly tickerStatus: typeof NATIVE_TICKER_STATUS;
};

export type DerivedNativePosition = {
  readonly accountId: ExchangeAccountId;
  readonly assetId: string;
  readonly available: bigint;
  readonly reserved: bigint;
  readonly pendingSettlement: bigint;
  readonly finalized: bigint;
  readonly pendingWithdrawal: bigint;
};

export type NativeReservation = {
  readonly reservationId: string;
  readonly orderId: OrderId;
  readonly accountId: ExchangeAccountId;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly remaining: bigint;
  readonly lockId: string;
  readonly purpose: 'EXCHANGE_ORDER';
  readonly state: 'ACTIVE' | 'PARTIAL' | 'CAPTURED' | 'RELEASED';
};

export type NativeFeeLeg = {
  readonly kind: 'TRADING_FEE' | 'NETWORK_FEE';
  readonly assetId: string;
  readonly quantity: bigint;
  readonly payer: ExchangeAccountId;
  readonly recipient: string;
};

export type ExchangeSettlementIntent = {
  readonly settlementId: SettlementId;
  readonly tradeIds: readonly TradeId[];
  readonly buyer: ExchangeAccountId;
  readonly seller: ExchangeAccountId;
  readonly buyerCustody: string;
  readonly sellerCustody: string;
  readonly baseAsset: string;
  readonly baseQuantity: bigint;
  readonly quoteAsset: string;
  readonly quoteQuantity: bigint;
  readonly feeLegs: readonly NativeFeeLeg[];
  readonly reservationRefs: readonly string[];
  readonly expirationHeight: bigint;
  readonly exchangeSignature: string;
  readonly policyVersion: typeof NATIVE_SETTLEMENT_POLICY;
  readonly networkId: string;
  readonly chainId: string;
  readonly nonce: bigint;
};

export type NativeTrade = {
  readonly tradeId: TradeId;
  readonly marketId: ExchangeMarketId;
  readonly buyer: ExchangeAccountId;
  readonly seller: ExchangeAccountId;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly quantity: AssetQuantity;
  readonly quoteQuantity: AssetQuantity;
  readonly price: ExchangePrice;
  readonly tradingFee: AssetQuantity;
  readonly networkFee: AssetQuantity;
  readonly matchedAt: UtcInstant;
};

export type NativeSettlement = {
  readonly settlementId: SettlementId;
  readonly intent: ExchangeSettlementIntent;
  readonly tradeIds: readonly TradeId[];
  readonly status: NativeSettlementStatus;
  readonly transactionId: string | null;
  readonly finalizedHeight: bigint | null;
  readonly blockId: string | null;
  readonly stateRoot: string | null;
  readonly submittedOnce: boolean;
};

export type TradeSettlementReceipt = {
  readonly tradeId: TradeId;
  readonly marketId: ExchangeMarketId;
  readonly buyer: ExchangeAccountId;
  readonly seller: ExchangeAccountId;
  readonly priceUnits: bigint;
  readonly quantity: bigint;
  readonly notional: bigint;
  readonly tradingFee: bigint;
  readonly networkFee: bigint;
  readonly settlementId: SettlementId;
  readonly blockchainTransactionId: string;
  readonly finalizedHeight: bigint;
  readonly blockId: string;
  readonly stateRootReference: string;
  readonly signature: string;
};

export type NativeDeposit = {
  readonly depositId: string;
  readonly accountId: ExchangeAccountId;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly address: string;
  readonly transactionId: string;
  readonly finality: NativeFinality;
  readonly credited: boolean;
};

export type NativeWithdrawal = {
  readonly withdrawalId: string;
  readonly accountId: ExchangeAccountId;
  readonly assetId: string;
  readonly quantity: bigint;
  readonly destination: string;
  readonly status: 'REQUESTED' | 'SUBMITTED' | 'SUBMISSION_UNKNOWN' | 'FINALIZED' | 'FAILED';
  readonly transactionId: string | null;
  readonly submittedOnce: boolean;
};

export type NativeReconciliationReport = {
  readonly outcome: 'MATCHED' | 'INVESTIGATION_REQUIRED';
  readonly notes: readonly string[];
  readonly autoCorrected: false;
  readonly autoCreatedAssets: false;
};

export type ChainQueryResult = {
  readonly transactionId: string;
  readonly found: boolean;
  readonly finality: NativeFinality | 'UNKNOWN';
  readonly settlementId: string | null;
};
