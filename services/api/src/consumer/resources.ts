import {
  CONSUMER_RESOURCE_GROUPS,
  type ConsumerResourceGroup,
  type ProductAvailability,
} from './types.ts';

export type ConsumerResourceDescriptor = {
  readonly group: ConsumerResourceGroup;
  readonly path: string;
  readonly methods: readonly string[];
  readonly availability: ProductAvailability;
  readonly domainDependency: string;
  readonly providerDependency: string;
  readonly notes: string;
};

export const CONSUMER_RESOURCE_CATALOG: readonly ConsumerResourceDescriptor[] = Object.freeze(
  CONSUMER_RESOURCE_GROUPS.map((group) => descriptorFor(group)),
);

function descriptorFor(group: ConsumerResourceGroup): ConsumerResourceDescriptor {
  switch (group) {
    case 'ME':
      return row(group, '/api/v1/me', ['GET', 'PATCH'], 'AVAILABLE_SIMULATION', 'packages/identity + packages/domain Customer', 'none', 'Profile reads; PATCH is preference-only.');
    case 'HOME':
      return row(group, '/api/v1/me/home', ['GET'], 'AVAILABLE_SIMULATION', 'services/accounts balance + activity read models', 'none', 'Aggregates only canonical reads.');
    case 'ACCOUNTS':
      return row(group, '/api/v1/accounts', ['GET'], 'AVAILABLE_SIMULATION', 'services/accounts + Ledger-derived balances', 'none', 'Never recalculated from activity arrays.');
    case 'ACTIVITY':
      return row(group, '/api/v1/accounts/{id}/activity', ['GET'], 'AVAILABLE_SIMULATION', 'services/accounts projectTransactionHistory', 'none', 'Cursor-paginated; not a balance authority.');
    case 'PAYMENTS':
      return row(group, '/api/v1/payments', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/payments PaymentPlatform', 'EXTERNAL_PROVIDER_REQUIRED for live rails', 'Provider-neutral. Lovable calls SunRey; SunRey routes the adapter. Production money movement disabled.');
    case 'RECIPIENTS':
      return row(group, '/api/v1/recipients', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/payments beneficiaries', 'none', 'Agents cannot add beneficiaries. Frontend cannot mark a recipient verified.');
    case 'FX':
      return row(group, '/api/v1/fx', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/payments FX quote engine', 'EXTERNAL_PROVIDER_REQUIRED for live FX', 'Provider-neutral quotes and execution. Live FX is not connected.');
    case 'CARDS':
      return row(group, '/api/v1/cards', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/cards + services/cards', 'EXTERNAL_PROVIDER_REQUIRED for live issuer', 'Provider-neutral PCI-minimized dashboard. last4/expiry only. No PAN/CVV. Live issuer is not connected.');
    case 'GROW':
      return row(group, '/api/v1/grow', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/platform Growth Orchestrator product plans/proposals', 'none', 'Grow My Money plans and structured proposals. Illustrations only. Production remains disabled.');
      return row(group, '/api/v1/grow', ['GET'], 'AVAILABLE_SIMULATION', 'packages/investments InvestmentPlatform + packages/platform Growth Orchestrator', 'EXTERNAL_PROVIDER_REQUIRED for live brokerage', 'Simulation portfolio/holdings/performance/allocation/risk. No privileged execution APIs. Not a live securities broker.');
      return row(group, '/api/v1/grow/opportunities', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/platform Growth Orchestrator', 'none', 'Deterministic opportunity feed. Starting a proposal does not move money.');
      return row(group, '/api/v1/grow/profile', ['GET', 'POST', 'PATCH'], 'AVAILABLE_SIMULATION', 'packages/personal-economic-graph EconomicGraphService', 'none', 'Client-safe PEG profile, snapshot, goals, insights, and suitability. Not the Ledger. Not guaranteed returns.');
    case 'GOALS':
      return row(group, '/api/v1/grow/goals', ['GET', 'POST', 'PATCH'], 'AVAILABLE_SIMULATION', 'packages/personal-economic-graph goals', 'none', 'User-declared goals. Ledger balances cannot be overridden.');
    case 'PORTFOLIO':
      return row(group, '/api/v1/portfolio', ['GET'], 'AVAILABLE_SIMULATION', 'services/accounts investments bucket + packages/sunrey-exchange consumer', 'none', 'Class breakdown only; no yield field.');
    case 'AGENT':
      return row(group, '/api/v1/agent', ['GET'], 'AVAILABLE_SIMULATION', 'packages/sunrey-agent ProposalGate', 'none', 'Recommendations are proposals. BFF cannot execute.');
    case 'EXCHANGE':
      return row(group, '/api/v1/exchange', ['GET'], 'AVAILABLE_SIMULATION', 'packages/sunrey-exchange consumer APIs', 'none', 'Indicative; not a second ledger.');
    case 'WALLETS':
      return row(group, '/api/v1/wallets', ['GET'], 'NOT_YET_PRODUCTIZED', 'packages/cards wallet + packages/sunrey-chain mobile-sync', 'wallet providers', 'No consumer wallet product path yet.');
    case 'DATA':
      return row(group, '/api/v1/data', ['GET'], 'AVAILABLE_SIMULATION', 'packages/personal-data-vault', 'none', 'Subject-bound vault metadata only.');
    case 'SECURITY':
      return row(group, '/api/v1/security', ['GET'], 'AVAILABLE_SIMULATION', 'packages/identity sessions/devices', 'none', 'Session and device summary.');
    case 'NOTIFICATIONS':
      return row(group, '/api/v1/notifications', ['GET'], 'NOT_YET_PRODUCTIZED', 'none', 'none', 'No productized notification store.');
  }
}

function row(
  group: ConsumerResourceGroup,
  path: string,
  methods: readonly string[],
  availability: ProductAvailability,
  domainDependency: string,
  providerDependency: string,
  notes: string,
): ConsumerResourceDescriptor {
  return Object.freeze({
    group,
    path,
    methods,
    availability,
    domainDependency,
    providerDependency,
    notes,
  });
}
