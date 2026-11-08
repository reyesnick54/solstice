/**
 * ALPHA03 loop: PREDICT → SEAL → WAIT → OBSERVE → SCORE → OPTIONAL PREDECLARED UPDATE
 */

import type { UtcInstant } from '@solstice/domain';
import { err, ok, type Result } from '@solstice/domain';

import { HELIOS_ALPHA03_PREQUENTIAL_SCHEMA } from './taxonomy.ts';
import { filterKnowableMarketEvents, midPriceMinorFromQuote } from './knowable-at.ts';
import { buildPrequentialDecisionId, predictPrequentialAt } from './predict.ts';
import { scorePrequentialDecision } from './score.ts';
import { sealPrequentialDecision } from './seal.ts';
import { PrequentialCampaignStore } from './store.ts';
import type {
  PrequentialCampaignConfig,
  PrequentialChronologicalObservation,
  PrequentialDecision,
  PrequentialEngineFailure,
  PrequentialModelUpdateRecord,
  PrequentialOutcome,
  PrequentialState,
} from './types.ts';
import type { PrequentialLoopPhase } from './taxonomy.ts';

export function createPrequentialCampaign(config: PrequentialCampaignConfig): PrequentialState {
  return Object.freeze({
    schema: HELIOS_ALPHA03_PREQUENTIAL_SCHEMA,
    campaignId: config.campaignId,
    dataSource: config.dataSource,
    forwardAlphaEvidenceEligible: config.forwardAlphaEvidenceEligible,
    onlineLearningEnabled: config.onlineLearningEnabled,
    modelVersion: config.initialModelVersion ?? 'alpha03-m0',
    startedAt: config.startedAt,
    observationRef: config.observationRef,
    instrumentId: config.instrumentId,
    decisions: Object.freeze([]),
    modelUpdates: Object.freeze([]),
    lastLoopPhase: null,
    grantsExecutionAuthority: false as const,
  });
}

export function createPrequentialCampaignStore(config: PrequentialCampaignConfig): PrequentialCampaignStore {
  return new PrequentialCampaignStore(createPrequentialCampaign(config));
}

function horizonEnd(decisionTime: UtcInstant, horizonMs: number): UtcInstant {
  const endMs = Date.parse(decisionTime) + horizonMs;
  return new Date(endMs).toISOString() as UtcInstant;
}

function attachOutcome(input: {
  readonly decision: PrequentialDecision;
  readonly now: UtcInstant;
  readonly observations: readonly PrequentialChronologicalObservation[];
  readonly instrumentId: string;
}): Result<PrequentialOutcome, PrequentialEngineFailure> {
  const end = horizonEnd(input.decision.decisionTime, input.decision.outcomeHorizonMs);
  if (Date.parse(input.now) < Date.parse(end)) {
    return err({
      code: 'OUTCOME_BEFORE_HORIZON',
      message: `outcome horizon ends at ${end}`,
    });
  }
  const knowable = filterKnowableMarketEvents(input.now, input.observations);
  const forInstrument = knowable
    .filter((row) => row.event.instrumentId === input.instrumentId)
    .sort((a, b) => a.chronologicalIndex - b.chronologicalIndex);
  const atOrBeforeHorizon = forInstrument.filter(
    (row) => Date.parse(row.event.knowableAt) <= Date.parse(end),
  );
  if (atOrBeforeHorizon.length === 0) {
    return err({
      code: 'NOT_YET_KNOWABLE',
      message: 'no outcome observation knowable at horizon',
    });
  }
  const latest = atOrBeforeHorizon[atOrBeforeHorizon.length - 1]!;
  const mid = midPriceMinorFromQuote(latest.event);
  if (mid === null) {
    return err({
      code: 'NOT_YET_KNOWABLE',
      message: 'latest outcome event has no quote mid',
    });
  }
  const ids = atOrBeforeHorizon.map((row) => row.event.eventId);
  return ok(
    Object.freeze({
      observedAt: input.now,
      horizonEnd: end,
      realizedMidMinor: mid,
      observationEventIdsAtOutcome: Object.freeze(ids),
    }),
  );
}

function applyPredeclaredModelUpdate(input: {
  readonly state: PrequentialState;
  readonly decision: PrequentialDecision;
  readonly appliedAt: UtcInstant;
}): PrequentialState {
  if (!input.state.onlineLearningEnabled) {
    return input.state;
  }
  if (input.decision.score === null) {
    return input.state;
  }
  const nextVersion = `${input.state.modelVersion}+post-${input.decision.decisionId.slice(-6)}`;
  const record: PrequentialModelUpdateRecord = Object.freeze({
    appliedAt: input.appliedAt,
    priorModelVersion: input.state.modelVersion,
    nextModelVersion: nextVersion,
    triggerDecisionId: input.decision.decisionId,
    predeclared: true as const,
  });
  return Object.freeze({
    ...input.state,
    modelVersion: nextVersion,
    modelUpdates: Object.freeze([...input.state.modelUpdates, record]),
    lastLoopPhase: 'OPTIONAL_PREDECLARED_UPDATE',
  });
}

export type PrequentialTickResult = Readonly<{
  readonly phases: readonly PrequentialLoopPhase[];
  readonly state: PrequentialState;
  readonly decision: PrequentialDecision | null;
}>;

/**
 * Advance one decision boundary at `decisionTime` using only information knowable at that time.
 * Subsequent calls at the same decisionTime with an existing sealed decision do not re-predict.
 */
export function advancePrequentialTick(input: {
  readonly store: PrequentialCampaignStore;
  readonly decisionTime: UtcInstant;
  readonly now: UtcInstant;
  readonly observations: readonly PrequentialChronologicalObservation[];
  readonly outcomeHorizonMs: number;
}): Result<PrequentialTickResult, PrequentialEngineFailure> {
  const state = input.store.getState();

  const decisionId = buildPrequentialDecisionId(state.campaignId, input.decisionTime);
  const existing = input.store.getDecision(decisionId);
  const phases: PrequentialLoopPhase[] = [];

  let decision: PrequentialDecision;
  if (existing !== undefined) {
    decision = existing;
    phases.push('SEAL', 'WAIT');
  } else {
    const draft = predictPrequentialAt({
      decisionTime: input.decisionTime,
      instrumentId: state.instrumentId,
      observations: input.observations,
    });
    if (draft === null) {
      return err({
        code: 'NOT_YET_KNOWABLE',
        message: 'insufficient knowable quotes to predict',
      });
    }
    phases.push('PREDICT');
    decision = sealPrequentialDecision({
      decisionId,
      campaignId: state.campaignId,
      decisionTime: input.decisionTime,
      predictedLabel: draft.predictedLabel,
      predictedReferenceMidMinor: draft.predictedReferenceMidMinor,
      instrumentId: state.instrumentId,
      contextDigest: draft.contextDigest,
      observationEventIdsAtDecision: draft.observationEventIdsAtDecision,
      outcomeHorizonMs: input.outcomeHorizonMs,
      modelVersion: state.modelVersion,
      sealedAt: input.decisionTime,
    });
    phases.push('SEAL', 'WAIT');
    input.store.putDecision(decision);
  }

  if (decision.outcome === null) {
    const outcomeResult = attachOutcome({
      decision,
      now: input.now,
      observations: input.observations,
      instrumentId: state.instrumentId,
    });
    if (outcomeResult.ok) {
      phases.push('OBSERVE');
      decision = Object.freeze({
        ...decision,
        outcome: outcomeResult.value,
      });
      input.store.putDecision(decision);
    }
  } else {
    phases.push('OBSERVE');
  }

  if (decision.outcome !== null && decision.score === null) {
    phases.push('SCORE');
    const score = scorePrequentialDecision({
      decision,
      outcome: decision.outcome,
      scoredAt: input.now,
    });
    decision = Object.freeze({
      ...decision,
      score,
    });
    input.store.putDecision(decision);
  } else if (decision.score !== null) {
    phases.push('SCORE');
  }

  let nextState: PrequentialState = Object.freeze({
    ...input.store.getState(),
    lastLoopPhase: phases[phases.length - 1] ?? null,
  });
  input.store.replaceState(nextState);

  if (decision.score !== null && state.onlineLearningEnabled) {
    nextState = applyPredeclaredModelUpdate({
      state: nextState,
      decision,
      appliedAt: input.now,
    });
    phases.push('OPTIONAL_PREDECLARED_UPDATE');
    input.store.replaceState(nextState);
  }

  return ok(
    Object.freeze({
      phases: Object.freeze(phases),
      state: input.store.getState(),
      decision,
    }),
  );
}

export function resumePrequentialCampaign(persisted: PrequentialState): PrequentialCampaignStore {
  const store = new PrequentialCampaignStore(persisted);
  return store;
}
