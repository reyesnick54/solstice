/**
 * EXEC01 engineering audit map — existing ports audited for connectivity domain qualification.
 */

export const EXEC01_AUDIT_BROKER_EXECUTION_PROVIDER = Object.freeze({
  owner: 'packages/investments/src/broker-port.ts',
  interface: 'BrokerExecutionProvider',
  implementation: 'PaperBrokerProvider',
  liveProviderConnected: false,
  issuesExecutionAuthority: false,
  notes: 'Canonical ledger-backed paper path via InvestmentsService',
});

export const EXEC01_AUDIT_HELIOS_ORDER_LIFECYCLE = Object.freeze({
  owner: 'packages/platform/src/helios/order-lifecycle/',
  service: 'HeliosOrderLifecycleService',
  providerPort: 'HeliosProviderOrderPort',
  sandboxImplementation: 'SandboxHeliosProviderPort',
  capitalPort: 'HeliosCapitalPort',
  settlementType: 'HeliosSettlement',
  reconciliationType: 'HeliosReconciliationRecord',
  liveExecutionFrozen: true,
  notes: 'H23 does not mint ExecutionAuthority; kernelPermits is injected',
});

export const EXEC01_AUDIT_RISK_PORTS = Object.freeze({
  preTrade: 'packages/investments/src/risk-port.ts — InvestmentRiskControlPort',
  engine: 'packages/risk/src/engine.ts — RiskEngine.assessPreTrade',
  portfolioKills: 'packages/risk/src/portfolio/kill-control.ts',
  exec01Extension: 'packages/risk/src/investments/exec01-capital-reservation.ts',
});

export const EXEC01_AUDIT_KERNEL_AUTHORIZATION = Object.freeze({
  investmentIntents: 'OPEN_INVESTMENT_ACCOUNT, FUND_BROKERAGE_CASH, CREATE_PAPER_ORDER, CANCEL_PAPER_ORDER, SETTLE_INVESTMENT',
  seedPath: 'packages/kernel/src/policy/seed.ts',
  featureGate: 'INVESTMENT_AGENT_EXECUTION',
  exec01Extension: 'packages/kernel/src/regulated/exec01-investment-execution.ts',
  agentIsolation: 'Agent proposals do not receive Execution Authority for investment execution',
});

export const EXEC01_AUDIT_REGULATED_MARKET_ACCESS = Object.freeze({
  owner: 'packages/sunrey-exchange/src/regulated/',
  evaluator: 'evaluateMarketAccess',
  killSwitches: 'engageExchangeKillSwitch — ORDER_ENTRY, SETTLEMENT scopes',
  exec01Extension: 'packages/sunrey-exchange/src/regulated/exec01-broker-access.ts',
  productionActivated: false,
});

export const EXEC01_AUDIT_CUSTODY_CANDIDATES = Object.freeze({
  owner: 'packages/custody/src/provider-candidate/',
  regulatedReconciliation: 'packages/custody/src/regulated/reconciliation.ts',
  exec01Extension: 'packages/custody/src/regulated/exec01-broker-settlement.ts',
  grantsExecutionAuthority: false,
});

export const EXEC01_AUDIT_SETTLEMENT_RECONCILIATION = Object.freeze({
  investmentsLedger: 'packages/investments/src/settlement.ts, reconciliation.ts',
  heliosH23: 'HeliosOrderLifecycleService.settleOrder / reconcileOrder',
  heliosM24: 'packages/platform/src/helios/multi-asset/m24/',
  custodyWorkflow: 'settlement_reconciliation in custody withdrawal steps',
});

export const EXEC01_AUDIT_KILL_SWITCHES = Object.freeze({
  exchange: 'packages/sunrey-exchange/src/regulated/kill-switches.ts',
  portfolio: 'packages/risk/src/portfolio/kill-control.ts — PROVIDER_FAILURE, RECONCILIATION_FAILURE',
  custody: 'packages/custody/src/service.ts — WITHDRAWAL_HALT, DEPOSIT_CREDIT_HALT',
  grow: 'packages/platform/src/helios/grow-controls/',
  fanOutComplete: false,
});

export const EXEC01_AUDIT_CAPITAL_RESERVATION = Object.freeze({
  accountsHolds: 'services/accounts (canonical holds)',
  investmentsProduct: 'packages/investments/src/product/reservation.ts — CashReservation + EA',
  heliosCapitalPort: 'HeliosCapitalPort in order-lifecycle (injected in tests)',
  h24: 'packages/platform/src/helios/capital-lifecycle/',
  exec01RiskFacts: 'BrokerCapitalReservationFact in risk investments extension',
});

export const EXEC01_OWNER_AUDIT_RECORDS = Object.freeze([
  EXEC01_AUDIT_BROKER_EXECUTION_PROVIDER,
  EXEC01_AUDIT_HELIOS_ORDER_LIFECYCLE,
  EXEC01_AUDIT_RISK_PORTS,
  EXEC01_AUDIT_KERNEL_AUTHORIZATION,
  EXEC01_AUDIT_REGULATED_MARKET_ACCESS,
  EXEC01_AUDIT_CUSTODY_CANDIDATES,
  EXEC01_AUDIT_SETTLEMENT_RECONCILIATION,
  EXEC01_AUDIT_KILL_SWITCHES,
  EXEC01_AUDIT_CAPITAL_RESERVATION,
]);
