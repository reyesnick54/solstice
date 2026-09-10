/**
 * Canonical exchange DVP settlement types consumed by SunRey Chain.
 *
 * Exchange matching produces intents; chain authority validates and applies them.
 */

export const NATIVE_TICKER_STATUS = 'NOT_ASSIGNED' as const;
export const NATIVE_SETTLEMENT_POLICY = 'sunrey.exchange.settlement.policy.v1' as const;
export const NATIVE_FEE_POLICY = 'sunrey.exchange.fee.policy.v1' as const;
export const EXCHANGE_SETTLEMENT_ISSUER = 'sunrey.exchange.settlement.authority' as const;

export type NativeFeeLeg = {
  readonly kind: 'TRADING_FEE' | 'NETWORK_FEE';
  readonly assetId: string;
  readonly quantity: bigint;
  readonly payer: string;
  readonly recipient: string;
};

export type ExchangeSettlementIntent = {
  readonly settlementId: string;
  readonly tradeIds: readonly string[];
  readonly buyer: string;
  readonly seller: string;
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

export type ChainSettlementFinality = 'PENDING_PROPOSAL' | 'BFT_FINALIZED' | 'REJECTED';

export type ChainSettlementTx = {
  readonly transactionId: string;
  readonly transactionHash: string;
  readonly kind: 'TRANSFER' | 'LOCK' | 'UNLOCK' | 'ISSUE' | 'EXCHANGE_SETTLEMENT';
  readonly settlementId: string | null;
  status: ChainSettlementFinality;
  payload: Record<string, unknown>;
};

export type ChainHolding = {
  available: bigint;
  locked: bigint;
};

export type ChainLock = {
  lockId: string;
  owner: string;
  assetId: string;
  quantity: bigint;
  status: 'LOCKED' | 'RELEASED';
};

export type ChainQueryResult = {
  readonly found: boolean;
  readonly finality: ChainSettlementFinality | 'UNKNOWN';
  readonly settlementId: string | null;
  readonly blockHeight: bigint | null;
};
