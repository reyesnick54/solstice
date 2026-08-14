/**
 * Canonical event namespace / taxonomy.
 *
 * Implemented namespaces match functionality that exists on this tree.
 * Reserved namespaces are documented only — they do not invent product
 * behavior.
 */

export const IMPLEMENTED_EVENT_NAMESPACES = [
  'customer',
  'account',
  'ledger',
  'kernel',
  'evidence',
] as const;

export const RESERVED_EVENT_NAMESPACES = [
  'payment',
  'fx',
  'card',
  'investment',
  'agent',
  'consent',
  'data',
  'pyr',
  'exchange',
  'regulatory',
  'notification',
  'analytics',
] as const;

export type ImplementedEventNamespace = (typeof IMPLEMENTED_EVENT_NAMESPACES)[number];
export type ReservedEventNamespace = (typeof RESERVED_EVENT_NAMESPACES)[number];

export const EVENT_TYPE_NAMES = [
  'AccountOpened',
  'DepositPosted',
  'WithdrawalPosted',
  'InternalTransferPosted',
  'CustomerStatusChanged',
  'KernelDecisionRecorded',
] as const;

export type ImplementedEventTypeName = (typeof EVENT_TYPE_NAMES)[number];

export const EVENT_SCHEMA_REFS = {
  AccountOpened: 'solstice.account.opened/1',
  DepositPosted: 'solstice.ledger.deposit_posted/1',
  WithdrawalPosted: 'solstice.ledger.withdrawal_posted/1',
  InternalTransferPosted: 'solstice.ledger.internal_transfer_posted/1',
  CustomerStatusChanged: 'solstice.customer.status_changed/1',
  KernelDecisionRecorded: 'solstice.kernel.decision_recorded/1',
} as const;

export const EVENT_NAMESPACES_BY_TYPE: {
  readonly [K in ImplementedEventTypeName]: ImplementedEventNamespace;
} = {
  AccountOpened: 'account',
  DepositPosted: 'ledger',
  WithdrawalPosted: 'ledger',
  InternalTransferPosted: 'ledger',
  CustomerStatusChanged: 'customer',
  KernelDecisionRecorded: 'kernel',
};

export function schemaRefFor(eventType: string, version: number): string {
  const known = EVENT_SCHEMA_REFS[eventType as ImplementedEventTypeName];
  if (known && version === 1) {
    return known;
  }
  const ns = EVENT_NAMESPACES_BY_TYPE[eventType as ImplementedEventTypeName] ?? 'unknown';
  return `solstice.${ns}.${camelToSnake(eventType)}/${version}`;
}

function camelToSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}
