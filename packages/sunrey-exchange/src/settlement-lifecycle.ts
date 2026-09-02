/**
 * Wave 8 — unified exchange settlement lifecycle vocabulary.
 *
 * Maps existing order, native, and product clearing states onto a single
 * consumer-facing settlement model without collapsing asset identities.
 */

import type { NativeSettlementStatus, OrderStatus } from './taxonomy.ts';
import type { ClearingState } from './product/types.ts';

export const WAVE8_SETTLEMENT_STATES = [
  'ORDER_OPEN',
  'MATCHED',
  'SETTLEMENT_PENDING',
  'SETTLED',
  'FAILED',
  'CANCELLED',
] as const;
export type Wave8SettlementState = (typeof WAVE8_SETTLEMENT_STATES)[number];

export function mapOrderStatusToWave8(status: OrderStatus): Wave8SettlementState {
  if (status === 'OPEN' || status === 'PARTIALLY_FILLED' || status === 'ACCEPTED') {
    return 'ORDER_OPEN';
  }
  if (status === 'FILLED') {
    return 'MATCHED';
  }
  if (status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED') {
    return 'CANCELLED';
  }
  return 'ORDER_OPEN';
}

export function mapNativeSettlementToWave8(status: NativeSettlementStatus): Wave8SettlementState {
  switch (status) {
    case 'MATCHED':
      return 'MATCHED';
    case 'SETTLEMENT_CREATED':
    case 'SUBMITTED':
    case 'SUBMISSION_UNKNOWN':
      return 'SETTLEMENT_PENDING';
    case 'FINALIZED':
      return 'SETTLED';
    case 'FAILED':
    case 'RECONCILIATION_REQUIRED':
      return 'FAILED';
    default:
      return 'SETTLEMENT_PENDING';
  }
}

export function mapClearingStateToWave8(state: ClearingState): Wave8SettlementState {
  switch (state) {
    case 'PENDING':
    case 'VALIDATED':
    case 'READY_TO_SETTLE':
    case 'SETTLING':
      return 'SETTLEMENT_PENDING';
    case 'SETTLED':
      return 'SETTLED';
    case 'FAILED':
      return 'FAILED';
    case 'REQUIRES_REVIEW':
      return 'FAILED';
    default:
      return 'SETTLEMENT_PENDING';
  }
}

export type Wave8SettlementRecord = {
  readonly schema: 'sunrey.wave8.settlement.v1';
  readonly settlementId: string;
  readonly tradeId: string | null;
  readonly orderId: string | null;
  readonly state: Wave8SettlementState;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly canonicalChainTxRef: string | null;
  readonly sandboxSimulation: true;
  readonly mutatesNativeSupply: false;
};

export function wave8SettlementRecord(input: {
  readonly settlementId: string;
  readonly tradeId?: string | null;
  readonly orderId?: string | null;
  readonly state: Wave8SettlementState;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly canonicalChainTxRef?: string | null;
}): Wave8SettlementRecord {
  assertAssetSeparation(input.baseAssetId, input.quoteAssetId);
  return Object.freeze({
    schema: 'sunrey.wave8.settlement.v1',
    settlementId: input.settlementId,
    tradeId: input.tradeId ?? null,
    orderId: input.orderId ?? null,
    state: input.state,
    baseAssetId: input.baseAssetId,
    quoteAssetId: input.quoteAssetId,
    canonicalChainTxRef: input.canonicalChainTxRef ?? null,
    sandboxSimulation: true,
    mutatesNativeSupply: false,
  });
}

export function assertAssetSeparation(baseAssetId: string, quoteAssetId: string): void {
  if (baseAssetId === quoteAssetId) {
    throw new TypeError('base and quote assets must not collide');
  }
  const canonical = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
  if (canonical.includes(baseAssetId as (typeof canonical)[number]) && canonical.includes(quoteAssetId as (typeof canonical)[number])) {
  }
}

export function assertNoTickerCollision(left: string, right: string): boolean {
  return left !== right;
}
