import { SLI_IDS, type SliDefinition } from './types.ts';

const DEFINITIONS: readonly SliDefinition[] = Object.freeze([
  {
    id: 'API_AVAILABILITY',
    system: 'API',
    description: 'Share of API requests that receive a non-5xx response.',
    measurement: 'successful_requests / valid_requests',
    goodEvent: 'HTTP status < 500 and handler completed',
    validEvent: 'Inbound request accepted by the platform API',
  },
  {
    id: 'API_LATENCY',
    system: 'API',
    description: 'Share of API requests completing within the engineering latency budget.',
    measurement: 'requests_under_budget / valid_requests',
    goodEvent: 'Handler latency <= 500ms in the simulation scrape window',
    validEvent: 'Completed inbound request',
  },
  {
    id: 'AUTHENTICATION_SUCCESS',
    system: 'AUTHENTICATION',
    description: 'Share of authentication attempts that complete without infrastructure failure.',
    measurement: 'auth_completed / auth_attempts',
    goodEvent: 'Session established or expected credential rejection (not 5xx)',
    validEvent: 'Authentication attempt',
  },
  {
    id: 'LEDGER_POSTING',
    system: 'LEDGER',
    description: 'Share of authorized journal posts that commit without invariant failure.',
    measurement: 'posts_committed / authorized_post_attempts',
    goodEvent: 'Ledger.postJournal committed a balanced journal',
    validEvent: 'Verified Execution Authority presented to postJournal',
  },
  {
    id: 'PAYMENT_ORCHESTRATION',
    system: 'PAYMENTS',
    description: 'Share of payment workflows that reach a terminal engineering state.',
    measurement: 'terminal_payments / started_payments',
    goodEvent: 'Workflow terminal without remaining SUBMISSION_UNKNOWN',
    validEvent: 'Payment orchestration started',
  },
  {
    id: 'PROVIDER_SUCCESS',
    system: 'PROVIDERS',
    description: 'Share of provider-candidate calls that return a technical success class.',
    measurement: 'technical_success / provider_calls',
    goodEvent: 'TECHNICALLY_HEALTHY response class',
    validEvent: 'Provider adapter invocation',
  },
  {
    id: 'FX_QUOTE',
    system: 'FX',
    description: 'Share of FX quote evaluations that are fresh enough to use.',
    measurement: 'fresh_quotes / quote_requests',
    goodEvent: 'Quote accepted and not stale-rejected',
    validEvent: 'FX quote request',
  },
  {
    id: 'AGENT_RESPONSE',
    system: 'AGENT',
    description: 'Share of agent turns that return a structured proposal or an explicit refusal.',
    measurement: 'structured_or_refused / agent_turns',
    goodEvent: 'Structured proposal or first-class REFUSE; not a model timeout',
    validEvent: 'Agent turn started',
  },
  {
    id: 'EXCHANGE_ORDER_PROCESSING',
    system: 'EXCHANGE',
    description: 'Share of accepted orders that reach match or an explicit reject/halt.',
    measurement: 'terminal_orders / accepted_orders',
    goodEvent: 'Matched, rejected, or halted with an explicit reason',
    validEvent: 'Order accepted for processing',
  },
  {
    id: 'CHAIN_FINALITY',
    system: 'CHAIN',
    description: 'Share of proposed heights that finalize when connected voting power permits.',
    measurement: 'finalized_when_quorum / propose_attempts_with_quorum',
    goodEvent: 'Finality when connected power >= two-thirds-plus',
    validEvent: 'Propose with connected quorum',
  },
  {
    id: 'WALLET_PROCESSING',
    system: 'WALLETS',
    description: 'Share of wallet operations that leave the processing backlog.',
    measurement: 'completed_wallet_ops / started_wallet_ops',
    goodEvent: 'Wallet operation completed or explicitly refused',
    validEvent: 'Wallet operation enqueued',
  },
  {
    id: 'RECONCILIATION',
    system: 'RECONCILIATION',
    description: 'Share of reconciliation windows with zero unmatched breaks.',
    measurement: 'matched_windows / reconciliation_windows',
    goodEvent: 'Break count 0 after the window',
    validEvent: 'Reconciliation window closed',
  },
]);

export function sliDefinitions(): readonly SliDefinition[] {
  return DEFINITIONS;
}

export function sliDefinition(id: SliDefinition['id']): SliDefinition {
  const found = DEFINITIONS.find((row) => row.id === id);
  if (!found) {
    throw new Error(`unknown SLI ${id}`);
  }
  return found;
}

export function sliCatalogComplete(): boolean {
  return DEFINITIONS.length === SLI_IDS.length && SLI_IDS.every((id) => DEFINITIONS.some((row) => row.id === id));
}
