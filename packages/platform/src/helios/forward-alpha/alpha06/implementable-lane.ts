/**
 * ALPHA06 — implementable return via Execution Twin + EXEC05/06/07 (paper only).
 */

import { createHash } from 'node:crypto';

import { asCustomerId, asUtcInstant, type UtcInstant } from '@solstice/domain';

import { SmartOrderRouter } from '../../execution-connectivity/exec05/router.ts';
import { EXEC05_SANDBOX_VENUE_CANDIDATES } from '../../execution-connectivity/exec05/fixtures.ts';
import {
  BoundedExecutionAlgorithmEngine,
  createExecutionAlgorithmStore,
  marketContextAt,
  permissiveAlgorithmRiskPort,
  registerParentFixture,
} from '../../execution-connectivity/exec06/index.ts';
import { computeExec07TransactionCostAnalysis } from '../../execution-connectivity/exec07/analysis.ts';
import { bpsFromMinorDelta } from '../../execution-connectivity/exec07/numeric.ts';
import { midPriceMinor, bestAsk, bestBid } from '../../execution-twin/simulation/market-book.ts';
import { marketBookFromLevel2 } from '../../execution-twin/simulation/market-book.ts';
import { SimulatedVenue } from '../../execution-twin/simulation/simulated-venue.ts';
import { computeFundingPayment, type FundingAccrual } from '../../execution-twin/simulation/funding-model.ts';
import { samplePerpetualSpec } from '../../execution-twin/simulation/fixtures.ts';
import type { SimulatedFill } from '../../execution-twin/simulation/types.ts';

import { asEconomicWorkOrderId } from '../../ids.ts';
import type { ForwardAlphaReturnLane } from '../taxonomy.ts';
import type { Alpha06ForwardScenario, Alpha06ImplementableExecutionBundle, Alpha06LaneReturn } from './types.ts';
import type { Alpha06ExecutionAlgorithmKind } from './taxonomy.ts';

const ZERO_LATENCY = Object.freeze({ submitLatencyMs: 0, cancelLatencyMs: 0, replaceLatencyMs: 0 });

function advanceOneMs(at: UtcInstant): UtcInstant {
  return asUtcInstant(new Date(Date.parse(at) + 1).toISOString());
}

function splitQuantity(total: bigint, slices: number): readonly bigint[] {
  if (slices <= 1) {
    return Object.freeze([total]);
  }
  const base = total / BigInt(slices);
  const rem = total % BigInt(slices);
  const parts: bigint[] = [];
  for (let i = 0; i < slices; i += 1) {
    parts.push(base + (i < Number(rem) ? 1n : 0n));
  }
  return Object.freeze(parts);
}

function exec06SliceCount(
  scenario: Alpha06ForwardScenario,
  algorithmKind: Alpha06ExecutionAlgorithmKind,
  now: UtcInstant,
): number {
  if (algorithmKind === 'MARKET') {
    return 1;
  }
  const engine = new BoundedExecutionAlgorithmEngine({ store: createExecutionAlgorithmStore() });
  const registered = engine.registerParent(
    registerParentFixture({
      algorithmKind: 'TWAP',
      now,
      instrumentId: scenario.instrumentId,
      side: scenario.entry.side,
      authorizedQuantityUnits: scenario.entry.quantityUnits,
      currency: scenario.currency,
    }),
  );
  if (!registered.ok || !registered.schedule) {
    return 1;
  }
  return Math.max(1, registered.schedule.slices.length);
}

function routeScenario(scenario: Alpha06ForwardScenario, at: UtcInstant, notionalMinor: string) {
  const router = new SmartOrderRouter();
  return router.route(
    Object.freeze({
      requestId: `alpha06_route_${scenario.scenarioId}`,
      customerId: asCustomerId('cust_alpha06_fixture'),
      workOrderId: asEconomicWorkOrderId('ewo_alpha06_fixture'),
      instrumentId: scenario.instrumentId,
      orderAction: scenario.entry.side,
      orderSizeMinorUnits: notionalMinor,
      currency: scenario.currency,
      urgency: 'NORMAL',
      at,
      directedInstruction: null,
      candidates: EXEC05_SANDBOX_VENUE_CANDIDATES,
    }),
  );
}

function executeSlices(input: {
  readonly venueId: string;
  readonly instrumentId: string;
  readonly currency: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantities: readonly bigint[];
  readonly bookAt: UtcInstant;
  readonly snapshot: Alpha06ForwardScenario['entryBook'];
  readonly reduceOnly?: boolean;
}): { readonly fills: readonly SimulatedFill[]; readonly unfilled: bigint; readonly usedMid: boolean } {
  const venue = new SimulatedVenue(input.bookAt, {
    venueId: input.venueId,
    latencyModel: ZERO_LATENCY,
  });
  venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: input.snapshot });
  const book = marketBookFromLevel2(input.snapshot);
  const bid = bestBid(book)?.priceMinorUnits;
  const ask = bestAsk(book)?.priceMinorUnits;
  const mid = midPriceMinor(book);
  let usedMid = false;
  const allFills: SimulatedFill[] = [];
  let unfilled = 0n;
  let tick = input.bookAt;
  for (const [index, quantityUnits] of input.quantities.entries()) {
    tick = advanceOneMs(tick);
    venue.advanceClock(tick);
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: { ...input.snapshot, observedAt: tick } });
    const submitted = venue.submitOrder({
      clientOrderId: `alpha06_${input.side}_${index}`,
      instrumentId: input.instrumentId,
      side: input.side,
      orderType: 'MARKET',
      timeInForce: 'IOC',
      quantityUnits,
      currency: input.currency,
      reduceOnly: input.reduceOnly === true,
    });
    if (!submitted.accepted) {
      unfilled += quantityUnits;
      continue;
    }
    const after = advanceOneMs(tick);
    venue.advanceClock(after);
    venue.onMarketUpdate({ kind: 'LEVEL_2_BOOK', snapshot: { ...input.snapshot, observedAt: after } });
    const order = venue.getOrder(submitted.order.orderId);
    const sliceFills = order?.fills ?? venue.getFills().slice(allFills.length);
    for (const fill of sliceFills) {
      allFills.push(fill);
      if (mid != null && bid != null && ask != null && ask > bid && fill.priceMinorUnits === mid) {
        usedMid = true;
      }
    }
    const filled = sliceFills.reduce((acc, row) => acc + row.quantityUnits, 0n);
    unfilled += quantityUnits - filled;
  }
  return Object.freeze({ fills: Object.freeze(allFills), unfilled, usedMid });
}

function signedCashflow(side: 'BUY' | 'SELL', fills: readonly SimulatedFill[]): bigint {
  let total = 0n;
  for (const fill of fills) {
    const gross = fill.priceMinorUnits * fill.quantityUnits;
    const fees = fill.feeMinorUnits;
    total += side === 'BUY' ? -(gross + fees) : gross - fees;
  }
  return total;
}

function spreadPaidMinor(side: 'BUY' | 'SELL', fills: readonly SimulatedFill[], snapshot: Alpha06ForwardScenario['entryBook']): bigint {
  const book = marketBookFromLevel2(snapshot);
  const bid = bestBid(book)?.priceMinorUnits;
  const ask = bestAsk(book)?.priceMinorUnits;
  if (bid == null || ask == null) {
    return 0n;
  }
  const ref = side === 'BUY' ? ask : bid;
  let total = 0n;
  for (const fill of fills) {
    const perUnit = side === 'BUY' ? fill.priceMinorUnits - ref : ref - fill.priceMinorUnits;
    if (perUnit > 0n) {
      total += perUnit * fill.quantityUnits;
    }
  }
  return total;
}

function fundingCosts(
  scenario: Alpha06ForwardScenario,
  positionUnits: bigint,
): { readonly accruals: readonly FundingAccrual[]; readonly totalMinor: bigint } {
  const events = scenario.fundingEvents ?? [];
  if (events.length === 0 || scenario.strategyType !== 'PERPETUAL_FUNDING') {
    return Object.freeze({ accruals: Object.freeze([]), totalMinor: 0n });
  }
  const spec = samplePerpetualSpec();
  const accruals: FundingAccrual[] = [];
  let total = 0n;
  for (const event of events) {
    const row = computeFundingPayment({ spec, event, positionUnits });
    accruals.push(row);
    total += row.direction === 'PAY' ? row.paymentMinorUnits : -row.paymentMinorUnits;
  }
  return Object.freeze({ accruals: Object.freeze(accruals), totalMinor: total });
}

export function executeImplementableReturn(scenario: Alpha06ForwardScenario): {
  readonly lane: Alpha06LaneReturn;
  readonly bundle: Alpha06ImplementableExecutionBundle;
} {
  const algorithmKind = scenario.algorithmKind ?? 'MARKET';
  const slices = exec06SliceCount(scenario, algorithmKind, scenario.entry.at);
  const entryParts = splitQuantity(scenario.entry.quantityUnits, algorithmKind === 'TWAP' ? slices : 1);
  const notionalMinor = scenario.entry.signalPriceMinor * scenario.entry.quantityUnits;
  const routing = routeScenario(scenario, scenario.entry.at, notionalMinor.toString());
  const venueId = routing.selectedVenueId ?? 'sandbox_paper';

  const entryExec = executeSlices({
    venueId,
    instrumentId: scenario.instrumentId,
    currency: scenario.currency,
    side: scenario.entry.side,
    quantities: entryParts,
    bookAt: scenario.entry.at,
    snapshot: scenario.entryBook,
  });

  const filledEntry = entryExec.fills.reduce((acc, row) => acc + row.quantityUnits, 0n);
  const exitQty = filledEntry > 0n ? filledEntry : 0n;
  const exitParts = splitQuantity(exitQty, algorithmKind === 'TWAP' ? slices : 1);

  const exitExec =
    exitQty > 0n
      ? executeSlices({
          venueId,
          instrumentId: scenario.instrumentId,
          currency: scenario.currency,
          side: scenario.exit.side,
          quantities: exitParts,
          bookAt: scenario.exit.at,
          snapshot: scenario.exitBook,
          reduceOnly: scenario.strategyType === 'PERPETUAL_FUNDING',
        })
      : Object.freeze({ fills: Object.freeze([] as SimulatedFill[]), unfilled: exitQty, usedMid: false });

  const entryCash = signedCashflow('BUY', entryExec.fills);
  const exitCash = signedCashflow(scenario.exit.side, exitExec.fills);
  const explicitFeesMinor = [...entryExec.fills, ...exitExec.fills].reduce((acc, row) => acc + row.feeMinorUnits, 0n);
  const spreadEntry = spreadPaidMinor('BUY', entryExec.fills, scenario.entryBook);
  const spreadExit = spreadPaidMinor(scenario.exit.side, exitExec.fills, scenario.exitBook);
  const spreadPaidMinorTotal = spreadEntry + spreadExit;

  const avgEntry =
    filledEntry > 0n
      ? entryExec.fills.reduce((acc, row) => acc + row.priceMinorUnits * row.quantityUnits, 0n) / filledEntry
      : null;
  const avgExit =
    exitExec.fills.length > 0
      ? exitExec.fills.reduce((acc, row) => acc + row.priceMinorUnits * row.quantityUnits, 0n) /
        exitExec.fills.reduce((acc, row) => acc + row.quantityUnits, 0n)
      : null;

  const signalEntry = scenario.entry.signalPriceMinor;
  const slippageMinor =
    avgEntry != null && filledEntry > 0n ? (avgEntry - signalEntry) * filledEntry : 0n;

  const funding = fundingCosts(scenario, filledEntry);

  const netPnlMinor = entryCash + exitCash - funding.totalMinor;
  const usedNotional = signalEntry * (filledEntry > 0n ? filledEntry : scenario.entry.quantityUnits);

  const marketImpactMinor = spreadPaidMinorTotal + (slippageMinor > 0n ? slippageMinor : 0n);

  const tca =
    avgEntry != null && filledEntry > 0n
      ? computeExec07TransactionCostAnalysis({
          side: 'BUY',
          quantityUnits: scenario.entry.quantityUnits,
          quantityFilledUnits: filledEntry,
          averageFillPriceMinor: avgEntry,
          explicitFeesMinor,
          spreadAtArrivalMinor: spreadEntry,
          decisionToFillMoveMinor: slippageMinor,
          priceImprovementVsLimitMinor: null,
          ordersSubmitted: entryParts.length + exitParts.length,
          ordersFilled: (entryExec.fills.length > 0n ? 1 : 0) + (exitExec.fills.length > 0n ? 1 : 0),
          ordersPartiallyFilled:
            entryExec.unfilled > 0n || exitExec.unfilled > 0n
              ? 1
              : 0,
          ordersCanceled: 0,
          ordersRejected: entryExec.fills.length === 0n ? 1 : 0,
          submissionToAckLatencyMs: 1,
          ackToFillLatencyMs: 1,
          postFillAdverseMoveBps: null,
          benchmarks: Object.freeze({
            decisionPriceMinor: signalEntry,
            decisionAt: scenario.entry.at,
            arrivalPriceMinor: bestAsk(marketBookFromLevel2(scenario.entryBook))?.priceMinorUnits ?? signalEntry,
            arrivalAt: scenario.entry.at,
            midAtArrivalMinor: midPriceMinor(marketBookFromLevel2(scenario.entryBook)),
            nbboMidMinor: midPriceMinor(marketBookFromLevel2(scenario.entryBook)),
            bboMidMinor: midPriceMinor(marketBookFromLevel2(scenario.entryBook)),
            vwapMinor: null,
            closeMinor: null,
            implementationShortfallBenchmarkMinor: signalEntry,
          }),
          computedAt: scenario.entry.at,
        })
      : null;

  const lane: Alpha06LaneReturn = Object.freeze({
    lane: 'IMPLEMENTABLE_RETURN' satisfies ForwardAlphaReturnLane,
    netPnlMinor,
    returnBps: bpsFromMinorDelta(netPnlMinor, usedNotional > 0n ? usedNotional : 1n),
    quantityUsedUnits: filledEntry,
    notionalMinor: usedNotional,
  });

  const bundle: Alpha06ImplementableExecutionBundle = Object.freeze({
    routing,
    algorithmKind,
    algorithmChildSlices: slices,
    entryFills: entryExec.fills,
    exitFills: exitExec.fills,
    unfilledEntryUnits: entryExec.unfilled,
    unfilledExitUnits: exitExec.unfilled,
    explicitFeesMinor,
    spreadPaidMinor: spreadPaidMinorTotal,
    slippageMinor,
    fundingCostMinor: funding.totalMinor,
    borrowCostMinor: 0n,
    rollCostMinor: 0n,
    marketImpactMinor,
    latencyAckMs: 1,
    usedMidPriceForFill: entryExec.usedMid || exitExec.usedMid,
    transactionCost: tca,
  });

  return Object.freeze({ lane, bundle });
}

export function alpha06ResultId(scenarioId: string, lanes: readonly Alpha06LaneReturn[]): string {
  const material = `${scenarioId}:${lanes.map((row) => `${row.lane}:${row.netPnlMinor.toString()}`).join('|')}`;
  return `alpha06_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
}
