import { createVenueRoutingAdapter } from './venue-routing-factory.ts';
import type { ExecutionRoutingProviderAdapterPort } from './port.ts';

/** Kraken venue routing adapter — manifest health only, no order execution. */
export function createKrakenVenueRoutingAdapter(): ExecutionRoutingProviderAdapterPort {
  return createVenueRoutingAdapter('kraken');
}
