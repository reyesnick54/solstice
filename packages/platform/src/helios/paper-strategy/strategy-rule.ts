import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { HeliosStrategyDecision } from './types.ts';
import type { HeliosPaperStrategyId } from './taxonomy.ts';

export const HELIOS_H14_REFERENCE_PRICE_ENTRY_V1: HeliosPaperStrategyId = 'HELIOS_H14_REFERENCE_PRICE_ENTRY_V1';

/** Default entry threshold: $101.00 — entry when reference mid is at or below this level. */
export const DEFAULT_ENTRY_THRESHOLD_MINOR = 10_100n;
/** Default exit threshold: $103.00 — exit when reference mid reaches this level. */
export const DEFAULT_EXIT_THRESHOLD_MINOR = 10_300n;
/** One whole share in investment quantity scale (1.0 share). */
export const DEFAULT_ENTRY_QUANTITY_UNITS = '1000000000';

export function evaluateReferencePriceEntryRule(input: {
  readonly strategyId: HeliosPaperStrategyId;
  readonly instrumentId: string;
  readonly terms: QualificationTermsSnapshot;
  readonly now: UtcInstant;
  readonly entryThresholdMinor?: bigint;
  readonly exitThresholdMinor?: bigint;
  readonly hasOpenPosition: boolean;
  readonly forceClose?: boolean;
}): HeliosStrategyDecision {
  const referenceMidMinor = BigInt(input.terms.priceReference?.minorUnits ?? '0');
  const entryThreshold = input.entryThresholdMinor ?? DEFAULT_ENTRY_THRESHOLD_MINOR;
  const exitThreshold = input.exitThresholdMinor ?? DEFAULT_EXIT_THRESHOLD_MINOR;
  const currency = input.terms.priceReference?.currency ?? 'USD';

  if (input.forceClose || (input.hasOpenPosition && referenceMidMinor >= exitThreshold)) {
    return Object.freeze({
      strategyId: input.strategyId,
      action: 'SELL',
      instrumentId: input.instrumentId,
      quantityUnits: DEFAULT_ENTRY_QUANTITY_UNITS,
      rationale: `Deterministic exit: reference mid ${referenceMidMinor} >= exit threshold ${exitThreshold} ${currency}`,
      ruleVersion: 'v1',
      entryThresholdMinor: entryThreshold.toString(),
      exitThresholdMinor: exitThreshold.toString(),
      referenceMidMinor: referenceMidMinor.toString(),
      decidedAt: input.now,
    });
  }

  if (!input.hasOpenPosition && referenceMidMinor <= entryThreshold) {
    return Object.freeze({
      strategyId: input.strategyId,
      action: 'BUY',
      instrumentId: input.instrumentId,
      quantityUnits: DEFAULT_ENTRY_QUANTITY_UNITS,
      rationale: `Deterministic entry: reference mid ${referenceMidMinor} <= entry threshold ${entryThreshold} ${currency}`,
      ruleVersion: 'v1',
      entryThresholdMinor: entryThreshold.toString(),
      exitThresholdMinor: exitThreshold.toString(),
      referenceMidMinor: referenceMidMinor.toString(),
      decidedAt: input.now,
    });
  }

  return Object.freeze({
    strategyId: input.strategyId,
    action: 'NO_ACTION',
    instrumentId: input.instrumentId,
    quantityUnits: '0',
    rationale: input.hasOpenPosition
      ? `Hold: reference mid ${referenceMidMinor} below exit threshold ${exitThreshold}`
      : `No entry: reference mid ${referenceMidMinor} above entry threshold ${entryThreshold}`,
    ruleVersion: 'v1',
    entryThresholdMinor: entryThreshold.toString(),
    exitThresholdMinor: exitThreshold.toString(),
    referenceMidMinor: referenceMidMinor.toString(),
    decidedAt: input.now,
  });
}
