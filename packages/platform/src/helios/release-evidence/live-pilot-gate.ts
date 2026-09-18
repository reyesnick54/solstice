/**
 * HELIOS H36 — live-pilot external gate evaluation.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { externalGateItemIdFor } from './ids.ts';
import { LIVE_PILOT_GATE_CATALOG } from './live-pilot-gate-catalog.ts';
import {
  gateStatePermitsPilotAuthorization,
  PILOT_ABORT_CONDITIONS,
  type LivePilotGateState,
} from './taxonomy.ts';
import type {
  ExternalEvidenceRef,
  LivePilotGate,
  LivePilotGateItem,
  LivePilotScope,
} from './types.ts';
import type { HeliosReleaseId } from './ids.ts';

export function createDefaultLivePilotGateItems(now: UtcInstant): readonly LivePilotGateItem[] {
  return Object.freeze(
    LIVE_PILOT_GATE_CATALOG.map((entry) =>
      Object.freeze({
        itemId: externalGateItemIdFor(entry.gateClass, entry.itemKey),
        gateClass: entry.gateClass,
        itemKey: entry.itemKey,
        description: entry.description,
        state: 'NOT_STARTED' as LivePilotGateState,
        requiresExternalEvidence: entry.requiresExternalEvidence,
        evidenceRefs: Object.freeze([]),
        notes: Object.freeze([
          entry.requiresExternalEvidence
            ? 'External evidence required; AI cannot mark SATISFIED without evidence refs.'
            : 'Engineering qualification may satisfy; external review may still be required.',
        ]),
        updatedAt: now,
      }),
    ),
  );
}

export function assertGateTransitionPermitted(input: {
  readonly item: LivePilotGateItem;
  readonly nextState: LivePilotGateState;
  readonly evidenceRefs: readonly ExternalEvidenceRef[];
  readonly actorIsAuthorizedGovernance: boolean;
}): void {
  const { item, nextState, evidenceRefs, actorIsAuthorizedGovernance } = input;

  if (nextState === 'SATISFIED') {
    if (item.requiresExternalEvidence && evidenceRefs.length === 0) {
      throw new TypeError(
        `gate ${item.itemKey} requires external evidence refs to reach SATISFIED`,
      );
    }
  }

  if (nextState === 'WAIVED_BY_AUTHORIZED_GOVERNANCE' && !actorIsAuthorizedGovernance) {
    throw new TypeError(
      `gate ${item.itemKey} may only be waived by authorized governance`,
    );
  }
}

export function applyGateItemUpdate(
  item: LivePilotGateItem,
  input: {
    readonly nextState: LivePilotGateState;
    readonly evidenceRefs?: readonly ExternalEvidenceRef[];
    readonly notes?: readonly string[];
    readonly actorIsAuthorizedGovernance: boolean;
    readonly updatedAt: UtcInstant;
  },
): LivePilotGateItem {
  const evidenceRefs = input.evidenceRefs ?? item.evidenceRefs;
  assertGateTransitionPermitted({
    item,
    nextState: input.nextState,
    evidenceRefs,
    actorIsAuthorizedGovernance: input.actorIsAuthorizedGovernance,
  });

  return Object.freeze({
    ...item,
    state: input.nextState,
    evidenceRefs: Object.freeze([...evidenceRefs]),
    notes: Object.freeze([...(input.notes ?? item.notes)]),
    updatedAt: input.updatedAt,
  });
}

export function evaluateLivePilotGate(input: {
  readonly scope: LivePilotScope;
  readonly releaseId: HeliosReleaseId;
  readonly releaseGitSha: string;
  readonly items: readonly LivePilotGateItem[];
  readonly evaluatedAt: UtcInstant;
}): LivePilotGate {
  const missingExternalEvidence: string[] = [];
  let allSatisfied = true;

  for (const item of input.items) {
    if (!gateStatePermitsPilotAuthorization(item.state)) {
      allSatisfied = false;
      if (item.requiresExternalEvidence && item.evidenceRefs.length === 0) {
        missingExternalEvidence.push(`${item.gateClass}:${item.itemKey}`);
      }
      if (item.state === 'NOT_STARTED' || item.state === 'PENDING_EVIDENCE') {
        missingExternalEvidence.push(`${item.gateClass}:${item.itemKey}:state=${item.state}`);
      }
    }
  }

  return Object.freeze({
    schema: 'sunrey.helios.live-pilot-gate.v1',
    scope: input.scope,
    releaseId: input.releaseId,
    releaseGitSha: input.releaseGitSha,
    items: Object.freeze([...input.items]),
    mandatoryAbortConditions: PILOT_ABORT_CONDITIONS,
    missingExternalEvidence: Object.freeze(missingExternalEvidence),
    allGatesSatisfied: allSatisfied,
    evaluatedAt: input.evaluatedAt,
  });
}

export function refuseAiGateSatisfaction(input: {
  readonly actorKind: 'AI' | 'HUMAN' | 'SERVICE';
  readonly nextState: LivePilotGateState;
  readonly requiresExternalEvidence: boolean;
}): void {
  if (
    input.actorKind === 'AI' &&
    input.requiresExternalEvidence &&
    input.nextState === 'SATISFIED'
  ) {
    throw new TypeError('AI cannot set external live-pilot gates to SATISFIED without governance');
  }
}
