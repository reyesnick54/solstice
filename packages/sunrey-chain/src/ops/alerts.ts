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
