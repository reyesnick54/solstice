import {
  TELEMETRY_SYSTEMS,
  type TelemetryInventoryRow,
  type TelemetrySystem,
} from './types.ts';

const ROWS: readonly TelemetryInventoryRow[] = Object.freeze([
  {
    system: 'API',
    owner: 'services/api',
    metrics: 'PARTIAL',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Platform API emits structured request logs with requestId and correlationId. Request/latency/error metrics are productized here; live scrape is simulation-only.',
    blindSpot: 'No production Prometheus scrape; consumer BFF cache hits are not a financial SLO.',
  },
  {
    system: 'AUTHENTICATION',
    owner: 'packages/identity',
    metrics: 'PARTIAL',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Session and WebAuthn outcomes can be counted by result class. ActorContext is not a metric label.',
    blindSpot: 'Passkey ceremony internals and KYC raw payloads must never appear in telemetry.',
  },
  {
    system: 'LEDGER',
    owner: 'packages/ledger',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'COVERED',
    notes: 'Posting success/failure and imbalance alerts exist on the control-room plane. Journals remain the system of record.',
    blindSpot: null,
  },
  {
    system: 'ACCOUNTS',
    owner: 'services/accounts',
    metrics: 'PARTIAL',
    logs: 'PARTIAL',
    traces: 'PARTIAL',
    notes: 'Open/deposit/withdraw/transfer are Kernel-gated library calls. HTTP exposure is via the platform API orchestration layer.',
    blindSpot: 'No dedicated accounts HTTP process metrics until the API surface is the only ingress.',
  },
  {
    system: 'PAYMENTS',
    owner: 'packages/payments',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'COVERED',
    notes: 'Chunk 156 payment snapshots cover SUBMISSION_UNKNOWN, settlement lag, and callback replays.',
    blindSpot: null,
  },
  {
    system: 'FX',
    owner: 'packages/payments/src/fx-quote.ts',
    metrics: 'COVERED',
    logs: 'PARTIAL',
    traces: 'PARTIAL',
    notes: 'Stale-quote rejections are a first-class payment metric. Same-currency paths must remain available when FX is down.',
    blindSpot: 'No live FX vendor freshness; simulation quotes only.',
  },
  {
    system: 'CARDS',
    owner: 'packages/cards',
    metrics: 'PARTIAL',
    logs: 'PARTIAL',
    traces: 'BLIND',
    notes: 'Card auth/clear/settle is simulated. Productization adds workflow-status gauges; there is no processor kill switch in packages/cards.',
    blindSpot: 'No card-processor kill switch owner; treasury/provider switches are the operational control.',
  },
  {
    system: 'TREASURY',
    owner: 'packages/treasury',
    metrics: 'PARTIAL',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Liquidity and kill-switch state are domain facts. Productization adds a liquidity-warning alert.',
    blindSpot: 'Treasury cannot mint native assets; do not treat protocol treasury gauges as customer balances.',
  },
  {
    system: 'RECONCILIATION',
    owner: 'packages/events + packages/treasury + packages/custody',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Break counts exist for payments, custody, exchange, and supply. Breaks never auto-journal.',
    blindSpot: null,
  },
  {
    system: 'PROVIDERS',
    owner: 'packages/sunrey-chain/src/ops/control-room',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'COVERED',
    notes: 'Technical health is not legal, commercial, or production approval.',
    blindSpot: null,
  },
  {
    system: 'GROW',
    owner: 'packages/platform',
    metrics: 'PARTIAL',
    logs: 'PARTIAL',
    traces: 'BLIND',
    notes: 'Growth Orchestrator is proposal-only. Productization counts proposal throughput, never a return-rate field.',
    blindSpot: 'No percentage-return, blended-yield, or growth-rate metric is permitted.',
  },
  {
    system: 'AGENT',
    owner: 'packages/sunrey-agent',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Agent productization already emits request/model/tool/proposal metrics without prompt labels.',
    blindSpot: 'ProposalGate ALLOW is not execution; do not SLI "agent executed a payment".',
  },
  {
    system: 'EXCHANGE',
    owner: 'packages/sunrey-exchange',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'COVERED',
    notes: 'Order ingress, matching latency, settlement backlog, and halt switches exist.',
    blindSpot: 'Settlement is not ledger-backed on the current simulation ports.',
  },
  {
    system: 'CHAIN',
    owner: 'packages/sunrey-chain',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'COVERED',
    notes: 'Height, finality, validator votes, and RPC error rate are Chunk 55 required metrics.',
    blindSpot: null,
  },
  {
    system: 'WALLETS',
    owner: 'packages/sunrey-chain/src/wallet',
    metrics: 'PARTIAL',
    logs: 'PARTIAL',
    traces: 'PARTIAL',
    notes: 'Wallet processing backlog is added as an engineering gauge. Wallet keys are not Execution Authority.',
    blindSpot: 'Mobile-sync lag is rehearsal-only.',
  },
  {
    system: 'CUSTODY',
    owner: 'packages/custody',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Deposit/withdrawal workflow counts and HSM health exist. Withdrawal kill switch is human-gated.',
    blindSpot: 'Custody does not call Ledger.postJournal today.',
  },
  {
    system: 'VAULT',
    owner: 'packages/personal-data-vault + packages/evidence',
    metrics: 'PARTIAL',
    logs: 'PARTIAL',
    traces: 'PARTIAL',
    notes: 'Evidence Vault is the financial evidence plane. PDV access anomalies are security signals, not evidence of money movement.',
    blindSpot: 'PDV payloads and consent content are forbidden in telemetry.',
  },
  {
    system: 'HIN',
    owner: 'packages/information-market',
    metrics: 'PARTIAL',
    logs: 'PARTIAL',
    traces: 'BLIND',
    notes: 'Marketplace kill switch exists. HIN is not a second ledger or Evidence Vault.',
    blindSpot: 'Information-rights grant content must not be logged.',
  },
  {
    system: 'DATABASE',
    owner: 'packages/persistence',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Primary health, replica lag, backup age, and recovery queue are control-room persistence metrics.',
    blindSpot: 'Managed-cloud PITR is not claimed. Local WAL archive only.',
  },
  {
    system: 'QUEUES_JOBS',
    owner: 'packages/events',
    metrics: 'COVERED',
    logs: 'COVERED',
    traces: 'PARTIAL',
    notes: 'Outbox/inbox/dead-letter gauges exist. Job age is added as an engineering gauge.',
    blindSpot: null,
  },
]);

export function telemetryInventory(): readonly TelemetryInventoryRow[] {
  return ROWS;
}

export function telemetryBlindSpots(): readonly TelemetryInventoryRow[] {
  return ROWS.filter((row) => row.blindSpot !== null || row.metrics === 'BLIND' || row.traces === 'BLIND');
}

export function inventoryComplete(): boolean {
  const systems = new Set(ROWS.map((row) => row.system));
  return TELEMETRY_SYSTEMS.every((system) => systems.has(system)) && ROWS.length === TELEMETRY_SYSTEMS.length;
}

export function coverageFor(system: TelemetrySystem): TelemetryInventoryRow {
  const row = ROWS.find((item) => item.system === system);
  if (!row) {
    throw new Error(`missing telemetry inventory for ${system}`);
  }
  return row;
}
