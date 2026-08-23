import { asAccountId } from '../../../packages/domain/src/account.ts';
import {
  asCustomerActivityId,
  freezeCustomerActivityItem,
  isConsumerActivityStatus,
  isConsumerActivityType,
  type ConsumerActivityCategory,
  type ConsumerActivityDirection,
  type ConsumerActivityStatus,
  type ConsumerActivityType,
  type CustomerActivityItem,
} from '../../../packages/domain/src/customer-activity.ts';
import type { TransactionHistoryItem } from '../../../packages/domain/src/transaction-history.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';

export type ActivityFilter = {
  readonly from?: string;
  readonly to?: string;
  readonly status?: ConsumerActivityStatus;
  readonly type?: ConsumerActivityType;
  readonly currency?: string;
};

export function normalizeActivityItem(item: TransactionHistoryItem): CustomerActivityItem {
  const type = typeOf(item);
  const status = statusOf(item.status, item.direction);
  const completed =
    status === 'COMPLETED' || status === 'REVERSED' || status === 'FAILED' || status === 'CANCELLED'
      ? item.occurredAt
      : null;
  return freezeCustomerActivityItem({
    activityId: asCustomerActivityId(item.reference),
    accountId: asAccountId(item.accountId),
    customerId: item.customerId,
    type,
    direction: directionOf(item.direction),
    amountMinorUnits: item.amountMinorUnits,
    currency: item.currency,
    status,
    counterpartyDisplay: counterpartyOf(item),
    description: customerDescription(item, type),
    occurredAt: item.occurredAt,
    completedAt: completed,
    feeMinorUnits: type === 'FEE' ? item.amountMinorUnits : null,
    feeCurrency: type === 'FEE' ? item.currency : null,
    reference: item.reference,
    category: categoryOf(type),
    relatedActionId: item.journalId,
    journalId: item.journalId,
  });
}

export function filterActivity(
  items: readonly CustomerActivityItem[],
  filter: ActivityFilter,
): readonly CustomerActivityItem[] {
  return items.filter((item) => {
    if (filter.status && item.status !== filter.status) {
      return false;
    }
    if (filter.type && item.type !== filter.type) {
      return false;
    }
    if (filter.currency && item.currency !== filter.currency) {
      return false;
    }
    if (filter.from && item.occurredAt < asUtcInstant(filter.from)) {
      return false;
    }
    if (filter.to && item.occurredAt > asUtcInstant(filter.to)) {
      return false;
    }
    return true;
  });
}

export function parseActivityFilter(query: Readonly<Record<string, string>>): ActivityFilter | { readonly error: string } {
  const status = query.status;
  const type = query.type ?? query.activityType;
  const currency = query.currency;
  const from = query.from ?? query.periodStart;
  const to = query.to ?? query.periodEnd;
  if (status && !isConsumerActivityStatus(status)) {
    return { error: 'status is not a permitted activity status' };
  }
  if (type && !isConsumerActivityType(type)) {
    return { error: 'type is not a permitted activity type' };
  }
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    return { error: 'currency filter must be an ISO-4217 alphabetic code' };
  }
  if (from && Number.isNaN(Date.parse(from))) {
    return { error: 'from must be an ISO-8601 instant' };
  }
  if (to && Number.isNaN(Date.parse(to))) {
    return { error: 'to must be an ISO-8601 instant' };
  }
  const filter: ActivityFilter = {};
  if (status && isConsumerActivityStatus(status)) {
    Object.assign(filter, { status });
  }
  if (type && isConsumerActivityType(type)) {
    Object.assign(filter, { type });
  }
  if (currency) {
    Object.assign(filter, { currency });
  }
  if (from) {
    Object.assign(filter, { from });
  }
  if (to) {
    Object.assign(filter, { to });
  }
  return filter;
}

function typeOf(item: TransactionHistoryItem): ConsumerActivityType {
  // Classify from the posting description only. Journal/posting ids are
  // random UUIDs whose hex can contain "fee" and must not change type.
  const text = item.description.toUpperCase();
  if (item.direction === 'HOLD' || item.holdId) {
    return 'HOLD';
  }
  if (text.includes('POST_FEE') || text.includes('FEE')) {
    return 'FEE';
  }
  if (text.includes('POST_INTEREST') || text.includes('INTEREST')) {
    return 'INTEREST';
  }
  if (text.includes('POST_REVERSAL') || text.includes('REVERSAL')) {
    return 'REVERSAL';
  }
  if (text.includes('INTERNAL_TRANSFER')) {
    return 'INTERNAL_TRANSFER';
  }
  if (text.includes('POST_DEPOSIT') || text.includes('DEPOSIT')) {
    return 'DEPOSIT';
  }
  if (text.includes('POST_WITHDRAWAL') || text.includes('WITHDRAWAL')) {
    return 'WITHDRAWAL';
  }
  if (text.includes('FX')) {
    return 'FX';
  }
  if (text.includes('CARD')) {
    return 'CARD';
  }
  if (text.includes('EXCHANGE')) {
    return 'EXCHANGE';
  }
  if (text.includes('CUSTODY') || text.includes('DIGITAL')) {
    return 'CUSTODY';
  }
  if (text.includes('INVEST') || text.includes('SECURIT')) {
    return 'INVESTMENT';
  }
  if (text.includes('PAYMENT') || text.includes('RAIL')) {
    return 'BANK_PAYMENT';
  }
  return 'OTHER';
}

function statusOf(
  status: TransactionHistoryItem['status'],
  direction: TransactionHistoryItem['direction'],
): ConsumerActivityStatus {
  if (status === 'PENDING') {
    return direction === 'HOLD' ? 'PENDING' : 'PROCESSING';
  }
  if (status === 'COMPLETED') {
    return 'COMPLETED';
  }
  if (status === 'REVERSED' || status === 'RETURNED') {
    return 'REVERSED';
  }
  if (status === 'FAILED') {
    return 'FAILED';
  }
  return 'PENDING';
}

function directionOf(direction: TransactionHistoryItem['direction']): ConsumerActivityDirection {
  if (direction === 'CREDIT') {
    return 'IN';
  }
  if (direction === 'DEBIT') {
    return 'OUT';
  }
  return 'HOLD';
}

function categoryOf(type: ConsumerActivityType): ConsumerActivityCategory {
  switch (type) {
    case 'INTERNAL_TRANSFER':
      return 'TRANSFER';
    case 'BANK_PAYMENT':
      return 'PAYMENT';
    case 'DEPOSIT':
    case 'WITHDRAWAL':
      return 'FUNDING';
    case 'FEE':
      return 'FEE';
    case 'INVESTMENT':
      return 'INVESTMENT';
    case 'EXCHANGE':
    case 'FX':
      return 'EXCHANGE';
    case 'CARD':
      return 'CARD';
    case 'HOLD':
      return 'COMPLIANCE';
    default:
      return 'OTHER';
  }
}

function counterpartyOf(item: TransactionHistoryItem): string | null {
  if (item.description.includes('Internal transfer')) {
    return 'Own account';
  }
  if (item.description.toUpperCase().includes('POST_DEPOSIT') || item.description.includes('deposit')) {
    return 'Simulated funding source';
  }
  if (item.description.toUpperCase().includes('POST_WITHDRAWAL') || item.description.includes('withdrawal')) {
    return 'Simulated funding source';
  }
  return null;
}

function customerDescription(item: TransactionHistoryItem, type: ConsumerActivityType): string {
  if (type === 'DEPOSIT') {
    return 'Deposit';
  }
  if (type === 'WITHDRAWAL') {
    return 'Withdrawal';
  }
  if (type === 'INTERNAL_TRANSFER') {
    return item.direction === 'CREDIT' ? 'Transfer in' : 'Transfer out';
  }
  if (type === 'HOLD') {
    return 'Funds hold';
  }
  if (type === 'FEE') {
    return 'Fee';
  }
  if (type === 'INTEREST') {
    return 'Interest';
  }
  if (type === 'REVERSAL') {
    return 'Reversal';
  }
  return item.description.replace(/_/g, ' ').replace(/\bPOST /i, '');
}
