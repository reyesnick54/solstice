import type {
  BrokerStatementSnapshot,
  CustodyStatementSnapshot,
  Exec12ExecutionRestriction,
  Exec12ReconciliationBreak,
  Exec12ReconciliationStoreSnapshot,
  Exec12ThreeWayReconciliationRun,
  ExecutionDropCopyEvent,
} from './types.ts';
import type { ExecutionDropCopyEventId } from './ids.ts';

export class InMemoryExec12ReconciliationStore {
  private readonly dropCopyById = new Map<ExecutionDropCopyEventId, ExecutionDropCopyEvent>();
  private readonly dropCopyDedupe = new Set<string>();
  private readonly brokerSnapshots: BrokerStatementSnapshot[] = [];
  private readonly custodySnapshots: CustodyStatementSnapshot[] = [];
  private readonly runs: Exec12ThreeWayReconciliationRun[] = [];
  private readonly breaks: Exec12ReconciliationBreak[] = [];
  private readonly restrictions = new Map<string, Exec12ExecutionRestriction>();

  putDropCopyEvent(event: ExecutionDropCopyEvent, dedupeHit: boolean): void {
    this.dropCopyById.set(event.eventId, event);
    if (!dedupeHit) {
      this.dropCopyDedupe.add(event.dedupeKey);
    }
  }

  hasDedupeKey(key: string): boolean {
    return this.dropCopyDedupe.has(key);
  }

  dropCopyEvents(): readonly ExecutionDropCopyEvent[] {
    return Object.freeze([...this.dropCopyById.values()]);
  }

  putBrokerSnapshot(snapshot: BrokerStatementSnapshot): void {
    this.brokerSnapshots.push(snapshot);
  }

  latestBrokerSnapshot(brokerAccountId: string): BrokerStatementSnapshot | null {
    const rows = this.brokerSnapshots.filter((row) => row.brokerAccountId === brokerAccountId);
    return rows.length > 0 ? rows[rows.length - 1]! : null;
  }

  putCustodySnapshot(snapshot: CustodyStatementSnapshot): void {
    this.custodySnapshots.push(snapshot);
  }

  latestCustodySnapshot(custodyAccountId: string): CustodyStatementSnapshot | null {
    const rows = this.custodySnapshots.filter((row) => row.custodyAccountId === custodyAccountId);
    return rows.length > 0 ? rows[rows.length - 1]! : null;
  }

  putRun(run: Exec12ThreeWayReconciliationRun): void {
    this.runs.push(run);
  }

  putBreaks(breaks: readonly Exec12ReconciliationBreak[]): void {
    this.breaks.push(...breaks);
  }

  openBreaks(accountId: string): readonly Exec12ReconciliationBreak[] {
    return Object.freeze(this.breaks.filter((row) => row.accountId === accountId));
  }

  putRestriction(restriction: Exec12ExecutionRestriction): void {
    this.restrictions.set(`${restriction.customerId}:${restriction.accountId}`, restriction);
  }

  getRestriction(customerId: string, accountId: string): Exec12ExecutionRestriction | null {
    return this.restrictions.get(`${customerId}:${accountId}`) ?? null;
  }

  snapshot(): Exec12ReconciliationStoreSnapshot {
    return Object.freeze({
      dropCopyEvents: Object.freeze([...this.dropCopyById.values()]),
      brokerSnapshots: Object.freeze([...this.brokerSnapshots]),
      custodySnapshots: Object.freeze([...this.custodySnapshots]),
      runs: Object.freeze([...this.runs]),
      breaks: Object.freeze([...this.breaks]),
      restrictions: Object.freeze([...this.restrictions.values()]),
    });
  }
}
