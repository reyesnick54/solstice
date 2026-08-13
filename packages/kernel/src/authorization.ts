import type { ActionKind } from './action-intent.ts';
import type { AuthorizingPosture } from './posture.ts';
import type { ActionIntentId, UtcInstant } from '@solstice/domain';
import { sha256Hex, canonicalJson } from './evidence.ts';

/**
 * Opaque Kernel authorization. Only `evaluateIntent` may mint one.
 * Forged objects fail `assertKernelAuthorization`.
 */
export type KernelAuthorization = {
  readonly intentId: ActionIntentId;
  readonly kind: ActionKind;
  readonly posture: AuthorizingPosture;
  readonly permitHash: string;
  readonly issuedAt: UtcInstant;
  readonly evidenceId: string;
  readonly __kernelBrand: 'KernelAuthorization';
};

const PERMIT_PREFIX = 'solstice-kernel-permit-v1:';

export function mintKernelAuthorization(input: {
  readonly intentId: ActionIntentId;
  readonly kind: ActionKind;
  readonly posture: AuthorizingPosture;
  readonly issuedAt: UtcInstant;
  readonly evidenceId: string;
  readonly proofFingerprint: string;
}): KernelAuthorization {
  const permitHash = sha256Hex(
    canonicalJson({
      prefix: PERMIT_PREFIX,
      intentId: input.intentId,
      kind: input.kind,
      posture: input.posture,
      issuedAt: input.issuedAt,
      evidenceId: input.evidenceId,
      proofFingerprint: input.proofFingerprint,
    }),
  );
  return Object.freeze({
    intentId: input.intentId,
    kind: input.kind,
    posture: input.posture,
    permitHash,
    issuedAt: input.issuedAt,
    evidenceId: input.evidenceId,
    __kernelBrand: 'KernelAuthorization',
  });
}

export function assertKernelAuthorization(
  authorization: KernelAuthorization,
  expectedKind: ActionKind,
): void {
  if (authorization === null || typeof authorization !== 'object') {
    throw new Error('Kernel authorization is required for this state-changing path');
  }
  if (authorization.__kernelBrand !== 'KernelAuthorization') {
    throw new Error('Kernel authorization brand missing; forged permits are refused');
  }
  if (typeof authorization.permitHash !== 'string' || authorization.permitHash.length !== 64) {
    throw new Error('Kernel authorization permit hash is invalid');
  }
  if (authorization.kind !== expectedKind) {
    throw new Error(
      `Kernel authorization kind ${authorization.kind} does not permit ${expectedKind}`,
    );
  }
  if (authorization.posture !== 'CLEAR' && authorization.posture !== 'REVIEW') {
    throw new Error('Kernel authorization posture cannot execute');
  }
}

export function assertKernelAuthorizationAny(
  authorization: KernelAuthorization,
  expectedKinds: readonly ActionKind[],
): void {
  if (authorization === null || typeof authorization !== 'object') {
    throw new Error('Kernel authorization is required for this state-changing path');
  }
  if (authorization.__kernelBrand !== 'KernelAuthorization') {
    throw new Error('Kernel authorization brand missing; forged permits are refused');
  }
  if (typeof authorization.permitHash !== 'string' || authorization.permitHash.length !== 64) {
    throw new Error('Kernel authorization permit hash is invalid');
  }
  if (!expectedKinds.includes(authorization.kind)) {
    throw new Error(
      `Kernel authorization kind ${authorization.kind} is not in ${expectedKinds.join('|')}`,
    );
  }
  if (authorization.posture !== 'CLEAR' && authorization.posture !== 'REVIEW') {
    throw new Error('Kernel authorization posture cannot execute');
  }
}

export function authorizationFingerprint(authorization: KernelAuthorization): string {
  return authorization.permitHash;
}
