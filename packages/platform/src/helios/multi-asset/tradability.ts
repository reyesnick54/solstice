import type { UtcInstant } from '@solstice/domain';
import type { VenueSessionState } from '../executable-opportunity/taxonomy.ts';
import { marketStatePermitsExecution, resolveMarketSession } from './calendar.ts';
import { resolveContinuousSeriesContract } from './continuous-series.ts';
import { evaluateFuturesContract, resolveFrontContract } from './futures.ts';
import type { MarketCalendarRegistry, TradabilityAssessment, VenueSignal } from './types.ts';
import type { MarketCalendarReasonCode, MarketState, RollState, TradabilityOutcome } from './taxonomy.ts';

export function mapMarketStateToVenueSession(state: MarketState): VenueSessionState {
  switch (state) {
    case 'OPEN':
      return 'OPEN';
    case 'PRE_MARKET':
      return 'PRE_MARKET';
    case 'POST_MARKET':
      return 'POST_MARKET';
    case 'CLOSED':
    case 'MAINTENANCE':
      return 'CLOSED';
    case 'HALTED':
    case 'UNKNOWN':
      return 'UNKNOWN';
  }
}

export function assessInstrumentTradability(input: {
  readonly instrumentId: string;
  readonly at: UtcInstant;
  readonly registry: MarketCalendarRegistry;
  readonly venueSignals?: readonly VenueSignal[];
  readonly forExecution?: boolean;
}): TradabilityAssessment {
  const forExecution = input.forExecution ?? true;
  const binding = input.registry.getInstrumentBinding(input.instrumentId);
  const reasonCodes: MarketCalendarReasonCode[] = [];

  if (!binding) {
    return Object.freeze({
      instrumentId: input.instrumentId,
      at: input.at,
      outcome: 'UNKNOWN',
      marketState: 'UNKNOWN',
      rollState: null,
      resolvedContractId: null,
      continuousSeries: false,
      executable: false,
      reasonCodes: Object.freeze(['CALENDAR_MISSING'] as const),
    });
  }

  const calendar = binding.calendarId ? input.registry.getCalendar(binding.calendarId) : null;
  const session = resolveMarketSession({
    calendar,
    at: input.at,
    ...(input.venueSignals ? { venueSignals: input.venueSignals } : {}),
  });
  reasonCodes.push(session.reasonCode);

  if (binding.kind === 'CONTINUOUS_RESEARCH' || binding.continuousSeriesId) {
    reasonCodes.push('CONTINUOUS_NOT_EXECUTABLE');
    const resolved = binding.continuousSeriesId
      ? resolveContinuousSeriesContract({
          seriesId: binding.continuousSeriesId,
          at: input.at,
          registry: input.registry,
        })
      : null;
    return Object.freeze({
      instrumentId: input.instrumentId,
      at: input.at,
      outcome: forExecution ? 'RESEARCH_ONLY' : 'RESEARCH_ONLY',
      marketState: session.state,
      rollState: null,
      resolvedContractId: resolved?.researchContractId ?? null,
      continuousSeries: true,
      executable: false,
      reasonCodes: Object.freeze([...reasonCodes]),
    });
  }

  let rollState: RollState | null = null;
  let resolvedContractId = binding.contractId;
  let contractBlocked = false;

  if (binding.contractId) {
    const contract = input.registry.getContract(binding.contractId);
    if (contract && calendar) {
      const snapshot = evaluateFuturesContract({
        contract,
        at: input.at,
        calendarTimeZone: calendar.timeZone,
      });
      rollState = snapshot.rollState;
      if (snapshot.expired) {
        reasonCodes.push('CONTRACT_EXPIRED');
        contractBlocked = true;
      } else if (snapshot.rollState === 'ROLL_REQUIRED') {
        reasonCodes.push('ROLL_REQUIRED');
      }
      if (!snapshot.newExposureAllowed && forExecution) {
        contractBlocked = true;
      }
    }
  } else if (binding.rootSymbol && (binding.kind === 'FUTURES' || binding.kind === 'COMMODITY_FUTURES')) {
    const front = resolveFrontContract({
      rootSymbol: binding.rootSymbol,
      at: input.at,
      registry: input.registry,
    });
    resolvedContractId = front?.contractId ?? null;
  }

  const sessionOpen = marketStatePermitsExecution(session.state);
  let outcome: TradabilityOutcome;
  if (session.state === 'UNKNOWN') {
    outcome = 'UNKNOWN';
  } else if (contractBlocked) {
    outcome = 'BLOCKED';
  } else if (!sessionOpen) {
    outcome = 'CLOSED';
  } else if (forExecution) {
    outcome = 'TRADABLE';
  } else {
    outcome = sessionOpen ? 'TRADABLE' : 'CLOSED';
  }

  return Object.freeze({
    instrumentId: input.instrumentId,
    at: input.at,
    outcome,
    marketState: session.state,
    rollState,
    resolvedContractId,
    continuousSeries: false,
    executable: outcome === 'TRADABLE' && !contractBlocked,
    reasonCodes: Object.freeze([...reasonCodes]),
  });
}

export function createMarketOpenValidator(registry: MarketCalendarRegistry, at: () => UtcInstant) {
  return Object.freeze({
    marketOpen(instrumentId: string): boolean {
      const assessment = assessInstrumentTradability({
        instrumentId,
        at: at(),
        registry,
        forExecution: true,
      });
      return assessment.executable;
    },
    venueSession(instrumentId: string): VenueSessionState {
      const assessment = assessInstrumentTradability({
        instrumentId,
        at: at(),
        registry,
        forExecution: true,
      });
      return mapMarketStateToVenueSession(assessment.marketState);
    },
  });
}
