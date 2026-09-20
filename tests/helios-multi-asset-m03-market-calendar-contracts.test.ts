import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  assessInstrumentTradability,
  createMarketAwareOrderValidation,
  createMarketCalendarRegistry,
  createMarketOpenValidator,
  evaluateFuturesContract,
  evaluateMultiAssetM03Qualification,
  HELIOS_MULTI_ASSET_M03,
  HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED,
  localDateKey,
  mapMarketStateToVenueSession,
  offsetLabel,
  resolveFrontContract,
  resolveMarketSession,
  resolveNextContract,
  NYSE_EQUITY_CALENDAR,
  CRYPTO_24_7_CALENDAR,
  CME_CL_FUTURES_CALENDAR,
  FX_WEEKDAY_CALENDAR,
  WTI_CONTRACTS,
} from '../packages/platform/src/helios/multi-asset/index.ts';

const registry = createMarketCalendarRegistry();

describe('HELIOS Multi-Asset M03 market calendar and contracts', () => {
  it('exports chunk marker HELIOS_MULTI_ASSET_M03', () => {
    assert.equal(HELIOS_MULTI_ASSET_M03, 'HELIOS_MULTI_ASSET_M03');
  });

  it('resolves equity regular session in America/New_York', () => {
    const at = asUtcInstant('2026-09-16T17:00:00.000Z');
    const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at });
    assert.equal(session.state, 'OPEN');
    assert.equal(session.reasonCode, 'OK');
    assert.equal(localDateKey(at, 'America/New_York'), '2026-09-16');
  });

  it('resolves equity pre-market session', () => {
    const at = asUtcInstant('2026-09-16T12:00:00.000Z');
    const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at });
    assert.equal(session.state, 'PRE_MARKET');
    assert.equal(session.reasonCode, 'PRE_MARKET');
  });

  it('resolves equity post-market session', () => {
    const at = asUtcInstant('2026-09-16T21:00:00.000Z');
    const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at });
    assert.equal(session.state, 'POST_MARKET');
    assert.equal(session.reasonCode, 'POST_MARKET');
  });

  it('closes equities on weekend', () => {
    const at = asUtcInstant('2026-09-19T15:00:00.000Z');
    const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at });
    assert.equal(session.state, 'CLOSED');
    assert.equal(session.reasonCode, 'WEEKEND');
  });

  it('closes equities on holiday', () => {
    const at = asUtcInstant('2026-01-01T15:00:00.000Z');
    const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at });
    assert.equal(session.state, 'CLOSED');
    assert.equal(session.reasonCode, 'HOLIDAY');
  });

  it('keeps crypto open on weekend', () => {
    const at = asUtcInstant('2026-09-19T15:00:00.000Z');
    const session = resolveMarketSession({ calendar: CRYPTO_24_7_CALENDAR, at });
    assert.equal(session.state, 'OPEN');
  });

  it('applies crypto maintenance window without fabricating HALTED', () => {
    const at = asUtcInstant('2026-09-16T02:15:00.000Z');
    const session = resolveMarketSession({ calendar: CRYPTO_24_7_CALENDAR, at });
    assert.equal(session.state, 'MAINTENANCE');
    assert.notEqual(session.state, 'HALTED');
  });

  it('resolves FX weekday session on business days', () => {
    const weekdayOpen = resolveMarketSession({
      calendar: FX_WEEKDAY_CALENDAR,
      at: asUtcInstant('2026-09-16T15:00:00.000Z'),
    });
    assert.equal(weekdayOpen.state, 'OPEN');

    const weekendClosed = resolveMarketSession({
      calendar: FX_WEEKDAY_CALENDAR,
      at: asUtcInstant('2026-09-19T15:00:00.000Z'),
    });
    assert.equal(weekendClosed.state, 'CLOSED');
    assert.equal(weekendClosed.reasonCode, 'WEEKEND');
  });

  it('supports futures session crossing UTC midnight', () => {
    const at = asUtcInstant('2026-09-15T00:30:00.000Z');
    const session = resolveMarketSession({ calendar: CME_CL_FUTURES_CALENDAR, at });
    assert.equal(session.state, 'OPEN');
  });

  it('evaluates expiration and first notice on futures contracts', () => {
    const contract = WTI_CONTRACTS[0]!;
    const beforeExpiry = evaluateFuturesContract({
      contract,
      at: asUtcInstant('2026-09-15T12:00:00.000Z'),
      calendarTimeZone: 'America/New_York',
    });
    assert.equal(beforeExpiry.expired, false);
    assert.ok(beforeExpiry.daysToExpiration > 0);
    assert.equal(contract.firstNoticeDate, '2026-08-21');

    const afterExpiry = evaluateFuturesContract({
      contract,
      at: asUtcInstant('2026-09-21T12:00:00.000Z'),
      calendarTimeZone: 'America/New_York',
    });
    assert.equal(afterExpiry.expired, true);
    assert.equal(afterExpiry.rollState, 'EXPIRED');
  });

  it('derives roll window states', () => {
    const contract = WTI_CONTRACTS[0]!;
    const approaching = evaluateFuturesContract({
      contract,
      at: asUtcInstant('2026-09-05T12:00:00.000Z'),
      calendarTimeZone: 'America/New_York',
    });
    assert.equal(approaching.rollState, 'APPROACHING_ROLL');

    const eligible = evaluateFuturesContract({
      contract,
      at: asUtcInstant('2026-09-10T12:00:00.000Z'),
      calendarTimeZone: 'America/New_York',
    });
    assert.equal(eligible.rollState, 'ROLL_ELIGIBLE');

    const required = evaluateFuturesContract({
      contract,
      at: asUtcInstant('2026-09-18T12:00:00.000Z'),
      calendarTimeZone: 'America/New_York',
    });
    assert.equal(required.rollState, 'ROLL_REQUIRED');
  });

  it('resolves front and next contracts', () => {
    const at = asUtcInstant('2026-09-01T12:00:00.000Z');
    const front = resolveFrontContract({ rootSymbol: 'CL', at, registry });
    const next = resolveNextContract({ rootSymbol: 'CL', at, registry });
    assert.equal(front?.contractId, 'FUT:CL:2026-10');
    assert.equal(next?.contractId, 'FUT:CL:2026-11');
  });

  it('blocks expired contract exposure for execution', () => {
    const assessment = assessInstrumentTradability({
      instrumentId: 'FUT:CL:2026-10',
      at: asUtcInstant('2026-09-21T12:00:00.000Z'),
      registry,
      forExecution: true,
    });
    assert.equal(assessment.outcome, 'BLOCKED');
    assert.equal(assessment.executable, false);
    assert.ok(assessment.reasonCodes.includes('CONTRACT_EXPIRED'));
  });

  it('treats continuous series as research-only and non-executable', () => {
    const assessment = assessInstrumentTradability({
      instrumentId: 'CONT:CL:FRONT',
      at: asUtcInstant('2026-09-01T12:00:00.000Z'),
      registry,
      forExecution: true,
    });
    assert.equal(assessment.continuousSeries, true);
    assert.equal(assessment.executable, false);
    assert.equal(assessment.outcome, 'RESEARCH_ONLY');
    assert.equal(assessment.resolvedContractId, 'FUT:CL:2026-10');
    assert.ok(assessment.reasonCodes.includes('CONTINUOUS_NOT_EXECUTABLE'));
  });

  it('handles daylight savings transition using explicit timezone', () => {
    const beforeDst = asUtcInstant('2026-03-07T15:00:00.000Z');
    const afterDst = asUtcInstant('2026-03-09T13:30:00.000Z');
    assert.equal(offsetLabel(beforeDst, 'America/New_York'), 'GMT-5');
    assert.equal(offsetLabel(afterDst, 'America/New_York'), 'GMT-4');
    const session = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: afterDst });
    assert.equal(session.state, 'OPEN');
  });

  it('fail-closes unknown calendar and missing instrument bindings', () => {
    const unknownCalendar = resolveMarketSession({ calendar: null, at: asUtcInstant('2026-09-16T15:00:00.000Z') });
    assert.equal(unknownCalendar.state, 'UNKNOWN');
    assert.equal(unknownCalendar.reasonCode, 'CALENDAR_MISSING');

    const unknownInstrument = assessInstrumentTradability({
      instrumentId: 'UNKNOWN:SYMBOL',
      at: asUtcInstant('2026-09-16T15:00:00.000Z'),
      registry,
    });
    assert.equal(unknownInstrument.outcome, 'UNKNOWN');
    assert.equal(unknownInstrument.executable, false);
  });

  it('requires authoritative evidence for HALTED state', () => {
    const at = asUtcInstant('2026-09-16T15:00:00.000Z');
    const withoutEvidence = resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at });
    assert.notEqual(withoutEvidence.state, 'HALTED');

    const withEvidence = resolveMarketSession({
      calendar: NYSE_EQUITY_CALENDAR,
      at,
      venueSignals: Object.freeze([
        Object.freeze({
          kind: 'AUTHORITATIVE_HALT',
          authoritative: true,
          message: 'Regulatory halt',
          observedAt: at,
        }),
      ]),
    });
    assert.equal(withEvidence.state, 'HALTED');
    assert.equal(withEvidence.reasonCode, 'AUTHORITATIVE_HALT');
  });

  it('integrates tradability into market-open validation helper', () => {
    const validator = createMarketOpenValidator(registry, () => asUtcInstant('2026-09-16T17:00:00.000Z'));
    assert.equal(validator.marketOpen('SECURITY:US:AAPL:XNAS'), true);
    assert.equal(validator.marketOpen('SECURITY:US:SPY:ARCX'), true);
    assert.equal(validator.marketOpen('SECURITY:US:AAPL:XNAS'), true);
    assert.equal(validator.venueSession('SECURITY:US:AAPL:XNAS'), 'OPEN');
    assert.equal(mapMarketStateToVenueSession('MAINTENANCE'), 'CLOSED');
  });

  it('blocks order lifecycle submission when equity market is closed on holiday', () => {
    const marketValidation = createMarketAwareOrderValidation({
      registry,
      at: () => asUtcInstant('2026-01-01T17:00:00.000Z'),
    });
    assert.equal(marketValidation.marketOpen('SECURITY:US:AAPL:XNAS'), false);
    assert.equal(marketValidation.marketOpen('CONT:CL:FRONT'), false);
  });

  it('qualifies M03 marker when all checks pass', () => {
    const checks = Object.freeze({
      equityRegularSession: resolveMarketSession({
        calendar: NYSE_EQUITY_CALENDAR,
        at: asUtcInstant('2026-09-16T17:00:00.000Z'),
      }).state === 'OPEN',
      equityPreMarket:
        resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: asUtcInstant('2026-09-16T12:00:00.000Z') }).state ===
        'PRE_MARKET',
      equityPostMarket:
        resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: asUtcInstant('2026-09-16T21:00:00.000Z') }).state ===
        'POST_MARKET',
      equityWeekendClosed:
        resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: asUtcInstant('2026-09-19T15:00:00.000Z') }).state ===
        'CLOSED',
      equityHolidayClosed:
        resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: asUtcInstant('2026-01-01T15:00:00.000Z') }).state ===
        'CLOSED',
      cryptoWeekendOpen:
        resolveMarketSession({ calendar: CRYPTO_24_7_CALENDAR, at: asUtcInstant('2026-09-19T15:00:00.000Z') }).state ===
        'OPEN',
      cryptoMaintenanceWindow:
        resolveMarketSession({ calendar: CRYPTO_24_7_CALENDAR, at: asUtcInstant('2026-09-16T02:15:00.000Z') }).state ===
        'MAINTENANCE',
      futuresCrossesUtcMidnight:
        resolveMarketSession({ calendar: CME_CL_FUTURES_CALENDAR, at: asUtcInstant('2026-09-15T00:30:00.000Z') }).state ===
        'OPEN',
      futuresExpiration: evaluateFuturesContract({
        contract: WTI_CONTRACTS[0]!,
        at: asUtcInstant('2026-09-21T12:00:00.000Z'),
        calendarTimeZone: 'America/New_York',
      }).expired,
      futuresFirstNoticeModeled: WTI_CONTRACTS[0]!.firstNoticeDate === '2026-08-21',
      rollWindow:
        evaluateFuturesContract({
          contract: WTI_CONTRACTS[0]!,
          at: asUtcInstant('2026-09-18T12:00:00.000Z'),
          calendarTimeZone: 'America/New_York',
        }).rollState === 'ROLL_REQUIRED',
      frontContractResolution: resolveFrontContract({
        rootSymbol: 'CL',
        at: asUtcInstant('2026-09-01T12:00:00.000Z'),
        registry,
      })?.contractId === 'FUT:CL:2026-10',
      expiredContractBlocked:
        assessInstrumentTradability({
          instrumentId: 'FUT:CL:2026-10',
          at: asUtcInstant('2026-09-21T12:00:00.000Z'),
          registry,
        }).outcome === 'BLOCKED',
      continuousSeriesNonExecutable:
        assessInstrumentTradability({
          instrumentId: 'CONT:CL:FRONT',
          at: asUtcInstant('2026-09-01T12:00:00.000Z'),
          registry,
        }).executable === false,
      daylightSavingsTransition: offsetLabel(asUtcInstant('2026-03-09T13:30:00.000Z'), 'America/New_York') === 'GMT-4',
      unknownCalendarFailClosed:
        resolveMarketSession({ calendar: null, at: asUtcInstant('2026-09-16T15:00:00.000Z') }).state === 'UNKNOWN',
      haltedRequiresAuthoritativeEvidence:
        resolveMarketSession({ calendar: NYSE_EQUITY_CALENDAR, at: asUtcInstant('2026-09-16T15:00:00.000Z') }).state !==
        'HALTED',
      tradabilityIntegrated: createMarketOpenValidator(registry, () => asUtcInstant('2026-09-16T17:00:00.000Z')).marketOpen(
        'SECURITY:US:AAPL:XNAS',
      ),
    });
    const result = evaluateMultiAssetM03Qualification(checks);
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.deepEqual(result.blockers, []);
  });
});
