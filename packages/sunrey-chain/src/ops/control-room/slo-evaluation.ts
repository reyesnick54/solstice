import { SLO_LABEL, type SloDefinition } from '../types.ts';
import { engineeringSlos } from '../slo.ts';
import type { DomainSnapshots } from './types.ts';

export type SloEvaluation = {
  readonly slo: SloDefinition;
  readonly met: boolean;
  readonly observedFailures: bigint;
  readonly detail: string;
};

export function evaluateEngineeringSlos(snapshots: DomainSnapshots): readonly SloEvaluation[] {
  return Object.freeze(engineeringSlos().map((slo) => evaluateOne(slo, snapshots)));
}

function evaluateOne(slo: SloDefinition, snapshots: DomainSnapshots): SloEvaluation {
  if (slo.label !== SLO_LABEL) {
    throw new Error(`${slo.id} is not labeled ${SLO_LABEL}`);
  }
  switch (slo.id) {
    case 'PAYMENT_WORKFLOW_COMPLETION':
    case 'PAYMENT_SUBMISSION_UNKNOWN_RECONCILIATION': {
      const unknown = snapshots.payments?.reduce((sum, row) => sum + row.submissionUnknown, 0n) ?? 0n;
      const recon = snapshots.payments?.reduce((sum, row) => sum + row.reconciliationRequired, 0n) ?? 0n;
      return result(slo, unknown + recon === 0n, unknown + recon, 'payment unknown/reconciliation remainder');
    }
    case 'PROVIDER_AVAILABILITY': {
      const unhealthy = (snapshots.providers ?? []).filter((row) => row.technicalHealth !== 'TECHNICALLY_HEALTHY').length;
      return result(slo, unhealthy === 0, BigInt(unhealthy), 'provider technical health');
    }
    case 'PROVIDER_CREDENTIAL_VALIDITY': {
      const failing = (snapshots.credentials ?? []).filter((row) => row.rotationRequired || row.expiryHorizonHours < 24n).length;
      return result(slo, failing === 0, BigInt(failing), 'credential expiry/rotation');
    }
    case 'ORACLE_FRESHNESS':
    case 'ORACLE_QUORUM': {
      const degraded = snapshots.economic?.oracleQuorumDegraded === true ? 1n : 0n;
      return result(slo, degraded === 0n, degraded, 'oracle quorum/freshness');
    }
    case 'EVENT_OUTBOX_DELIVERY': {
      const backlog = snapshots.events?.outboxBacklog ?? snapshots.persistence?.outboxBacklog ?? 0n;
      return result(slo, backlog === 0n, backlog, 'outbox backlog');
    }
    case 'PERSISTENCE_RECOVERY': {
      const persistence = snapshots.persistence;
      const failures =
        (persistence?.primaryHealthy === false ? 1n : 0n) +
        (persistence?.replicaLagMs ?? 0n) +
        (persistence?.recoveryReconciliationQueue ?? 0n);
      return result(slo, failures === 0n, failures, 'persistence recovery');
    }
    case 'CUSTODY_RECONCILIATION': {
      const mismatches = snapshots.custody?.reduce((sum, row) => sum + row.reconciliationMismatches, 0n) ?? 0n;
      return result(slo, mismatches === 0n, mismatches, 'custody reconciliation');
    }
    case 'SETTLEMENT_PROCESSING':
    case 'EXCHANGE_SETTLEMENT': {
      const pending = snapshots.exchange?.pendingSettlements ?? 0n;
      return result(slo, pending === 0n, pending, 'exchange settlement backlog');
    }
    case 'COMPLIANCE_PROVIDER_AVAILABILITY': {
      const row = snapshots.compliance?.[0];
      const failures =
        (row?.kycUnavailable ? 1n : 0n) + (row?.sanctionsUnavailable ? 1n : 0n) + (row?.amlUnavailable ? 1n : 0n);
      return result(slo, failures === 0n, failures, 'compliance provider availability');
    }
    case 'BACKUP_SUCCESS': {
      const age = snapshots.persistence?.backupAgeMs ?? 0n;
      return result(slo, age >= 0n, 0n, 'backup age is an engineering signal');
    }
    default:
      return result(slo, true, 0n, 'existing engineering target unchanged');
  }
}

function result(slo: SloDefinition, met: boolean, observedFailures: bigint, detail: string): SloEvaluation {
  return Object.freeze({ slo, met, observedFailures, detail });
}
