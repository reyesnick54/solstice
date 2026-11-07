import type { BrokerEventPurpose } from '../taxonomy.ts';
import type { BrokerOrderStateKind } from '../taxonomy.ts';

const FIX_ORD_STATUS_TO_STATE: Readonly<Record<string, BrokerOrderStateKind>> = Object.freeze({
  '0': 'NEW',
  '1': 'PARTIALLY_FILLED',
  '2': 'FILLED',
  '3': 'DONE_FOR_DAY',
  '4': 'CANCELED',
  '5': 'REPLACED',
  '6': 'PENDING_CANCEL',
  '7': 'SUSPENDED',
  '8': 'PENDING_REPLACE',
  '9': 'PENDING_NEW',
  A: 'PENDING_NEW',
  B: 'UNKNOWN',
  C: 'EXPIRED',
  E: 'PENDING_NEW',
});

const FIX_EXEC_TYPE_TO_PURPOSE: Readonly<Record<string, BrokerEventPurpose>> = Object.freeze({
  '0': 'ACKNOWLEDGEMENT',
  '1': 'TRADE',
  '2': 'TRADE',
  '3': 'TRADE',
  '4': 'CANCEL_ACK',
  '5': 'REPLACE_ACK',
  '6': 'REJECTION',
  '7': 'BUST',
  '8': 'STATUS',
  '9': 'STATUS',
  B: 'CORRECTION',
  C: 'CORRECTION',
  F: 'TRADE',
  G: 'CORRECTION',
  H: 'STATUS',
});

export function mapFixOrdStatusToBrokerOrderState(raw: string | null): BrokerOrderStateKind {
  if (raw === null) {
    return 'UNKNOWN';
  }
  return FIX_ORD_STATUS_TO_STATE[raw] ?? 'UNKNOWN';
}

export function mapFixExecTypeToEventPurpose(
  raw: string | null,
  resultingState: BrokerOrderStateKind,
): BrokerEventPurpose {
  if (raw !== null && FIX_EXEC_TYPE_TO_PURPOSE[raw]) {
    return FIX_EXEC_TYPE_TO_PURPOSE[raw];
  }
  if (resultingState === 'REJECTED') {
    return 'REJECTION';
  }
  return 'STATUS';
}
