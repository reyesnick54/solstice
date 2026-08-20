import type { DomainSnapshots, OperationalIncident, OperationalState } from './types.ts';

export function operationalState(input: {
  readonly snapshots: DomainSnapshots;
  readonly incidents: readonly OperationalIncident[];
  readonly maintenance?: boolean;
}): OperationalState {
  if (input.maintenance) {
    return 'MAINTENANCE';
  }
  if (input.snapshots.financialSafety?.ledgerImbalance || (input.snapshots.economic?.supplyReconciliationMismatches ?? 0n) > 0n) {
    return 'BLOCKED';
  }
  const open = input.incidents.filter((row) => row.status !== 'RESOLVED' && row.status !== 'POSTMORTEM_REQUIRED');
  if (open.some((row) => row.status === 'RECOVERING')) {
    return 'RECOVERY';
  }
  if (open.length > 0) {
    return 'INCIDENT';
  }
  if (degraded(input.snapshots)) {
    return 'DEGRADED';
  }
  return 'NORMAL';
}

function degraded(snapshots: DomainSnapshots): boolean {
  const providerDegraded = (snapshots.providers ?? []).some((row) => row.technicalHealth !== 'TECHNICALLY_HEALTHY');
  const backlog =
    (snapshots.events?.outboxBacklog ?? 0n) > 0n ||
    (snapshots.payments?.some((row) => row.submissionUnknown > 0n) ?? false);
  return providerDegraded || backlog;
}

export function paymentRecoveryConditions(snapshots: DomainSnapshots) {
  const provider = snapshots.providers?.find((row) => row.domain === 'payments');
  const payment = snapshots.payments?.[0];
  return Object.freeze([
    {
      id: 'provider_technically_healthy',
      satisfied: provider?.technicalHealth === 'TECHNICALLY_HEALTHY',
      detail: 'provider technical health is not legal approval',
    },
    {
      id: 'submission_unknown_drained',
      satisfied: (payment?.submissionUnknown ?? 0n) === 0n,
      detail: 'SUBMISSION_UNKNOWN backlog drained',
    },
    {
      id: 'reconciliation_complete',
      satisfied: (payment?.reconciliationRequired ?? 0n) === 0n,
      detail: 'payment reconciliation complete',
    },
  ]);
}
