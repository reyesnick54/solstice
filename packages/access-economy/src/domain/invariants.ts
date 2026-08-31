import {
  ACCESS_ENTITLEMENT_NON_CASH_FLAGS,
  type AccessCapacity,
  type AccessDomainFailure,
  type AccessEntitlement,
  type AccessQuote,
  type AccessSettlement,
} from './types.ts';
import { isAccessCategoryId, isAccessUnit } from './taxonomy.ts';

export function accessDomainFailure(
  code: AccessDomainFailure['code'],
  message: string,
): AccessDomainFailure {
  return Object.freeze({ code, message });
}

export function assertNonNegative(value: bigint, label: string): AccessDomainFailure | null {
  if (value < 0n) {
    return accessDomainFailure('NEGATIVE_UNITS', `${label} must be >= 0`);
  }
  return null;
}

export function deriveRemainingEntitlementUnits(
  allocatedUnits: bigint,
  reservedUnits: bigint,
  consumedUnits: bigint,
): bigint {
  const remaining = allocatedUnits - reservedUnits - consumedUnits;
  return remaining > 0n ? remaining : 0n;
}

export function deriveAvailableCapacityUnits(
  totalUnits: bigint,
  reservedUnits: bigint,
  consumedUnits: bigint,
): bigint {
  const available = totalUnits - reservedUnits - consumedUnits;
  return available > 0n ? available : 0n;
}

export function validateEntitlementUnits(
  allocatedUnits: bigint,
  reservedUnits: bigint,
  consumedUnits: bigint,
  remainingUnits: bigint,
): AccessDomainFailure | null {
  const negative =
    assertNonNegative(allocatedUnits, 'allocatedUnits') ??
    assertNonNegative(reservedUnits, 'reservedUnits') ??
    assertNonNegative(consumedUnits, 'consumedUnits') ??
    assertNonNegative(remainingUnits, 'remainingUnits');
  if (negative) {
    return negative;
  }
  if (reservedUnits + consumedUnits > allocatedUnits) {
    return accessDomainFailure(
      'OVER_CONSUMED',
      'reservedUnits + consumedUnits must not exceed allocatedUnits',
    );
  }
  const expected = deriveRemainingEntitlementUnits(allocatedUnits, reservedUnits, consumedUnits);
  if (remainingUnits !== expected) {
    return accessDomainFailure(
      'INVALID_REMAINING_UNITS',
      `remainingUnits must equal allocatedUnits - reservedUnits - consumedUnits (${expected})`,
    );
  }
  return null;
}

export function validateCapacityUnits(
  totalUnits: bigint,
  reservedUnits: bigint,
  consumedUnits: bigint,
  availableUnits: bigint,
): AccessDomainFailure | null {
  const negative =
    assertNonNegative(totalUnits, 'totalUnits') ??
    assertNonNegative(reservedUnits, 'reservedUnits') ??
    assertNonNegative(consumedUnits, 'consumedUnits') ??
    assertNonNegative(availableUnits, 'availableUnits');
  if (negative) {
    return negative;
  }
  if (reservedUnits + consumedUnits > totalUnits) {
    return accessDomainFailure(
      'OVER_RESERVED',
      'reservedUnits + consumedUnits must not exceed totalUnits',
    );
  }
  const expected = deriveAvailableCapacityUnits(totalUnits, reservedUnits, consumedUnits);
  if (availableUnits !== expected) {
    return accessDomainFailure(
      'INVALID_AVAILABLE_CAPACITY',
      `availableUnits must equal totalUnits - reservedUnits - consumedUnits (${expected})`,
    );
  }
  return null;
}

export function validateNonNegativeAmounts(
  amounts: Readonly<Record<string, bigint>>,
): AccessDomainFailure | null {
  for (const [label, value] of Object.entries(amounts)) {
    const failure = assertNonNegative(value, label);
    if (failure) {
      return failure;
    }
  }
  return null;
}

export function validateAccessEntitlement(entitlement: AccessEntitlement): AccessDomainFailure | null {
  if (!isAccessCategoryId(entitlement.category)) {
    return accessDomainFailure('INVALID_CATEGORY', `unknown category: ${entitlement.category}`);
  }
  if (!isAccessUnit(entitlement.unit)) {
    return accessDomainFailure('INVALID_UNIT', `unknown unit: ${entitlement.unit}`);
  }
  const unitsFailure = validateEntitlementUnits(
    entitlement.allocatedUnits,
    entitlement.reservedUnits,
    entitlement.consumedUnits,
    entitlement.remainingUnits,
  );
  if (unitsFailure) {
    return unitsFailure;
  }
  if (
    entitlement.nonCash.isCash ||
    entitlement.nonCash.isBankBalance ||
    entitlement.nonCash.isMonetaryAsset
  ) {
    return accessDomainFailure(
      'ENTITLEMENT_IS_NOT_CASH',
      'AccessEntitlement must remain explicitly non-cash',
    );
  }
  return null;
}

export function validateAccessCapacity(capacity: AccessCapacity): AccessDomainFailure | null {
  if (!isAccessCategoryId(capacity.category)) {
    return accessDomainFailure('INVALID_CATEGORY', `unknown category: ${capacity.category}`);
  }
  return validateCapacityUnits(
    capacity.totalUnits,
    capacity.reservedUnits,
    capacity.consumedUnits,
    capacity.availableUnits,
  );
}

export function validateAccessQuote(quote: AccessQuote): AccessDomainFailure | null {
  if (!isAccessCategoryId(quote.category)) {
    return accessDomainFailure('INVALID_CATEGORY', `unknown category: ${quote.category}`);
  }
  if (!isAccessUnit(quote.unit)) {
    return accessDomainFailure('INVALID_UNIT', `unknown unit: ${quote.unit}`);
  }
  return validateNonNegativeAmounts({
    requestedUnits: quote.requestedUnits,
    providerPrice: quote.providerPrice,
    taxes: quote.taxes,
    mandatoryFees: quote.mandatoryFees,
    optionalFees: quote.optionalFees,
    securityDeposit: quote.securityDeposit,
    totalProviderAmount: quote.totalProviderAmount,
    eligibleAccessAmount: quote.eligibleAccessAmount,
    userContribution: quote.userContribution,
  });
}

export function validateAccessSettlement(settlement: AccessSettlement): AccessDomainFailure | null {
  return validateNonNegativeAmounts({
    providerAmount: settlement.providerAmount,
    accessPoolContribution: settlement.accessPoolContribution,
    userFiatContribution: settlement.userFiatContribution,
    tokenConversionContribution: settlement.tokenConversionContribution,
    taxAmount: settlement.taxAmount,
    feeAmount: settlement.feeAmount,
  });
}

export function defaultTokenConversionContribution(): bigint {
  return 0n;
}

export function buildAccessCapacity(
  input: Omit<AccessCapacity, 'availableUnits'> & { readonly availableUnits?: bigint },
): AccessCapacity {
  const availableUnits =
    input.availableUnits ??
    deriveAvailableCapacityUnits(input.totalUnits, input.reservedUnits, input.consumedUnits);
  const record: AccessCapacity = Object.freeze({
    ...input,
    availableUnits,
  });
  const failure = validateAccessCapacity(record);
  if (failure) {
    throw new RangeError(failure.message);
  }
  return record;
}

export function buildAccessEntitlement(
  input: Omit<AccessEntitlement, 'remainingUnits' | 'nonCash'> & {
    readonly remainingUnits?: bigint;
    readonly nonCash?: typeof ACCESS_ENTITLEMENT_NON_CASH_FLAGS;
  },
): AccessEntitlement {
  const remainingUnits =
    input.remainingUnits ??
    deriveRemainingEntitlementUnits(input.allocatedUnits, input.reservedUnits, input.consumedUnits);
  const record: AccessEntitlement = Object.freeze({
    ...input,
    remainingUnits,
    nonCash: input.nonCash ?? ACCESS_ENTITLEMENT_NON_CASH_FLAGS,
  });
  const failure = validateAccessEntitlement(record);
  if (failure) {
    throw new RangeError(failure.message);
  }
  return record;
}

export function buildAccessSettlement(
  input: Omit<AccessSettlement, 'tokenConversionContribution'> & {
    readonly tokenConversionContribution?: bigint;
  },
): AccessSettlement {
  const record: AccessSettlement = Object.freeze({
    ...input,
    tokenConversionContribution:
      input.tokenConversionContribution ?? defaultTokenConversionContribution(),
  });
  const failure = validateAccessSettlement(record);
  if (failure) {
    throw new RangeError(failure.message);
  }
  return record;
}
