/**
 * ALPHA19 — enqueue pending outcome jobs; mature only after horizon with chronological observations.
 */

import type { UtcInstant } from '@solstice/domain';
import { err, ok, type Result } from '@solstice/domain';

import type { PrequentialChronologicalObservation } from '../alpha03/types.ts';

import { horizonMsForId } from './horizons.ts';
import { computeOutcomeObservationSlice, sealMaturedOutcome } from './outcome.ts';
import { HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA } from './taxonomy.ts';
import type { OutcomeMaturitySchedule, OutcomeSealedDecisionBinding } from './types.ts';
import type {
  OutcomeEvidenceUpdateRecord,
  OutcomeMaturityEngineFailure,
  OutcomeMaturityQueueState,
  PendingOutcome,
} from './types.ts';
import { buildOutcomeObservationWindow, maturityInstant } from './window.ts';
import { OutcomeMaturityQueueStore } from './store.ts';
import type { CanonicalOutcomeHorizonId } from './taxonomy.ts';

export function createOutcomeMaturityQueueStore(schedule: OutcomeMaturitySchedule): OutcomeMaturityQueueStore {
  return new OutcomeMaturityQueueStore(schedule);
}

function pendingId(decisionId: string, horizonId: CanonicalOutcomeHorizonId): string {
  return `pout_${decisionId}_${horizonId}`;
}

export function enqueuePendingOutcomesForDecision(input: {
  readonly store: OutcomeMaturityQueueStore;
  readonly binding: OutcomeSealedDecisionBinding;
  readonly enqueuedAt: UtcInstant;
}): readonly PendingOutcome[] {
  const schedule = input.store.getState().schedule;
  const created: PendingOutcome[] = [];
  for (const horizonId of schedule.requiredHorizonIds) {
    const window = buildOutcomeObservationWindow({
      decisionTime: input.binding.decisionTime,
      horizonId,
    });
    const pending: PendingOutcome = Object.freeze({
      schema: HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
      pendingId: pendingId(input.binding.decisionId, horizonId),
      binding: input.binding,
      horizonId,
      observationWindow: window,
      maturityAt: maturityInstant(input.binding.decisionTime, horizonMsForId(horizonId)),
      enqueuedAt: input.enqueuedAt,
      status: 'PENDING',
      maturedOutcome: null,
    });
    input.store.enqueue(pending);
    created.push(pending);
  }
  return Object.freeze(created);
}

export type OutcomeMaturityAttemptResult = Readonly<{
  readonly pending: PendingOutcome;
  readonly matured: boolean;
  readonly outcome: import('./types.ts').MaturedOutcome | null;
  readonly evidenceUpdate: OutcomeEvidenceUpdateRecord | null;
}>;

export function attemptMaturePendingOutcome(input: {
  readonly store: OutcomeMaturityQueueStore;
  readonly pendingId: string;
  readonly now: UtcInstant;
  readonly observations: readonly PrequentialChronologicalObservation[];
}): Result<OutcomeMaturityAttemptResult, OutcomeMaturityEngineFailure> {
  const row = input.store.getPending(input.pendingId);
  if (row === undefined) {
    return err({ code: 'NOT_YET_KNOWABLE', message: 'unknown pending outcome' });
  }
  if (row.status === 'MATURED' && row.maturedOutcome !== null) {
    return ok(
      Object.freeze({
        pending: row,
        matured: true,
        outcome: row.maturedOutcome,
        evidenceUpdate: null,
      }),
    );
  }
  if (row.status === 'OUTCOME_DATA_INCOMPLETE') {
    return ok(
      Object.freeze({
        pending: row,
        matured: false,
        outcome: null,
        evidenceUpdate: null,
      }),
    );
  }
  if (Date.parse(input.now) < Date.parse(row.maturityAt)) {
    return err({
      code: 'EARLY_LABEL_FORBIDDEN',
      message: `no outcome information before ${row.maturityAt}`,
    });
  }
  const slice = computeOutcomeObservationSlice({
    now: input.now,
    window: row.observationWindow,
    binding: row.binding,
    observations: input.observations,
  });
  if (!slice.ok) {
    if (slice.error.code === 'NOT_YET_KNOWABLE') {
      return ok(
        Object.freeze({
          pending: row,
          matured: false,
          outcome: null,
          evidenceUpdate: null,
        }),
      );
    }
    if (slice.error.code === 'OUTCOME_DATA_INCOMPLETE') {
      const incomplete: PendingOutcome = Object.freeze({
        ...row,
        status: 'OUTCOME_DATA_INCOMPLETE',
        maturedOutcome: null,
      });
      input.store.replacePending(incomplete);
      return ok(
        Object.freeze({
          pending: incomplete,
          matured: false,
          outcome: null,
          evidenceUpdate: null,
        }),
      );
    }
    return slice;
  }
  const outcome = sealMaturedOutcome({
    pendingId: row.pendingId,
    binding: row.binding,
    window: row.observationWindow,
    slice: slice.value,
    realizedAt: input.now,
  });
  const updated: PendingOutcome = Object.freeze({
    ...row,
    status: 'MATURED',
    maturedOutcome: outcome,
  });
  input.store.replacePending(updated);
  const evidenceUpdate: OutcomeEvidenceUpdateRecord = Object.freeze({
    schema: HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
    updateId: `oev_${outcome.maturedOutcomeId}`,
    campaignId: row.binding.campaignId,
    decisionId: row.binding.decisionId,
    horizonId: row.horizonId,
    maturedOutcomeId: outcome.maturedOutcomeId,
    triggeredAt: input.now,
    statisticalChannel: 'forward_alpha_delayed_label_v1',
  });
  input.store.attachMatured(outcome, evidenceUpdate);
  return ok(
    Object.freeze({
      pending: updated,
      matured: true,
      outcome,
      evidenceUpdate,
    }),
  );
}

export function processDueOutcomeMaturityJobs(input: {
  readonly store: OutcomeMaturityQueueStore;
  readonly now: UtcInstant;
  readonly observations: readonly PrequentialChronologicalObservation[];
}): readonly OutcomeMaturityAttemptResult[] {
  const results: OutcomeMaturityAttemptResult[] = [];
  for (const pending of input.store.listPending()) {
    if (pending.status !== 'PENDING') {
      continue;
    }
    if (Date.parse(input.now) < Date.parse(pending.maturityAt)) {
      continue;
    }
    const attempt = attemptMaturePendingOutcome({
      store: input.store,
      pendingId: pending.pendingId,
      now: input.now,
      observations: input.observations,
    });
    if (attempt.ok) {
      results.push(attempt.value);
    }
  }
  return Object.freeze(results);
}

export function initialQueueState(schedule: OutcomeMaturitySchedule): OutcomeMaturityQueueState {
  return Object.freeze({
    schema: HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
    campaignId: schedule.campaignId,
    schedule,
    pending: Object.freeze([]),
    matured: Object.freeze([]),
    evidenceUpdates: Object.freeze([]),
    grantsExecutionAuthority: false as const,
  });
}
