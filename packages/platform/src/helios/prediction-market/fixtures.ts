/**
 * Sandbox fixtures — assimilated Polymarket CLOB shapes without private keys or live trading.
 */

import { asUtcInstant } from '@solstice/domain';
import { normalizeOrderBookLevels } from '../market-observation/order-book.ts';
import type { OrderBookLevel } from '../market-observation/types.ts';
import {
  outcomeContractInstrumentId,
  predictionEventInstrumentId,
  predictionMarketInstrumentId,
  yesNoContractInstrumentId,
} from './ids.ts';
import {
  HELIOS_PREDICTION_MARKET_AUTHORITY,
  HELIOS_PREDICTION_MARKET_SCHEMA,
} from './taxonomy.ts';
import type {
  CloOrderBookSnapshot,
  OutcomeContract,
  PredictionEventMarket,
  YesNoContract,
} from './types.ts';

export const FIXTURE_CONDITION_FED_DEC = '0xfixture_fed_dec_2026' as const;
export const FIXTURE_YES_TOKEN = '0xfixture_yes_token' as const;
export const FIXTURE_NO_TOKEN = '0xfixture_no_token' as const;

const SOURCE_TS = asUtcInstant('2026-11-03T09:00:00.000Z');
const ARRIVAL_TS = asUtcInstant('2026-11-03T09:00:01.000Z');
const EXPIRES = asUtcInstant('2026-12-17T00:00:00.000Z');

function level(price: number, qty: bigint): OrderBookLevel {
  return Object.freeze({
    priceMinorUnits: BigInt(price),
    quantityMinorUnits: qty,
    depth: 0,
  });
}

function book(bids: OrderBookLevel[], asks: OrderBookLevel[]) {
  return Object.freeze({
    bids: normalizeOrderBookLevels(bids, 'bid'),
    asks: normalizeOrderBookLevels(asks, 'ask'),
    sequence: 1n,
    version: 'fixture.v1',
    sourceTimestamp: SOURCE_TS,
    arrivalTimestamp: ARRIVAL_TS,
    providerSupportsOrderBook: true as const,
  });
}

export function fixtureYesNoContracts(): { readonly yes: YesNoContract; readonly no: YesNoContract } {
  const yes: YesNoContract = Object.freeze({
    schema: HELIOS_PREDICTION_MARKET_SCHEMA,
    authority: HELIOS_PREDICTION_MARKET_AUTHORITY,
    kind: 'yes_no_contract',
    instrumentId: yesNoContractInstrumentId(FIXTURE_CONDITION_FED_DEC, 'YES'),
    conditionId: FIXTURE_CONDITION_FED_DEC,
    side: 'YES',
    tokenId: FIXTURE_YES_TOKEN,
    complementarySide: 'NO',
  });
  const no: YesNoContract = Object.freeze({
    schema: HELIOS_PREDICTION_MARKET_SCHEMA,
    authority: HELIOS_PREDICTION_MARKET_AUTHORITY,
    kind: 'yes_no_contract',
    instrumentId: yesNoContractInstrumentId(FIXTURE_CONDITION_FED_DEC, 'NO'),
    conditionId: FIXTURE_CONDITION_FED_DEC,
    side: 'NO',
    tokenId: FIXTURE_NO_TOKEN,
    complementarySide: 'YES',
  });
  return Object.freeze({ yes, no });
}

export function fixtureOutcomeContract(): OutcomeContract {
  return Object.freeze({
    schema: HELIOS_PREDICTION_MARKET_SCHEMA,
    authority: HELIOS_PREDICTION_MARKET_AUTHORITY,
    kind: 'outcome_contract',
    instrumentId: outcomeContractInstrumentId(FIXTURE_CONDITION_FED_DEC, 0),
    conditionId: FIXTURE_CONDITION_FED_DEC,
    outcomeIndex: 0,
    label: 'Rate cut at December 2026 FOMC',
    tokenId: FIXTURE_YES_TOKEN,
  });
}

export function fixturePredictionEvents(): readonly PredictionEventMarket[] {
  const marketInstrument = predictionMarketInstrumentId(FIXTURE_CONDITION_FED_DEC);
  return Object.freeze([
    Object.freeze({
      schema: HELIOS_PREDICTION_MARKET_SCHEMA,
      authority: HELIOS_PREDICTION_MARKET_AUTHORITY,
      kind: 'prediction_event' as const,
      instrumentId: predictionEventInstrumentId('fed-dec-2026'),
      slug: 'fed-dec-2026',
      title: 'December 2026 FOMC rate decision',
      category: 'macro',
      markets: Object.freeze([
        Object.freeze({
          instrumentId: marketInstrument,
          conditionId: FIXTURE_CONDITION_FED_DEC,
          question: 'Will the Fed cut rates at the December 2026 meeting?',
          status: 'ACTIVE' as const,
          resolutionStatus: 'UNRESOLVED' as const,
          expiresAt: EXPIRES,
          resolvesAt: EXPIRES,
        }),
      ]),
    }),
  ]);
}

export function fixtureClobBooks(): readonly CloOrderBookSnapshot[] {
  const { yes, no } = fixtureYesNoContracts();
  return Object.freeze([
    Object.freeze({
      contractInstrumentId: yes.instrumentId,
      tokenId: yes.tokenId,
      volume24hContracts: 250_000n,
      book: book(
        [level(6400, 50_000n), level(6350, 80_000n)],
        [level(6450, 40_000n), level(6500, 60_000n)],
      ),
    }),
    Object.freeze({
      contractInstrumentId: no.instrumentId,
      tokenId: no.tokenId,
      volume24hContracts: 180_000n,
      book: book(
        [level(3500, 30_000n), level(3450, 55_000n)],
        [level(3600, 45_000n), level(3650, 70_000n)],
      ),
    }),
  ]);
}
