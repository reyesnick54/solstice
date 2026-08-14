export { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';

export type {
  AssetCapability,
  AssetPair,
  EligibleCustomer,
  Fill,
  Order,
  OrderSide,
  OrderState,
  OrderType,
  TimeInForce,
} from './types.ts';
export {
  ASSET_CAPABILITIES,
  BASE_PRICE_SCALE,
  feeQuoteMinor,
  LISTING_STATUSES,
  notionalQuoteMinor,
  ORDER_SIDES,
  ORDER_STATES,
  ORDER_TYPES,
  PYR_USD,
  TIME_IN_FORCE,
} from './types.ts';

export type { ClearedOrder, ComplianceClearance } from './cleared-order.ts';
export { assertClearedOrder, isClearedOrder } from './cleared-order.ts';

export type { JurisdictionAssetEntry, ListingApproval } from './registry.ts';
export { JurisdictionalAssetRegistry } from './registry.ts';

export { SimulatedPyrCustody } from './custody.ts';

export type { KillSwitchId, KillSwitchState } from './kill-switch.ts';
export { KillSwitchBoard, KILL_SWITCH_IDS } from './kill-switch.ts';

export type { GatewayClearance, GatewayRefusal, OrderRequest } from './gateway.ts';
export { ComplianceGateway } from './gateway.ts';

export type { BookLevel, MatchResult, OrderBookSnapshot } from './matching.ts';
export { MatchingEngine } from './matching.ts';

export type { HistoricalPoint, TradePrint } from './market-data.ts';
export { MarketDataService } from './market-data.ts';

export type { ReconciliationHalt, ReconciliationOk } from './reconciliation.ts';
export { ReconciliationEngine } from './reconciliation.ts';

export type {
  AlertType,
  HumanEnforcementDecision,
  InvestigationNote,
  SurveillanceAlert,
} from './surveillance.ts';
export {
  ALERT_TYPES,
  detectAbnormalVolume,
  detectCoordinatedAccounts,
  detectLayering,
  detectPriceManipulation,
  detectSelfTrading,
  detectSpoofing,
  detectWashTrading,
  runAllDetectors,
  SurveillanceDesk,
} from './surveillance.ts';

export type { ReplayResult, ReplayScenarioName } from './replay.ts';
export { assertReplayDetectsAll, runManipulationReplay } from './replay.ts';

export type { MonitoringOutcome, TravelRuleOk, TravelRuleRefusal } from './travel-rule.ts';
export { monitorTransfer, screenSimulatedAnalytics, submitDigitalAssetTransfer } from './travel-rule.ts';

export { convertFiatToPyr, FIAT_BRIDGE_CLASS } from './fiat.ts';

export type { PlaceResult } from './system.ts';
export { PyramidExchangeSystem } from './system.ts';
