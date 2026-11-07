/**
 * EXEC01 canonical owner reuse — broker, execution, custody domain.
 */

export const EXEC01_CANONICAL_OWNER_REUSE = Object.freeze([
  {
    path: 'packages/investments/src/broker-port.ts',
    exec01Usage: 'BrokerExecutionProvider + PaperBrokerProvider (unchanged paper path)',
  },
  {
    path: 'packages/investments/src/broker-connectivity/',
    exec01Usage: 'Production-shaped EXEC01 broker connectivity types and paper bridge',
  },
  {
    path: 'packages/investments/src/product/execution.ts',
    exec01Usage: 'InvestmentExecutionAdapter product facade (sandbox)',
  },
  {
    path: 'packages/platform/src/helios/order-lifecycle/',
    exec01Usage: 'H23 HeliosProviderOrderPort + settlement + reconciliation',
  },
  {
    path: 'packages/platform/src/helios/provider-orchestration/',
    exec01Usage: 'H22 provider accounts, funding, custody wallet adapters',
  },
  {
    path: 'packages/platform/src/helios/executable-opportunity/',
    exec01Usage: 'H09 execution route registry',
  },
  {
    path: 'packages/platform/src/helios/capital-lifecycle/',
    exec01Usage: 'H24 capital exits, withdrawal, reconcile-first semantics',
  },
  {
    path: 'packages/sunrey-exchange/src/regulated/',
    exec01Usage: 'Market access, exchange kill switches, listing readiness',
  },
  {
    path: 'packages/custody/src/provider-candidate/',
    exec01Usage: 'Custody candidate settlement_reconciliation workflows',
  },
  {
    path: 'packages/risk/src/investments/',
    exec01Usage: 'Pre-trade investment risk + EXEC01 capital reservation facts',
  },
  {
    path: 'packages/risk/src/portfolio/kill-control.ts',
    exec01Usage: 'Portfolio kill triggers (provider failure, reconciliation failure)',
  },
  {
    path: 'packages/kernel/src/policy/seed.ts',
    exec01Usage: 'CREATE_PAPER_ORDER and investment action intents',
  },
  {
    path: 'packages/kernel/src/regulatory-controls/feature-gates.ts',
    exec01Usage: 'INVESTMENT_AGENT_EXECUTION feature gate',
  },
]);

export const EXEC01_EXPLICIT_NON_OWNERS = Object.freeze([
  'packages/brokerage — forbidden',
  'packages/broker — forbidden',
  'packages/portfolio — forbidden',
  'packages/custody-v2 — forbidden',
  'Second Exchange — reuse sunrey-exchange regulated owner only',
  'Second Execution Authority — kernel + permissions owner only',
  'Second Risk Engine — reuse packages/risk',
  'Second ledger — packages/ledger canonical owner only',
]);
