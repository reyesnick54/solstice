import type { CustomerId } from './customer.ts';
import type { ActorId } from './ids.ts';

/**
 * Who is asking the Kernel to execute an ActionIntent.
 * Agents are a distinct principal class: they never receive high-risk
 * capabilities such as adding or modifying a beneficiary.
 */
export const ACTOR_TYPES = ['CUSTOMER', 'OPERATOR', 'SYSTEM', 'INTERNAL_TOOL', 'AGENT'] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

export type Actor = {
  readonly type: ActorType;
  readonly id: ActorId;
  readonly customerId?: CustomerId;
};

export function freezeActor(actor: Actor): Actor {
  return Object.freeze({ ...actor });
}
