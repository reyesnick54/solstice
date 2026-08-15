/**
 * Investments application facade. Canonical investment state lives in
 * packages/investments. This service is not a second portfolio, brokerage,
 * or trading model and cannot bypass the Kernel.
 */
export {
  InvestmentsService,
  InvestmentStore,
  seedSimulationInstruments,
  SIM_ETF_1,
  LIVE_INVESTMENT_EXECUTION,
  QUANTITY_SCALE,
  type InvestmentsServiceOutcome,
} from '../../../packages/investments/src/index.ts';
