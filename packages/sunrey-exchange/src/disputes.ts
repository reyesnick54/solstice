import { newDisputeId, type ContractId, type SettlementId, type TradeId } from './ids.ts';
import type { ExchangeDispute } from './types-universal.ts';
import type { ExchangeDisputeKind } from './taxonomy.ts';

/**
 * Unified exchange dispute references. Detectors and settlement
 * failures open a reference into the canonical case system; they do
 * not adjudicate.
 */
export function openExchangeDispute(input: {
  readonly kind: ExchangeDisputeKind;
  readonly contractId?: ContractId | null;
  readonly tradeId?: TradeId | null;
  readonly settlementId?: SettlementId | null;
  readonly caseRef: string;
}): ExchangeDispute {
  return Object.freeze({
    disputeId: newDisputeId(),
    kind: input.kind,
    contractId: input.contractId ?? null,
    tradeId: input.tradeId ?? null,
    settlementId: input.settlementId ?? null,
    caseRef: input.caseRef,
    legalConclusion: false,
    status: 'REFERRED',
  });
}
