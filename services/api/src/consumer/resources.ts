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
      return row(group, '/api/v1/grow', ['GET', 'POST', 'PATCH'], 'AVAILABLE_SIMULATION', 'packages/platform Growth Orchestrator + packages/personal-economic-graph', 'EXTERNAL_PROVIDER_REQUIRED for live brokerage', 'Opportunity feed, PEG profile, plans, proposals, and simulation portfolio. Starting a proposal does not move money. Live investment is disabled. Not the Ledger. Not guaranteed returns.');
    case 'GOALS':
      return row(group, '/api/v1/grow/goals', ['GET', 'POST', 'PATCH'], 'AVAILABLE_SIMULATION', 'packages/personal-economic-graph goals', 'none', 'User-declared goals. Ledger balances cannot be overridden.');
    case 'PORTFOLIO':
      return row(group, '/api/v1/portfolio', ['GET'], 'AVAILABLE_SIMULATION', 'services/accounts investments bucket + packages/sunrey-exchange consumer', 'none', 'Class breakdown only; no yield field.');
    case 'AGENT':
      return row(group, '/api/v1/agent', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/sunrey-agent conversation + ProposalGate + Phase F qualification platform + packages/ai-runtime Model Gateway', 'EXTERNAL_PROVIDER_REQUIRED for a real model', 'Conversation, Action Cards, Action Center, tools, runtime, and qualification. The Agent never approves. BFF cannot execute or issue Execution Authority. Frontend lists tools via GET /api/v1/agent/tools and does not invoke privileged tools directly.');
    case 'EXCHANGE':
      return row(group, '/api/v1/exchange', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/sunrey-exchange product APIs + productization lifecycle', 'EXTERNAL_PROVIDER_REQUIRED for live custody/market-data', 'Markets, preview, orders, fills, holdings, stream, eligibility, and qualification proposals. Not a second ledger. Production trading disabled.');
    case 'WALLETS':
      return row(group, '/api/v1/wallets', ['GET', 'POST'], 'AVAILABLE_SIMULATION', 'packages/custody product wallet', 'custody / chain adapters', 'Customer wallet, deposit address, withdrawal quote/execute. No signing material. Production signing disabled.');
    case 'ECONOMY':
      return row(group, '/api/v1/economy', ['GET'], 'AVAILABLE_SIMULATION', 'packages/sunrey-chain/src/economics/supply.ts + native-assets productization', 'none', 'Read-only SunRey Coin and MoonRey Coin metadata and supply. No issuance endpoints.');
    case 'HIN':
      return row(group, '/api/v1/hin', ['GET'], 'AVAILABLE_SIMULATION', 'packages/human-economic-contribution hin-value + Human Contribution Registry', 'none', 'Read-only HIN contributions, metrics, and valuation methodology metadata. No verification or issuance endpoints.');
    case 'DATA':
      return row(group, '/api/v1/data', ['GET', 'POST', 'PATCH'], 'AVAILABLE_SIMULATION', 'packages/personal-data-vault product + packages/consent product', 'none', 'Subject-bound vault home, consents, data-rights requests, and export. No getAllUserData. Optional HIN participation. SunRey does not own user data.');
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
