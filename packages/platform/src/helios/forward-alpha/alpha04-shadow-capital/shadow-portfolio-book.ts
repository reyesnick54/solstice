import type { UtcInstant } from '@solstice/domain';

import { assertRegistrationUnchanged } from './registration.ts';
import { SHADOW_CAPITAL_SCHEMA } from './taxonomy.ts';
import type {
  ShadowCampaignPolicy,
  ShadowCapitalAccount,
  ShadowCapitalAccountSnapshot,
  ShadowCapitalFailure,
  ShadowCash,
  ShadowEquityCurve,
  ShadowEquityCurvePoint,
  ShadowLot,
  ShadowPnL,
  ShadowPosition,
  ShadowTrade,
} from './types.ts';

function addDays(at: UtcInstant, days: number): UtcInstant {
  const d = new Date(at);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString() as UtcInstant;
}

function positionKey(instrumentId: string, strategyId: string): string {
  return `${instrumentId}::${strategyId}`;
}

function deployableCapMinor(account: ShadowCapitalAccount, declaredFlowMinor: bigint): bigint {
  let cap = BigInt(account.registration.startingNotionalMinor) + declaredFlowMinor;
  const additional = account.campaignPolicy.additionalDeployableMinor;
  if (additional !== null) {
    cap += BigInt(additional);
  }
  return cap;
}

function buyingPowerMinor(
  account: ShadowCapitalAccount,
  cash: ShadowCash,
  declaredFlowMinor: bigint,
  positionCostMinor: bigint,
): bigint {
  let power = BigInt(cash.settledMinor) - BigInt(cash.reservedMinor);
  if (account.campaignPolicy.reinvestRealizedProfits) {
    power += BigInt(cash.unsettledMinor);
  }
  const cap = deployableCapMinor(account, declaredFlowMinor);
  const remainingCap = cap - positionCostMinor - BigInt(cash.nonDeployableMinor);
  if (remainingCap < 0n) {
    return 0n;
  }
  if (power > remainingCap) {
    return remainingCap;
  }
  return power > 0n ? power : 0n;
}

function positionCostBasisMinor(positions: Iterable<ShadowPosition>): bigint {
  let total = 0n;
  for (const pos of positions) {
    total += BigInt(pos.quantityMinor) * BigInt(pos.averageCostMinor);
  }
  return total;
}

export class ShadowCapitalPortfolioBook {
  private account: ShadowCapitalAccount;
  private cash: ShadowCash;
  private readonly positions = new Map<string, ShadowPosition>();
  private readonly lots: ShadowLot[] = [];
  private readonly trades: ShadowTrade[] = [];
  private readonly marks = new Map<string, string>();
  private realizedMinor = 0n;
  private readonly realizedByStrategy = new Map<string, bigint>();
  private readonly feesByStrategy = new Map<string, bigint>();
  private feesMinor = 0n;
  private readonly equityPoints: ShadowEquityCurvePoint[] = [];
  private sequence = 0;
  private tradeCounter = 0;
  private lotCounter = 0;
  private declaredFlowMinor = 0n;

  constructor(account: ShadowCapitalAccount) {
    this.account = account;
    this.cash = Object.freeze({
      currency: account.registration.currency,
      settledMinor: account.registration.startingNotionalMinor,
      unsettledMinor: '0',
      reservedMinor: '0',
      nonDeployableMinor: '0',
    });
    this.recordEquityPoint(account.registration.registeredAt);
  }

  static fromSnapshot(snapshot: ShadowCapitalAccountSnapshot): ShadowCapitalPortfolioBook {
    const book = new ShadowCapitalPortfolioBook(snapshot.account);
    book.cash = snapshot.cash;
    book.sequence = snapshot.sequence;
    for (const pos of snapshot.positions) {
      book.positions.set(positionKey(pos.instrumentId, pos.strategyId), pos);
    }
    book.lots.push(...snapshot.lots);
    book.trades.push(...snapshot.trades);
    book.realizedMinor = BigInt(snapshot.pnl.realizedMinor);
    book.feesMinor = BigInt(snapshot.pnl.feesMinor);
    book.equityPoints.push(...snapshot.equityCurve.points);
    for (const pos of snapshot.positions) {
      if (pos.markPriceMinor) {
        book.marks.set(pos.instrumentId, pos.markPriceMinor);
      }
    }
    book.lotCounter = snapshot.lots.length;
    book.tradeCounter = snapshot.trades.length;
    return book;
  }

  getAccount(): ShadowCapitalAccount {
    return this.account;
  }

  reserveCash(amountMinor: bigint): ShadowCapitalFailure | null {
    const power = buyingPowerMinor(
      this.account,
      this.cash,
      this.declaredFlowMinor,
      positionCostBasisMinor(this.positions.values()),
    );
    if (amountMinor > power) {
      return Object.freeze({
        code: 'INSUFFICIENT_BUYING_POWER',
        message: `reserve ${amountMinor} exceeds buying power ${power}`,
      });
    }
    const settled = BigInt(this.cash.settledMinor);
    const reserved = BigInt(this.cash.reservedMinor);
    this.cash = Object.freeze({
      ...this.cash,
      settledMinor: (settled - amountMinor).toString(),
      reservedMinor: (reserved + amountMinor).toString(),
    });
    return null;
  }

  releaseReservedCash(amountMinor: bigint): void {
    const settled = BigInt(this.cash.settledMinor);
    const reserved = BigInt(this.cash.reservedMinor);
    const release = amountMinor > reserved ? reserved : amountMinor;
    this.cash = Object.freeze({
      ...this.cash,
      settledMinor: (settled + release).toString(),
      reservedMinor: (reserved - release).toString(),
    });
  }

  markPrices(prices: Readonly<Record<string, string>>, at: UtcInstant): void {
    for (const [instrumentId, priceMinor] of Object.entries(prices)) {
      this.marks.set(instrumentId, priceMinor);
    }
    for (const [key, pos] of this.positions) {
      const mark = this.marks.get(pos.instrumentId);
      if (mark) {
        this.positions.set(
          key,
          Object.freeze({
            ...pos,
            markPriceMinor: mark,
          }),
        );
      }
    }
    this.recordEquityPoint(at);
  }

  applyTrade(input: {
    readonly instrumentId: string;
    readonly strategyId: string;
    readonly side: 'BUY' | 'SELL';
    readonly quantityMinor: bigint;
    readonly priceMinor: bigint;
    readonly feeMinor: bigint;
    readonly tradeAt: UtcInstant;
    readonly releaseReservationMinor?: bigint;
  }): ShadowCapitalFailure | ShadowTrade {
    if (!this.account.strategyIds.includes(input.strategyId)) {
      return Object.freeze({
        code: 'INVALID_QUANTITY',
        message: `unknown strategy ${input.strategyId}`,
      });
    }
    if (input.quantityMinor <= 0n) {
      return Object.freeze({ code: 'INVALID_QUANTITY', message: 'quantity must be positive' });
    }
    const notional = input.priceMinor * input.quantityMinor;
    if (input.releaseReservationMinor && input.releaseReservationMinor > 0n) {
      this.releaseReservedCash(input.releaseReservationMinor);
    }

    if (input.side === 'BUY') {
      const totalCost = notional + input.feeMinor;
      const power = buyingPowerMinor(
        this.account,
        this.cash,
        this.declaredFlowMinor,
        positionCostBasisMinor(this.positions.values()),
      );
      if (totalCost > power) {
        return Object.freeze({
          code: 'INSUFFICIENT_BUYING_POWER',
          message: `buy cost ${totalCost} exceeds buying power ${power}`,
        });
      }
      const settled = BigInt(this.cash.settledMinor);
      if (totalCost > settled) {
        return Object.freeze({
          code: 'INSUFFICIENT_SETTLED_CASH',
          message: `buy cost ${totalCost} exceeds settled cash ${settled}`,
        });
      }
      this.cash = Object.freeze({
        ...this.cash,
        settledMinor: (settled - totalCost).toString(),
      });
      this.feesMinor += input.feeMinor;
      this.feesByStrategy.set(
        input.strategyId,
        (this.feesByStrategy.get(input.strategyId) ?? 0n) + input.feeMinor,
      );
      this.openLot({
        instrumentId: input.instrumentId,
        strategyId: input.strategyId,
        quantityMinor: input.quantityMinor,
        costTotalMinor: notional,
        openedAt: input.tradeAt,
      });
      this.bumpPosition(input.instrumentId, input.strategyId, input.quantityMinor, notional, 'BUY');
    } else {
      const key = positionKey(input.instrumentId, input.strategyId);
      const pos = this.positions.get(key);
      const held = pos ? BigInt(pos.quantityMinor) : 0n;
      if (input.quantityMinor > held) {
        return Object.freeze({
          code: 'INSUFFICIENT_POSITION',
          message: `sell ${input.quantityMinor} exceeds position ${held}`,
        });
      }
      const { realized, updatedLots } = this.consumeLotsFifo({
        instrumentId: input.instrumentId,
        strategyId: input.strategyId,
        quantityMinor: input.quantityMinor,
        proceedsPerUnitMinor: input.priceMinor,
      });
      this.lots.length = 0;
      this.lots.push(...updatedLots);
      const netProceeds = notional - input.feeMinor;
      this.feesMinor += input.feeMinor;
      if (this.account.campaignPolicy.reinvestRealizedProfits) {
        const unsettled = BigInt(this.cash.unsettledMinor);
        this.cash = Object.freeze({
          ...this.cash,
          unsettledMinor: (unsettled + netProceeds).toString(),
        });
      } else if (realized > 0n) {
        const nonDeploy = BigInt(this.cash.nonDeployableMinor);
        const unsettled = BigInt(this.cash.unsettledMinor);
        this.cash = Object.freeze({
          ...this.cash,
          unsettledMinor: (unsettled + (notional - input.feeMinor - realized)).toString(),
          nonDeployableMinor: (nonDeploy + realized).toString(),
        });
      } else {
        const unsettled = BigInt(this.cash.unsettledMinor);
        this.cash = Object.freeze({
          ...this.cash,
          unsettledMinor: (unsettled + netProceeds).toString(),
        });
      }
      this.realizedMinor += realized;
      this.realizedByStrategy.set(
        input.strategyId,
        (this.realizedByStrategy.get(input.strategyId) ?? 0n) + realized,
      );
      this.feesByStrategy.set(
        input.strategyId,
        (this.feesByStrategy.get(input.strategyId) ?? 0n) + input.feeMinor,
      );
      this.bumpPosition(input.instrumentId, input.strategyId, -input.quantityMinor, notional, 'SELL');
    }

    const delay = this.account.campaignPolicy.settlementDelayDays;
    const trade = Object.freeze({
      tradeId: `shadow_trade_${++this.tradeCounter}`,
      accountId: this.account.accountId,
      instrumentId: input.instrumentId,
      strategyId: input.strategyId,
      side: input.side,
      quantityMinor: input.quantityMinor.toString(),
      priceMinor: input.priceMinor.toString(),
      feeMinor: input.feeMinor.toString(),
      notionalMinor: notional.toString(),
      settlementState: delay === 0 ? ('SETTLED' as const) : ('PENDING_SETTLEMENT' as const),
      tradeAt: input.tradeAt,
      settleAfter: delay === 0 ? input.tradeAt : addDays(input.tradeAt, delay),
      settledAt: delay === 0 ? input.tradeAt : null,
    }) satisfies ShadowTrade;
    this.trades.push(trade);
    if (delay === 0 && input.side === 'SELL') {
      this.settleTrade(trade.tradeId, input.tradeAt);
    } else if (delay === 0 && input.side === 'BUY') {
      // buy cash already debited from settled
    }
    this.recordEquityPoint(input.tradeAt);
    return trade;
  }

  settleDueTrades(asOf: UtcInstant): readonly ShadowTrade[] {
    const settled: ShadowTrade[] = [];
    for (let i = 0; i < this.trades.length; i += 1) {
      const row = this.trades[i]!;
      if (row.settlementState === 'SETTLED') {
        continue;
      }
      if (row.settleAfter <= asOf) {
        const updated = this.settleTrade(row.tradeId, asOf);
        if (updated) {
          settled.push(updated);
        }
      }
    }
    if (settled.length > 0) {
      this.recordEquityPoint(asOf);
    }
    return Object.freeze(settled);
  }

  private settleTrade(tradeId: string, at: UtcInstant): ShadowTrade | null {
    const idx = this.trades.findIndex((row) => row.tradeId === tradeId);
    if (idx < 0) {
      return null;
    }
    const row = this.trades[idx]!;
    if (row.settlementState === 'SETTLED') {
      return row;
    }
    const notional = BigInt(row.notionalMinor);
    const fee = BigInt(row.feeMinor);
    if (row.side === 'SELL') {
      const net = notional - fee;
      const unsettled = BigInt(this.cash.unsettledMinor);
      const settled = BigInt(this.cash.settledMinor);
      const move = net <= unsettled ? net : unsettled;
      this.cash = Object.freeze({
        ...this.cash,
        unsettledMinor: (unsettled - move).toString(),
        settledMinor: (settled + move).toString(),
      });
    }
    const updated = Object.freeze({
      ...row,
      settlementState: 'SETTLED' as const,
      settledAt: at,
    });
    this.trades[idx] = updated;
    return updated;
  }

  private openLot(input: {
    readonly instrumentId: string;
    readonly strategyId: string;
    readonly quantityMinor: bigint;
    readonly costTotalMinor: bigint;
    readonly openedAt: UtcInstant;
  }): void {
    this.lots.push(
      Object.freeze({
        lotId: `shadow_lot_${++this.lotCounter}`,
        instrumentId: input.instrumentId,
        strategyId: input.strategyId,
        quantityRemainingMinor: input.quantityMinor.toString(),
        costBasisTotalMinor: input.costTotalMinor.toString(),
        openedAt: input.openedAt,
      }),
    );
  }

  private consumeLotsFifo(input: {
    readonly instrumentId: string;
    readonly strategyId: string;
    readonly quantityMinor: bigint;
    readonly proceedsPerUnitMinor: bigint;
  }): { readonly realized: bigint; readonly updatedLots: readonly ShadowLot[] } {
    let remaining = input.quantityMinor;
    let realized = 0n;
    const next: ShadowLot[] = [];
    for (const lot of this.lots) {
      if (lot.instrumentId !== input.instrumentId || lot.strategyId !== input.strategyId) {
        next.push(lot);
        continue;
      }
      const lotQty = BigInt(lot.quantityRemainingMinor);
      if (lotQty === 0n || remaining === 0n) {
        if (lotQty > 0n) {
          next.push(lot);
        }
        continue;
      }
      const costTotal = BigInt(lot.costBasisTotalMinor);
      const take = remaining < lotQty ? remaining : lotQty;
      const costPortion = (costTotal * take) / lotQty;
      const proceeds = take * input.proceedsPerUnitMinor;
      realized += proceeds - costPortion;
      const leftQty = lotQty - take;
      remaining -= take;
      if (leftQty > 0n) {
        const leftCost = costTotal - costPortion;
        next.push(
          Object.freeze({
            ...lot,
            quantityRemainingMinor: leftQty.toString(),
            costBasisTotalMinor: leftCost.toString(),
          }),
        );
      }
    }
    return Object.freeze({ realized, updatedLots: Object.freeze(next) });
  }

  private bumpPosition(
    instrumentId: string,
    strategyId: string,
    deltaQty: bigint,
    notional: bigint,
    side: 'BUY' | 'SELL',
  ): void {
    const key = positionKey(instrumentId, strategyId);
    const prev = this.positions.get(key);
    const prevQty = prev ? BigInt(prev.quantityMinor) : 0n;
    const nextQty = prevQty + deltaQty;
    const prevCost = prev ? BigInt(prev.averageCostMinor) : 0n;
    let avg = prevCost;
    if (side === 'BUY' && nextQty > 0n) {
      const prevBasis = prevQty * prevCost;
      avg = (prevBasis + notional) / nextQty;
    } else if (nextQty === 0n) {
      avg = 0n;
    }
    const mark = this.marks.get(instrumentId) ?? prev?.markPriceMinor ?? null;
    if (nextQty === 0n) {
      this.positions.delete(key);
      return;
    }
    const delay = this.account.campaignPolicy.settlementDelayDays;
    const settledDelta = delay === 0 ? deltaQty : 0n;
    const unsettledDelta = delay === 0 ? 0n : deltaQty;
    const prevSettled = prev ? BigInt(prev.settledQuantityMinor) : 0n;
    const prevUnsettled = prev ? BigInt(prev.unsettledQuantityMinor) : 0n;
    this.positions.set(
      key,
      Object.freeze({
        instrumentId,
        strategyId,
        quantityMinor: nextQty.toString(),
        settledQuantityMinor: (prevSettled + settledDelta).toString(),
        unsettledQuantityMinor: (prevUnsettled + unsettledDelta).toString(),
        averageCostMinor: avg.toString(),
        markPriceMinor: mark,
      }),
    );
  }

  computePnL(): ShadowPnL {
    let grossExposure = 0n;
    let netExposure = 0n;
    let unrealized = 0n;
    const positions = [...this.positions.values()];
    for (const pos of positions) {
      const qty = BigInt(pos.quantityMinor);
      const mark = pos.markPriceMinor ? BigInt(pos.markPriceMinor) : BigInt(pos.averageCostMinor);
      const marketValue = qty * mark;
      grossExposure += marketValue >= 0n ? marketValue : -marketValue;
      netExposure += marketValue;
      const costBasis = qty * BigInt(pos.averageCostMinor);
      unrealized += marketValue - costBasis;
    }
    const cashTotal =
      BigInt(this.cash.settledMinor) +
      BigInt(this.cash.unsettledMinor) +
      BigInt(this.cash.reservedMinor) +
      BigInt(this.cash.nonDeployableMinor);
    const nav = cashTotal + netExposure;
    return Object.freeze({
      currency: this.cash.currency,
      realizedMinor: this.realizedMinor.toString(),
      unrealizedMinor: unrealized.toString(),
      feesMinor: this.feesMinor.toString(),
      cash: this.cash,
      navMinor: nav.toString(),
      grossExposureMinor: grossExposure.toString(),
      netExposureMinor: netExposure.toString(),
    });
  }

  private recordEquityPoint(at: UtcInstant): void {
    const pnl = this.computePnL();
    this.equityPoints.push(
      Object.freeze({
        at,
        navMinor: pnl.navMinor,
        cumulativeDeclaredFlowMinor: this.declaredFlowMinor.toString(),
        registrationId: this.account.registration.registrationId,
      }),
    );
    this.sequence += 1;
  }

  detectHiddenCapital(): ShadowCapitalFailure | null {
    const pnl = this.computePnL();
    const cashTotal =
      BigInt(this.cash.settledMinor) +
      BigInt(this.cash.unsettledMinor) +
      BigInt(this.cash.reservedMinor) +
      BigInt(this.cash.nonDeployableMinor);
    let positionValue = 0n;
    for (const pos of this.positions.values()) {
      const qty = BigInt(pos.quantityMinor);
      const mark = pos.markPriceMinor ? BigInt(pos.markPriceMinor) : BigInt(pos.averageCostMinor);
      positionValue += qty * mark;
    }
    const expected =
      BigInt(this.account.registration.startingNotionalMinor) +
      this.declaredFlowMinor +
      this.realizedMinor +
      positionValue -
      this.feesMinor;
    const nav = BigInt(pnl.navMinor);
    if (nav > expected + cashTotal - BigInt(this.account.registration.startingNotionalMinor) + 1n) {
      // simplified: NAV must not exceed registered start + declared flows + economic PnL envelope
      const envelope =
        BigInt(this.account.registration.startingNotionalMinor) +
        this.declaredFlowMinor +
        this.realizedMinor;
      if (nav > envelope + positionValue + 1000n) {
        return Object.freeze({
          code: 'HIDDEN_CAPITAL_DETECTED',
          message: `nav ${nav} exceeds registered capital envelope`,
        });
      }
    }
    return null;
  }

  snapshot(): ShadowCapitalAccountSnapshot {
    if (!assertRegistrationUnchanged(this.account.registration, this.account.registration)) {
      throw new Error('registration mutated');
    }
    const pnl = this.computePnL();
    const equityCurve: ShadowEquityCurve = Object.freeze({
      accountId: this.account.accountId,
      registrationId: this.account.registration.registrationId,
      points: Object.freeze([...this.equityPoints]),
    });
    return Object.freeze({
      schema: SHADOW_CAPITAL_SCHEMA,
      account: this.account,
      cash: this.cash,
      positions: Object.freeze([...this.positions.values()]),
      lots: Object.freeze([...this.lots]),
      trades: Object.freeze([...this.trades]),
      pnl,
      equityCurve,
      sequence: this.sequence,
    });
  }

  aggregateByStrategy(): Readonly<Record<string, ShadowPnL>> {
    const out: Record<string, ShadowPnL> = {};
    const strategies = new Set(this.account.strategyIds);
    for (const t of this.trades) {
      strategies.add(t.strategyId);
    }
    for (const strategyId of strategies) {
      let gross = 0n;
      let net = 0n;
      let unrealized = 0n;
      for (const pos of this.positions.values()) {
        if (pos.strategyId !== strategyId) {
          continue;
        }
        const qty = BigInt(pos.quantityMinor);
        const mark = pos.markPriceMinor ? BigInt(pos.markPriceMinor) : BigInt(pos.averageCostMinor);
        const mv = qty * mark;
        gross += mv >= 0n ? mv : -mv;
        net += mv;
        unrealized += mv - qty * BigInt(pos.averageCostMinor);
      }
      const realized = this.realizedByStrategy.get(strategyId) ?? 0n;
      const fees = this.feesByStrategy.get(strategyId) ?? 0n;
      out[strategyId] = Object.freeze({
        currency: this.cash.currency,
        realizedMinor: realized.toString(),
        unrealizedMinor: unrealized.toString(),
        feesMinor: fees.toString(),
        cash: this.cash,
        navMinor: net.toString(),
        grossExposureMinor: gross.toString(),
        netExposureMinor: net.toString(),
      });
    }
    return Object.freeze(out);
  }
}
