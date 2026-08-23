export {
  EXCHANGE_CORE_CODE_COMPLETE_CANDIDATE,
  EXCHANGE_CORE_POSTURE,
  EXCHANGE_ENVIRONMENT,
  EXCHANGE_LIVE_CONNECTIVITY_ENABLED,
  EXCHANGE_LIVE_TRADING_ENABLED,
  EXCHANGE_PRODUCTION_ACTIVE,
  EXCHANGE_PRODUCTION_AUTHORIZED,
  EXCHANGE_PRODUCTION_READY,
  assertExchangeSimulationOnly,
} from './posture.ts';
export {
  CUSTODY_REQUIREMENTS,
  PRODUCTIZED_MARKET_STATUSES,
  PRODUCTIZED_MARKET_TYPES,
  ProductizedInstrumentRegistry,
  mapMarketStateToProductized,
  productizedInstrumentFromMarket,
  type CustodyRequirement,
  type ProductizedInstrument,
  type ProductizedMarketStatus,
  type ProductizedMarketType,
} from './instrument.ts';
export {
  ORDER_TRANSITIONS,
  PRODUCTIZED_ORDER_STATES,
  TERMINAL_ORDER_STATES,
  canTransitionOrder,
  cancellableStates,
  isCancellable,
  isProductizedOrderState,
  isTerminalOrderState,
  transitionOrder,
  type ProductizedOrderState,
} from './order-lifecycle.ts';
export {
  accountIsActive,
  validateMarketAdmitsOrders,
  validatePreTrade,
  type PreTradeAcceptance,
  type PreTradeInput,
  type PreTradeRejection,
} from './validation.ts';
export {
  assessTradeFees,
  expectedTakerFeeBuffer,
  feeFromNotional,
  productizeFeeSchedule,
  rejectClientFeeOverride,
  type CustomerFeeTier,
  type FeeAssessment,
  type ProductizedFeeSchedule,
} from './fees.ts';
export { planReservation, releasableOnCancel, remainingReservable, type ReservationPlan } from './reservation.ts';
export {
  controlAllowsCancelOnly,
  controlBlocksNewOrders,
  priceWithinBand,
  recordOrderRate,
  rateAllows,
  tripCircuitBreaker,
  type CircuitBreaker,
  type PriceBand,
  type RateWindow,
} from './controls.ts';
export { MatchingSequencer, resolveCancelFillRace, type RaceResolution, type SequencedIntent } from './sequencer.ts';
export {
  captureExchangeCore,
  decodeSnapshot,
  encodeSnapshot,
  hydrateExchangeStore,
  type ExchangeCoreSnapshot,
} from './snapshot.ts';
export { reconstructOpenBook, replayAcceptedOrders, tradeDedupeKey, type ReplayResult } from './replay.ts';
export {
  EXCHANGE_CORE_EVENT_NAMES,
  EXCHANGE_DOMAIN_EVENT_TYPES,
  exchangeCoreEvent,
  type ExchangeCoreEvent,
  type ExchangeCoreEventName,
} from './events.ts';
export { InMemoryExchangeCorePersistence, type ExchangeCorePersistencePort } from './persistence-port.ts';
export { measureExchangeCore, type ExchangeCorePerfCase } from './performance.ts';
