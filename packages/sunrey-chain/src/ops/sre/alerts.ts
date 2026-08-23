import { AlertEngine } from '../alerts.ts';
import {
  PRODUCTIZATION_ALERT_CODES,
  type ProductizationAlert,
  type ProductizationAlertCode,
  type SeverityLevel,
} from './types.ts';

const TABLE: Readonly<
  Record<ProductizationAlertCode, { readonly severity: SeverityLevel; readonly description: string; readonly runbook: string }>
> = Object.freeze({
  API_OUTAGE: {
    severity: 'SEV1',
    description: 'Platform API availability dropped below the engineering target.',
    runbook: 'docs/runbooks/sre/api-outage.md',
  },
  DATABASE_FAILURE: {
    severity: 'SEV1',
    description: 'Writable primary is unhealthy or restore is required.',
    runbook: 'docs/runbooks/sre/database-outage.md',
  },
  HIGH_ERRORS: {
    severity: 'SEV2',
    description: 'Error rate exceeded the engineering burn threshold.',
    runbook: 'docs/runbooks/sre/api-outage.md',
  },
  QUEUE_BACKLOG: {
    severity: 'SEV2',
    description: 'Outbox/inbox/job depth or age exceeded the engineering drain target.',
    runbook: 'docs/runbooks/sre/database-outage.md',
  },
  LEDGER_POSTING_FAILURE: {
    severity: 'SEV1',
    description: 'Authorized journal posting failed or an invariant refused the journal.',
    runbook: 'docs/runbooks/sre/ledger-invariant-failure.md',
  },
  PROVIDER_OUTAGE: {
    severity: 'SEV2',
    description: 'A provider-candidate adapter is technically unavailable.',
    runbook: 'docs/runbooks/sre/provider-outage.md',
  },
  RECONCILIATION_BREAK_SPIKE: {
    severity: 'SEV2',
    description: 'Reconciliation break count exceeded the engineering spike threshold.',
    runbook: 'docs/runbooks/sre/reconciliation-break.md',
  },
  TREASURY_LIQUIDITY_WARNING: {
    severity: 'SEV3',
    description: 'Treasury liquidity is below the engineering reserve. Not a mint signal.',
    runbook: 'docs/runbooks/sre/provider-outage.md',
  },
  EXCHANGE_HALT_FAILURE: {
    severity: 'SEV1',
    description: 'Exchange matching halted or settlement failed.',
    runbook: 'docs/runbooks/sre/exchange-incident.md',
  },
  CHAIN_STALL: {
    severity: 'SEV1',
    description: 'Finality stalled while connected quorum should permit progress.',
    runbook: 'docs/runbooks/sre/chain-stall.md',
  },
  VALIDATOR_LOSS: {
    severity: 'SEV2',
    description: 'Validator or signer loss reduced connected power.',
    runbook: 'docs/runbooks/sre/validator-failure.md',
  },
  WALLET_BACKLOG: {
    severity: 'SEV2',
    description: 'Wallet processing backlog exceeded the engineering drain target.',
    runbook: 'docs/runbooks/sre/custody-outage.md',
  },
  AGENT_MODEL_FAILURE: {
    severity: 'SEV2',
    description: 'Agent model or tool path is unavailable. Money UI must remain usable.',
    runbook: 'docs/runbooks/sre/agent-model-outage.md',
  },
  SECURITY_ANOMALY: {
    severity: 'SEV1',
    description: 'Security anomaly: credential misuse, signature failure, or unexpected endpoint.',
    runbook: 'docs/runbooks/sre/security-incident.md',
  },
  VAULT_ACCESS_ANOMALY: {
    severity: 'SEV1',
    description: 'Personal Data Vault or evidence access violated the expected policy envelope.',
    runbook: 'docs/runbooks/sre/data-privacy-incident.md',
  },
});

export function productizationAlerts(): readonly ProductizationAlert[] {
  return Object.freeze(
    PRODUCTIZATION_ALERT_CODES.map((code) => {
      const row = TABLE[code];
      return Object.freeze({
        code,
        severity: row.severity,
        description: row.description,
        runbookRef: row.runbook,
        autoExecute: false,
      });
    }),
  );
}

export function productizationAlert(code: ProductizationAlertCode): ProductizationAlert {
  const found = productizationAlerts().find((row) => row.code === code);
  if (!found) {
    throw new Error(`unknown productization alert ${code}`);
  }
  return found;
}

export function evaluateProductizationAlerts(input: {
  readonly apiAvailable: boolean;
  readonly databaseHealthy: boolean;
  readonly errorRateBps: bigint;
  readonly queueDepth: bigint;
  readonly ledgerPostFailure: boolean;
  readonly providerHealthy: boolean;
  readonly reconciliationBreaks: bigint;
  readonly treasuryLiquidityWarning: boolean;
  readonly exchangeHalted: boolean;
  readonly chainStalled: boolean;
  readonly validatorLoss: boolean;
  readonly walletBacklog: bigint;
  readonly agentHealthy: boolean;
  readonly securityAnomaly: boolean;
  readonly vaultAccessAnomaly: boolean;
}): readonly ProductizationAlert[] {
  const fired: ProductizationAlert[] = [];
  if (!input.apiAvailable) fired.push(productizationAlert('API_OUTAGE'));
  if (!input.databaseHealthy) fired.push(productizationAlert('DATABASE_FAILURE'));
  if (input.errorRateBps > 500n) fired.push(productizationAlert('HIGH_ERRORS'));
  if (input.queueDepth > 100n) fired.push(productizationAlert('QUEUE_BACKLOG'));
  if (input.ledgerPostFailure) fired.push(productizationAlert('LEDGER_POSTING_FAILURE'));
  if (!input.providerHealthy) fired.push(productizationAlert('PROVIDER_OUTAGE'));
  if (input.reconciliationBreaks > 0n) fired.push(productizationAlert('RECONCILIATION_BREAK_SPIKE'));
  if (input.treasuryLiquidityWarning) fired.push(productizationAlert('TREASURY_LIQUIDITY_WARNING'));
  if (input.exchangeHalted) fired.push(productizationAlert('EXCHANGE_HALT_FAILURE'));
  if (input.chainStalled) fired.push(productizationAlert('CHAIN_STALL'));
  if (input.validatorLoss) fired.push(productizationAlert('VALIDATOR_LOSS'));
  if (input.walletBacklog > 25n) fired.push(productizationAlert('WALLET_BACKLOG'));
  if (!input.agentHealthy) fired.push(productizationAlert('AGENT_MODEL_FAILURE'));
  if (input.securityAnomaly) fired.push(productizationAlert('SECURITY_ANOMALY'));
  if (input.vaultAccessAnomaly) fired.push(productizationAlert('VAULT_ACCESS_ANOMALY'));
  return Object.freeze(fired);
}

export function mapToExistingAlertEngine(
  engine: AlertEngine,
  alerts: readonly ProductizationAlert[],
  nowUtc: string,
): void {
  for (const alert of alerts) {
    if (alert.code === 'LEDGER_POSTING_FAILURE') {
      engine.fire('LEDGER_IMBALANCE', 'ledger', alert.description, nowUtc);
    } else if (alert.code === 'PROVIDER_OUTAGE') {
      engine.fire('PROVIDER_UNAVAILABLE', 'provider', alert.description, nowUtc);
    } else if (alert.code === 'QUEUE_BACKLOG') {
      engine.fire('OUTBOX_BACKLOG', 'events', alert.description, nowUtc);
    } else if (alert.code === 'CHAIN_STALL') {
      engine.fire('CONSENSUS_FINALITY_DELAY', 'chain', alert.description, nowUtc);
    } else if (alert.code === 'SECURITY_ANOMALY') {
      engine.fire('CREDENTIAL_MISUSE', 'security', alert.description, nowUtc);
    }
  }
}
