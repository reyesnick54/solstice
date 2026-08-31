/**
 * Access Wave 4 product taxonomy — consumer-facing states and actions.
 * Backend-authoritative; frontend must not recompute financial values.
 */

export const ACCESS_PRODUCT_EVENT_TYPES = Object.freeze([
  'ACCESS_ALLOCATION_AVAILABLE',
  'ACCESS_ALLOCATION_UPDATED',
  'ACCESS_EXPIRING_SOON',
  'ACCESS_EXPIRED',
  'ACCESS_OPPORTUNITY_AVAILABLE',
  'ACCESS_QUOTE_EXPIRING',
  'ACCESS_PAYMENT_ACTION_REQUIRED',
  'ACCESS_BOOKING_PROCESSING',
  'ACCESS_BOOKING_CONFIRMED',
  'ACCESS_BOOKING_CHANGED',
  'ACCESS_BOOKING_CANCELLED',
  'ACCESS_FULFILLMENT_UPCOMING',
  'ACCESS_FULFILLED',
  'ACCESS_REFUND_PENDING',
  'ACCESS_PARTIAL_REFUND',
  'ACCESS_REFUNDED',
  'ACCESS_RECONCILIATION_REQUIRED',
  'ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE',
  'ACCESS_TRANSACTION_FAILED',
] as const);
export type AccessProductEventType = (typeof ACCESS_PRODUCT_EVENT_TYPES)[number];

export const ACCESS_EVENT_PRIORITIES = Object.freeze([
  'INFO',
  'ACTION',
  'IMPORTANT',
  'CRITICAL',
] as const);
export type AccessEventPriority = (typeof ACCESS_EVENT_PRIORITIES)[number];

export const ACCESS_PRODUCT_TRANSACTION_STATUSES = Object.freeze([
  'DRAFT',
  'QUOTED',
  'QUOTE_EXPIRED',
  'PRICE_CHANGED',
  'CHECKOUT_STARTED',
  'PROCESSING_CONFIRMATION',
  'BOOKING_CONFIRMED',
  'BOOKED',
  'FULFILLED',
  'SETTLED',
  'CANCELLED',
  'REFUND_PENDING',
  'PARTIAL_REFUND',
  'REFUNDED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
] as const);
export type AccessProductTransactionStatus = (typeof ACCESS_PRODUCT_TRANSACTION_STATUSES)[number];

export const ACCESS_USER_ACTION_TYPES = Object.freeze([
  'ADD_PAYMENT_METHOD',
  'CONFIRM_PRICE_CHANGE',
  'RETRY_USER_PAYMENT',
  'CONTACT_SUPPORT',
  'REVIEW_CANCELLATION',
  'VERIFY_IDENTITY',
  'REQUOTE',
] as const);
export type AccessUserActionType = (typeof ACCESS_USER_ACTION_TYPES)[number];

export const ACCESS_ACTIVITY_ITEM_TYPES = Object.freeze([
  'ALLOCATION',
  'RESERVATION',
  'BOOKING',
  'FULFILLMENT',
  'CANCELLATION',
  'REFUND',
  'EXPIRATION',
  'RESTORATION',
] as const);
export type AccessActivityItemType = (typeof ACCESS_ACTIVITY_ITEM_TYPES)[number];

export const ACCESS_HISTORY_FILTERS = Object.freeze([
  'ALL',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const);
export type AccessHistoryFilter = (typeof ACCESS_HISTORY_FILTERS)[number];

export const ACCESS_DATA_STATES = Object.freeze([
  'LIVE',
  'PARTIAL',
  'STALE',
  'SIMULATED',
  'UNAVAILABLE',
] as const);
export type AccessDataState = (typeof ACCESS_DATA_STATES)[number];

export const ACCESS_FUNNEL_EVENT_TYPES = Object.freeze([
  'ACCESS_VIEWED',
  'ACCESS_CATEGORY_VIEWED',
  'ACCESS_SEARCHED',
  'ACCESS_QUOTED',
  'ACCESS_CHECKOUT_STARTED',
  'ACCESS_BOOKED',
  'ACCESS_CANCELLED',
] as const);
export type AccessFunnelEventType = (typeof ACCESS_FUNNEL_EVENT_TYPES)[number];

export const ACCESS_NOTIFICATION_CHANNELS = Object.freeze([
  'TRANSACTIONAL',
  'PROMOTIONAL',
] as const);
export type AccessNotificationChannel = (typeof ACCESS_NOTIFICATION_CHANNELS)[number];

export const ACCESS_RECEIPT_TYPES = Object.freeze([
  'BOOKING_CONFIRMATION',
  'SETTLEMENT',
  'REFUND',
] as const);
export type AccessReceiptType = (typeof ACCESS_RECEIPT_TYPES)[number];

export const ACCESS_EXPIRATION_NOTICE_DAYS = Object.freeze([7, 3, 1] as const);

export const ACCESS_EVENT_PRIORITY_BY_TYPE: Readonly<Record<AccessProductEventType, AccessEventPriority>> =
  Object.freeze({
    ACCESS_ALLOCATION_AVAILABLE: 'INFO',
    ACCESS_ALLOCATION_UPDATED: 'INFO',
    ACCESS_EXPIRING_SOON: 'ACTION',
    ACCESS_EXPIRED: 'INFO',
    ACCESS_OPPORTUNITY_AVAILABLE: 'INFO',
    ACCESS_QUOTE_EXPIRING: 'ACTION',
    ACCESS_PAYMENT_ACTION_REQUIRED: 'ACTION',
    ACCESS_BOOKING_PROCESSING: 'INFO',
    ACCESS_BOOKING_CONFIRMED: 'INFO',
    ACCESS_BOOKING_CHANGED: 'IMPORTANT',
    ACCESS_BOOKING_CANCELLED: 'INFO',
    ACCESS_FULFILLMENT_UPCOMING: 'INFO',
    ACCESS_FULFILLED: 'INFO',
    ACCESS_REFUND_PENDING: 'INFO',
    ACCESS_PARTIAL_REFUND: 'INFO',
    ACCESS_REFUNDED: 'INFO',
    ACCESS_RECONCILIATION_REQUIRED: 'IMPORTANT',
    ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE: 'IMPORTANT',
    ACCESS_TRANSACTION_FAILED: 'IMPORTANT',
  });

export const ACCESS_PRODUCT_TERMINOLOGY = Object.freeze({
  access: 'Access',
  availableAccess: 'Available Access',
  accessCovers: 'Access covers',
  youPay: 'You pay',
  accessUsed: 'Access used',
  remainingAccess: 'Remaining Access',
});

export function productStatusLabel(status: AccessProductTransactionStatus): string {
  switch (status) {
    case 'PROCESSING_CONFIRMATION':
      return 'Confirming booking';
    case 'BOOKING_CONFIRMED':
    case 'BOOKED':
      return 'Booking confirmed';
    case 'FULFILLED':
      return 'Completed';
    case 'SETTLED':
      return 'Settled';
    case 'QUOTE_EXPIRED':
      return 'Quote expired';
    case 'PRICE_CHANGED':
      return 'Price changed';
    case 'REFUND_PENDING':
      return 'Refund pending';
    case 'PARTIAL_REFUND':
      return 'Partial refund';
    case 'REFUNDED':
      return 'Refunded';
    case 'CANCELLED':
      return 'Cancelled';
    case 'FAILED':
      return 'Transaction failed';
    case 'RECONCILIATION_REQUIRED':
      return 'Confirming booking';
    default:
      return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}
