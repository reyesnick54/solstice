import type { Md08FuturesContractState, Md08FuturesCurvePoint, Md08TermStructure } from './types.ts';
import type { Md08TermStructureShape } from './taxonomy.ts';

function observedProvenance(sourceId: string, observationRef: string): Md08FuturesCurvePoint['provenance'] {
  return Object.freeze({
    kind: 'OBSERVED',
    sourceId,
    observationRef,
    modelId: null,
    notExchangeObserved: false,
  });
}

function midFromBook(state: Md08FuturesContractState): bigint | null {
  const book = state.book;
  if (!book || book.bids.length === 0 || book.asks.length === 0) {
    return state.settlement?.settlementMinor ?? null;
  }
  return (book.bids[0]!.priceMinorUnits + book.asks[0]!.priceMinorUnits) / 2n;
}

export function buildFuturesCurve(
  contracts: readonly Md08FuturesContractState[],
): readonly Md08FuturesCurvePoint[] {
  return Object.freeze(
    [...contracts]
      .sort((a, b) => Date.parse(a.lifecycle.expiry) - Date.parse(b.lifecycle.expiry))
      .map((contract) => {
        const mid = midFromBook(contract);
        return Object.freeze({
          instrumentId: contract.instrumentId,
          expiry: contract.lifecycle.expiry,
          settlementOrMidMinor: mid ?? 0n,
          provenance: observedProvenance('helios.md08.futures.curve', contract.instrumentId),
        });
      }),
  );
}

export function classifyTermStructureShape(
  curve: readonly Md08FuturesCurvePoint[],
): Md08TermStructureShape {
  if (curve.length < 2) {
    return 'UNKNOWN';
  }
  const front = curve[0]!.settlementOrMidMinor;
  const back = curve[curve.length - 1]!.settlementOrMidMinor;
  if (back > front) {
    return 'CONTANGO';
  }
  if (back < front) {
    return 'BACKWARDATION';
  }
  return 'FLAT';
}

export function buildTermStructureForRoot(input: {
  readonly rootSymbol: string;
  readonly contracts: readonly Md08FuturesContractState[];
}): Md08TermStructure {
  const curve = buildFuturesCurve(input.contracts);
  let calendarSpread = null;
  if (curve.length >= 2) {
    const front = curve[0]!;
    const back = curve[1]!;
    calendarSpread = Object.freeze({
      frontInstrumentId: front.instrumentId,
      backInstrumentId: back.instrumentId,
      spreadMinor: back.settlementOrMidMinor - front.settlementOrMidMinor,
      provenance: Object.freeze({
        kind: 'DERIVED' as const,
        sourceId: 'helios.md08.term-structure.calendar-spread.v1',
        observationRef: null,
        modelId: 'calendar-spread-back-minus-front',
        notExchangeObserved: true,
      }),
    });
  }
  const shape = classifyTermStructureShape(curve);
  return Object.freeze({
    rootSymbol: input.rootSymbol,
    curve,
    calendarSpread,
    shape,
    provenance: Object.freeze({
      kind: 'DERIVED',
      sourceId: 'helios.md08.term-structure.v1',
      observationRef: null,
      modelId: 'futures-curve-assembly',
      notExchangeObserved: shape !== 'UNKNOWN',
    }),
  });
}
