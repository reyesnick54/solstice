/**
 * Multi-person launch authorization bound to the exact plan hash.
 *
 * AI cannot occupy a human role. A material plan change requires a
 * new authorization. Engineering qualification alone is insufficient.
 */

import { digestText, FIXED_LAUNCH_UTC } from './hash.ts';
import type {
  LaunchActorKind,
  LaunchAuthorityRole,
  LaunchHumanAuthorization,
  ProductionLaunchAuthorization,
  ProductionLaunchPlan,
} from './types.ts';
import { REQUIRED_LAUNCH_HUMAN_ROLES } from './types.ts';

export function authorizationSetHashOf(authorizations: readonly LaunchHumanAuthorization[]): string {
  return digestText(
    'SUNREY_LAUNCH_AUTHORIZATION_SET_V1',
    ...authorizations.map((row) =>
      [row.role, row.actorKind, row.actorId, row.planHash, row.accepted ? '1' : '0'].join(':'),
    ),
  );
}

export function signLaunchAuthorization(input: {
  readonly role: LaunchAuthorityRole;
  readonly actorKind: LaunchActorKind;
  readonly actorId: string;
  readonly plan: ProductionLaunchPlan;
}): LaunchHumanAuthorization {
  if (input.actorKind !== 'HUMAN') {
    return Object.freeze({
      role: input.role,
      actorKind: input.actorKind,
      actorId: input.actorId,
      planHash: input.plan.planHash,
      accepted: false,
      rejectionReason: 'AI_CANNOT_AUTHORIZE',
      signedAtUtc: FIXED_LAUNCH_UTC,
    });
  }
  if (input.actorId.toUpperCase().includes('AI') || input.actorId.toUpperCase().includes('AGENT')) {
    return Object.freeze({
      role: input.role,
      actorKind: input.actorKind,
      actorId: input.actorId,
      planHash: input.plan.planHash,
      accepted: false,
      rejectionReason: 'AI_CANNOT_AUTHORIZE',
      signedAtUtc: FIXED_LAUNCH_UTC,
    });
  }
  return Object.freeze({
    role: input.role,
    actorKind: 'HUMAN',
    actorId: input.actorId,
    planHash: input.plan.planHash,
    accepted: true,
    rejectionReason: null,
    signedAtUtc: FIXED_LAUNCH_UTC,
  });
}

export function sealLaunchAuthorization(
  plan: ProductionLaunchPlan,
  authorizations: readonly LaunchHumanAuthorization[],
): ProductionLaunchAuthorization {
  const accepted = authorizations.filter((row) => row.accepted && row.actorKind === 'HUMAN' && row.planHash === plan.planHash);
  const roles = new Set(accepted.map((row) => row.role));
  const actors = new Set(accepted.map((row) => row.actorId));
  const complete =
    REQUIRED_LAUNCH_HUMAN_ROLES.every((role) => roles.has(role)) &&
    accepted.length >= plan.requiredApprovals &&
    actors.size >= plan.requiredApprovals;
  return Object.freeze({
    schemaVersion: 1,
    planHash: plan.planHash,
    authorizations: Object.freeze([...authorizations]),
    authorizationSetHash: authorizationSetHashOf(authorizations),
    complete,
    occupiedByAi: false,
    usableForProduction: complete && plan.mode === 'PRODUCTION' && plan.usableForProduction,
  });
}

export function rehearsalHumanAuthorizations(plan: ProductionLaunchPlan): readonly LaunchHumanAuthorization[] {
  return Object.freeze(
    REQUIRED_LAUNCH_HUMAN_ROLES.map((role) =>
      signLaunchAuthorization({
        role,
        actorKind: 'HUMAN',
        actorId: `human.${role.toLowerCase()}.rehearsal`,
        plan,
      }),
    ),
  );
}

export function rejectWrongPlanAuthorization(
  authorization: ProductionLaunchAuthorization,
  plan: ProductionLaunchPlan,
): void {
  if (authorization.planHash !== plan.planHash) {
    throw new TypeError('AUTHORIZATION_MISMATCH');
  }
}
