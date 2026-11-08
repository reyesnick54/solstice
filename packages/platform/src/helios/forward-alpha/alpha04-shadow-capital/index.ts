export {
  SHADOW_CAPITAL_SCHEMA,
  HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED,
  HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED,
  SHADOW_SETTLEMENT_STATES,
  SHADOW_TRADE_SIDES,
  SHADOW_CAPITAL_FAILURE_CODES,
  type ShadowSettlementState,
  type ShadowTradeSide,
  type ShadowCapitalFailureCode,
} from './taxonomy.ts';

export type {
  ShadowResearchPosture,
  ShadowCampaignPolicy,
  ShadowCapitalRegistration,
  ShadowCapitalAccount,
  ShadowCash,
  ShadowPosition,
  ShadowLot,
  ShadowTrade,
  ShadowPnL,
  ShadowEquityCurvePoint,
  ShadowEquityCurve,
  ShadowCapitalFailure,
  ShadowCapitalAccountSnapshot,
  ShadowCapitalStrategyRollups,
} from './types.ts';

export { SHADOW_RESEARCH_POSTURE } from './types.ts';

export { registerShadowCapitalAccount, assertRegistrationUnchanged } from './registration.ts';
export { ShadowCapitalPortfolioBook } from './shadow-portfolio-book.ts';

export {
  evaluateAlpha04ShadowCapitalQualification,
  type Alpha04QualificationChecks,
  type Alpha04QualificationResult,
} from './qualification.ts';
