import type { HeliosFillId, HeliosOrderId } from '../../order-lifecycle/ids.ts';

export type Exec09TradeConfirmationId = `etc_${string}`;
export type Exec09SettlementInstructionId = `esi_${string}`;
export type Exec09SettlementObligationId = `eso_${string}`;
export type Exec09SettlementLifecycleId = `esl_${string}`;
export type Exec09SettlementFailureId = `esf_${string}`;
export type Exec09SettlementCorrectionId = `esc_${string}`;
export type Exec09SettlementLegId = `leg_${string}`;

export function asExec09TradeConfirmationId(value: string): Exec09TradeConfirmationId {
  if (!value.startsWith('etc_')) throw new Error(`invalid Exec09TradeConfirmationId: ${value}`);
  return value as Exec09TradeConfirmationId;
}

export function tradeConfirmationIdFor(providerTradeId: string): Exec09TradeConfirmationId {
  return asExec09TradeConfirmationId(`etc_${providerTradeId}`);
}

export function settlementInstructionIdFor(obligationId: Exec09SettlementObligationId): Exec09SettlementInstructionId {
  return `esi_${obligationId}` as Exec09SettlementInstructionId;
}

export function settlementObligationIdFor(orderId: HeliosOrderId, fillId: HeliosFillId): Exec09SettlementObligationId {
  return `eso_${orderId}_${fillId}` as Exec09SettlementObligationId;
}

export function settlementLifecycleIdFor(orderId: HeliosOrderId): Exec09SettlementLifecycleId {
  return `esl_${orderId}` as Exec09SettlementLifecycleId;
}

export function settlementFailureIdFor(obligationId: Exec09SettlementObligationId, sequence: number): Exec09SettlementFailureId {
  return `esf_${obligationId}_${sequence}` as Exec09SettlementFailureId;
}

export function settlementCorrectionIdFor(obligationId: Exec09SettlementObligationId, sequence: number): Exec09SettlementCorrectionId {
  return `esc_${obligationId}_${sequence}` as Exec09SettlementCorrectionId;
}

export function settlementLegIdFor(obligationId: Exec09SettlementObligationId, kind: string): Exec09SettlementLegId {
  return `leg_${obligationId}_${kind}` as Exec09SettlementLegId;
}
