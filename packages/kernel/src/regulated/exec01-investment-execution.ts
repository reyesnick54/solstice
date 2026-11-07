/**
 * EXEC01 — investment execution connectivity gate references (not legal authorization).
 */

export const EXEC01_INVESTMENT_EXECUTION_CONNECTIVITY_GATE = 'INVESTMENT_EXECUTION_CONNECTIVITY' as const;

export type Exec01InvestmentExecutionPosture = {
  readonly gate: typeof EXEC01_INVESTMENT_EXECUTION_CONNECTIVITY_GATE;
  readonly liveInvestmentExecution: false;
  readonly agentMaySubmitLiveBrokerOrders: false;
  readonly connectivityStateImpliesLegalAuthorization: false;
  readonly kernelStillRequiredForLedgerMutation: true;
};

export function exec01InvestmentExecutionPosture(): Exec01InvestmentExecutionPosture {
  return Object.freeze({
    gate: EXEC01_INVESTMENT_EXECUTION_CONNECTIVITY_GATE,
    liveInvestmentExecution: false,
    agentMaySubmitLiveBrokerOrders: false,
    connectivityStateImpliesLegalAuthorization: false,
    kernelStillRequiredForLedgerMutation: true,
  });
}
