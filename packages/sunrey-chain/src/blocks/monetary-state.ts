/**
 * Deterministic monetary/protocol state and resulting state commitment.
 */

import type { NativeAssetId } from '../protocol/assets.ts';
import { hashToHex, stateRoot } from './commitments.ts';

const NS_ASSET = 'ast/';
const NS_NONCE = 'non/';
const NS_SUPPLY = 'sup/';

export type AssetSupplySnapshot = {
  readonly assetId: NativeAssetId;
  readonly issued: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
};

export type AccountBalance = {
  readonly accountId: string;
  readonly assetId: NativeAssetId;
  readonly available: bigint;
  readonly locked: bigint;
};

export class MonetaryStateStore {
  private readonly balances = new Map<string, bigint>();
  private readonly locked = new Map<string, bigint>();
  private readonly nonces = new Map<string, bigint>();
  private readonly supply = new Map<NativeAssetId, AssetSupplySnapshot>();

  constructor() {
    for (const assetId of ['SUNREY_COIN', 'MOONREY_COIN'] as const) {
      this.supply.set(assetId, {
        assetId,
        issued: 0n,
        burned: 0n,
        circulating: 0n,
        locked: 0n,
      });
    }
  }

  clone(): MonetaryStateStore {
    const next = new MonetaryStateStore();
    next.balances.clear();
    next.locked.clear();
    next.nonces.clear();
    next.supply.clear();
    for (const [key, value] of this.balances) {
      next.balances.set(key, value);
    }
    for (const [key, value] of this.locked) {
      next.locked.set(key, value);
    }
    for (const [key, value] of this.nonces) {
      next.nonces.set(key, value);
    }
    for (const [key, value] of this.supply) {
      next.supply.set(key, { ...value });
    }
    return next;
  }

  balanceKey(accountId: string, assetId: NativeAssetId): string {
    return `${accountId}:${assetId}`;
  }

  availableBalance(accountId: string, assetId: NativeAssetId): bigint {
    return this.balances.get(this.balanceKey(accountId, assetId)) ?? 0n;
  }

  nonceOf(accountId: string): bigint {
    return this.nonces.get(accountId) ?? 0n;
  }

  supplyOf(assetId: NativeAssetId): AssetSupplySnapshot {
    const row = this.supply.get(assetId);
    if (!row) {
      throw new TypeError(`unknown asset: ${assetId}`);
    }
    return row;
  }

  mint(accountId: string, assetId: NativeAssetId, quantity: bigint): void {
    if (quantity < 0n) {
      throw new RangeError('mint quantity must be non-negative');
    }
    const key = this.balanceKey(accountId, assetId);
    this.balances.set(key, (this.balances.get(key) ?? 0n) + quantity);
    const supply = this.supplyOf(assetId);
    this.supply.set(assetId, {
      ...supply,
      issued: supply.issued + quantity,
      circulating: supply.circulating + quantity,
    });
  }

  transfer(input: {
    readonly from: string;
    readonly to: string;
    readonly assetId: NativeAssetId;
    readonly amount: bigint;
    readonly fee: bigint;
    readonly nonce: bigint;
  }): void {
    const expected = this.nonceOf(input.from);
    if (input.nonce !== expected) {
      throw new Error(`nonce mismatch: expected ${expected}, got ${input.nonce}`);
    }
    const total = input.amount + input.fee;
    const fromKey = this.balanceKey(input.from, input.assetId);
    const available = this.balances.get(fromKey) ?? 0n;
    if (available < total) {
      throw new Error('insufficient balance');
    }
    this.balances.set(fromKey, available - total);
    const toKey = this.balanceKey(input.to, input.assetId);
    this.balances.set(toKey, (this.balances.get(toKey) ?? 0n) + input.amount);
    this.nonces.set(input.from, input.nonce + 1n);
  }

  entries(): Map<string, Uint8Array> {
    const out = new Map<string, Uint8Array>();
    for (const [key, value] of this.balances) {
      out.set(`${NS_ASSET}${key}:available`, encodeU128(value));
    }
    for (const [key, value] of this.locked) {
      out.set(`${NS_ASSET}${key}:locked`, encodeU128(value));
    }
    for (const [accountId, nonce] of this.nonces) {
      out.set(`${NS_NONCE}${accountId}`, encodeU64(nonce));
    }
    for (const [assetId, supply] of this.supply) {
      out.set(`${NS_SUPPLY}${assetId}:issued`, encodeU128(supply.issued));
      out.set(`${NS_SUPPLY}${assetId}:burned`, encodeU128(supply.burned));
      out.set(`${NS_SUPPLY}${assetId}:circulating`, encodeU128(supply.circulating));
      out.set(`${NS_SUPPLY}${assetId}:locked`, encodeU128(supply.locked));
    }
    return out;
  }

  commitment(): string {
    return hashToHex(stateRoot(this.entries()));
  }

  listBalances(): readonly AccountBalance[] {
    const rows: AccountBalance[] = [];
    for (const [key, available] of this.balances) {
      const [accountId, assetId] = key.split(':') as [string, NativeAssetId];
      rows.push({
        accountId,
        assetId,
        available,
        locked: this.locked.get(key) ?? 0n,
      });
    }
    return rows.sort((left, right) =>
      left.accountId === right.accountId
        ? left.assetId.localeCompare(right.assetId)
        : left.accountId.localeCompare(right.accountId),
    );
  }
}

function encodeU64(value: bigint): Uint8Array {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(value);
  return out;
}

function encodeU128(value: bigint): Uint8Array {
  const out = Buffer.alloc(16);
  const hi = value >> 64n;
  const lo = value & ((1n << 64n) - 1n);
  out.writeBigUInt64BE(hi, 0);
  out.writeBigUInt64BE(lo, 8);
  return out;
}

export function reconcileNativeSupply(state: MonetaryStateStore): {
  readonly ok: boolean;
  readonly assets: readonly { readonly assetId: NativeAssetId; readonly ok: boolean; readonly detail: string }[];
} {
  const assets = (['SUNREY_COIN', 'MOONREY_COIN'] as const).map((assetId) => {
    const supply = state.supplyOf(assetId);
    const left = supply.issued - supply.burned;
    const right = supply.circulating + supply.locked;
    const ok = left === right;
    return {
      assetId,
      ok,
      detail: ok ? 'supply identity holds' : `issued-burned ${left} != circulating+locked ${right}`,
    };
  });
  return { ok: assets.every((row) => row.ok), assets };
}
