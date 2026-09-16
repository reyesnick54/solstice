import type { HeliosMetricsSnapshot } from './execution-types.ts';
import type { InMemoryHeliosWorkStore } from './execution-store.ts';

export function collectHeliosMetrics(store: InMemoryHeliosWorkStore, now: string): HeliosMetricsSnapshot {
  const snapshot = store.snapshot();
  const tasks = snapshot.tasks;
  const queueDepth = tasks.filter((row) => row.state === 'QUEUED' || row.state === 'CLAIMABLE').length;
  const activeLeases = tasks.filter((row) => row.state === 'RUNNING' && row.lease).length;
  const expiredLeases = tasks.filter(
    (row) => row.state === 'RUNNING' && row.lease && row.lease.expiresAt <= now,
  ).length;
  const retryCount = tasks.reduce((sum, row) => sum + row.retry.attemptCount, 0);
  const taskSuccessCount = tasks.filter((row) => row.state === 'COMPLETED').length;
  const taskFailureCount = tasks.filter(
    (row) => row.state === 'PERMANENTLY_FAILED' || row.state === 'RETRYABLE_FAILURE',
  ).length;
  const budgetReservations = snapshot.reservations.filter((row) => row.state === 'ACTIVE').length;
  const researchSpendTotal = snapshot.spendRecords
    .reduce((sum, row) => {
      const amount = row.actualAmount ?? row.estimatedAmount ?? '0';
      return sum + BigInt(amount);
    }, 0n)
    .toString();
  const budgetExhaustionCount = snapshot.workOrders.filter((row) => row.state === 'BLOCKED_BUDGET').length;
  const cancelledWorkCount = tasks.filter((row) => row.state === 'CANCELLED').length;
  const blockedAuthorityCount = snapshot.workOrders.filter((row) => row.state === 'BLOCKED_AUTHORITY').length;
  return Object.freeze({
    queueDepth,
    activeLeases,
    expiredLeases,
    retryCount,
    taskSuccessCount,
    taskFailureCount,
    budgetReservations,
    researchSpendTotal,
    budgetExhaustionCount,
    cancelledWorkCount,
    blockedAuthorityCount,
  });
}
