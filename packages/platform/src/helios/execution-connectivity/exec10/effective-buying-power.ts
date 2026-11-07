import type { FinancingAllocationCaps } from './types.ts';

export type EffectiveBuyingPowerResult = {
  readonly executableBuyingPowerMinor: string;
  readonly limitingSource: 'BROKER' | 'SUNREY_CAPITAL' | 'RISK' | 'CUSTOMER_MANDATE';
};

const CAP_KEYS: Array<{
  readonly field: keyof FinancingAllocationCaps;
  readonly source: EffectiveBuyingPowerResult['limitingSource'];
}> = [
  { field: 'brokerAvailableMinor', source: 'BROKER' },
  { field: 'sunreyCapitalAllocationMinor', source: 'SUNREY_CAPITAL' },
  { field: 'riskAllocationMinor', source: 'RISK' },
  { field: 'customerMandateMinor', source: 'CUSTOMER_MANDATE' },
];

/**
 * Effective executable buying power is the minimum of broker, SunRey capital,
 * Risk, and customer mandate allocations — never broker margin alone.
 */
export function computeEffectiveBuyingPower(caps: FinancingAllocationCaps): EffectiveBuyingPowerResult {
  let minValue = BigInt(caps.brokerAvailableMinor);
  let limitingSource: EffectiveBuyingPowerResult['limitingSource'] = 'BROKER';

  for (const { field, source } of CAP_KEYS) {
    const value = BigInt(caps[field]);
    if (value < minValue) {
      minValue = value;
      limitingSource = source;
    }
  }

  const executable = minValue > 0n ? minValue : 0n;
  return Object.freeze({
    executableBuyingPowerMinor: executable.toString(),
    limitingSource,
  });
}
