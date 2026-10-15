/**
 * AAF09 qualification gate — external crypto multi-venue observation plane.
 */

export const HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED =
  'HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED' as const;

export const HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_BLOCKED = 'HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_BLOCKED' as const;

export type Aaf09QualificationChecks = {
  readonly btcUsdDistinctFromBtcUsdt: boolean;
  readonly venueDistinctFromAggregate: boolean;
  readonly staleVenueFeedHandled: boolean;
  readonly sequenceGapHandled: boolean;
  readonly crossedMarketHandled: boolean;
  readonly largeSourceDisagreementHandled: boolean;
  readonly providerOutageHandled: boolean;
  readonly weekendOperationSupported: boolean;
  readonly replayDeterministic: boolean;
  readonly pointInTimeFeatureCorrect: boolean;
  readonly krakenAaf07Certified: boolean;
  readonly referenceClassifiedAsAggregate: boolean;
  readonly noTradingExecutionPath: boolean;
};

export type Aaf09QualificationResult = {
  readonly marker:
    | typeof HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED
    | typeof HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_MESSAGES: Array<[keyof Aaf09QualificationChecks, string]> = [
  ['btcUsdDistinctFromBtcUsdt', 'BTC/USD and BTC/USDT identities not distinct'],
  ['venueDistinctFromAggregate', 'venue source not distinguished from aggregate provider'],
  ['staleVenueFeedHandled', 'stale venue feed handling missing'],
  ['sequenceGapHandled', 'sequence gap handling missing'],
  ['crossedMarketHandled', 'crossed market handling missing'],
  ['largeSourceDisagreementHandled', 'large source disagreement handling missing'],
  ['providerOutageHandled', 'provider outage handling missing'],
  ['weekendOperationSupported', 'weekend crypto calendar not supported'],
  ['replayDeterministic', 'replay determinism missing'],
  ['pointInTimeFeatureCorrect', 'point-in-time feature correctness not proven'],
  ['krakenAaf07Certified', 'Kraken venue adapter not AAF07 certified'],
  ['referenceClassifiedAsAggregate', 'reference provider not classified as aggregate'],
  ['noTradingExecutionPath', 'fabric must not grant execution authority'],
];

export function evaluateAaf09Qualification(checks: Aaf09QualificationChecks): Aaf09QualificationResult {
  const blockers: string[] = [];
  for (const [key, message] of CHECK_MESSAGES) {
    if (!checks[key]) blockers.push(message);
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_AAF09_EXTERNAL_CRYPTO_DATA_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
