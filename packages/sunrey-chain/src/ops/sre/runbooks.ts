export const REQUIRED_RUNBOOKS = [
  'API_OUTAGE',
  'DATABASE_OUTAGE',
  'PROVIDER_OUTAGE',
  'PAYMENT_UNKNOWN_STATUS',
  'LEDGER_INVARIANT_FAILURE',
  'RECONCILIATION_BREAK',
  'EXCHANGE_INCIDENT',
  'CHAIN_STALL',
  'VALIDATOR_FAILURE',
  'CUSTODY_OUTAGE',
  'AGENT_MODEL_OUTAGE',
  'KYC_COMPLIANCE_PROVIDER_OUTAGE',
  'SECURITY_INCIDENT',
  'DATA_PRIVACY_INCIDENT',
] as const;
export type RequiredRunbookId = (typeof REQUIRED_RUNBOOKS)[number];

export type RunbookRecord = {
  readonly id: RequiredRunbookId;
  readonly title: string;
  readonly path: string;
  readonly existingRefs: readonly string[];
  readonly autoExecute: false;
};

const CATALOG: readonly RunbookRecord[] = Object.freeze([
  {
    id: 'API_OUTAGE',
    title: 'API outage',
    path: 'docs/runbooks/sre/api-outage.md',
    existingRefs: Object.freeze(['docs/operations/alerts.md', 'docs/runbooks/public-rpc-incident.md']),
    autoExecute: false,
  },
  {
    id: 'DATABASE_OUTAGE',
    title: 'Database outage',
    path: 'docs/runbooks/sre/database-outage.md',
    existingRefs: Object.freeze(['docs/operations/database-recovery.md', 'docs/runbooks/database-pitr.md']),
    autoExecute: false,
  },
  {
    id: 'PROVIDER_OUTAGE',
    title: 'Provider outage',
    path: 'docs/runbooks/sre/provider-outage.md',
    existingRefs: Object.freeze(['docs/runbooks/regulated-provider-outage.md', 'docs/runbooks/provider-runtime-incident.md']),
    autoExecute: false,
  },
  {
    id: 'PAYMENT_UNKNOWN_STATUS',
    title: 'Payment unknown status',
    path: 'docs/runbooks/sre/payment-unknown-status.md',
    existingRefs: Object.freeze(['docs/operations/chunk-156-sunrey-control-room.md']),
    autoExecute: false,
  },
  {
    id: 'LEDGER_INVARIANT_FAILURE',
    title: 'Ledger invariant failure',
    path: 'docs/runbooks/sre/ledger-invariant-failure.md',
    existingRefs: Object.freeze(['docs/operations/chunk-156-sunrey-control-room.md']),
    autoExecute: false,
  },
  {
    id: 'RECONCILIATION_BREAK',
    title: 'Reconciliation break',
    path: 'docs/runbooks/sre/reconciliation-break.md',
    existingRefs: Object.freeze(['docs/runbooks/custody-reconciliation.md', 'docs/runbooks/exchange-settlement-reconciliation.md']),
    autoExecute: false,
  },
  {
    id: 'EXCHANGE_INCIDENT',
    title: 'Exchange incident',
    path: 'docs/runbooks/sre/exchange-incident.md',
    existingRefs: Object.freeze(['docs/runbooks/exchange-market-incident.md', 'docs/runbooks/consumer-exchange-incident.md']),
    autoExecute: false,
  },
  {
    id: 'CHAIN_STALL',
    title: 'Chain stall',
    path: 'docs/runbooks/sre/chain-stall.md',
    existingRefs: Object.freeze(['docs/operations/failure-domain-loss.md', 'docs/runbooks/consensus-partition-recovery.md']),
    autoExecute: false,
  },
  {
    id: 'VALIDATOR_FAILURE',
    title: 'Validator failure',
    path: 'docs/runbooks/sre/validator-failure.md',
    existingRefs: Object.freeze(['docs/runbooks/validator-operator-incident.md', 'docs/runbooks/validator-signer-safety.md']),
    autoExecute: false,
  },
  {
    id: 'CUSTODY_OUTAGE',
    title: 'Custody outage',
    path: 'docs/runbooks/sre/custody-outage.md',
    existingRefs: Object.freeze(['docs/runbooks/custody-security-event.md', 'docs/operations/signer-failover.md']),
    autoExecute: false,
  },
  {
    id: 'AGENT_MODEL_OUTAGE',
    title: 'Agent/model outage',
    path: 'docs/runbooks/sre/agent-model-outage.md',
    existingRefs: Object.freeze(['docs/runbooks/agent-security-incident.md']),
    autoExecute: false,
  },
  {
    id: 'KYC_COMPLIANCE_PROVIDER_OUTAGE',
    title: 'KYC/compliance provider outage',
    path: 'docs/runbooks/sre/kyc-compliance-provider-outage.md',
    existingRefs: Object.freeze(['docs/runbooks/regulated-provider-outage.md']),
    autoExecute: false,
  },
  {
    id: 'SECURITY_INCIDENT',
    title: 'Security incident',
    path: 'docs/runbooks/sre/security-incident.md',
    existingRefs: Object.freeze(['docs/runbooks/emergency-security-coordination.md', 'docs/runbooks/launch-security-incident.md']),
    autoExecute: false,
  },
  {
    id: 'DATA_PRIVACY_INCIDENT',
    title: 'Data/privacy incident',
    path: 'docs/runbooks/sre/data-privacy-incident.md',
    existingRefs: Object.freeze(['docs/runbooks/human-information-privacy-incident.md', 'docs/runbooks/evidence-investigation.md']),
    autoExecute: false,
  },
]);

export function runbookCatalog(): readonly RunbookRecord[] {
  return CATALOG;
}

export function runbookCatalogComplete(): boolean {
  return CATALOG.length === REQUIRED_RUNBOOKS.length && CATALOG.every((row) => row.autoExecute === false);
}
