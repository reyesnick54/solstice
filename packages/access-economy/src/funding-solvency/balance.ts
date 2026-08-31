/**
 * Derive entitlement and funding balances from immutable ledger entries.
 */

import type {
  EntitlementBalance,
  EntitlementLedgerEntry,
  FundingLedgerEntry,
  FundingPoolBalance,
} from './types.ts';
import type { AccessFundingSource } from './types.ts';

function assertNonNegative(value: bigint, label: string): void {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative, got ${value}`);
  }
}

export function deriveEntitlementBalance(
  entitlementId: string,
  entries: readonly EntitlementLedgerEntry[],
): EntitlementBalance | null {
  const relevant = entries.filter((row) => row.entitlementId === entitlementId);
  if (relevant.length === 0) {
    return null;
  }

  let allocated = 0n;
  let reserved = 0n;
  let consumed = 0n;
  let expired = 0n;
  let released = 0n;
  let reversed = 0n;

  for (const entry of relevant) {
    const qty = entry.quantity;
    switch (entry.entryType) {
      case 'ALLOCATION':
      case 'MANUAL_ADJUSTMENT':
        if (entry.direction === 'CREDIT') {
          allocated += qty;
        } else {
          allocated -= qty;
        }
        break;
      case 'RESERVATION':
        if (entry.direction === 'DEBIT') {
          reserved += qty;
        }
        break;
      case 'RESERVATION_RELEASE':
        if (entry.direction === 'CREDIT') {
          released += qty;
          reserved -= qty;
        }
        break;
      case 'REDEMPTION':
        if (entry.direction === 'DEBIT') {
          consumed += qty;
          reserved -= qty;
        }
        break;
      case 'REVERSAL':
        if (entry.direction === 'CREDIT') {
          reversed += qty;
          consumed -= qty;
        }
        break;
      case 'EXPIRATION':
        if (entry.direction === 'DEBIT') {
          expired += qty;
        }
        break;
      default:
        break;
    }
  }

  const remaining = allocated - reserved - consumed - expired;
  assertNonNegative(allocated, 'allocated');
  assertNonNegative(reserved, 'reserved');
  assertNonNegative(consumed, 'consumed');
  assertNonNegative(expired, 'expired');
  assertNonNegative(remaining, 'remaining');

  const first = relevant[0]!;
  return Object.freeze({
    entitlementId,
    userId: first.userId,
    category: first.category,
    unit: first.unit,
    allocated,
    reserved,
    consumed,
    expired,
    released,
    reversed,
    remaining,
  });
}

export function deriveFundingPoolBalance(
  fundingPoolId: string,
  currency: string,
  entries: readonly FundingLedgerEntry[],
  sources: readonly AccessFundingSource[],
  now: string,
): FundingPoolBalance {
  const poolEntries = entries.filter(
    (row) => row.fundingPoolId === fundingPoolId && row.currency === currency,
  );

  let totalReceived = 0n;
  let totalCommitted = 0n;
  let pendingSettlement = 0n;
  let capturedSettlement = 0n;
  let refundReserve = 0n;
  let riskReserve = 0n;

  for (const entry of poolEntries) {
    const amt = entry.amountMinorUnits;
    switch (entry.entryType) {
      case 'FUNDING_RECEIVED':
        totalReceived += entry.direction === 'CREDIT' ? amt : -amt;
        break;
      case 'REFUND_RECEIVED':
        totalReceived += entry.direction === 'CREDIT' ? amt : -amt;
        break;
      case 'FUNDING_COMMITTED':
        totalCommitted += entry.direction === 'DEBIT' ? amt : -amt;
        break;
      case 'SETTLEMENT_RESERVED':
        pendingSettlement += amt;
        break;
      case 'SETTLEMENT_RELEASED':
        pendingSettlement -= amt;
        break;
      case 'SETTLEMENT_CAPTURED':
        capturedSettlement += amt;
        pendingSettlement -= amt;
        break;
      case 'RESERVE_ALLOCATED':
        if (entry.transactionReference.startsWith('refund:')) {
          refundReserve += amt;
        } else if (entry.transactionReference.startsWith('risk:')) {
          riskReserve += amt;
        }
        break;
      case 'RESERVE_RELEASED':
        if (entry.transactionReference.startsWith('refund:')) {
          refundReserve -= amt;
        } else if (entry.transactionReference.startsWith('risk:')) {
          riskReserve -= amt;
        }
        break;
      case 'ADJUSTMENT':
        totalReceived += entry.direction === 'CREDIT' ? amt : -amt;
        break;
      default:
        break;
    }
  }

  assertNonNegative(pendingSettlement, 'pendingSettlement');
  assertNonNegative(refundReserve, 'refundReserve');
  assertNonNegative(riskReserve, 'riskReserve');

  const activeSources = sources.filter(
    (src) =>
      src.fundingPoolId === fundingPoolId &&
      src.currency === currency &&
      src.status === 'ACTIVE' &&
      src.effectiveFrom <= now &&
      (src.expiresAt === null || src.expiresAt > now),
  );

  let cashReceived = 0n;
  let discountCapacity = 0n;
  for (const src of activeSources) {
    if (src.valueKind === 'DISCOUNT_CAPACITY') {
      discountCapacity += src.amountReceived;
    } else {
      cashReceived += src.amountReceived;
    }
  }

  const availableCashFunding =
    cashReceived - pendingSettlement - capturedSettlement - refundReserve - riskReserve;
  const availableDiscountCapacity = discountCapacity;
  const availableFunding = availableCashFunding + availableDiscountCapacity;

  assertNonNegative(pendingSettlement, 'pendingSettlement after derive');

  return Object.freeze({
    fundingPoolId,
    currency,
    totalReceived,
    totalCommitted,
    cashReceived,
    discountCapacity,
    pendingSettlement,
    capturedSettlement,
    refundReserve,
    riskReserve,
    reservedFunding: pendingSettlement,
    availableFunding,
    availableCashFunding,
    availableDiscountCapacity,
  });
}

export function computeSolvencyEquation(balance: FundingPoolBalance): {
  readonly fundedAccessPool: bigint;
  readonly eligibleAvailableFunding: bigint;
} {
  const eligibleAvailableFunding =
    balance.cashReceived +
    balance.discountCapacity -
    balance.pendingSettlement -
    balance.capturedSettlement -
    balance.refundReserve -
    balance.riskReserve;

  return Object.freeze({
    fundedAccessPool: balance.availableFunding,
    eligibleAvailableFunding,
  });
}
