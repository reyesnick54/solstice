/**
 * Safe structured diagnostics for persistence failures.
 * Never log secrets, HMAC material, full customer records, or raw payloads.
 */

export type PersistenceDiagnostic = {
  readonly level: 'info' | 'error';
  readonly code: string;
  readonly domain: 'customer' | 'ledger' | 'evidence' | 'security' | 'migrator' | 'bootstrap';
  readonly message: string;
  readonly correlationId?: string;
  readonly journalId?: string;
  readonly accountId?: string;
  readonly customerId?: string;
  readonly intentId?: string;
  readonly evidenceId?: string;
  readonly migrationVersion?: number;
};

export function persistenceDiagnostic(input: PersistenceDiagnostic): PersistenceDiagnostic {
  return Object.freeze({ ...input });
}

export function formatPersistenceDiagnostic(event: PersistenceDiagnostic): string {
  const parts = [
    `code=${event.code}`,
    `domain=${event.domain}`,
    `message=${event.message}`,
  ];
  if (event.correlationId) parts.push(`correlationId=${event.correlationId}`);
  if (event.journalId) parts.push(`journalId=${event.journalId}`);
  if (event.accountId) parts.push(`accountId=${event.accountId}`);
  if (event.customerId) parts.push(`customerId=${event.customerId}`);
  if (event.intentId) parts.push(`intentId=${event.intentId}`);
  if (event.evidenceId) parts.push(`evidenceId=${event.evidenceId}`);
  if (event.migrationVersion !== undefined) {
    parts.push(`migrationVersion=${String(event.migrationVersion)}`);
  }
  return `sunrey.persistence ${parts.join(' ')}`;
}

export function logPersistenceEvent(event: PersistenceDiagnostic): void {
  const line = formatPersistenceDiagnostic(event);
  if (event.level === 'error') {
    console.error(line);
  } else {
    console.info(line);
  }
}
