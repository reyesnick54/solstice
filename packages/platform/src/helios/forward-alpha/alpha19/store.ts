import { HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA } from './taxonomy.ts';
import type {
  MaturedOutcome,
  OutcomeEvidenceUpdateRecord,
  OutcomeMaturityQueueState,
  OutcomeMaturitySchedule,
  PendingOutcome,
} from './types.ts';

export class OutcomeMaturityQueueStore {
  private state: OutcomeMaturityQueueState;

  constructor(schedule: OutcomeMaturitySchedule) {
    this.state = Object.freeze({
      schema: HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
      campaignId: schedule.campaignId,
      schedule,
      pending: Object.freeze([]),
      matured: Object.freeze([]),
      evidenceUpdates: Object.freeze([]),
      grantsExecutionAuthority: false as const,
    });
  }

  getState(): OutcomeMaturityQueueState {
    return this.state;
  }

  listPending(): readonly PendingOutcome[] {
    return this.state.pending;
  }

  getPending(pendingId: string): PendingOutcome | undefined {
    return this.state.pending.find((row) => row.pendingId === pendingId);
  }

  listMaturedForDecision(decisionId: string): readonly MaturedOutcome[] {
    return this.state.matured.filter((row) => row.decisionId === decisionId);
  }

  enqueue(pending: PendingOutcome): void {
    const existing = this.getPending(pending.pendingId);
    if (existing !== undefined) {
      if (existing.binding.sealedContentHash !== pending.binding.sealedContentHash) {
        throw new Error('OUTCOME_MATURITY_SEALED_BINDING_MUTATION');
      }
      return;
    }
    this.state = Object.freeze({
      ...this.state,
      pending: Object.freeze([...this.state.pending, pending]),
    });
  }

  replacePending(next: PendingOutcome): void {
    const existing = this.getPending(next.pendingId);
    if (existing === undefined) {
      throw new Error('OUTCOME_MATURITY_UNKNOWN_PENDING');
    }
    if (existing.binding.sealedContentHash !== next.binding.sealedContentHash) {
      throw new Error('OUTCOME_MATURITY_SEALED_BINDING_MUTATION');
    }
    if (existing.status === 'MATURED' && next.status !== 'MATURED') {
      throw new Error('OUTCOME_MATURITY_IMMUTABLE_MATURED');
    }
    this.state = Object.freeze({
      ...this.state,
      pending: Object.freeze(this.state.pending.map((row) => (row.pendingId === next.pendingId ? next : row))),
    });
  }

  attachMatured(outcome: MaturedOutcome, update: OutcomeEvidenceUpdateRecord): void {
    if (this.state.matured.some((row) => row.maturedOutcomeId === outcome.maturedOutcomeId)) {
      return;
    }
    this.state = Object.freeze({
      ...this.state,
      matured: Object.freeze([...this.state.matured, outcome]),
      evidenceUpdates: Object.freeze([...this.state.evidenceUpdates, update]),
    });
  }

  rehydrate(persisted: OutcomeMaturityQueueState): void {
    for (const row of persisted.pending) {
      const local = this.getPending(row.pendingId);
      if (local !== undefined && local.binding.sealedContentHash !== row.binding.sealedContentHash) {
        throw new Error('OUTCOME_MATURITY_SEALED_BINDING_MUTATION');
      }
    }
    this.state = persisted;
  }
}
