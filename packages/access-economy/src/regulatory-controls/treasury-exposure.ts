// @ts-nocheck
/**
 * ACCESS Wave 5 — Treasury exposure model derived from actual ledgers.
 *
 * Does not duplicate balance truth; reads from funding pool balances.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { FundingPoolBalance } from '../funding-solvency/types.ts';
import type { AccessTreasuryExposure, AccessTreasuryExposureStatus } from './types.ts';

export function deriveAccessTreasuryExposure(input: {
  readonly category: string | null;
  readonly currency: string;
  readonly balance: FundingPoolBalance;
  readonly userCopayAuthorized?: bigint;
  readonly userCopayReceivable?: bigint;
  readonly calculatedAt: UtcInstant;
  readonly operationalPaused?: boolean;
}): AccessTreasuryExposure {
  const {
    category,
    currency,
    balance,
    userCopayAuthorized = 0n,
    userCopayReceivable = 0n,
    calculatedAt,
    operationalPaused = false,
  } = input;

  const unsettledProviderExposure = balance.pendingSettlement;
  const maximumPotentialExposure =
    balance.reservedFunding +
    balance.pendingSettlement +
    balance.refundReserve +
    userCopayAuthorized;

  let status: AccessTreasuryExposureStatus = 'WITHIN_LIMITS';
  if (operationalPaused) {
    status = 'PAUSED';
  } else if (balance.availableFunding <= 0n) {
    status = 'LIMIT_BREACHED';
  } else if (balance.availableFunding < balance.riskReserve) {
    status = 'APPROACHING_LIMIT';
  }

  return Object.freeze({
    category,
    currency,
    availableFunding: balance.availableFunding,
    reservedFunding: balance.reservedFunding,
    capturedFunding: balance.capturedSettlement,
    pendingRefunds: balance.refundReserve,
    riskReserve: balance.riskReserve,
    refundReserve: balance.refundReserve,
    unsettledProviderExposure,
    userCopayAuthorized,
    userCopayReceivable,
    providerDiscountCapacity: balance.availableDiscountCapacity,
    maximumPotentialExposure,
    status,
    calculatedAt,
  });
}

export function aggregateTreasuryExposure(
  exposures: readonly AccessTreasuryExposure[],
): {
  readonly totalAvailableFunding: bigint;
  readonly totalReservedFunding: bigint;
  readonly totalMaximumExposure: bigint;
  readonly currencies: readonly string[];
} {
  let totalAvailableFunding = 0n;
  let totalReservedFunding = 0n;
  let totalMaximumExposure = 0n;
  const currencies = new Set<string>();
  for (const row of exposures) {
    totalAvailableFunding += row.availableFunding;
    totalReservedFunding += row.reservedFunding;
    totalMaximumExposure += row.maximumPotentialExposure;
    currencies.add(row.currency);
  }
  return Object.freeze({
    totalAvailableFunding,
    totalReservedFunding,
    totalMaximumExposure,
    currencies: Object.freeze([...currencies]),
  });
}
