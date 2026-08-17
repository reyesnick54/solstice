import { opsErr, opsOk, type OpsResult, type SignerLease, type SignerMode } from './types.ts';

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
