/**
 * Launch-ceremony participants.
 *
 * Required human roles cannot be filled by AI, automation, or a
 * service. Independent slots require distinct public identities unless
 * the deliberate overlap policy is enabled.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';
import { fingerprintOf } from '../keys.ts';
import { REQUIRED_PRODUCTION_HUMAN_ROLES } from '../types.ts';
import type { ProductionCeremonyActorKind } from '../types.ts';
import {
  AI_SATISFIES_HUMAN_ROLE,
  REQUIRED_LAUNCH_HUMAN_ROLES,
  type LaunchApprovalScope,
  type LaunchCeremonyParticipant,
  type PreservedEconomicAuthorizationRole,
  type RoleOverlapPolicy,
} from './types.ts';
import type { ProductionCeremonyRole } from '../types.ts';

const INDEPENDENT_SLOTS = new Set<string>([
  ...REQUIRED_LAUNCH_HUMAN_ROLES,
  'ECONOMIC_POLICY_AUTHORITY',
  'VALIDATOR_GOVERNANCE_AUTHORITY',
]);

export function publicIdentityCommitment(input: {
  readonly participantId: string;
  readonly role: string;
  readonly actorKind: ProductionCeremonyActorKind;
  readonly publicSigningDescriptor: string;
}): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('sunrey.launch-ceremony.participant.v1'),
      encodeString(input.participantId),
      encodeString(input.role),
      encodeString(input.actorKind),
      encodeString(input.publicSigningDescriptor),
    ]),
  );
}

export function defaultScopeForRole(
  role: ProductionCeremonyRole | PreservedEconomicAuthorizationRole,
): LaunchApprovalScope {
  if (role === 'GENESIS_AUTHORITY') {
    return 'GENESIS_CANDIDATE';
  }
  if (role === 'ECONOMIC_POLICY_AUTHORITY') {
    return 'ECONOMIC_PARAMETER_PACKAGE';
  }
  if (role === 'CEREMONY_OBSERVER') {
    return 'OBSERVER';
  }
  return 'LAUNCH_AUTHORIZATION';
}

export function registerLaunchParticipant(input: {
  readonly participantId: string;
  readonly displayName: string;
  readonly role: ProductionCeremonyRole | PreservedEconomicAuthorizationRole;
  readonly actorKind: ProductionCeremonyActorKind;
  readonly publicSigningDescriptor: string;
  readonly approvalScope?: LaunchApprovalScope;
}): LaunchCeremonyParticipant {
  const requiredHuman =
    (REQUIRED_LAUNCH_HUMAN_ROLES as readonly string[]).includes(input.role) ||
    (REQUIRED_PRODUCTION_HUMAN_ROLES as readonly string[]).includes(input.role);
  if (requiredHuman && input.actorKind !== 'HUMAN') {
    throw new TypeError(`AI or automation cannot occupy required human role ${input.role}`);
  }
  if (input.actorKind === 'SERVICE' && requiredHuman) {
    throw new TypeError(`service cannot satisfy required human role ${input.role}`);
  }
  if (input.actorKind !== 'HUMAN' && requiredHuman) {
    throw new TypeError(`required launch role ${input.role} requires a human actor`);
  }
  return Object.freeze({
    participantId: input.participantId,
    displayName: input.displayName,
    role: input.role,
    actorKind: input.actorKind,
    publicIdentityCommitment: publicIdentityCommitment(input),
    publicSigningDescriptor: input.publicSigningDescriptor,
    approvalScope: input.approvalScope ?? defaultScopeForRole(input.role),
  });
}

export function assertHumanRoleEligible(participant: LaunchCeremonyParticipant): void {
  const required = (REQUIRED_LAUNCH_HUMAN_ROLES as readonly string[]).includes(participant.role);
  if (!required) {
    return;
  }
  if (participant.actorKind === 'AI') {
    throw new TypeError('AI participant cannot satisfy required human role');
  }
  if (participant.actorKind === 'SERVICE' || participant.actorKind === 'AUTOMATION') {
    throw new TypeError('service cannot satisfy human role');
  }
  if (participant.actorKind !== 'HUMAN' || AI_SATISFIES_HUMAN_ROLE) {
    throw new TypeError(`required launch role ${participant.role} requires a distinct human`);
  }
}

export function assertDistinctIndependentActors(
  participants: readonly LaunchCeremonyParticipant[],
  policy: RoleOverlapPolicy,
): void {
  if (policy.allowIndependentRoleOverlap) {
    return;
  }
  const seen = new Map<string, string>();
  for (const participant of participants) {
    if (!INDEPENDENT_SLOTS.has(participant.role)) {
      continue;
    }
    assertHumanRoleEligible(participant);
    const prior = seen.get(participant.publicSigningDescriptor);
    if (prior && prior !== participant.role) {
      throw new TypeError(
        `distinct human roles required: ${prior} and ${participant.role} share a public identity`,
      );
    }
    seen.set(participant.publicSigningDescriptor, participant.role);
    const commitmentPrior = [...participants].find(
      (other) =>
        other.participantId !== participant.participantId &&
        INDEPENDENT_SLOTS.has(other.role) &&
        other.publicIdentityCommitment === participant.publicIdentityCommitment,
    );
    if (commitmentPrior) {
      throw new TypeError(
        `distinct human roles required: ${commitmentPrior.role} and ${participant.role} share an identity commitment`,
      );
    }
  }
}

export function participantFingerprint(participant: LaunchCeremonyParticipant): string {
  return fingerprintOf(participant.publicSigningDescriptor);
}

export function aiCannotSatisfyHumanRole(): false {
  return AI_SATISFIES_HUMAN_ROLE;
}
