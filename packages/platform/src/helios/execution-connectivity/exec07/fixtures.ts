import { asUtcInstant } from '@solstice/domain';

export const EXEC07_FIXTURE_AS_OF = asUtcInstant('2026-11-07T12:00:00.000Z');
export const EXEC07_FIXTURE_ARRIVAL = asUtcInstant('2026-11-07T12:00:01.000Z');
export const EXEC07_FIXTURE_DECISION = asUtcInstant('2026-11-07T11:59:55.000Z');

export const exec07FixtureBenchmarkPrices = Object.freeze({
  decisionPriceMinor: 100_00n,
  decisionAt: EXEC07_FIXTURE_DECISION,
  arrivalPriceMinor: 100_05n,
  arrivalAt: EXEC07_FIXTURE_ARRIVAL,
  midAtArrivalMinor: 100_04n,
  nbboMidMinor: 100_04n,
  bboMidMinor: null,
  vwapMinor: 100_03n,
  closeMinor: 100_10n,
  implementationShortfallBenchmarkMinor: 100_05n,
});

export const exec07IncompleteBenchmarkPrices = Object.freeze({
  decisionPriceMinor: null,
  decisionAt: null,
  arrivalPriceMinor: 100_05n,
  arrivalAt: EXEC07_FIXTURE_ARRIVAL,
  midAtArrivalMinor: null,
  nbboMidMinor: null,
  bboMidMinor: 100_04n,
  vwapMinor: null,
  closeMinor: null,
  implementationShortfallBenchmarkMinor: null,
});
