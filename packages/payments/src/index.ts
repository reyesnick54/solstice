export { compareQuotes, sourceAmountForDestination } from './fx/router.ts';
export { quoteAllSources, quoteFingerprint, QUOTE_SOURCES } from './fx/quotes.ts';
export type { QuoteSourceId, SimulatedFxQuote } from './fx/quotes.ts';

export {
  createSimulatedRails,
  DomesticRail,
  InstantRail,
  RAIL_IDS,
  SepaLikeRail,
  SwiftLikeRail,
} from './rails/index.ts';
export type {
  PaymentRail,
  RailExecution,
  RailId,
  RailInstruction,
  RailQuote,
  RailStatus,
} from './rails/index.ts';

export { routingFingerprint, ROUTE_SCORE_VERSION, scoreRoutes } from './routing/engine.ts';
export type { RoutingDecision, ScoredRoute } from './routing/engine.ts';

export { SolsticeSystem } from './system.ts';
export type { SubmissionErr, SubmissionOk } from './system.ts';
