import type { Clock } from '@solstice/config';
import type { EvidenceVault } from '@solstice/evidence';

import { sealExec12Evidence } from './evidence.ts';
import { materializeExecutionDropCopyEvent, type IngestDropCopyInput } from './ingest.ts';
import { runExec12ThreeWayReconciliation } from './reconciliation.ts';
import { deriveExec12ExecutionRestriction, executionPermitted } from './restrictions.ts';
import { InMemoryExec12ReconciliationStore } from './store.ts';
import type {
  BrokerStatementSnapshot,
  CustodyStatementSnapshot,
  Exec12CanonicalAccountView,
  Exec12ThreeWayReconciliationRun,
  ExecutionDropCopyEvent,
} from './types.ts';

export type HeliosExec12ReconciliationPorts = {
  readonly clock: Clock;
  readonly evidence: EvidenceVault;
};

/**
 * EXEC12 orchestration — drop-copy ingest and three-way reconciliation.
 * Does not mutate canonical order lifecycle or ledger records.
 */
export class HeliosExec12ReconciliationService {
  readonly store = new InMemoryExec12ReconciliationStore();
  private readonly ports: HeliosExec12ReconciliationPorts;

  constructor(ports: HeliosExec12ReconciliationPorts) {
    this.ports = ports;
  }

  ingestDropCopy(input: Omit<IngestDropCopyInput, 'now'>): ExecutionDropCopyEvent | null {
    if (this.store.hasDedupeKey(input.dedupeKey)) {
      const event = materializeExecutionDropCopyEvent({
        ...input,
        now: this.ports.clock.now(),
      });
      this.store.putDropCopyEvent(event, true);
      return null;
    }
    const event = materializeExecutionDropCopyEvent({
      ...input,
      now: this.ports.clock.now(),
    });
    this.store.putDropCopyEvent(event, false);
    sealExec12Evidence(this.ports.evidence, 'HELIOS_EXEC12_DROP_COPY_INGESTED', {
      eventId: event.eventId,
      ingestKind: event.ingestKind,
      dedupeKey: event.dedupeKey,
    });
    return event;
  }

  recordBrokerSnapshot(snapshot: BrokerStatementSnapshot): void {
    this.store.putBrokerSnapshot(snapshot);
    sealExec12Evidence(this.ports.evidence, 'HELIOS_EXEC12_BROKER_STATEMENT_SNAPSHOT', {
      snapshotId: snapshot.snapshotId,
      accountId: snapshot.brokerAccountId,
    });
  }

  recordCustodySnapshot(snapshot: CustodyStatementSnapshot): void {
    this.store.putCustodySnapshot(snapshot);
    sealExec12Evidence(this.ports.evidence, 'HELIOS_EXEC12_CUSTODY_STATEMENT_SNAPSHOT', {
      snapshotId: snapshot.snapshotId,
      accountId: snapshot.custodyAccountId,
    });
  }

  reconcileThreeWay(input: {
    readonly canonical: Exec12CanonicalAccountView;
    readonly broker: BrokerStatementSnapshot | null;
    readonly custody: CustodyStatementSnapshot | null;
  }): Exec12ThreeWayReconciliationRun {
    const now = this.ports.clock.now();
    const { run, breaks } = runExec12ThreeWayReconciliation({
      canonical: input.canonical,
      broker: input.broker,
      custody: input.custody,
      now,
      sealBreakEvidence: (kind, detail) => sealExec12Evidence(this.ports.evidence, kind, detail),
      sealRunEvidence: (detail) => sealExec12Evidence(this.ports.evidence, 'HELIOS_EXEC12_RECONCILIATION_RUN', detail),
    });
    this.store.putRun(run);
    this.store.putBreaks(breaks);

    const restriction = deriveExec12ExecutionRestriction({
      customerId: input.canonical.customerId,
      accountId: input.canonical.accountId,
      breaks,
      now,
      evidenceRef: sealExec12Evidence(this.ports.evidence, 'HELIOS_EXEC12_EXECUTION_RESTRICTION', {
        accountId: input.canonical.accountId,
        restricted: breaks.length > 0,
      }),
    });
    this.store.putRestriction(restriction);

    return run;
  }

  reconcileLatestStatements(canonical: Exec12CanonicalAccountView): Exec12ThreeWayReconciliationRun {
    const broker = this.store.latestBrokerSnapshot(canonical.accountId);
    const custody = this.store.latestCustodySnapshot(canonical.accountId);
    return this.reconcileThreeWay({
      canonical,
      broker,
      custody,
    });
  }

  executionRestricted(customerId: string, accountId: string): boolean {
    const restriction = this.store.getRestriction(customerId, accountId);
    return !executionPermitted(restriction);
  }
}
