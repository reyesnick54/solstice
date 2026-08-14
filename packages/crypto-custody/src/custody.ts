/**
 * Crypto-custody subsystem boundary.
 *
 * SECURITY REVIEW REQUIRED before any implementation that handles real
 * MPC or HSM key material. That event is the extraction trigger for this
 * subsystem (see docs/architecture/subsystem-manifest.md) and requires a
 * security specialist review before any implementation.
 *
 * This interface admits only a simulated provider. There is no method to
 * import a seed phrase, export a private key, generate a mnemonic, or
 * contact a wallet provider. Those methods must not be added until the
 * extraction trigger fires and the review is recorded.
 */

export type CustodyAccountRef = {
  readonly accountId: string;
  readonly holderClass: 'CUSTOMER' | 'CORPORATE';
};

export type CustodyHold = {
  readonly accountId: string;
  readonly holderClass: 'CUSTOMER' | 'CORPORATE';
  readonly asset: 'PYR';
  readonly minorUnits: bigint;
};

export interface CustodyProvider {
  hold(account: CustodyAccountRef, minorUnits: bigint): CustodyHold;
  release(account: CustodyAccountRef, minorUnits: bigint): CustodyHold;
  position(accountId: string): bigint;
}

/**
 * In-memory simulated custodian. Stores integer PYR minor units only.
 * Does not generate, store, or handle key material.
 */
export class SimulatedCustodyProvider implements CustodyProvider {
  readonly #positions = new Map<string, { holderClass: 'CUSTOMER' | 'CORPORATE'; minorUnits: bigint }>();

  hold(account: CustodyAccountRef, minorUnits: bigint): CustodyHold {
    if (typeof minorUnits !== 'bigint' || minorUnits < 0n) {
      throw new TypeError('custody hold requires a non-negative bigint');
    }
    const current = this.#positions.get(account.accountId);
    if (current && current.holderClass !== account.holderClass) {
      throw new Error('customer and corporate PYR must not share a custody account');
    }
    const next = (current?.minorUnits ?? 0n) + minorUnits;
    this.#positions.set(account.accountId, {
      holderClass: account.holderClass,
      minorUnits: next,
    });
    return Object.freeze({
      accountId: account.accountId,
      holderClass: account.holderClass,
      asset: 'PYR' as const,
      minorUnits: next,
    });
  }

  release(account: CustodyAccountRef, minorUnits: bigint): CustodyHold {
    if (typeof minorUnits !== 'bigint' || minorUnits < 0n) {
      throw new TypeError('custody release requires a non-negative bigint');
    }
    const current = this.#positions.get(account.accountId);
    if (!current || current.holderClass !== account.holderClass) {
      throw new Error('custody account not found for this holder class');
    }
    if (current.minorUnits < minorUnits) {
      throw new Error('insufficient simulated custody position');
    }
    const next = current.minorUnits - minorUnits;
    this.#positions.set(account.accountId, { holderClass: account.holderClass, minorUnits: next });
    return Object.freeze({
      accountId: account.accountId,
      holderClass: account.holderClass,
      asset: 'PYR' as const,
      minorUnits: next,
    });
  }

  position(accountId: string): bigint {
    return this.#positions.get(accountId)?.minorUnits ?? 0n;
  }
}
