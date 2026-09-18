/**
 * HELIOS H33 — correctness invariants verified under load.
 */

import type { CapacityInvariantResult } from './types.ts';
import type { CustomerIsolationResult } from './types.ts';
import type { PortfolioInteractionResult } from './types.ts';
import type { BackpressureResult } from './types.ts';

export function verifyCapacityInvariants(input: {
  readonly portfolioInteractions: readonly PortfolioInteractionResult[];
  readonly customerIsolation: CustomerIsolationResult;
  readonly backpressure: readonly BackpressureResult[];
  readonly duplicateOperationCount: number;
  readonly unbalancedLedgerCount: number;
  readonly staleAuthorizationAccepted: number;
  readonly unsafeProviderRetries: number;
  readonly lostFillCount: number;
}): readonly CapacityInvariantResult[] {
  const results: CapacityInvariantResult[] = [];

  const noOverspend = input.portfolioInteractions.every((row) => row.passed);
  results.push(
    Object.freeze({
      name: 'no_overspending',
      passed: noOverspend,
      detail: noOverspend
        ? 'portfolio interactions stayed within available capital'
        : 'one or more portfolio scenarios over-allocated capital',
    }),
  );

  results.push(
    Object.freeze({
      name: 'no_duplicate_operation',
      passed: input.duplicateOperationCount === 0,
      detail:
        input.duplicateOperationCount === 0
          ? 'no duplicate financial operations observed'
          : `${input.duplicateOperationCount} duplicate operations detected`,
    }),
  );

  results.push(
    Object.freeze({
      name: 'no_customer_crossing',
      passed: input.customerIsolation.passed,
      detail: input.customerIsolation.passed
        ? `isolation held across ${input.customerIsolation.customersTested} customers`
        : [
            ...input.customerIsolation.crossCustomerLeaks,
            ...input.customerIsolation.proposalLeakage,
          ].join('; '),
    }),
  );

  results.push(
    Object.freeze({
      name: 'no_lost_fill',
      passed: input.lostFillCount === 0,
      detail:
        input.lostFillCount === 0 ? 'all simulated fills accounted for' : `${input.lostFillCount} lost fills`,
    }),
  );

  results.push(
    Object.freeze({
      name: 'no_unbalanced_ledger',
      passed: input.unbalancedLedgerCount === 0,
      detail:
        input.unbalancedLedgerCount === 0
          ? 'ledger remained balanced under load'
          : `${input.unbalancedLedgerCount} unbalanced ledger states`,
    }),
  );

  results.push(
    Object.freeze({
      name: 'no_stale_authorization_accepted',
      passed: input.staleAuthorizationAccepted === 0,
      detail:
        input.staleAuthorizationAccepted === 0
          ? 'stale authorizations rejected'
          : `${input.staleAuthorizationAccepted} stale authorizations accepted`,
    }),
  );

  results.push(
    Object.freeze({
      name: 'no_unsafe_provider_retry',
      passed: input.unsafeProviderRetries === 0,
      detail:
        input.unsafeProviderRetries === 0
          ? 'provider retries stayed within safe bounds'
          : `${input.unsafeProviderRetries} unsafe provider retries`,
    }),
  );

  const backpressureSafe = input.backpressure.every(
    (row) => row.droppedFinancialTasks === 0 && row.duplicateRequests === 0 && row.bypassedControls === 0,
  );
  results.push(
    Object.freeze({
      name: 'backpressure_safe_degradation',
      passed: backpressureSafe,
      detail: backpressureSafe
        ? 'queues degraded by queueing/rejection without dropping financial tasks'
        : 'unsafe backpressure behavior detected',
    }),
  );

  return Object.freeze(results);
}

export function allInvariantsPassed(invariants: readonly CapacityInvariantResult[]): boolean {
  return invariants.every((row) => row.passed);
}
