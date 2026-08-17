import { DEVELOPMENT_CHAIN_ID, type SignerRole } from './types.ts';
import { opsErr, opsOk, type OpsResult, type SignerLease, type SignerMode } from './types.ts';

export type SignerFenceRecord = {
import {
  DEVELOPMENT_CHAIN_ID,
  opsErr,
  opsOk,
  type OpsResult,
  type SignerLease,
  type SignerMode,
  type SignerRole,
} from './types.ts';

export type ResilienceSignerFence = {
  readonly validatorId: string;
  readonly chainId: string;
  readonly activeSite: string | null;
  readonly passiveSite: string | null;
  readonly epoch: bigint;
  readonly leaseId: string | null;
};

/** @deprecated use SignerFenceRecord — kept for Chunk 55 call sites */
export type SignerFenceState = SignerFenceRecord;

export class SignerFencingController {
  readonly #fences = new Map<string, SignerFenceRecord>();
  readonly #roles = new Map<string, SignerRole>();

  register(validatorId: string, activeSite: string, passiveSite: string, chainId = DEVELOPMENT_CHAIN_ID): SignerFenceRecord {
    const fence: SignerFenceRecord = {
  readonly #fences = new Map<string, ResilienceSignerFence>();
  readonly #roles = new Map<string, SignerRole>();

  register(validatorId: string, activeSite: string, passiveSite: string, chainId = DEVELOPMENT_CHAIN_ID): ResilienceSignerFence {
    const fence: ResilienceSignerFence = {
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

  fence(validatorId: string): SignerFenceRecord {
  fence(validatorId: string): ResilienceSignerFence {
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
  }): SignerFenceRecord {
  }): ResilienceSignerFence {
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
    const next: SignerFenceRecord = {
    const next: ResilienceSignerFence = {
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

export class SignerFence {
  #lease: SignerLease | null = null;
  readonly #now: () => string;

  constructor(now: () => string = () => new Date().toISOString()) {
    this.#now = now;
  }

  current(): SignerLease | null {
    return this.#lease;
  }

  acquire(consensusKeyId: string, holderId: string, ttlMs: number): OpsResult<SignerLease> {
    const now = Date.parse(this.#now());
    if (this.#lease && this.#lease.consensusKeyId === consensusKeyId) {
      const expires = Date.parse(this.#lease.expiresAtUtc);
      if (this.#lease.mode === 'ACTIVE' && this.#lease.holderId !== holderId && expires > now) {
        return opsErr(
          'DUPLICATE_ACTIVE_SIGNER',
          `consensus key ${consensusKeyId} is already leased by ${this.#lease.holderId}`,
        );
      }
    }
    const token = (this.#lease?.fencingToken ?? 0n) + 1n;
    const lease: SignerLease = Object.freeze({
      consensusKeyId,
      holderId,
      fencingToken: token,
      expiresAtUtc: new Date(now + ttlMs).toISOString(),
      mode: 'ACTIVE',
    });
    this.#lease = lease;
    return opsOk(lease);
  }

  demote(holderId: string): OpsResult<SignerLease> {
    if (!this.#lease || this.#lease.holderId !== holderId) {
      return opsErr('LEASE_FENCED', 'only the active holder can demote itself');
    }
    const next: SignerLease = Object.freeze({ ...this.#lease, mode: 'PASSIVE' as SignerMode });
    this.#lease = next;
    return opsOk(next);
  }

  assertActive(holderId: string, token: bigint): OpsResult<true> {
    if (!this.#lease || this.#lease.mode !== 'ACTIVE') {
      return opsErr('LEASE_FENCED', 'no active signer lease');
    }
    if (this.#lease.holderId !== holderId || this.#lease.fencingToken !== token) {
      return opsErr('LEASE_FENCED', 'stale or foreign fencing token');
    }
    if (Date.parse(this.#lease.expiresAtUtc) <= Date.parse(this.#now())) {
      return opsErr('LEASE_FENCED', 'signer lease expired');
    }
    return opsOk(true);
  }
}
