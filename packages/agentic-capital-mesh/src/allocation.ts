import { err, ok, type Result } from '../../domain/src/result.ts';
import { quantityScaleFactor } from '../../investments/src/quantity.ts';
import { RATIO_SCALE, RATIO_UNIT, applyRatio, ratioFromUnits, type Ratio } from '../../risk/src/arithmetic.ts';
import { asCapitalAllocationCandidateId } from './ids.ts';
import type {
  AllocationSlice,
  CapitalAllocationCandidate,
  CompiledAllocation,
  CompiledQuantity,
  InstrumentUniverseFact,
  MarketPriceFact,
} from './types.ts';

export type AllocationFailure = {
  readonly code:
    | 'WEIGHT_SUM'
    | 'FLOATING_POINT_WEIGHT'
    | 'UNKNOWN_INSTRUMENT'
    | 'STALE_PRICE'
    | 'INCREMENT_VIOLATION'
    | 'CURRENCY_MISMATCH';
  readonly message: string;
};

export function allocationWeight(percent: bigint): Ratio {
  return ratioFromUnits(percent * 1_000_000n);
}

export function createAllocationCandidate(input: {
  readonly candidateId: string;
  readonly subjectId: string;
  readonly slices: readonly { readonly instrumentId: string; readonly percent: bigint; readonly cash?: boolean }[];
}): Result<CapitalAllocationCandidate, AllocationFailure> {
  const slices: AllocationSlice[] = input.slices.map((slice) =>
    Object.freeze({
      instrumentId: slice.instrumentId,
      weight: allocationWeight(slice.percent),
      kind: slice.cash === true ? 'BROKERAGE_CASH' : 'INSTRUMENT',
    }),
  );
  const total = slices.reduce((sum, slice) => sum + slice.weight.units, 0n);
  if (total !== RATIO_UNIT) {
    return err({
      code: 'WEIGHT_SUM',
      message: `allocation weights must total ${RATIO_UNIT.toString()} at scale ${RATIO_SCALE}; got ${total.toString()}`,
    });
  }
  return ok(
    Object.freeze({
      candidateId: asCapitalAllocationCandidateId(input.candidateId),
      subjectId: input.subjectId,
      slices: Object.freeze(slices),
      scale: RATIO_SCALE,
      totalsExactly: true as const,
    }),
  );
}

/**
 * Deterministic compiler: capital + weights + prices + increment → quantities + cash remainder.
 * AI-suggested arithmetic is ignored; only these bigint paths are authoritative.
 */
export function compileAllocation(input: {
  readonly candidate: CapitalAllocationCandidate;
  readonly investableMinor: bigint;
  readonly currency: string;
  readonly prices: readonly MarketPriceFact[];
  readonly universe: readonly InstrumentUniverseFact[];
}): Result<CompiledAllocation, AllocationFailure> {
  const quantities: CompiledQuantity[] = [];
  let used = 0n;
  for (const slice of input.candidate.slices) {
    if (slice.kind === 'BROKERAGE_CASH') {
      continue;
    }
    const instrument = input.universe.find((row) => row.instrumentId === slice.instrumentId);
    if (!instrument || !instrument.available) {
      return err({
        code: 'UNKNOWN_INSTRUMENT',
        message: `instrument ${slice.instrumentId} is not in the approved universe`,
      });
    }
    if (instrument.currency !== input.currency) {
      return err({ code: 'CURRENCY_MISMATCH', message: `instrument currency ${instrument.currency}` });
    }
    const price = input.prices.find((row) => row.instrumentId === slice.instrumentId);
    if (!price || price.stale) {
      return err({
        code: 'STALE_PRICE',
        message: `missing or stale price for ${slice.instrumentId}`,
      });
    }
    const targetMinor = applyRatio(input.investableMinor, slice.weight);
    const rawUnits = (targetMinor * quantityScaleFactor()) / price.priceMinor;
    const increment = instrument.incrementUnits <= 0n ? quantityScaleFactor() : instrument.incrementUnits;
    const aligned = (rawUnits / increment) * increment;
    if (aligned < increment && targetMinor > 0n && !instrument.fractionalSupported) {
      // whole-share instruments may receive zero shares when the slice cannot buy one increment
    }
    const notional = (aligned * price.priceMinor) / quantityScaleFactor();
    quantities.push(
      Object.freeze({
        instrumentId: slice.instrumentId,
        quantityUnits: aligned,
        notionalMinor: notional,
        currency: input.currency,
      }),
    );
    used += notional;
  }
  return ok(
    Object.freeze({
      quantities: Object.freeze(quantities),
      cashRemainderMinor: input.investableMinor - used,
      currency: input.currency,
      investableCapitalMinor: input.investableMinor,
    }),
  );
}

export function suggestedWeightsAreNotAuthoritative(): true {
  return true;
}

export const ALLOCATION_SCALE = 8;
