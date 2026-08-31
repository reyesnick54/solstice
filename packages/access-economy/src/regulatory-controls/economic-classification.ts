/**
 * ACCESS Wave 5 — Economic classification for Access entitlements.
 */

import { ACCESS_ENTITLEMENT_NON_CASH_FLAGS } from '../domain/types.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from '../funding-solvency/taxonomy.ts';
import {
  ACCESS_ECONOMIC_CLASSIFICATIONS,
  FORBIDDEN_ACCESS_ECONOMIC_CLASSIFICATIONS,
} from './taxonomy.ts';
import type { AccessEconomicPosture } from './types.ts';

export const CANONICAL_ACCESS_ECONOMIC_CLASSIFICATION = 'NON_CASH_ACCESS_RIGHT' as const;

export function accessEconomicPosture(): AccessEconomicPosture {
  return Object.freeze({
    classification: CANONICAL_ACCESS_ECONOMIC_CLASSIFICATION,
    forbiddenClassifications: Object.freeze([...FORBIDDEN_ACCESS_ECONOMIC_CLASSIFICATIONS]),
    isNonCash: true,
    isGuaranteedFiatRedemption: false,
    isTokenRedemption: false,
  });
}

export function isAccessEconomicClassification(value: string): value is typeof CANONICAL_ACCESS_ECONOMIC_CLASSIFICATION {
  return (ACCESS_ECONOMIC_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function assertAccessIsNonCashEntitlement(flags: typeof ACCESS_ENTITLEMENT_NON_CASH_FLAGS): void {
  if (flags.isCash || flags.isBankBalance || flags.isMonetaryAsset || flags.isGuaranteedFiatRedemption) {
    throw new Error('Access entitlement must remain classified as NON_CASH_ACCESS_RIGHT');
  }
}

export function assertNoTokenFiatPeg(input: {
  readonly tokenConversionContribution: bigint;
}): void {
  assertTokenConversionContributionZero(input.tokenConversionContribution);
}

export function assertTokenConversionContributionZero(value: bigint): void {
  if (value !== TOKEN_CONVERSION_CONTRIBUTION) {
    throw new Error('TokenConversionContribution must remain zero at Access launch');
  }
}

export function assertNoFixedTokenRedemptionRate(
  tokenAmount: bigint,
  fiatMinorUnits: bigint,
  tokenSymbol: 'SR' | 'MR',
): void {
  if (tokenAmount > 0n && fiatMinorUnits > 0n) {
    throw new Error(
      `forbidden fixed redemption rate: ${tokenSymbol} holdings do not establish guaranteed Access fiat value`,
    );
  }
}
