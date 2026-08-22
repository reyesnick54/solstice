import { Money } from '../../../money/src/money.ts';
import type { InstrumentId } from '../ids.ts';
import type { PortfolioAllocationView } from '../allocation.ts';
import { deriveAllocation } from '../allocation.ts';
import type { PortfolioValuationSnapshot } from '../valuation.ts';
import type { Instrument } from '../instrument.ts';
import type { InstrumentProduct } from './instrument-catalog.ts';
import { mapCoreTypeToAssetClass } from './instrument-catalog.ts';
import { asTargetAllocationId, type TargetAllocationId } from './ids.ts';
import { ratio, ratioToBps } from './ratio.ts';
import type { InstrumentRiskCategory, ProductAssetClass } from './types.ts';

export type AllocationSliceView = {
  readonly key: string;
  readonly marketValue: Money;
  readonly weightBps: bigint;
  readonly positionCount: bigint;
};

export type ProductAllocationView = {
  readonly byInstrument: readonly AllocationSliceView[];
  readonly byAssetClass: readonly AllocationSliceView[];
  readonly byCurrency: readonly AllocationSliceView[];
  readonly byRiskClass: readonly AllocationSliceView[];
  readonly cash: Money;
  readonly invested: Money;
  readonly total: Money;
};

export type TargetWeight = {
  readonly key: string;
  readonly dimension: 'ASSET_CLASS' | 'INSTRUMENT' | 'CURRENCY' | 'RISK_CLASS';
  readonly weightBps: bigint;
};

export type TargetAllocation = {
  readonly targetId: TargetAllocationId;
  readonly portfolioId: string;
  readonly weights: readonly TargetWeight[];
  readonly cashTargetBps: bigint;
};

export function freezeTargetAllocation(target: TargetAllocation): TargetAllocation {
  const sum = target.weights.reduce((acc, row) => acc + row.weightBps, 0n) + target.cashTargetBps;
  if (sum !== 10_000n) {
    throw new Error('target allocation weights plus cash must sum to 10000 bps');
  }
  return Object.freeze({
    ...target,
    weights: Object.freeze([...target.weights]),
  });
}

export function defaultBalancedTarget(portfolioId: string, cashTargetBps = 1_000n): TargetAllocation {
  return freezeTargetAllocation({
    targetId: asTargetAllocationId(`tgt_${portfolioId}`),
    portfolioId,
    cashTargetBps,
    weights: Object.freeze([
      { key: 'ETF', dimension: 'ASSET_CLASS', weightBps: 6_000n },
      { key: 'FIXED_INCOME', dimension: 'ASSET_CLASS', weightBps: 2_000n },
      { key: 'EQUITY', dimension: 'ASSET_CLASS', weightBps: 1_000n },
    ]),
  });
}

function withWeights(slices: readonly { key: string; marketValue: Money; positionCount: bigint }[], total: Money): readonly AllocationSliceView[] {
  return Object.freeze(
    slices.map((row) =>
      Object.freeze({
        key: row.key,
        marketValue: row.marketValue,
        positionCount: row.positionCount,
        weightBps: total.minorUnits === 0n ? 0n : ratioToBps(ratio(row.marketValue.minorUnits, total.minorUnits)),
      }),
    ),
  );
}

export function productAllocation(
  snapshot: PortfolioValuationSnapshot,
  instruments: ReadonlyMap<string, Instrument>,
  products: ReadonlyMap<string, InstrumentProduct>,
): ProductAllocationView {
  const core: PortfolioAllocationView = deriveAllocation(snapshot, instruments);
  const invested = snapshot.marketValue;
  const total = invested.plus(snapshot.cash);
  const byAssetClass = new Map<string, { value: Money; count: bigint }>();
  const byRisk = new Map<string, { value: Money; count: bigint }>();
  for (const position of snapshot.positions) {
    const product = products.get(position.instrumentId);
    const coreInstrument = instruments.get(position.instrumentId);
    const assetClass: ProductAssetClass = product?.assetClass ?? (coreInstrument ? mapCoreTypeToAssetClass(coreInstrument.instrumentType) : 'OTHER_APPROVED_PRODUCT');
    const risk: InstrumentRiskCategory = product?.riskCategory ?? 'UNKNOWN';
    const existingClass = byAssetClass.get(assetClass);
    if (!existingClass) {
      byAssetClass.set(assetClass, { value: position.marketValue, count: 1n });
    } else {
      byAssetClass.set(assetClass, { value: existingClass.value.plus(position.marketValue), count: existingClass.count + 1n });
    }
    const existingRisk = byRisk.get(risk);
    if (!existingRisk) {
      byRisk.set(risk, { value: position.marketValue, count: 1n });
    } else {
      byRisk.set(risk, { value: existingRisk.value.plus(position.marketValue), count: existingRisk.count + 1n });
    }
  }
  if (snapshot.cash.minorUnits > 0n) {
    const cashClass = byAssetClass.get('CASH');
    byAssetClass.set('CASH', {
      value: cashClass ? cashClass.value.plus(snapshot.cash) : snapshot.cash,
      count: (cashClass?.count ?? 0n) + 1n,
    });
    const cashRisk = byRisk.get('LOW');
    byRisk.set('LOW', {
      value: cashRisk ? cashRisk.value.plus(snapshot.cash) : snapshot.cash,
      count: (cashRisk?.count ?? 0n) + 1n,
    });
  }
  const asSlices = (map: Map<string, { value: Money; count: bigint }>) =>
    [...map.entries()].map(([key, row]) => ({ key, marketValue: row.value, positionCount: row.count }));
  return Object.freeze({
    byInstrument: withWeights(core.byInstrument, total),
    byAssetClass: withWeights(asSlices(byAssetClass), total),
    byCurrency: withWeights(core.byCurrency, total),
    byRiskClass: withWeights(asSlices(byRisk), total),
    cash: snapshot.cash,
    invested,
    total,
  });
}

export type AllocationDrift = {
  readonly key: string;
  readonly targetBps: bigint;
  readonly actualBps: bigint;
  readonly driftBps: bigint;
  readonly targetValue: Money;
  readonly actualValue: Money;
};

export function compareToTarget(
  actual: ProductAllocationView,
  target: TargetAllocation,
): readonly AllocationDrift[] {
  const actualByKey = new Map(actual.byAssetClass.map((row) => [row.key, row] as const));
  const drifts: AllocationDrift[] = [];
  for (const weight of target.weights) {
    const slice = actualByKey.get(weight.key);
    const actualBps = slice?.weightBps ?? 0n;
    const actualValue = slice?.marketValue ?? Money.zero(actual.total.currency);
    const targetValue = actual.total.allocate(weight.weightBps, 10_000n, 'FLOOR');
    drifts.push(
      Object.freeze({
        key: weight.key,
        targetBps: weight.weightBps,
        actualBps,
        driftBps: actualBps - weight.weightBps,
        targetValue,
        actualValue,
      }),
    );
  }
  const cashActual = actual.total.minorUnits === 0n ? 0n : ratioToBps(ratio(actual.cash.minorUnits, actual.total.minorUnits));
  drifts.push(
    Object.freeze({
      key: 'CASH',
      targetBps: target.cashTargetBps,
      actualBps: cashActual,
      driftBps: cashActual - target.cashTargetBps,
      targetValue: actual.total.allocate(target.cashTargetBps, 10_000n, 'FLOOR'),
      actualValue: actual.cash,
    }),
  );
  return Object.freeze(drifts);
}

export function largestInstrumentId(actual: ProductAllocationView): InstrumentId | null {
  let best: AllocationSliceView | null = null;
  for (const row of actual.byInstrument) {
    if (!best || row.marketValue.cmp(best.marketValue) > 0) {
      best = row;
    }
  }
  return best ? (best.key as InstrumentId) : null;
}
