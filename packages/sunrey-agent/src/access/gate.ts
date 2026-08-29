import { createHash } from 'node:crypto';

import { asIntentId, type ActionIntent } from '../../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import type { AccessIntent, AccessIntentFailure } from '../../../agent/src/access-fabric/types.ts';

export type ProposeAccessIntentPayload = {
  readonly accessIntentId: string;
  readonly subjectId: string;
  readonly category: string;
  readonly kind: string;
  readonly experienceLevel: string;
  readonly purpose: string;
  readonly mandateRef: string | null;
  readonly consentRefs: readonly string[];
  readonly pegContextRefs: readonly string[];
  readonly intentHash: string;
};

export type AccessIntentGateRefusal = {
  readonly ok: false;
  readonly code: AccessIntentFailure['code'] | 'KERNEL_PATH_REQUIRED';
  readonly detail: string;
};

export function accessIntentHash(intent: AccessIntent): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        intentId: intent.intentId,
        subjectId: intent.subjectId,
        category: intent.category,
        kind: intent.kind,
        target: intent.target,
        geography: intent.geography,
        window: intent.window,
        purpose: intent.purpose,
      }),
    )
    .digest('hex');
}

/**
 * Converts a validated AccessIntent into a canonical ActionIntent envelope.
 * The agent never receives Execution Authority from this conversion.
 */
export function toProposeAccessActionIntent(input: {
  readonly intent: AccessIntent;
  readonly actorId: string;
  readonly requestedAt: ActionIntent['requestedAt'];
}): { readonly ok: true; readonly actionIntent: ActionIntent<ProposeAccessIntentPayload> } | AccessIntentGateRefusal {
  if (input.intent.confirmsReservation !== false || input.intent.executable !== false) {
    return { ok: false, code: 'MALFORMED_INTENT', detail: 'access intent must remain proposal-only' };
  }
  const hash = accessIntentHash(input.intent);
  return {
    ok: true,
    actionIntent: Object.freeze({
      id: asIntentId(`axi_act_${hash.slice(0, 20)}`),
      actionType: ACTION_TYPES.PROPOSE_ACCESS_INTENT,
      payload: Object.freeze({
        accessIntentId: input.intent.intentId,
        subjectId: input.intent.subjectId,
        category: input.intent.category,
        kind: input.intent.kind,
        experienceLevel: input.intent.experienceLevel,
        purpose: input.intent.purpose,
        mandateRef: input.intent.mandateRef,
        consentRefs: Object.freeze([...input.intent.consentRefs]),
        pegContextRefs: Object.freeze([...input.intent.pegContextRefs]),
        intentHash: hash,
      }),
      idempotencyKey: `access-intent:${input.intent.intentId}`,
      actorId: input.actorId,
      requestedAt: input.requestedAt,
      purpose: 'ACCESS_REQUEST',
    }),
  };
}

export function refuseAgentConfirmReservation(input: {
  readonly actorOriginatedFromAgent?: boolean;
}): AccessIntentGateRefusal {
  return {
    ok: false,
    code: 'PROHIBITED_CONFIRMATION',
    detail: input.actorOriginatedFromAgent
      ? 'agents cannot confirm access reservations'
      : 'reservation confirmation requires human authority outside the agent path',
  };
}

export function refuseSelfIssuedExecutionAuthority(): AccessIntentGateRefusal {
  return {
    ok: false,
    code: 'SELF_ISSUED_AUTHORITY',
    detail: 'execution authority cannot be self-issued by an agent proposal path',
  };
}
