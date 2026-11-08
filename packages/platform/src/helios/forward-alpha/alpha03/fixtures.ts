import { MARKET_DATA_LIVE_SHADOW_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import { asUtcInstant } from '@solstice/domain';
import type { MarketQuoteEvent } from '@solstice/provider-sdk';

import { describeMarketDataLiveShadowPosture } from '../../market-data/live-shadow.ts';
import { md01QuoteEventFixture } from '../../market-data/md01/index.ts';
import {
  MD15_LIVE_SHADOW_CHRONOLOGICAL,
  SIMULATION_FORWARD_HARNESS,
  DEFAULT_OUTCOME_HORIZON_MS,
} from './taxonomy.ts';
import type { PrequentialCampaignConfig, PrequentialChronologicalObservation } from './types.ts';

export function resolveAlpha03DataSource(): {
  readonly dataSource: typeof MD15_LIVE_SHADOW_CHRONOLOGICAL | typeof SIMULATION_FORWARD_HARNESS;
  readonly forwardAlphaEvidenceEligible: boolean;
} {
  const posture = describeMarketDataLiveShadowPosture();
  if (MARKET_DATA_LIVE_SHADOW_ENABLED && posture.liveShadowEnabled) {
    return Object.freeze({
      dataSource: MD15_LIVE_SHADOW_CHRONOLOGICAL,
      forwardAlphaEvidenceEligible: true,
    });
  }
  return Object.freeze({
    dataSource: SIMULATION_FORWARD_HARNESS,
    forwardAlphaEvidenceEligible: false,
  });
}

function quoteAt(input: {
  readonly index: number;
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly bid: string;
  readonly ask: string;
  readonly providerId: string;
}): MarketQuoteEvent {
  return md01QuoteEventFixture({
    eventId: `alpha03-fixture-quote-${input.index}`,
    eventTime: input.eventTime,
    exchangeTime: input.eventTime,
    providerPublishTime: input.knowableAt,
    sunreyReceiveTime: input.knowableAt,
    normalizedTime: input.knowableAt,
    knowableAt: input.knowableAt,
    bidPrice: input.bid,
    askPrice: input.ask,
    sourceSequence: BigInt(input.index),
    providerId: input.providerId,
    sourceFeedId: input.providerId === 'simulation-market-data' ? 'fixture-alpha03' : 'live-shadow-readonly',
  });
}

/**
 * Chronological quotes with rising mid — outcome knowable after one-hour horizon.
 */
export function alpha03ChronologicalFixtureStream(): readonly PrequentialChronologicalObservation[] {
  const providerId =
    resolveAlpha03DataSource().dataSource === MD15_LIVE_SHADOW_CHRONOLOGICAL
      ? 'sandbox-live-shadow-readonly'
      : 'simulation-market-data';
  const rows: PrequentialChronologicalObservation[] = [];
  const base = Date.parse('2026-04-01T14:00:00.000Z');
  const mids = [
    { bid: '100.0000', ask: '100.0200' },
    { bid: '100.0100', ask: '100.0300' },
    { bid: '100.0500', ask: '100.0700' },
    { bid: '100.1200', ask: '100.1400' },
    { bid: '100.2000', ask: '100.2200' },
  ];
  for (let i = 0; i < mids.length; i++) {
    const t = asUtcInstant(new Date(base + i * 15 * 60_000).toISOString());
    const event = quoteAt({
      index: i + 1,
      eventTime: t,
      knowableAt: t,
      bid: mids[i]!.bid,
      ask: mids[i]!.ask,
      providerId,
    });
    rows.push(
      Object.freeze({
        event,
        chronologicalIndex: i,
      }),
    );
  }
  return Object.freeze(rows);
}

export function alpha03CampaignFixture(overrides: Partial<PrequentialCampaignConfig> = {}): PrequentialCampaignConfig {
  const source = resolveAlpha03DataSource();
  return Object.freeze({
    campaignId: 'alpha03_demo_campaign',
    dataSource: source.dataSource,
    forwardAlphaEvidenceEligible: source.forwardAlphaEvidenceEligible,
    onlineLearningEnabled: true,
    startedAt: asUtcInstant('2026-04-01T14:00:00.000Z'),
    observationRef: 'md15:chronological:alpha03:fixture',
    instrumentId: 'helios:equity:AAPL:USD',
    outcomeHorizonMs: DEFAULT_OUTCOME_HORIZON_MS,
    initialModelVersion: 'alpha03-m0',
    ...overrides,
  });
}

/** A quote that is only knowable after the decision boundary (leak probe). */
export function alpha03FutureLeakObservation(decisionTime: UtcInstant): PrequentialChronologicalObservation {
  const knowableMs = Date.parse(decisionTime) + 60_000;
  const knowableAt = asUtcInstant(new Date(knowableMs).toISOString());
  const event = quoteAt({
    index: 99,
    eventTime: knowableAt,
    knowableAt,
    bid: '999.0000',
    ask: '999.0200',
    providerId: 'simulation-market-data',
  });
  return Object.freeze({ event, chronologicalIndex: 99 });
}
