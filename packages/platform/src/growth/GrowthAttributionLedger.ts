import { Money } from '../../../contracts/src/money.ts';
import {
  CANONICAL_REALIZATION,
  GROWTH_SOURCES,
  REALIZATION_CLASSES,
  type GrowthPeriod,
  type GrowthSource,
  type RealizationClass,
} from '../../../contracts/src/growth-catalog.ts';
import type { CustomerId, EventId, GrowthEntryId } from '../../../contracts/src/ids.ts';
import { asGrowthEntryId } from '../../../contracts/src/ids.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';

export type GrowthAttributionEntry = {
  readonly id: GrowthEntryId;
  readonly customerId: CustomerId;
  readonly source: GrowthSource;
  readonly realizationClass: RealizationClass;
  readonly amount: Money;
  readonly originatingEventId: EventId;
  readonly recordedAt: UtcInstant;
  readonly presentedAsIncome: false;
  readonly presentedAsWithdrawable: boolean;
};

export type RealizationBreakdown = {
  readonly SETTLED_CASH: Money;
  readonly UNREALIZED: Money;
  readonly COST_AVOIDED: Money;
  readonly PENDING: Money;
};

export type EconomicDelta = {
  readonly customerId: CustomerId;
  readonly period: GrowthPeriod;
  readonly from: UtcInstant;
  readonly to: UtcInstant;
  readonly bySource: { readonly [S in GrowthSource]: Money };
  readonly byRealizationClass: RealizationBreakdown;
  /**
   * Settled cash only. Cost-avoided is not income. Unrealized is not
   * withdrawable. There is no combined "return" figure and no percentage.
   */
  readonly settledCashTotal: Money;
  readonly unrealizedTotal: Money;
  readonly costAvoidedTotal: Money;
  readonly pendingTotal: Money;
};

export type ForbiddenDeltaKeys =
  | 'percentageReturn'
  | 'percentReturn'
  | 'yield'
  | 'apy'
  | 'apr'
  | 'growthRate'
  | 'blendedYield'
  | 'rateOfReturn'
  | 'income'
  | 'withdrawableTotal';

export type EconomicDeltaHasNoReturnMetrics =
  Extract<keyof EconomicDelta, ForbiddenDeltaKeys> extends never ? true : false;

function emptyBreakdown(currency: string): RealizationBreakdown {
  return {
    SETTLED_CASH: Money.zero(currency),
    UNREALIZED: Money.zero(currency),
    COST_AVOIDED: Money.zero(currency),
    PENDING: Money.zero(currency),
  };
}

function emptyBySource(currency: string): { [S in GrowthSource]: Money } {
  const out = {} as { [S in GrowthSource]: Money };
  for (const source of GROWTH_SOURCES) {
    out[source] = Money.zero(currency);
  }
  return out;
}

export class GrowthAttributionLedger {
  private readonly entries: GrowthAttributionEntry[] = [];
  private seq = 0;

  /**
   * Principal deposits are not economic improvement.
   */
  skipPrincipalDeposit(reason: string): void {
    if (reason !== 'PRINCIPAL_DEPOSIT_IS_NOT_ECONOMIC_IMPROVEMENT') {
      throw new Error('growth skip requires an explicit principal-deposit reason');
    }
  }

  record(input: {
    readonly customerId: CustomerId;
    readonly source: GrowthSource;
    readonly amount: Money;
    readonly originatingEventId: EventId;
    readonly recordedAt: UtcInstant;
    readonly realizationClass?: RealizationClass;
  }): GrowthAttributionEntry {
    const realizationClass = input.realizationClass ?? CANONICAL_REALIZATION[input.source];
    const allowedPromotion =
      CANONICAL_REALIZATION[input.source] === 'PENDING' && realizationClass === 'SETTLED_CASH';
    if (realizationClass !== CANONICAL_REALIZATION[input.source] && !allowedPromotion) {
      throw new Error(
        `Source ${input.source} cannot be recorded as ${realizationClass}; canonical class is ${CANONICAL_REALIZATION[input.source]}`,
      );
    }
    if (input.amount.isNegative()) {
      throw new Error('Growth amount must not be negative');
    }
    this.seq += 1;
    const presentedAsWithdrawable = realizationClass === 'SETTLED_CASH';
    const entry: GrowthAttributionEntry = Object.freeze({
      id: asGrowthEntryId(`gal_${this.seq}`),
      customerId: input.customerId,
      source: input.source,
      realizationClass,
      amount: input.amount,
      originatingEventId: input.originatingEventId,
      recordedAt: input.recordedAt,
      presentedAsIncome: false,
      presentedAsWithdrawable,
    });
    this.entries.push(entry);
    return entry;
  }

  list(): readonly GrowthAttributionEntry[] {
    return this.entries.slice();
  }

  count(): number {
    return this.entries.length;
  }

  summarize(input: {
    readonly customerId: CustomerId;
    readonly period: GrowthPeriod;
    readonly from: UtcInstant;
    readonly to: UtcInstant;
    readonly currency: string;
  }): EconomicDelta {
    const fromMs = input.period === 'LIFETIME' ? 0 : Date.parse(input.from);
    const toMs = Date.parse(input.to);
    const matching = this.entries.filter((entry) => {
      if (entry.customerId !== input.customerId) {
        return false;
      }
      const at = Date.parse(entry.recordedAt);
      return at >= fromMs && at <= toMs;
    });

    const bySource = emptyBySource(input.currency);
    const byClass = emptyBreakdown(input.currency);
    for (const entry of matching) {
      bySource[entry.source] = bySource[entry.source]!.plus(entry.amount);
      byClass[entry.realizationClass] = byClass[entry.realizationClass].plus(entry.amount);
    }

    return Object.freeze({
      customerId: input.customerId,
      period: input.period,
      from: input.from,
      to: input.to,
      bySource: Object.freeze(bySource),
      byRealizationClass: Object.freeze(byClass),
      settledCashTotal: byClass.SETTLED_CASH,
      unrealizedTotal: byClass.UNREALIZED,
      costAvoidedTotal: byClass.COST_AVOIDED,
      pendingTotal: byClass.PENDING,
    });
  }
}

export { GROWTH_SOURCES, REALIZATION_CLASSES };
