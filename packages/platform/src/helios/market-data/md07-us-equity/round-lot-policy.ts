/**
 * Versioned U.S. equity round-lot reference policy (no hard-coded 100 shares).
 */

import type { UtcInstant } from '@solstice/domain';
import type { RoundLotPolicyVersion, UsEquityLotClassification } from './types.ts';

export const HELIOS_MD07_ROUND_LOT_POLICY_REGISTRY_ID = 'helios.md07.us-equity.round-lot' as const;

const POLICY_V2024_09: RoundLotPolicyVersion = Object.freeze({
  policyId: HELIOS_MD07_ROUND_LOT_POLICY_REGISTRY_ID,
  version: '2024-09',
  effectiveFrom: '2024-09-01T00:00:00.000Z',
  effectiveUntil: '2026-06-30T23:59:59.999Z',
  tiers: Object.freeze([
    Object.freeze({
      minPriceMinorUnits: 1_000_000n,
      maxPriceMinorUnits: null,
      roundLotShares: 100n,
    }),
    Object.freeze({
      minPriceMinorUnits: 100n,
      maxPriceMinorUnits: 999_999n,
      roundLotShares: 100n,
    }),
    Object.freeze({
      minPriceMinorUnits: 0n,
      maxPriceMinorUnits: 99n,
      roundLotShares: 100n,
    }),
  ]),
});

const POLICY_V2026_07: RoundLotPolicyVersion = Object.freeze({
  policyId: HELIOS_MD07_ROUND_LOT_POLICY_REGISTRY_ID,
  version: '2026-07',
  effectiveFrom: '2026-07-01T00:00:00.000Z',
  effectiveUntil: null,
  tiers: Object.freeze([
    Object.freeze({
      minPriceMinorUnits: 250_00n,
      maxPriceMinorUnits: null,
      roundLotShares: 100n,
    }),
    Object.freeze({
      minPriceMinorUnits: 0n,
      maxPriceMinorUnits: 249_99n,
      roundLotShares: 100n,
    }),
  ]),
});

export const HELIOS_MD07_ROUND_LOT_POLICY_HISTORY: readonly RoundLotPolicyVersion[] = Object.freeze([
  POLICY_V2024_09,
  POLICY_V2026_07,
]);

export function resolveRoundLotPolicyAt(
  asOf: UtcInstant,
  history: readonly RoundLotPolicyVersion[] = HELIOS_MD07_ROUND_LOT_POLICY_HISTORY,
): RoundLotPolicyVersion | null {
  const instant = Date.parse(asOf);
  for (const policy of history) {
    const from = Date.parse(policy.effectiveFrom);
    const until = policy.effectiveUntil ? Date.parse(policy.effectiveUntil) : Number.POSITIVE_INFINITY;
    if (instant >= from && instant <= until) {
      return policy;
    }
  }
  return null;
}

export function resolveRoundLotShares(
  policy: RoundLotPolicyVersion,
  referencePriceMinorUnits: bigint,
): bigint {
  for (const tier of policy.tiers) {
    const aboveMin = referencePriceMinorUnits >= tier.minPriceMinorUnits;
    const belowMax =
      tier.maxPriceMinorUnits === null || referencePriceMinorUnits <= tier.maxPriceMinorUnits;
    if (aboveMin && belowMax) {
      return tier.roundLotShares;
    }
  }
  const fallback = policy.tiers[policy.tiers.length - 1];
  return fallback?.roundLotShares ?? 100n;
}

export function classifyLotSize(
  roundLotShares: bigint,
  sizeShares: bigint,
): UsEquityLotClassification {
  if (sizeShares <= 0n) {
    return 'UNKNOWN';
  }
  if (sizeShares < roundLotShares) {
    return 'ODD';
  }
  if (sizeShares % roundLotShares === 0n) {
    return 'ROUND';
  }
  return 'MIXED';
}
