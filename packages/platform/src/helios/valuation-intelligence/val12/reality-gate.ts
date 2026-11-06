import { LIVE_TRADING_ENABLED } from '@solstice/config';

import type { ValuationRealityGateStatus } from './types.ts';

export function resolveValuationRealityGate(input: {
  readonly architectureComplete: boolean;
  readonly validationStable: boolean;
  readonly knowableAtViolations: number;
}): {
  readonly status: ValuationRealityGateStatus;
  readonly valuationQualityNotInvestmentAlpha: true;
  readonly notes: readonly string[];
} {
  const notes: string[] = [];
  if (input.knowableAtViolations > 0) {
    notes.push('Point-in-time knowable-at violations detected');
  }
  if (LIVE_TRADING_ENABLED) {
    notes.push('LIVE_TRADING_ENABLED must remain false');
  }
  notes.push('Valuation quality is separated from investment alpha; good architecture does not prove tradable alpha');

  let status: ValuationRealityGateStatus = 'ARCHITECTURALLY_QUALIFIED';
  if (input.architectureComplete && input.knowableAtViolations === 0) {
    status = input.validationStable ? 'VALUATION_QUALITY_QUALIFIED' : 'ARCHITECTURALLY_QUALIFIED';
  }
  if (status === 'VALUATION_QUALITY_QUALIFIED') {
    notes.push('Research-only intelligence — never auto-promotes strategy candidates from valuation alone');
    status = 'RESEARCH_ONLY';
  }
  return Object.freeze({
    status,
    valuationQualityNotInvestmentAlpha: true,
    notes: Object.freeze(notes),
  });
}

/** Architecture implemented must not be read as alpha proven. */
export function valuationArchitectureImpliesAlpha(status: ValuationRealityGateStatus): boolean {
  return status !== 'ARCHITECTURALLY_QUALIFIED' && status !== 'RESEARCH_ONLY' && status !== 'VALUATION_QUALITY_QUALIFIED';
}
