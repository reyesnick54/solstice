/**
 * HELIOS Forward Alpha ALPHA09 — deterministic simulation fixtures.
 */

import { asUtcInstant } from '@solstice/domain';
import { RATIO_UNIT } from '@solstice/risk';

import { HELIOS_ALPHA09_SCHEMA } from './taxonomy.ts';
import type { ForwardAlpha09MeasureInput, ForwardAlpha09TradeObservation } from './types.ts';

const SEALED_AT = asUtcInstant('2026-06-15T18:00:00.000Z');

function ret(percentThousandths: number): bigint {
  return (BigInt(percentThousandths) * RATIO_UNIT) / 100_000n;
}

function trade(
  id: string,
  pnlMinor: bigint,
  instrumentId: string,
  sectorId: string,
  monthKey: string,
  eventId: string,
): ForwardAlpha09TradeObservation {
  return Object.freeze({
    tradeId: id,
    instrumentId,
    sectorId,
    monthKey,
    eventId,
    realizedPnlMinor: pnlMinor,
    closedAt: SEALED_AT,
  });
}

/** Diversified swing-track record — should qualify when duration/opportunity thresholds are met. */
export function fixtureAlpha09DiversifiedInput(): ForwardAlpha09MeasureInput {
  const periodReturns = Object.freeze([
    ret(50),
    ret(30),
    ret(-20),
    ret(40),
    ret(25),
    ret(-15),
    ret(35),
    ret(20),
    ret(-10),
    ret(45),
    ret(15),
    ret(-25),
    ret(30),
    ret(20),
    ret(-5),
    ret(25),
    ret(35),
    ret(-20),
    ret(40),
    ret(15),
    ret(-15),
    ret(30),
    ret(25),
    ret(-10),
    ret(20),
    ret(35),
    ret(-20),
    ret(40),
    ret(15),
    ret(-5),
    ret(25),
    ret(30),
    ret(-15),
    ret(20),
    ret(25),
    ret(-10),
    ret(30),
    ret(20),
    ret(-5),
    ret(15),
  ] as const);

  const trades: ForwardAlpha09TradeObservation[] = [];
  for (let i = 0; i < 45; i += 1) {
    const pnl = 2_000n + BigInt((i % 7) * 300);
    if (i % 5 === 0) {
      trades.push(
        trade(`t_${i}`, -1_500n - BigInt(i * 10), `INST_${i % 8}`, `SEC_${i % 4}`, `2026-0${(i % 3) + 4}`, `evt_${i % 6}`),
      );
    } else {
      trades.push(
        trade(`t_${i}`, pnl, `INST_${i % 8}`, `SEC_${i % 4}`, `2026-0${(i % 3) + 4}`, `evt_${i % 6}`),
      );
    }
  }

  return Object.freeze({
    schema: HELIOS_ALPHA09_SCHEMA,
    strategyId: 'strat_alpha09_fixture_diversified',
    horizonClass: 'SWING',
    observationDays: 90,
    startingCapitalMinor: 1_000_000n,
    endingCapitalMinor: 1_120_000n,
    periodReturns,
    trades: Object.freeze(trades),
    benchmarkPeriodReturns: periodReturns.map((r) => r / 4n),
    riskFreePeriodReturnUnits: 0n,
    sealedAt: SEALED_AT,
  });
}

/** Single-event dominated return — repeatability claim must be blocked. */
export function fixtureAlpha09ConcentratedInput(): ForwardAlpha09MeasureInput {
  const base = fixtureAlpha09DiversifiedInput();
  const trades = [
    trade('t_winner', 800_000n, 'INST_EVENT', 'SEC_EVT', '2026-05', 'evt_fomc'),
    ...base.trades.slice(0, 44),
  ];
  return Object.freeze({
    ...base,
    strategyId: 'strat_alpha09_fixture_concentrated',
    endingCapitalMinor: 1_500_000n,
    trades: Object.freeze(trades),
  });
}
