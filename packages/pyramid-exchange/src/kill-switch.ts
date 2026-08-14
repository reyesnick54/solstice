import { assertKernelAuthorization, type KernelAuthorization } from '@solstice/kernel';

export const KILL_SWITCH_IDS = [
  'EXCHANGE',
  'ASSET_PAIR',
  'CUSTOMER',
  'JURISDICTION',
  'WITHDRAWALS',
  'FIAT_GATEWAY',
] as const;

export type KillSwitchId = (typeof KILL_SWITCH_IDS)[number];

export type KillSwitchState = {
  readonly id: KillSwitchId;
  readonly engaged: boolean;
  readonly reason?: string;
  readonly scope?: string;
  readonly engagedAt?: string;
  readonly authorizationHash?: string;
};

/**
 * Independent operational halt flags. No AI component is consulted.
 * Each switch is operable when the agent runtime is not constructed.
 */
export class KillSwitchBoard {
  readonly #states = new Map<KillSwitchId, KillSwitchState>();
  readonly #pairHalts = new Set<string>();
  readonly #customerHalts = new Set<string>();
  readonly #jurisdictionHalts = new Set<string>();

  constructor() {
    for (const id of KILL_SWITCH_IDS) {
      this.#states.set(id, Object.freeze({ id, engaged: false }));
    }
  }

  snapshot(): readonly KillSwitchState[] {
    return [...this.#states.values()];
  }

  isEngaged(id: KillSwitchId, scope?: string): boolean {
    if (id === 'ASSET_PAIR' && scope) return this.#pairHalts.has(scope);
    if (id === 'CUSTOMER' && scope) return this.#customerHalts.has(scope);
    if (id === 'JURISDICTION' && scope) return this.#jurisdictionHalts.has(scope);
    return this.#states.get(id)?.engaged === true;
  }

  tradingHalted(input: {
    readonly pair?: string;
    readonly customerId?: string;
    readonly jurisdiction?: string;
  }): { readonly halted: boolean; readonly reason: string } {
    if (this.isEngaged('EXCHANGE')) {
      return { halted: true, reason: 'EXCHANGE kill switch engaged' };
    }
    if (input.pair && this.#pairHalts.has(input.pair)) {
      return { halted: true, reason: `ASSET_PAIR kill switch engaged for ${input.pair}` };
    }
    if (input.customerId && this.#customerHalts.has(input.customerId)) {
      return { halted: true, reason: `CUSTOMER kill switch engaged for ${input.customerId}` };
    }
    if (input.jurisdiction && this.#jurisdictionHalts.has(input.jurisdiction)) {
      return { halted: true, reason: `JURISDICTION kill switch engaged for ${input.jurisdiction}` };
    }
    return { halted: false, reason: '' };
  }

  /**
   * @kernelGated
   */
  engageKillSwitch(
    authorization: KernelAuthorization,
    input: {
      readonly id: KillSwitchId;
      readonly reason: string;
      readonly scope?: string;
      readonly engagedAt: string;
    },
  ): KillSwitchState {
    assertKernelAuthorization(authorization, 'TOGGLE_KILL_SWITCH');
    if (input.reason.trim().length === 0) {
      throw new Error('Kill switch engagement requires a recorded reason');
    }
    const state: KillSwitchState = Object.freeze({
      id: input.id,
      engaged: true,
      reason: input.reason,
      ...(input.scope === undefined ? {} : { scope: input.scope }),
      engagedAt: input.engagedAt,
      authorizationHash: authorization.permitHash,
    });
    this.#states.set(input.id, state);
    if (input.id === 'ASSET_PAIR' && input.scope) this.#pairHalts.add(input.scope);
    if (input.id === 'CUSTOMER' && input.scope) this.#customerHalts.add(input.scope);
    if (input.id === 'JURISDICTION' && input.scope) this.#jurisdictionHalts.add(input.scope);
    return state;
  }

  /**
   * @kernelGated
   */
  disengageKillSwitch(authorization: KernelAuthorization, id: KillSwitchId, scope?: string): KillSwitchState {
    assertKernelAuthorization(authorization, 'TOGGLE_KILL_SWITCH');
    const state: KillSwitchState = Object.freeze({ id, engaged: false });
    this.#states.set(id, state);
    if (id === 'ASSET_PAIR' && scope) this.#pairHalts.delete(scope);
    if (id === 'CUSTOMER' && scope) this.#customerHalts.delete(scope);
    if (id === 'JURISDICTION' && scope) this.#jurisdictionHalts.delete(scope);
    if (id === 'EXCHANGE') {
      this.#pairHalts.clear();
      this.#customerHalts.clear();
      this.#jurisdictionHalts.clear();
    }
    return state;
  }
}
