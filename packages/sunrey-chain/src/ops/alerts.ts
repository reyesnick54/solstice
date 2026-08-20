import {
  ALERT_CODES,
  type AlertCode,
  type AlertDefinition,
  type AlertSeverity,
  type FiredAlert,
} from './types.ts';

const DEFINITIONS: readonly AlertDefinition[] = Object.freeze(
  ALERT_CODES.map((code) => definitionFor(code)),
);

function definitionFor(code: AlertCode): AlertDefinition {
  const table: Record<AlertCode, { readonly severity: AlertSeverity; readonly description: string }> = {
    CONSENSUS_FINALITY_DELAY: {
      severity: 'CRITICAL',
      description: 'Finality latency exceeded the engineering test target.',
    },
    VALIDATOR_MISSED_VOTES: {
      severity: 'HIGH',
      description: 'A validator missed consecutive votes.',
    },
    VALIDATOR_SIGNER_UNAVAILABLE: {
      severity: 'CRITICAL',
      description: 'The active validator signer did not respond.',
    },
    VALIDATOR_PEER_ISOLATION: {
      severity: 'HIGH',
      description: 'Validator peer count dropped below the isolation threshold.',
    },
    RPC_HIGH_ERROR_RATE: {
      severity: 'HIGH',
      description: 'RPC error rate exceeded the engineering test target.',
    },
    DISK_LOW: {
      severity: 'WARNING',
      description: 'Free disk on a node is below the engineering reserve.',
    },
    EXPLORER_LAG: {
      severity: 'WARNING',
      description: 'Explorer index height lagged finalized height.',
    },
    ORACLE_QUORUM_UNAVAILABLE: {
      severity: 'HIGH',
      description: 'Oracle observation quorum is unavailable.',
    },
    CUSTODY_RECONCILIATION_MISMATCH: {
      severity: 'CRITICAL',
      description: 'Custody metadata does not match finalized chain holdings.',
    },
    EXCHANGE_SETTLEMENT_BACKLOG: {
      severity: 'HIGH',
      description: 'Pending exchange settlements exceeded the engineering backlog.',
    },
    INTEROP_CLIENT_EXPIRING: {
      severity: 'WARNING',
      description: 'An interop light client is approaching expiry.',
    },
    OUTBOX_BACKLOG: {
      severity: 'HIGH',
      description: 'Event outbox backlog exceeded the engineering drain target.',
    },
    CREDENTIAL_EXPIRY: {
      severity: 'WARNING',
      description: 'A provider credential is approaching the engineering expiry horizon.',
    },
    ORACLE_QUORUM_DEGRADATION: {
      severity: 'HIGH',
      description: 'Oracle quorum is degraded below the engineering freshness target.',
    },
    SUPPLY_RECONCILIATION: {
      severity: 'CRITICAL',
      description: 'Native supply reconciliation does not match the monetary constitution book.',
    },
    PAYMENT_SUBMISSION_UNKNOWN: {
      severity: 'HIGH',
      description: 'Payment submissions entered SUBMISSION_UNKNOWN and require reconciliation.',
    },
    FAST_ERROR_BUDGET_BURN: {
      severity: 'CRITICAL',
      description: 'Engineering error budget is burning at a fast rate.',
    },
    SLOW_ERROR_BUDGET_BURN: {
      severity: 'WARNING',
      description: 'Engineering error budget is burning at a slow sustained rate.',
    },
    PROVIDER_UNAVAILABLE: {
      severity: 'HIGH',
      description: 'A provider-candidate adapter is technically unavailable.',
    },
    AI_AUTHORITY_ATTEMPT: {
      severity: 'HIGH',
      description: 'An AI proposal attempted a forbidden authority, mint, or production action.',
    },
    LEDGER_IMBALANCE: {
      severity: 'CRITICAL',
      description: 'A ledger imbalance invariant failed. Balances are not auto-corrected.',
    },
    CREDENTIAL_MISUSE: {
      severity: 'CRITICAL',
      description: 'A credential scope, leak-guard, or resolution failure was observed.',
    },
  };
  const row = table[code];
  return Object.freeze({
    code,
    severity: row.severity,
    description: row.description,
    operatorActionRef: `docs/operations/alerts.md#${code.toLowerCase()}`,
  });
}

export function alertDefinitions(): readonly AlertDefinition[] {
  return DEFINITIONS;
}

export function alertDefinition(code: AlertCode): AlertDefinition {
  const found = DEFINITIONS.find((row) => row.code === code);
  if (!found) {
    throw new Error(`unknown alert ${code}`);
  }
  return found;
}

export class AlertEngine {
  readonly #fired: FiredAlert[] = [];

  fire(code: AlertCode, componentId: string, details: string, nowUtc: string): FiredAlert {
    const def = alertDefinition(code);
    const alert: FiredAlert = Object.freeze({
      ...def,
      firedAtUtc: nowUtc,
      componentId,
      details,
    });
    this.#fired.push(alert);
    return alert;
  }

  active(): readonly FiredAlert[] {
    return this.#fired.slice();
  }

  codes(): readonly AlertCode[] {
    return this.#fired.map((row) => row.code);
  }

  has(code: AlertCode): boolean {
    return this.#fired.some((row) => row.code === code);
  }
}
