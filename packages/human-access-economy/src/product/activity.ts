/**
 * Access Wave 4 activity model — product-safe history items.
 */

import type { AccessCategory } from '../taxonomy.ts';
import {
  ACCESS_PRODUCT_TRANSACTION_STATUSES,
  type AccessActivityItemType,
  type AccessHistoryFilter,
  type AccessProductTransactionStatus,
} from './taxonomy.ts';
import { productStatusLabel } from './taxonomy.ts';

export type AccessActivityItem = {
  readonly activityId: string;
  readonly customerId: string;
  readonly type: AccessActivityItemType;
  readonly title: string;
  readonly summary: string;
  readonly category: AccessCategory;
  readonly transactionId: string | null;
  readonly status: AccessProductTransactionStatus | string;
  readonly statusLabel: string;
  readonly occurredAt: string;
  readonly providerDisplayName: string | null;
  readonly serviceName: string | null;
  readonly location: string | null;
  readonly financialSummary: string | null;
  readonly dataState: 'SIMULATED' | 'LIVE';
};

export function buildActivityItem(input: {
  readonly activityId: string;
  readonly customerId: string;
  readonly type: AccessActivityItemType;
  readonly title: string;
  readonly summary: string;
  readonly category: AccessCategory;
  readonly transactionId?: string | null;
  readonly status: AccessProductTransactionStatus | string;
  readonly occurredAt: string;
  readonly providerDisplayName?: string | null;
  readonly serviceName?: string | null;
  readonly location?: string | null;
  readonly financialSummary?: string | null;
}): AccessActivityItem {
  const statusLabel =
    (ACCESS_PRODUCT_TRANSACTION_STATUSES as readonly string[]).includes(String(input.status))
      ? productStatusLabel(input.status as AccessProductTransactionStatus)
      : String(input.status);
  return Object.freeze({
    activityId: input.activityId,
    customerId: input.customerId,
    type: input.type,
    title: input.title,
    summary: input.summary,
    category: input.category,
    transactionId: input.transactionId ?? null,
    status: input.status,
    statusLabel,
    occurredAt: input.occurredAt,
    providerDisplayName: input.providerDisplayName ?? null,
    serviceName: input.serviceName ?? null,
    location: input.location ?? null,
    financialSummary: input.financialSummary ?? null,
    dataState: 'SIMULATED' as const,
  });
}

export function filterActivityItems(
  items: readonly AccessActivityItem[],
  filter: AccessHistoryFilter,
  category?: AccessCategory,
  fromDate?: string,
  toDate?: string,
): readonly AccessActivityItem[] {
  let result = items;
  if (category) {
    result = result.filter((row) => row.category === category);
  }
  if (fromDate) {
    result = result.filter((row) => row.occurredAt >= fromDate);
  }
  if (toDate) {
    result = result.filter((row) => row.occurredAt <= toDate);
  }
  switch (filter) {
    case 'ACTIVE':
      return result.filter((row) =>
        ['QUOTED', 'CHECKOUT_STARTED', 'PROCESSING_CONFIRMATION', 'BOOKING_CONFIRMED', 'BOOKED'].includes(
          String(row.status),
        ),
      );
    case 'COMPLETED':
      return result.filter((row) => ['FULFILLED', 'SETTLED', 'BOOKED'].includes(String(row.status)));
    case 'CANCELLED':
      return result.filter((row) => row.type === 'CANCELLATION' || row.status === 'CANCELLED');
    case 'REFUNDED':
      return result.filter((row) =>
        ['REFUNDED', 'PARTIAL_REFUND', 'REFUND_PENDING'].includes(String(row.status)) || row.type === 'REFUND',
      );
    default:
      return result;
  }
}
