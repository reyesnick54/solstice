import { DEVELOPMENT_CHAIN_ID, type SignerRole } from './types.ts';

export type SignerFence = {
  readonly validatorId: string;
  readonly chainId: string;
  readonly activeSite: string | null;
  readonly passiveSite: string | null;
  readonly epoch: bigint;
  readonly leaseId: string | null;
};

export class SignerFencingController {
  readonly #fences = new Map<string, SignerFence>();
  readonly #roles = new Map<string, SignerRole>();

  register(validatorId: string, activeSite: string, passiveSite: string, chainId = DEVELOPMENT_CHAIN_ID): SignerFence {
    const fence: SignerFence = {
      validatorId,
      chainId,
      activeSite,
      passiveSite,
      epoch: 1n,
      leaseId: `lease:${validatorId}:1`,
    };
    this.#fences.set(validatorId, fence);
    this.#roles.set(siteKey(validatorId, activeSite), 'ACTIVE');
    this.#roles.set(siteKey(validatorId, passiveSite), 'PASSIVE');
    return fence;
  }

  role(validatorId: string, site: string): SignerRole {
    return this.#roles.get(siteKey(validatorId, site)) ?? 'DISABLED';
  }

  fence(validatorId: string): SignerFence {
    const found = this.#fences.get(validatorId);
    if (!found) {
      throw new Error(`unknown validator fence ${validatorId}`);
    }
    return found;
  }

  activatePassive(input: {
    readonly validatorId: string;
    readonly operatorAuthorized: boolean;
    readonly chainId?: string;
  }): SignerFence {
    if (!input.operatorAuthorized) {
      throw new Error('signer fencing requires operator authorization');
    }
    const current = this.fence(input.validatorId);
    const chainId = input.chainId ?? DEVELOPMENT_CHAIN_ID;
    if (current.chainId !== chainId) {
      throw new Error('wrong-chain fencing rejected');
    }
    if (!current.passiveSite || !current.activeSite) {
      throw new Error('passive infrastructure is not registered');
    }
    const activeRole = this.role(input.validatorId, current.activeSite);
    const passiveRole = this.role(input.validatorId, current.passiveSite);
    if (activeRole === 'ACTIVE' && passiveRole === 'ACTIVE') {
      throw new Error('two active signers rejected by fencing');
    }
    this.#roles.set(siteKey(input.validatorId, current.activeSite), 'DISABLED');
    const next: SignerFence = {
      validatorId: current.validatorId,
      chainId: current.chainId,
      activeSite: current.passiveSite,
      passiveSite: current.activeSite,
      epoch: current.epoch + 1n,
      leaseId: `lease:${current.validatorId}:${(current.epoch + 1n).toString()}`,
    };
    this.#roles.set(siteKey(input.validatorId, next.activeSite!), 'ACTIVE');
    this.#roles.set(siteKey(input.validatorId, next.passiveSite!), 'PASSIVE');
    const activeCount = [...this.#roles.entries()].filter(
      ([key, role]) => key.startsWith(`${input.validatorId}:`) && role === 'ACTIVE',
    ).length;
    if (activeCount !== 1) {
      throw new Error('two active signers rejected by fencing');
    }
    this.#fences.set(input.validatorId, next);
    return next;
  }

  rejectDualActive(validatorId: string): void {
    const current = this.fence(validatorId);
    if (!current.activeSite || !current.passiveSite) {
      return;
    }
    this.#roles.set(siteKey(validatorId, current.activeSite), 'ACTIVE');
    this.#roles.set(siteKey(validatorId, current.passiveSite), 'ACTIVE');
    const activeCount = [...this.#roles.values()].filter((role) => role === 'ACTIVE').length;
    if (activeCount > 1) {
      this.#roles.set(siteKey(validatorId, current.passiveSite), 'PASSIVE');
      throw new Error('two active signers rejected by fencing');
    }
  }
}

function siteKey(validatorId: string, site: string): string {
  return `${validatorId}:${site}`;
}
