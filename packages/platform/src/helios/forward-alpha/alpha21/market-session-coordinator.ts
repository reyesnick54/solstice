import type { UtcInstant } from '@solstice/domain';

import { createMarketCalendarRegistry } from '../../multi-asset/market-calendar/registry.ts';
import {
  assessInstrumentTradability,
  mapMarketStateToVenueSession,
} from '../../multi-asset/market-calendar/tradability.ts';
import type { MarketCalendarRegistry } from '../../multi-asset/market-calendar/types.ts';
import type { ActiveStrategyConfig, CertifiedMarketState } from './types.ts';

export class MarketSessionCoordinator {
  private readonly registry: MarketCalendarRegistry;

  constructor(registry?: MarketCalendarRegistry) {
    this.registry = registry ?? createMarketCalendarRegistry();
  }

  certifiedStateForInstrument(input: {
    readonly instrumentId: string;
    readonly at: UtcInstant;
    readonly extendedHoursPermitted: boolean;
  }): CertifiedMarketState {
    const assessment = assessInstrumentTradability({
      instrumentId: input.instrumentId,
      at: input.at,
      registry: this.registry,
      forExecution: true,
    });
    const binding = this.registry.getInstrumentBinding(input.instrumentId);
    let sessionOpen = assessment.marketState === 'OPEN' && assessment.executable;
    if (
      input.extendedHoursPermitted &&
      (assessment.marketState === 'PRE_MARKET' || assessment.marketState === 'POST_MARKET') &&
      assessment.executable
    ) {
      sessionOpen = true;
    }

    return Object.freeze({
      instrumentId: input.instrumentId,
      at: input.at,
      marketState: assessment.marketState,
      sessionOpen,
      extendedHoursPermitted: input.extendedHoursPermitted,
      executable: assessment.executable,
      calendarId: binding?.calendarId ?? null,
    });
  }

  resolveSessions(input: {
    readonly strategies: readonly ActiveStrategyConfig[];
    readonly at: UtcInstant;
  }): readonly CertifiedMarketState[] {
    const byInstrument = new Map<string, CertifiedMarketState>();
    for (const strategy of input.strategies) {
      for (const instrumentId of strategy.instrumentIds) {
        if (byInstrument.has(instrumentId)) {
          continue;
        }
        byInstrument.set(
          instrumentId,
          this.certifiedStateForInstrument({
            instrumentId,
            at: input.at,
            extendedHoursPermitted: strategy.extendedHoursPermitted,
          }),
        );
      }
    }
    return Object.freeze([...byInstrument.values()]);
  }

  activeStrategyIds(input: {
    readonly strategies: readonly ActiveStrategyConfig[];
    readonly at: UtcInstant;
  }): readonly string[] {
    const sessions = this.resolveSessions({ strategies: input.strategies, at: input.at });
    const openInstruments = new Set(sessions.filter((row) => row.sessionOpen).map((row) => row.instrumentId));
    const active: string[] = [];
    for (const strategy of input.strategies) {
      const runnable = strategy.instrumentIds.some((instrumentId) => openInstruments.has(instrumentId));
      if (runnable) {
        active.push(strategy.strategyId);
      }
    }
    return Object.freeze(active);
  }

  venueSessionFor(instrumentId: string, at: UtcInstant): ReturnType<typeof mapMarketStateToVenueSession> {
    const assessment = assessInstrumentTradability({
      instrumentId,
      at,
      registry: this.registry,
      forExecution: true,
    });
    return mapMarketStateToVenueSession(assessment.marketState);
  }
}
