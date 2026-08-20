import { CUSTODY_WITHDRAWAL_TRANSITIONS, type DurableWithdrawalState } from '../../custody/durable-store.ts';
import { EXCHANGE_ORDER_TRANSITIONS, type DurableOrderState } from '../../exchange/durable-store.ts';
import { PAYMENT_TRANSITIONS, type DurablePaymentStatus } from '../../payments/durable-store.ts';
import { PROVIDER_ACCEPTANCE_TRANSITIONS, type DurableProviderAcceptance } from '../../provider/durable-store.ts';
import { DurableStoreError } from '../snapshot-envelope.ts';

export function assertPaymentTransition(from: DurablePaymentStatus, to: DurablePaymentStatus): void {
  if (from !== to && !PAYMENT_TRANSITIONS[from].includes(to)) {
    throw new DurableStoreError('ILLEGAL_TRANSITION', `payment ${from} → ${to} is illegal`);
  }
}

export function assertCustodyWithdrawalTransition(from: DurableWithdrawalState, to: DurableWithdrawalState): void {
  if (from !== to && !CUSTODY_WITHDRAWAL_TRANSITIONS[from].includes(to)) {
    throw new DurableStoreError('ILLEGAL_TRANSITION', `custody withdrawal ${from} → ${to} is illegal`);
  }
}

export function assertExchangeOrderTransition(from: DurableOrderState, to: DurableOrderState): void {
  if (from !== to && !EXCHANGE_ORDER_TRANSITIONS[from].includes(to)) {
    throw new DurableStoreError('ILLEGAL_TRANSITION', `exchange order ${from} → ${to} is illegal`);
  }
}

export function assertProviderTransition(from: DurableProviderAcceptance, to: DurableProviderAcceptance): void {
  if (from !== to && !PROVIDER_ACCEPTANCE_TRANSITIONS[from].includes(to)) {
    throw new DurableStoreError('ILLEGAL_TRANSITION', `provider ${from} → ${to} is illegal`);
  }
}

export function assertExpectedRevision(actual: number, expected: number | undefined, label: string): void {
  if (expected !== undefined && actual !== expected) {
    throw new DurableStoreError('STALE_REVISION', `stale writer for ${label}`);
  }
}
