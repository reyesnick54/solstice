import type { UtcInstant } from '../../../../domain/src/time.ts';
import { Money } from '../../../../money/src/money.ts';
import type { SerializedMoney } from '../../mandate/types.ts';
import type { DetectorFinding, OpportunityImpact, RateCatalogReference } from './types.ts';

export const TAX_DISCLAIMER =
  'Tax treatment is customer-specific and not determined here. This is not tax advice.';

function zero(currency: string): SerializedMoney {
  return { minorUnits: '0', currency };
}

/**
 * Integer minor-unit estimate of an annual cash-flow effect from a
 * catalog rate. This is not a yield, APY, APR, or promised return.
 */
export function estimatedAnnualEffect(
  principal: Money,
  rate: RateCatalogReference,
): { readonly low: SerializedMoney; readonly high: SerializedMoney } {
  if (principal.currency !== rate.currency || rate.basisPoints < 0) {
    return { low: zero(principal.currency), high: zero(principal.currency) };
  }
  const high = (principal.minorUnits * BigInt(rate.basisPoints)) / 10000n;
  return {
    low: zero(principal.currency),
    high: { minorUnits: high.toString(), currency: principal.currency },
  };
}

export function impactFromFinding(finding: DetectorFinding, asOf: UtcInstant): OpportunityImpact {
  return Object.freeze({
    kind: finding.impactKind,
    ...(finding.estimatedImpact ? { estimatedImpact: finding.estimatedImpact } : {}),
    ...(finding.impactRange ? { impactRange: finding.impactRange } : {}),
    assumptions: Object.freeze([...finding.assumptions]),
    ...(finding.rateSource ? { rateSource: finding.rateSource } : {}),
    asOf,
    fees: Object.freeze([...finding.fees]),
    taxDisclaimer: TAX_DISCLAIMER,
    achievementPromised: false,
    returnGuaranteed: false,
  });
}

export function assertNoReturnGuarantee(impact: OpportunityImpact): void {
  if (impact.achievementPromised !== false || impact.returnGuaranteed !== false) {
    throw new Error('opportunity impact must not promise a return');
  }
}
