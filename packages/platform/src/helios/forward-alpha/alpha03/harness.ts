import { asUtcInstant } from '@solstice/domain';

import { DEFAULT_OUTCOME_HORIZON_MS, SIMULATION_FORWARD_HARNESS } from './taxonomy.ts';
import { advancePrequentialTick, createPrequentialCampaignStore, resumePrequentialCampaign } from './engine.ts';
import {
  alpha03CampaignFixture,
  alpha03ChronologicalFixtureStream,
  alpha03FutureLeakObservation,
} from './fixtures.ts';
import { verifyPrequentialPointInTimeIsolation } from './pit.ts';
import { evaluateAlpha03PrequentialQualification, type Alpha03QualificationChecks } from './qualification.ts';
import type { Alpha03QualificationResult } from './qualification.ts';
import type { PrequentialState } from './types.ts';
import type { PrequentialLoopPhase } from './taxonomy.ts';

export function runAlpha03PrequentialHarness(): Alpha03QualificationResult & {
  readonly state: PrequentialState;
  readonly observedPhases: readonly PrequentialLoopPhase[];
} {
  const observations = alpha03ChronologicalFixtureStream();
  const config = alpha03CampaignFixture();
  const store = createPrequentialCampaignStore(config);
  const decisionTime = asUtcInstant('2026-04-01T14:15:00.000Z');
  const outcomeTime = asUtcInstant('2026-04-01T15:30:00.000Z');

  const tick1 = advancePrequentialTick({
    store,
    decisionTime,
    now: decisionTime,
    observations,
    outcomeHorizonMs: config.outcomeHorizonMs ?? DEFAULT_OUTCOME_HORIZON_MS,
  });
  if (!tick1.ok) {
    return Object.freeze({
      ...evaluateAlpha03PrequentialQualification(
        {
          loopPhasesComplete: false,
          decisionsSealedBeforeOutcome: false,
          noRetroactivePredictionChange: false,
          simulationHarnessLabeled: false,
          restartPreservesSeals: false,
          onlineLearningAfterScoreOnly: false,
          pitEnforced: false,
          noExecutionAuthority: false,
        },
        store.getState(),
        [],
      ),
      state: store.getState(),
      observedPhases: Object.freeze([]),
    });
  }

  const sealedHash = tick1.value.decision?.seal.contentHash ?? '';
  const tick2 = advancePrequentialTick({
    store,
    decisionTime,
    now: outcomeTime,
    observations,
    outcomeHorizonMs: config.outcomeHorizonMs ?? DEFAULT_OUTCOME_HORIZON_MS,
  });
  const phases = Object.freeze([...tick1.value.phases, ...(tick2.ok ? tick2.value.phases : [])]);

  const persisted = store.getState();
  const restarted = resumePrequentialCampaign(persisted);
  const tick3 = advancePrequentialTick({
    store: restarted,
    decisionTime,
    now: outcomeTime,
    observations,
    outcomeHorizonMs: config.outcomeHorizonMs ?? DEFAULT_OUTCOME_HORIZON_MS,
  });
  const afterRestartHash =
    tick3.ok && tick3.value.decision !== null ? tick3.value.decision.seal.contentHash : '';

  const pitIsolated = verifyPrequentialPointInTimeIsolation({
    campaignId: 'alpha03_leak_probe',
    instrumentId: config.instrumentId,
    decisionTime,
    baseline: observations,
    withFutureProbe: [...observations, alpha03FutureLeakObservation(decisionTime)],
    outcomeHorizonMs: config.outcomeHorizonMs ?? DEFAULT_OUTCOME_HORIZON_MS,
    modelVersion: config.initialModelVersion ?? 'alpha03-m0',
  });

  const finalDecision = tick2.ok ? tick2.value.decision : tick1.value.decision;
  const checks: Alpha03QualificationChecks = Object.freeze({
    loopPhasesComplete: tick2.ok && finalDecision !== null && finalDecision.score !== null,
    decisionsSealedBeforeOutcome:
      tick1.ok && tick1.value.decision !== null && tick1.value.decision.outcome === null,
    noRetroactivePredictionChange: sealedHash.length > 0 && sealedHash === afterRestartHash,
    simulationHarnessLabeled: persisted.dataSource === SIMULATION_FORWARD_HARNESS,
    restartPreservesSeals: tick3.ok,
    onlineLearningAfterScoreOnly:
      persisted.onlineLearningEnabled && persisted.modelUpdates.length > 0
        ? finalDecision !== null && finalDecision.score !== null
        : true,
    pitEnforced: pitIsolated,
    noExecutionAuthority: !persisted.grantsExecutionAuthority,
  });

  const qualification = evaluateAlpha03PrequentialQualification(checks, restarted.getState(), phases);
  return Object.freeze({
    ...qualification,
    state: restarted.getState(),
    observedPhases: phases,
  });
}
