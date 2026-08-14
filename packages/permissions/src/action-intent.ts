import { type Brand, brandAs } from './brand.ts';

/**
 * Unique id of a proposed action. Later services use this for idempotency.
 * Declaring a new action does not change this type.
 */
export type IntentId = Brand<string, 'IntentId'>;

export function asIntentId(value: string): IntentId {
  if (value.length === 0) {
    throw new TypeError('IntentId must be a non-empty string');
  }
  return brandAs<string, 'IntentId'>(value);
}

export const ACTOR_KINDS = ['CUSTOMER', 'AGENT', 'OPERATOR', 'SYSTEM'] as const;

export type ActorKind = (typeof ACTOR_KINDS)[number];

/**
 * Who proposed the intent. Agents may only propose; they never authorize.
 */
export type ActorRef = {
  readonly kind: ActorKind;
  readonly id: string;
};

/**
 * An action type is a string-literal const. Domain packages declare their own
 * literals (for example `export const OPEN_ACCOUNT = 'OPEN_ACCOUNT' as const`)
 * and pass them as `TActionType`. Do not widen the permissions envelope to
 * learn a payload — add a typed alias in the declaring package instead:
 *
 *   type OpenAccountIntent = ActionIntent<typeof OPEN_ACCOUNT, OpenAccountPayload>
 */
export type ActionIntent<
  TActionType extends string = string,
  TPayload = unknown,
> = {
  readonly intentId: IntentId;
  readonly actionType: TActionType;
  readonly payload: TPayload;
  readonly actor: ActorRef;
  readonly proposedAt: string;
};

export type CreateActionIntentInput<
  TActionType extends string,
  TPayload,
> = {
  readonly intentId: IntentId;
  readonly actionType: TActionType;
  readonly payload: TPayload;
  readonly actor: ActorRef;
  readonly proposedAt: string;
};

/**
 * Pure constructor for the ActionIntent envelope. Frozen. Does not authorize.
 */
export function createActionIntent<TActionType extends string, TPayload>(
  input: CreateActionIntentInput<TActionType, TPayload>,
): ActionIntent<TActionType, TPayload> {
  if (input.actionType.length === 0) {
    throw new TypeError('actionType must be a non-empty string');
  }
  if (input.proposedAt.length === 0) {
    throw new TypeError('proposedAt must be a non-empty UTC instant string');
  }
  if (input.actor.id.length === 0) {
    throw new TypeError('actor.id must be a non-empty string');
  }

  return Object.freeze({
    intentId: input.intentId,
    actionType: input.actionType,
    payload: input.payload,
    actor: Object.freeze({
      kind: input.actor.kind,
      id: input.actor.id,
    }),
    proposedAt: input.proposedAt,
  });
}

export function isActorKind(value: unknown): value is ActorKind {
  return typeof value === 'string' && (ACTOR_KINDS as readonly string[]).includes(value);
}
