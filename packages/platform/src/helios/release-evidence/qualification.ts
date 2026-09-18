/**
 * HELIOS H36 — release candidate qualification and live-pilot readiness evaluation.
 */

import {
  HELIOS_RC_BLOCKED,
  HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING,
  HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION,
  READY_FOR_HUMAN_LIVE_PILOT_AUTHORIZATION,
} from './taxonomy.ts';
import type {
  HELIOSReleaseEvidencePackage,
  LivePilotGate,
  ReleaseCandidateQualificationResult,
} from './types.ts';

export function evaluateReleaseCandidateQualification(input: {
  readonly releaseEvidence: HELIOSReleaseEvidencePackage;
  readonly livePilotGate?: LivePilotGate | null;
}): ReleaseCandidateQualificationResult {
  const blockers: string[] = [...input.releaseEvidence.engineering.blockers];

  if (!input.releaseEvidence.engineering.engineeringQualified) {
    blockers.push('engineering release package not qualified');
  }

  const gate = input.livePilotGate ?? null;
  const externalGatesComplete = gate?.allGatesSatisfied === true;
  const engineeringQualified = input.releaseEvidence.engineering.engineeringQualified && blockers.length === 0;

  if (!engineeringQualified) {
    return Object.freeze({
      marker: HELIOS_RC_BLOCKED,
      engineeringQualified: false,
      externalGatesComplete: false,
      readyForHumanPilotAuthorization: false,
      blockers: Object.freeze(blockers),
      releaseEvidence: input.releaseEvidence,
      livePilotGate: gate,
    });
  }

  if (!gate || !externalGatesComplete) {
    return Object.freeze({
      marker: HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING,
      engineeringQualified: true,
      externalGatesComplete: false,
      readyForHumanPilotAuthorization: false,
      blockers: Object.freeze([
        ...blockers,
        ...(gate?.missingExternalEvidence ?? ['live pilot gate not evaluated']),
      ]),
      releaseEvidence: input.releaseEvidence,
      livePilotGate: gate,
    });
  }

  return Object.freeze({
    marker: HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION,
    engineeringQualified: true,
    externalGatesComplete: true,
    readyForHumanPilotAuthorization: true,
    blockers: Object.freeze(blockers),
    releaseEvidence: input.releaseEvidence,
    livePilotGate: gate,
  });
}

export function pilotAuthorizationOutcome(
  result: ReleaseCandidateQualificationResult,
): typeof READY_FOR_HUMAN_LIVE_PILOT_AUTHORIZATION | 'NOT_READY' {
  if (result.readyForHumanPilotAuthorization) {
    return READY_FOR_HUMAN_LIVE_PILOT_AUTHORIZATION;
  }
  return 'NOT_READY';
}

export function refuseLiveActivation(): never {
  throw new TypeError(
    'H36 does not activate live financial connectivity; requires separate authorized operational ceremony',
  );
}
