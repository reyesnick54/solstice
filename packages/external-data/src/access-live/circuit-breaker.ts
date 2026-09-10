/**
 * Per-provider circuit breaker for live HTTP adapters.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerOptions = {
  readonly failureThreshold: number;
  readonly resetMs: number;
};

const DEFAULT_OPTIONS: CircuitBreakerOptions = Object.freeze({
  failureThreshold: 5,
  resetMs: 60_000,
});

type CircuitRecord = {
  state: CircuitState;
  failures: number;
  openedAtMs: number | null;
};

const circuits = new Map<string, CircuitRecord>();

function record(providerId: string): CircuitRecord {
  let row = circuits.get(providerId);
  if (!row) {
    row = { state: 'CLOSED', failures: 0, openedAtMs: null };
    circuits.set(providerId, row);
  }
  return row;
}

export function circuitAllows(providerId: string, options: CircuitBreakerOptions = DEFAULT_OPTIONS): boolean {
  const row = record(providerId);
  if (row.state === 'CLOSED') return true;
  if (row.state === 'OPEN') {
    if (row.openedAtMs !== null && Date.now() - row.openedAtMs >= options.resetMs) {
      row.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true;
}

export function circuitRecordSuccess(providerId: string): void {
  const row = record(providerId);
  row.state = 'CLOSED';
  row.failures = 0;
  row.openedAtMs = null;
}

export function circuitRecordFailure(
  providerId: string,
  options: CircuitBreakerOptions = DEFAULT_OPTIONS,
): void {
  const row = record(providerId);
  row.failures += 1;
  if (row.failures >= options.failureThreshold) {
    row.state = 'OPEN';
    row.openedAtMs = Date.now();
  }
}

export function resetCircuitBreakers(): void {
  circuits.clear();
}
