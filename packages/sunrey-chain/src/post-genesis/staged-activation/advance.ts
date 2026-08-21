/**
 * Stage advancement and independent product sequencing.
 *
 * AI, agents, automations, and the control room cannot advance a stage
 * or activate a domain. Human activation remains a separate later act.
 * There is no LIVE state.
 */

import { evaluateDomainGates, failedGates } from './gates.ts';
import { chainSafetyPassed } from './health.ts';
import { canonicalStagedPlan, domainsForStage, nextStage, previousStage, stageIndex } from './plan.ts';
import type {
  AdvanceAttempt,
  AdvanceResult,
  DomainStageStatus,
  StageStatus,
  StagedActivationActorKind,
  StagedActivationDomain,
  StagedActivationObservation,
  StagedActivationStage,
  StagedDomainState,
} from './types.ts';
import { AI_CAN_ADVANCE_STAGE, CONTROL_ROOM_CAN_ACTIVATE_DOMAIN } from './types.ts';

const REJECTED_ADVANCE_ACTORS: readonly StagedActivationActorKind[] = Object.freeze([
  'AI',
  'AGENT',
  'AUTOMATION',
  'CONTROL_ROOM',
]);

export type SequencerState = {
  readonly currentStage: StagedActivationStage;
  readonly pausedDomains: ReadonlySet<StagedActivationDomain>;
  readonly canaryDomains: ReadonlySet<StagedActivationDomain>;
  readonly rehearsalPassedDomains: ReadonlySet<StagedActivationDomain>;
  readonly awaitingHumanDomains: ReadonlySet<StagedActivationDomain>;
  readonly activationCandidateDomains: ReadonlySet<StagedActivationDomain>;
};

export function initialSequencerState(): SequencerState {
  return {
    currentStage: 'STAGE_0_GENESIS_AND_CONSENSUS',
    pausedDomains: new Set(),
    canaryDomains: new Set(),
    rehearsalPassedDomains: new Set(),
    awaitingHumanDomains: new Set(),
    activationCandidateDomains: new Set(),
  };
}

export function actorMayAdvance(actorKind: StagedActivationActorKind): boolean {
  if (REJECTED_ADVANCE_ACTORS.includes(actorKind)) {
    return false;
  }
  return actorKind === 'HUMAN';
}

export function controlRoomMayActivateDomain(): false {
  return CONTROL_ROOM_CAN_ACTIVATE_DOMAIN;
}

export function aiMayAdvanceStage(): false {
  return AI_CAN_ADVANCE_STAGE;
}

export function evaluateAdvance(
  state: SequencerState,
  attempt: AdvanceAttempt,
  observation: StagedActivationObservation,
): AdvanceResult {
  const reasons: string[] = [];
  if (!actorMayAdvance(attempt.actorKind)) {
    reasons.push(
      attempt.actorKind === 'CONTROL_ROOM'
        ? 'control room cannot activate domain or advance stage'
        : 'AI cannot advance stage',
    );
  }
  if (stageIndex(attempt.toStage) !== stageIndex(attempt.fromStage) + 1) {
    reasons.push(`stage advancement must be sequential: ${attempt.fromStage} -> ${attempt.toStage}`);
  }
  if (attempt.fromStage !== state.currentStage) {
    reasons.push(`current stage is ${state.currentStage}, not ${attempt.fromStage}`);
  }
  if (attempt.fromStage !== 'STAGE_0_GENESIS_AND_CONSENSUS' || attempt.toStage !== 'STAGE_1_READ_ONLY_PUBLIC_SURFACES') {
    if (!stagePassed(state, attempt.fromStage, observation)) {
      reasons.push(`previous stage ${attempt.fromStage} has not passed`);
    }
  } else if (!chainSafetyPassed(observation.chain)) {
    reasons.push('consensus/chain safety has not passed');
  }

  const nextDomains = domainsForStage(attempt.toStage);
  for (const domain of nextDomains) {
    const failed = failedGates(evaluateDomainGates(domain, observation));
    if (state.pausedDomains.has(domain)) {
      reasons.push(`${domain} is paused`);
    }
    for (const finding of failed) {
      reasons.push(`${domain}: ${finding.reason}`);
    }
  }

  return Object.freeze({
    ok: reasons.length === 0,
    fromStage: attempt.fromStage,
    toStage: attempt.toStage,
    actorKind: attempt.actorKind,
    reasons: Object.freeze([...new Set(reasons)]),
    minted: false,
    liveEnabled: false,
    productionActive: false,
  });
}

export function applyAdvance(
  state: SequencerState,
  attempt: AdvanceAttempt,
  observation: StagedActivationObservation,
): { readonly state: SequencerState; readonly result: AdvanceResult } {
  const result = evaluateAdvance(state, attempt, observation);
  if (!result.ok) {
    return { state, result };
  }
  return {
    state: { ...state, currentStage: attempt.toStage },
    result,
  };
}

export function requestHumanActivation(
  state: SequencerState,
  domain: StagedActivationDomain,
  actorKind: StagedActivationActorKind,
): { readonly state: SequencerState; readonly ok: boolean; readonly reasons: readonly string[] } {
  if (actorKind !== 'HUMAN') {
    return {
      state,
      ok: false,
      reasons: Object.freeze(['human activation remains separate; AI and control room cannot activate a domain']),
    };
  }
  if (!state.rehearsalPassedDomains.has(domain) && !state.awaitingHumanDomains.has(domain)) {
    return {
      state,
      ok: false,
      reasons: Object.freeze(['domain rehearsal has not passed; human activation remains separate']),
    };
  }
  const awaiting = new Set(state.awaitingHumanDomains);
  awaiting.add(domain);
  const candidates = new Set(state.activationCandidateDomains);
  candidates.add(domain);
  return {
    state: {
      ...state,
      awaitingHumanDomains: awaiting,
      activationCandidateDomains: candidates,
    },
    ok: true,
    reasons: Object.freeze([]),
  };
}

export function markRehearsalPassed(state: SequencerState, domain: StagedActivationDomain): SequencerState {
  const passed = new Set(state.rehearsalPassedDomains);
  passed.add(domain);
  const canary = new Set(state.canaryDomains);
  canary.delete(domain);
  return { ...state, rehearsalPassedDomains: passed, canaryDomains: canary };
}

export function markCanary(state: SequencerState, domain: StagedActivationDomain): SequencerState {
  const canary = new Set(state.canaryDomains);
  canary.add(domain);
  return { ...state, canaryDomains: canary };
}

export function applyPause(state: SequencerState, domain: StagedActivationDomain): SequencerState {
  const paused = new Set(state.pausedDomains);
  paused.add(domain);
  const canary = new Set(state.canaryDomains);
  canary.delete(domain);
  const candidates = new Set(state.activationCandidateDomains);
  candidates.delete(domain);
  return { ...state, pausedDomains: paused, canaryDomains: canary, activationCandidateDomains: candidates };
}

export function domainRuntimeState(
  state: SequencerState,
  domain: StagedActivationDomain,
  observation: StagedActivationObservation,
): StagedDomainState {
  if (state.pausedDomains.has(domain)) {
    return 'BLOCKED';
  }
  if (state.activationCandidateDomains.has(domain)) {
    return 'ACTIVATION_CANDIDATE';
  }
  if (state.awaitingHumanDomains.has(domain)) {
    return 'AWAITING_HUMAN_ACTIVATION';
  }
  if (state.rehearsalPassedDomains.has(domain)) {
    return 'REHEARSAL_PASSED';
  }
  if (state.canaryDomains.has(domain)) {
    return 'CANARY_REHEARSAL';
  }
  const failed = failedGates(evaluateDomainGates(domain, observation));
  if (failed.length === 0) {
    return 'READY_FOR_REHEARSAL';
  }
  if (failed.some((row) => row.gateId === 'CHAIN_FIRST')) {
    return 'NOT_ELIGIBLE';
  }
  return 'BLOCKED';
}

export function stagePassed(
  state: SequencerState,
  stage: StagedActivationStage,
  observation: StagedActivationObservation,
): boolean {
  if (stage === 'STAGE_0_GENESIS_AND_CONSENSUS') {
    return chainSafetyPassed(observation.chain);
  }
  if (stageIndex(stage) > stageIndex(state.currentStage)) {
    return false;
  }
  return domainsForStage(stage).every((domain) => {
    if (state.pausedDomains.has(domain)) {
      return false;
    }
    return failedGates(evaluateDomainGates(domain, observation)).length === 0;
  });
}

export function evaluateStage(
  state: SequencerState,
  stage: StagedActivationStage,
  observation: StagedActivationObservation,
  domainStatuses: readonly DomainStageStatus[],
): StageStatus {
  const prior = previousStage(stage);
  const previousPassed = prior === null ? true : stagePassed(state, prior, observation);
  const reasons: string[] = [];
  if (!previousPassed && prior) {
    reasons.push(`previous stage ${prior} has not passed`);
  }
  const domains = domainStatuses.filter((row) => domainsForStage(stage).includes(row.domain));
  if (domains.some((row) => row.state === 'BLOCKED' || row.state === 'NOT_ELIGIBLE')) {
    reasons.push('one or more stage domains are blocked or not eligible');
  }
  const passed = previousPassed && domains.every((row) => row.state !== 'BLOCKED' && row.state !== 'NOT_ELIGIBLE' && !row.paused);
  return Object.freeze({
    stage,
    state: passed ? (stage === state.currentStage ? 'READY_FOR_REHEARSAL' : 'REHEARSAL_PASSED') : 'BLOCKED',
    previousStagePassed: previousPassed,
    domains: Object.freeze(domains),
    reasons: Object.freeze(reasons),
  });
}

export function sequentialAdvancePath(): readonly StagedActivationStage[] {
  return canonicalStagedPlan().stages;
}

export function nextAdvanceTarget(state: SequencerState): StagedActivationStage | null {
  return nextStage(state.currentStage);
}
