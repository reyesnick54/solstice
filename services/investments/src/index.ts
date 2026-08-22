/**
 * Investments application facade. Canonical investment state lives in
 * packages/investments. This service is not a second portfolio, brokerage,
 * or trading model and cannot bypass the Kernel.
 */
export {
  InvestmentsService,
  InvestmentStore,
  InvestmentPlatform,
  seedSimulationInstruments,
  seedInstrumentProducts,
  SandboxInvestmentExecutionProvider,
  SIM_ETF_1,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_SECURITIES_BROKERAGE,
  QUANTITY_SCALE,
  PRODUCT_ASSET_CLASSES,
  INVESTMENT_ORDER_STATES,
  asInvestmentAccountId,
  type InvestmentsServiceOutcome,
  type InstrumentProduct,
  type ProductAssetClass,
  type InvestmentOrderState,
  type PlatformResult,
} from '../../../packages/investments/src/index.ts';
