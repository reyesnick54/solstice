/**
 * Single-use LaunchExecutionPermit with replay protection and
 * pre-genesis revocation.
 */

import { digestText, FIXED_LAUNCH_UTC, permitHashOf } from './hash.ts';
import type {
  LaunchExecutionPermit,
  ProductionLaunchAuthorization,
  ProductionLaunchPlan,
} from './types.ts';

const consumedNonces = new Set<string>();
const revokedPermits = new Set<string>();

export function resetPermitRegistry(): void {
  consumedNonces.clear();
  revokedPermits.clear();
}

export function issueLaunchExecutionPermit(input: {
  readonly plan: ProductionLaunchPlan;
  readonly authorization: ProductionLaunchAuthorization;
  readonly validFromUtc?: string;
  readonly validUntilUtc?: string;
}): LaunchExecutionPermit {
  if (!input.authorization.complete || input.authorization.planHash !== input.plan.planHash) {
    throw new TypeError('INSUFFICIENT_HUMAN_AUTHORITY');
  }
  const body = {
    permitId: digestText('SUNREY_PERMIT_ID_V1', input.plan.planHash, input.authorization.authorizationSetHash).slice(0, 32),
    launchPlanHash: input.plan.planHash,
    genesisHash: input.plan.genesisHash,
    rcHash: input.plan.mainnetRcHash,
    candidateV2Hash: input.plan.candidateV2Hash,
    networkId: input.plan.networkId,
    chainId: input.plan.chainId,
    authorizationSetHash: input.authorization.authorizationSetHash,
    validFromUtc: input.validFromUtc ?? FIXED_LAUNCH_UTC,
    validUntilUtc: input.validUntilUtc ?? '2026-01-01T01:00:00.000Z',
    executionNonce: digestText('SUNREY_PERMIT_NONCE_V1', input.plan.planHash, input.plan.genesisHash),
  };
  return Object.freeze({
    schemaVersion: 1,
    ...body,
    singleUse: true,
    consumed: consumedNonces.has(body.executionNonce),
    revoked: revokedPermits.has(body.permitId),
    permitHash: permitHashOf(body),
  });
}

export function consumeLaunchExecutionPermit(permit: LaunchExecutionPermit): LaunchExecutionPermit {
  if (permit.revoked || revokedPermits.has(permit.permitId)) {
    throw new TypeError('PERMIT_REVOKED');
  }
  if (permit.consumed || consumedNonces.has(permit.executionNonce)) {
    throw new TypeError('PERMIT_REPLAYED');
  }
  consumedNonces.add(permit.executionNonce);
  return Object.freeze({ ...permit, consumed: true });
}

export function revokeLaunchExecutionPermit(
  permit: LaunchExecutionPermit,
  actorKind: 'HUMAN' | 'AI',
): LaunchExecutionPermit {
  if (actorKind !== 'HUMAN') {
    throw new TypeError('AI_CANNOT_AUTHORIZE');
  }
  if (permit.consumed) {
    throw new TypeError('cannot revoke a consumed execution permit after genesis started');
  }
  revokedPermits.add(permit.permitId);
  return Object.freeze({ ...permit, revoked: true });
}

export function permitEligible(permit: LaunchExecutionPermit, plan: ProductionLaunchPlan): {
  readonly ok: boolean;
  readonly code: 'OK' | 'PERMIT_REPLAYED' | 'PERMIT_REVOKED' | 'AUTHORIZATION_MISMATCH' | 'WRONG_PLAN' | 'WRONG_GENESIS';
} {
  if (permit.revoked || revokedPermits.has(permit.permitId)) {
    return { ok: false, code: 'PERMIT_REVOKED' };
  }
  if (permit.consumed || consumedNonces.has(permit.executionNonce)) {
    return { ok: false, code: 'PERMIT_REPLAYED' };
  }
  if (permit.launchPlanHash !== plan.planHash) {
    return { ok: false, code: 'WRONG_PLAN' };
  }
  if (permit.genesisHash !== plan.genesisHash) {
    return { ok: false, code: 'WRONG_GENESIS' };
  }
  if (permit.rcHash !== plan.mainnetRcHash || permit.candidateV2Hash !== plan.candidateV2Hash) {
    return { ok: false, code: 'AUTHORIZATION_MISMATCH' };
  }
  if (permit.networkId !== plan.networkId || permit.chainId !== plan.chainId) {
    return { ok: false, code: 'AUTHORIZATION_MISMATCH' };
  }
  return { ok: true, code: 'OK' };
}

export function permitAlreadyConsumed(nonce: string): boolean {
  return consumedNonces.has(nonce);
}
