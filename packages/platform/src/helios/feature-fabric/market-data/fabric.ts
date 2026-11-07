import type { UtcInstant } from '@solstice/domain';
import type { CanonicalMarketDataEvent } from '@solstice/provider-sdk';
import { MD01_GRANTS_EXECUTION_AUTHORITY, MD01_MARKET_OBSERVATION_ONLY } from '../../market-data/md01/authority.ts';
import { assertMarketEventKnowableAtDecision } from '../../market-data/md01/knowable-at.ts';
import { HELIOS_MD01_FEATURE_FABRIC_SCHEMA, MD01_POINT_IN_TIME_MARKET_FEATURES } from './taxonomy.ts';

export type PointInTimeMarketFeatureRow = Readonly<{
  readonly featureId: string;
  readonly valueDecimal: string | null;
  readonly knowableAt: UtcInstant;
  readonly sourceEventId: string;
}>;

export type PointInTimeMarketFeaturePlane = Readonly<{
  readonly schema: typeof HELIOS_MD01_FEATURE_FABRIC_SCHEMA;
  readonly authority: typeof MD01_MARKET_OBSERVATION_ONLY;
  readonly grantsExecutionAuthority: typeof MD01_GRANTS_EXECUTION_AUTHORITY;
  readonly evaluationTime: UtcInstant;
  readonly features: readonly PointInTimeMarketFeatureRow[];
}>;

export class PointInTimeMarketDataFabric {
  readonly #events: CanonicalMarketDataEvent[] = [];

  ingest(event: CanonicalMarketDataEvent): void {
    this.#events.push(Object.freeze({ ...event }));
  }

  compileFeaturePlane(input: { readonly evaluationTime: UtcInstant }): PointInTimeMarketFeaturePlane {
    const visible = this.#events.filter((event) => assertMarketEventKnowableAtDecision(input.evaluationTime, event).ok);
    const features: PointInTimeMarketFeatureRow[] = [];
    const lastTrade = [...visible].reverse().find((row) => row.eventKind === 'MarketTradeEvent');
    if (lastTrade && lastTrade.eventKind === 'MarketTradeEvent') {
      features.push({
        featureId: MD01_POINT_IN_TIME_MARKET_FEATURES[0]!,
        valueDecimal: lastTrade.price,
        knowableAt: lastTrade.knowableAt as UtcInstant,
        sourceEventId: lastTrade.eventId,
      });
    }
    const lastQuote = [...visible].reverse().find((row) => row.eventKind === 'MarketQuoteEvent');
    if (lastQuote && lastQuote.eventKind === 'MarketQuoteEvent' && lastQuote.bidPrice && lastQuote.askPrice) {
      const mid = decimalMid4(lastQuote.bidPrice, lastQuote.askPrice);
      features.push({
        featureId: MD01_POINT_IN_TIME_MARKET_FEATURES[1]!,
        valueDecimal: mid,
        knowableAt: lastQuote.knowableAt as UtcInstant,
        sourceEventId: lastQuote.eventId,
      });
    }
    return Object.freeze({
      schema: HELIOS_MD01_FEATURE_FABRIC_SCHEMA,
      authority: MD01_MARKET_OBSERVATION_ONLY,
      grantsExecutionAuthority: MD01_GRANTS_EXECUTION_AUTHORITY,
      evaluationTime: input.evaluationTime,
      features: Object.freeze(features),
    });
  }
}

export function createPointInTimeMarketDataFabric(): PointInTimeMarketDataFabric {
  return new PointInTimeMarketDataFabric();
}

function toMinorUnits4(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  const frac = (fraction + '0000').slice(0, 4).padEnd(4, '0');
  return BigInt(whole) * 10_000n + BigInt(frac);
}

function fromMinorUnits4(minor: bigint): string {
  const whole = minor / 10_000n;
  const frac = (minor % 10_000n).toString().padStart(4, '0');
  return `${whole}.${frac}`;
}

function decimalMid4(bid: string, ask: string): string {
  return fromMinorUnits4((toMinorUnits4(bid) + toMinorUnits4(ask)) / 2n);
}
