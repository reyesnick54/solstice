import type { PseudonymousJoinKeyId } from './ids.ts';
import type {
  AuthorizationSnapshot,
  CleanRoomComputationReceipt,
  CleanRoomJob,
  CleanRoomSession,
  CleanRoomStoreSnapshot,
  ContributionComputationReference,
  DatasetLineage,
  EgressRecord,
  QueryBudget,
} from './types.ts';

export class CleanRoomStore {
  private readonly sessions = new Map<string, CleanRoomSession>();
  private readonly jobs = new Map<string, CleanRoomJob>();
  private readonly snapshots = new Map<string, AuthorizationSnapshot>();
  private readonly budgets = new Map<string, QueryBudget>();
  private readonly egress: EgressRecord[] = [];
  private readonly receipts = new Map<string, CleanRoomComputationReceipt>();
  private readonly contributions = new Map<string, ContributionComputationReference>();
  private readonly lineage: DatasetLineage[] = [];
  private readonly joinMetadata: CleanRoomStoreSnapshot['joinMetadata'][number][] = [];
  private readonly sessionIdempotency = new Map<string, string>();
  private readonly fingerprints = new Map<string, Set<string>>();

  putSession(session: CleanRoomSession): void {
    this.sessions.set(session.sessionId, session);
  }
  getSession(id: string): CleanRoomSession | undefined {
    return this.sessions.get(id);
  }
  putJob(job: CleanRoomJob): void {
    this.jobs.set(job.jobId, job);
  }
  getJob(id: string): CleanRoomJob | undefined {
    return this.jobs.get(id);
  }
  jobsForSession(sessionId: string): readonly CleanRoomJob[] {
    return Object.freeze([...this.jobs.values()].filter((job) => job.sessionId === sessionId));
  }
  putSnapshot(snapshot: AuthorizationSnapshot): void {
    this.snapshots.set(snapshot.snapshotId, snapshot);
  }
  getSnapshot(id: string): AuthorizationSnapshot | undefined {
    return this.snapshots.get(id);
  }
  putBudget(budget: QueryBudget): void {
    this.budgets.set(budget.sessionId, budget);
  }
  getBudget(sessionId: string): QueryBudget | undefined {
    return this.budgets.get(sessionId);
  }
  putEgress(record: EgressRecord): void {
    this.egress.push(record);
  }
  putReceipt(receipt: CleanRoomComputationReceipt): void {
    this.receipts.set(receipt.receiptId, receipt);
  }
  getReceipt(id: string): CleanRoomComputationReceipt | undefined {
    return this.receipts.get(id);
  }
  putContribution(ref: ContributionComputationReference): void {
    this.contributions.set(ref.contributionId, ref);
  }
  contributionKey(subjectId: string, receiptId: string, assets: readonly string[]): string {
    return `${subjectId}:${receiptId}:${[...assets].sort().join(',')}`;
  }
  hasContribution(subjectId: string, receiptId: string, assets: readonly string[]): boolean {
    return [...this.contributions.values()].some(
      (row) => this.contributionKey(row.subjectId, row.receiptId, row.participatingAssetRefs) === this.contributionKey(subjectId, receiptId, assets),
    );
  }
  listContributions(): readonly ContributionComputationReference[] {
    return Object.freeze([...this.contributions.values()]);
  }
  putLineage(lineage: DatasetLineage): void {
    this.lineage.push(lineage);
  }
  rememberSession(key: string, sessionId: string): void {
    this.sessionIdempotency.set(key, sessionId);
  }
  sessionForKey(key: string): string | undefined {
    return this.sessionIdempotency.get(key);
  }
  rememberFingerprint(sessionId: string, fingerprint: string): void {
    const set = this.fingerprints.get(sessionId) ?? new Set<string>();
    set.add(fingerprint);
    this.fingerprints.set(sessionId, set);
  }
  fingerprintsFor(sessionId: string): ReadonlySet<string> {
    return this.fingerprints.get(sessionId) ?? new Set();
  }
  putJoinMetadata(row: {
    readonly joinKeyId: PseudonymousJoinKeyId;
    readonly requesterId: import('./ids.ts').CleanRoomRequesterId;
    readonly purposeId: import('../../consent/src/ids.ts').PurposeId;
    readonly createdAt: import('../../domain/src/time.ts').UtcInstant;
  }): void {
    this.joinMetadata.push(row);
  }

  snapshot(): CleanRoomStoreSnapshot {
    return Object.freeze({
      sessions: Object.freeze([...this.sessions.values()]),
      jobs: Object.freeze([...this.jobs.values()]),
      snapshots: Object.freeze([...this.snapshots.values()]),
      budgets: Object.freeze([...this.budgets.values()]),
      egress: Object.freeze([...this.egress]),
      receipts: Object.freeze([...this.receipts.values()]),
      contributions: Object.freeze([...this.contributions.values()]),
      lineage: Object.freeze([...this.lineage]),
      joinMetadata: Object.freeze([...this.joinMetadata]),
      sessionIdempotency: Object.freeze(Object.fromEntries(this.sessionIdempotency)),
    });
  }

  restore(state: CleanRoomStoreSnapshot): void {
    this.sessions.clear();
    this.jobs.clear();
    this.snapshots.clear();
    this.budgets.clear();
    this.egress.length = 0;
    this.receipts.clear();
    this.contributions.clear();
    this.lineage.length = 0;
    this.joinMetadata.length = 0;
    this.sessionIdempotency.clear();
    this.fingerprints.clear();
    for (const session of state.sessions) this.putSession(session);
    for (const job of state.jobs) this.putJob(job);
    for (const snapshot of state.snapshots) this.putSnapshot(snapshot);
    for (const budget of state.budgets) this.putBudget(budget);
    for (const row of state.egress) this.putEgress(row);
    for (const receipt of state.receipts) this.putReceipt(receipt);
    for (const ref of state.contributions) this.putContribution(ref);
    for (const row of state.lineage) this.putLineage(row);
    for (const row of state.joinMetadata) this.putJoinMetadata(row);
    for (const [key, value] of Object.entries(state.sessionIdempotency)) this.rememberSession(key, value);
  }
}
