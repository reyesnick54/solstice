/**
 * Wave 8 product integration — service startup dependency order.
 *
 * Services may start in degraded mode when upstream dependencies are unavailable.
 * Chain-derived balances must not be reported as current when the node/indexer is stale.
 */

export const PRODUCT_STARTUP_PHASES = [
  'CONFIG_AND_SECURITY',
  'PERSISTENCE',
  'EVIDENCE_AND_POLICY',
  'BLOCKCHAIN_NODE',
  'BLOCKCHAIN_QUERY',
  'LEDGER_AND_ACCOUNTS',
  'IDENTITY_AND_CONSENT',
  'ECONOMIC_PLANES',
  'EXCHANGE_AND_CUSTODY',
  'AGENT_AND_VAULT',
  'CONSUMER_API',
  'ADMIN_GOVERNANCE',
] as const;

export type ProductStartupPhase = (typeof PRODUCT_STARTUP_PHASES)[number];

export type ProductServiceStartupSpec = {
  readonly serviceId: string;
  readonly phase: ProductStartupPhase;
  readonly requiredDependencies: readonly string[];
  readonly degradedMode: string | null;
  readonly blocksFinancialWrites: boolean;
};

export const PRODUCT_SERVICE_STARTUP_ORDER: readonly ProductServiceStartupSpec[] = Object.freeze([
  {
    serviceId: 'config',
    phase: 'CONFIG_AND_SECURITY',
    requiredDependencies: [],
    degradedMode: null,
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'persistence',
    phase: 'PERSISTENCE',
    requiredDependencies: ['config'],
    degradedMode: 'read-only; no durable writes',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'evidence',
    phase: 'EVIDENCE_AND_POLICY',
    requiredDependencies: ['persistence'],
    degradedMode: 'Kernel decisions sealed in-memory only',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'blockchain-node',
    phase: 'BLOCKCHAIN_NODE',
    requiredDependencies: ['config'],
    degradedMode: 'chain sync in progress; native balances stale',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'blockchain-query',
    phase: 'BLOCKCHAIN_QUERY',
    requiredDependencies: ['blockchain-node', 'persistence'],
    degradedMode: 'read-only; height lag reported',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'ledger',
    phase: 'LEDGER_AND_ACCOUNTS',
    requiredDependencies: ['persistence', 'evidence'],
    degradedMode: 'no postJournal until evidence durable',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'accounts',
    phase: 'LEDGER_AND_ACCOUNTS',
    requiredDependencies: ['ledger', 'kernel'],
    degradedMode: 'read-only balances from last persisted journals',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'identity',
    phase: 'IDENTITY_AND_CONSENT',
    requiredDependencies: ['persistence'],
    degradedMode: 'session validation only; no new grants',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'consent',
    phase: 'IDENTITY_AND_CONSENT',
    requiredDependencies: ['identity', 'persistence'],
    degradedMode: 'purpose firewall deny-all on mutations',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'economic-awareness',
    phase: 'ECONOMIC_PLANES',
    requiredDependencies: ['provider-runtime'],
    degradedMode: 'cached observations only',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'human-economy',
    phase: 'ECONOMIC_PLANES',
    requiredDependencies: ['economic-awareness', 'consent'],
    degradedMode: 'registry read-only',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'productive-economy',
    phase: 'ECONOMIC_PLANES',
    requiredDependencies: ['economic-awareness'],
    degradedMode: 'oracle facts read-only',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'exchange',
    phase: 'EXCHANGE_AND_CUSTODY',
    requiredDependencies: ['ledger', 'blockchain-query'],
    degradedMode: 'matching paused; quotes from last snapshot',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'custody-wallet',
    phase: 'EXCHANGE_AND_CUSTODY',
    requiredDependencies: ['blockchain-query', 'ledger'],
    degradedMode: 'projections marked stale; no withdrawals',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'agent',
    phase: 'AGENT_AND_VAULT',
    requiredDependencies: ['consent', 'persistence'],
    degradedMode: 'proposals only; mandates read-only',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'vault',
    phase: 'AGENT_AND_VAULT',
    requiredDependencies: ['consent', 'persistence'],
    degradedMode: 'read-only exports',
    blocksFinancialWrites: false,
  },
  {
    serviceId: 'consumer-api',
    phase: 'CONSUMER_API',
    requiredDependencies: ['accounts', 'identity', 'consent'],
    degradedMode: 'read-only consumer surface',
    blocksFinancialWrites: true,
  },
  {
    serviceId: 'admin-governance',
    phase: 'ADMIN_GOVERNANCE',
    requiredDependencies: ['evidence', 'kernel'],
    degradedMode: 'auditor read-only',
    blocksFinancialWrites: false,
  },
]);

export function startupOrderFor(serviceId: string): ProductServiceStartupSpec | undefined {
  return PRODUCT_SERVICE_STARTUP_ORDER.find((row) => row.serviceId === serviceId);
}

export function servicesInPhase(phase: ProductStartupPhase): readonly ProductServiceStartupSpec[] {
  return PRODUCT_SERVICE_STARTUP_ORDER.filter((row) => row.phase === phase);
}

export function canStartService(
  serviceId: string,
  ready: ReadonlySet<string>,
): { readonly allowed: boolean; readonly missing: readonly string[] } {
  const spec = startupOrderFor(serviceId);
  if (!spec) {
    return { allowed: false, missing: Object.freeze(['unknown service']) };
  }
  const missing = spec.requiredDependencies.filter((dep) => !ready.has(dep));
  return Object.freeze({ allowed: missing.length === 0, missing: Object.freeze(missing) });
}
