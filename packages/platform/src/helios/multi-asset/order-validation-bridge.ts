import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { HeliosOrderValidationPorts } from '../order-lifecycle/types.ts';
import { createMarketCalendarRegistry } from './registry.ts';
import type { MarketCalendarRegistry } from './types.ts';
import { createMarketOpenValidator } from './tradability.ts';

export function createMarketAwareOrderValidation(input: {
  readonly at: () => UtcInstant;
  readonly registry?: MarketCalendarRegistry;
}): Pick<HeliosOrderValidationPorts, 'marketOpen'> {
  const registry = input.registry ?? createMarketCalendarRegistry();
  const validator = createMarketOpenValidator(registry, input.at);
  return Object.freeze({
    marketOpen: (instrumentId: string) => validator.marketOpen(instrumentId),
  });
}
