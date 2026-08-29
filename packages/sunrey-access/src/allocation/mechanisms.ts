/**
 * Deterministic seeded PRNG for simulation lottery outcomes.
 * Uses FNV-1a style mixing — no Math.random().
 */
export function deterministicLotteryScore(seed: string, subjectRef: string, resourceId: string): bigint {
  const input = `${seed}|${subjectRef}|${resourceId}`;
  let hash = 2_166_136_261n;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * 16_777_619n) & 0xffff_ffff_ffff_ffffn;
  }
  return hash % 10_000n;
}

export function lotteryWins(score: bigint, thresholdBps: bigint): boolean {
  return score <= thresholdBps;
}

export function queuePosition(queueJoinOrder: bigint | undefined, fairOrdering: boolean): bigint | null {
  if (queueJoinOrder === undefined) return null;
  return fairOrdering ? queueJoinOrder : queueJoinOrder;
}

export function fixedAccessGrant(
  requestedUnits: bigint,
  fixedAccessRatePerHour: bigint | undefined,
): bigint {
  if (!fixedAccessRatePerHour || fixedAccessRatePerHour <= 0n) {
    return requestedUnits;
  }
  return requestedUnits <= fixedAccessRatePerHour ? requestedUnits : fixedAccessRatePerHour;
}

export function entitlementGrant(requestedUnits: bigint, entitlementUnits: bigint | undefined): bigint {
  if (entitlementUnits === undefined) {
    return 0n;
  }
  return requestedUnits <= entitlementUnits ? requestedUnits : entitlementUnits;
}

export function marketGrant(
  requestedUnits: bigint,
  optionalMarketPurchase: boolean | undefined,
  offeredPriceMinor: bigint | undefined,
  allowFinancialPurchase: boolean,
): { readonly granted: bigint; readonly financialConsidered: boolean } {
  if (!optionalMarketPurchase || !allowFinancialPurchase) {
    return { granted: 0n, financialConsidered: false };
  }
  if (offeredPriceMinor === undefined || offeredPriceMinor <= 0n) {
    return { granted: 0n, financialConsidered: true };
  }
  return { granted: requestedUnits, financialConsidered: true };
}
