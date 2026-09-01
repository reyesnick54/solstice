import { Money } from '../../../../money/src/money.ts';

/**
 * Deterministic financial calculations for Grow agents.
 * AI may explain results; it must not perform core accounting arithmetic.
 */
export function allocationWeightBps(partMinorUnits: string, totalMinorUnits: string, currency: string): number {
  const part = Money.fromMinorUnitsString(partMinorUnits, currency);
  const total = Money.fromMinorUnitsString(totalMinorUnits, currency);
  if (total.minorUnits === 0n) {
    return 0;
  }
  return Number((part.minorUnits * 10_000n) / total.minorUnits);
}

export function cashFlowDelta(inflowMinorUnits: string, outflowMinorUnits: string, currency: string): string {
  const inflow = Money.fromMinorUnitsString(inflowMinorUnits, currency);
  const outflow = Money.fromMinorUnitsString(outflowMinorUnits, currency);
  return inflow.minus(outflow).minorUnits.toString();
}

export function feeImpactMinorUnits(principalMinorUnits: string, feeBps: number, currency: string): string {
  const principal = Money.fromMinorUnitsString(principalMinorUnits, currency);
  const fee = (principal.minorUnits * BigInt(feeBps)) / 10_000n;
  return fee.toString();
}

export function interestAccruedMinorUnits(
  principalMinorUnits: string,
  annualBps: number,
  days: number,
  currency: string,
): string {
  const principal = Money.fromMinorUnitsString(principalMinorUnits, currency);
  const daily = (principal.minorUnits * BigInt(annualBps)) / (10_000n * 365n);
  return (daily * BigInt(days)).toString();
}

export const ANALYSIS_ENGINE_KIND = 'DETERMINISTIC_GROW_ANALYSIS_V1' as const;
