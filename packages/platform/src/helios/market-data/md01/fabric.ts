/**
 * MD01 institutional market-data observation fabric.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  isDecimalString,
  validateMarketDataEventEnvelope,
  type CanonicalMarketDataEvent,
} from '@solstice/provider-sdk';
import { MD01_GRANTS_EXECUTION_AUTHORITY, MD01_MARKET_OBSERVATION_ONLY } from './authority.ts';
import { assertMarketEventKnowableAtDecision } from './knowable-at.ts';
import { HELIOS_MD01_MARKET_DATA_FABRIC_SCHEMA, MD01_TEMPORAL_OBSERVATION_KIND } from './taxonomy.ts';

export type MarketDataEventPlane = Readonly<{
  readonly schema: typeof HELIOS_MD01_MARKET_DATA_FABRIC_SCHEMA;
  readonly authority: typeof MD01_MARKET_OBSERVATION_ONLY;
  readonly grantsExecutionAuthority: typeof MD01_GRANTS_EXECUTION_AUTHORITY;
  readonly evaluationTime: UtcInstant;
  readonly events: readonly CanonicalMarketDataEvent[];
  readonly temporalObservationKinds: readonly (typeof MD01_TEMPORAL_OBSERVATION_KIND)[];
}>;

export type IngestMarketDataEventResult =
  | { readonly ok: true; readonly event: CanonicalMarketDataEvent }
  | { readonly ok: false; readonly code: string; readonly message: string };

function extractDecimalFields(event: CanonicalMarketDataEvent): readonly string[] {
  const fields: string[] = [];
  switch (event.eventKind) {
    case 'MarketTradeEvent':
      fields.push(event.price, event.quantity);
      break;
    case 'MarketQuoteEvent':
      if (event.bidPrice) fields.push(event.bidPrice);
      if (event.bidQuantity) fields.push(event.bidQuantity);
      if (event.askPrice) fields.push(event.askPrice);
      if (event.askQuantity) fields.push(event.askQuantity);
      break;
    case 'MarketBookUpdate':
      for (const level of event.levels) {
        fields.push(level.price, level.quantity);
      }
      break;
    case 'MarketBookSnapshot':
      for (const level of [...event.bids, ...event.asks]) {
        fields.push(level.price, level.quantity);
      }
      break;
    case 'ReferencePriceEvent':
      fields.push(event.referencePrice);
      break;
    case 'SettlementPriceEvent':
      fields.push(event.settlementPrice);
      break;
    case 'OpenInterestEvent':
      fields.push(event.openInterest);
      break;
    case 'FundingRateEvent':
      fields.push(event.fundingRateNumerator, event.fundingRateDenominator);
      break;
    case 'IndexPriceEvent':
      fields.push(event.indexPrice);
      break;
    case 'MarkPriceEvent':
      fields.push(event.markPrice);
      break;
    case 'AuctionEvent':
      if (event.indicativePrice) fields.push(event.indicativePrice);
      if (event.indicativeQuantity) fields.push(event.indicativeQuantity);
      break;
    case 'ImbalanceEvent':
      fields.push(event.imbalanceQuantity);
      if (event.referencePrice) fields.push(event.referencePrice);
      break;
    default:
      break;
  }
  return fields;
}

export class HeliosMarketDataFabric {
  readonly #events: CanonicalMarketDataEvent[] = [];

  ingestEvent(event: CanonicalMarketDataEvent): IngestMarketDataEventResult {
    const envelopeErrors = validateMarketDataEventEnvelope(event);
    if (envelopeErrors.length > 0) {
      return {
        ok: false,
        code: 'INVALID_ENVELOPE',
        message: envelopeErrors.join(','),
      };
    }
    if (event.grantsExecutionAuthority !== false) {
      return { ok: false, code: 'EXECUTION_AUTHORITY_FORBIDDEN', message: 'market data cannot grant execution authority' };
    }
    for (const decimal of extractDecimalFields(event)) {
      if (!isDecimalString(decimal)) {
        return { ok: false, code: 'NON_DECIMAL_PRICE', message: `invalid decimal: ${decimal}` };
      }
    }
    const duplicate = this.#events.some((row) => row.eventId === event.eventId);
    if (duplicate) {
      return { ok: false, code: 'DUPLICATE_EVENT', message: event.eventId };
    }
    this.#events.push(Object.freeze({ ...event }));
    return { ok: true, event };
  }

  listEvents(): readonly CanonicalMarketDataEvent[] {
    return Object.freeze([...this.#events]);
  }

  compilePlane(input: { readonly evaluationTime: UtcInstant }): MarketDataEventPlane {
    const visible = this.#events.filter((event) => assertMarketEventKnowableAtDecision(input.evaluationTime, event).ok);
    return Object.freeze({
      schema: HELIOS_MD01_MARKET_DATA_FABRIC_SCHEMA,
      authority: MD01_MARKET_OBSERVATION_ONLY,
      grantsExecutionAuthority: MD01_GRANTS_EXECUTION_AUTHORITY,
      evaluationTime: input.evaluationTime,
      events: Object.freeze(visible.map((row) => Object.freeze({ ...row }))),
      temporalObservationKinds: Object.freeze([MD01_TEMPORAL_OBSERVATION_KIND]),
    });
  }
}

export function createHeliosMarketDataFabric(): HeliosMarketDataFabric {
  return new HeliosMarketDataFabric();
}
