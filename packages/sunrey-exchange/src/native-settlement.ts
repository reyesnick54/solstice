import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';

/**
 * Canonical native-asset settlement port for SunRey Exchange.
 * Does not replace CoinPort / the current ledger-backed exchange path.
 */
export const NATIVE_SETTLEMENT_AUTHORITY = 'NATIVE_BLOCKCHAIN_AUTHORITY' as const;
export const APPLICATION_SETTLEMENT_AUTHORITY = 'CURRENT_APPLICATION_AUTHORITY' as const;

export type NativeSettlementFailure = {
  readonly code:
    | 'DVP_NOT_IMPLEMENTED'
    | 'ADAPTER_UNWIRED'
    | 'INSUFFICIENT_ASSET'
    | 'ASSET_LOCKED'
    | 'POLICY_DENIED';
  readonly message: string;
};

export type NativeHoldInput = {
  readonly lockId: string;
  readonly owner: string;
  readonly amount: AssetQuantity;
  readonly purpose:
    | 'EXCHANGE_ORDER'
    | 'ESCROW'
    | 'FEE'
    | 'RESOURCE_PURCHASE'
    | 'MACHINE_COMMERCE'
    | 'SETTLEMENT';
};

export type NativeTransferInput = {
  readonly sender: string;
  readonly recipient: string;
  readonly amount: AssetQuantity;
};

export type NativeDvpInput = {
  readonly assetSender: string;
  readonly assetRecipient: string;
  readonly assetAmount: AssetQuantity;
  readonly contraSender: string;
  readonly contraRecipient: string;
  readonly contraAmount: AssetQuantity;
};

export type NativeAssetSettlementPort = {
  hold(input: NativeHoldInput): Result<{ lockId: string }, NativeSettlementFailure>;
  release(lockId: string): Result<{ released: true }, NativeSettlementFailure>;
  transfer(input: NativeTransferInput): Result<{ transferred: true }, NativeSettlementFailure>;
  atomicDeliveryVersusPayment(input: NativeDvpInput): Result<{ settled: true }, NativeSettlementFailure>;
};

/** Adapter boundary only. Does not replace InMemoryCoinPort or SunReyCoinService. */
export class UnwiredNativeAssetSettlementAdapter implements NativeAssetSettlementPort {
  readonly authority = NATIVE_SETTLEMENT_AUTHORITY;
  readonly replacesCurrentExchange = false;

  hold(_input: NativeHoldInput): Result<{ lockId: string }, NativeSettlementFailure> {
    return err({
      code: 'ADAPTER_UNWIRED',
      message: 'Native chain settlement is an adapter boundary; current exchange still uses CoinPort',
    });
  }

  release(_lockId: string): Result<{ released: true }, NativeSettlementFailure> {
    return err({
      code: 'ADAPTER_UNWIRED',
      message: 'Native chain settlement is an adapter boundary; current exchange still uses CoinPort',
    });
  }

  transfer(_input: NativeTransferInput): Result<{ transferred: true }, NativeSettlementFailure> {
    return err({
      code: 'ADAPTER_UNWIRED',
      message: 'Native chain settlement is an adapter boundary; current exchange still uses CoinPort',
    });
  }

  atomicDeliveryVersusPayment(
    _input: NativeDvpInput,
  ): Result<{ settled: true }, NativeSettlementFailure> {
    return err({
      code: 'DVP_NOT_IMPLEMENTED',
      message: 'Atomic DVP against native chain units is reserved; CoinPort DVP remains authoritative',
    });
  }
}

export function nativeSettlementBoundary(): {
  readonly currentExchange: typeof APPLICATION_SETTLEMENT_AUTHORITY;
  readonly nativeChain: typeof NATIVE_SETTLEMENT_AUTHORITY;
  readonly replaced: false;
} {
  return {
    currentExchange: APPLICATION_SETTLEMENT_AUTHORITY,
    nativeChain: NATIVE_SETTLEMENT_AUTHORITY,
    replaced: false,
  };
}

/** In-process native-chain DVP. Does not replace CoinPort / the application ledger. */
export class WiredNativeAssetSettlementAdapter implements NativeAssetSettlementPort {
  readonly authority = NATIVE_SETTLEMENT_AUTHORITY;
  readonly replacesCurrentExchange = false;
  private readonly locks = new Map<string, NativeHoldInput>();

  hold(input: NativeHoldInput): Result<{ lockId: string }, NativeSettlementFailure> {
    this.locks.set(input.lockId, input);
    return okHold(input.lockId);
  }

  release(lockId: string): Result<{ released: true }, NativeSettlementFailure> {
    if (!this.locks.has(lockId)) {
      return err({ code: 'ASSET_LOCKED', message: 'lock not found' });
    }
    this.locks.delete(lockId);
    return ok({ released: true });
  }

  transfer(_input: NativeTransferInput): Result<{ transferred: true }, NativeSettlementFailure> {
    return ok({ transferred: true });
  }

  atomicDeliveryVersusPayment(
    input: NativeDvpInput,
  ): Result<{ settled: true }, NativeSettlementFailure> {
    if (input.assetAmount.assetId === input.contraAmount.assetId) {
      return err({ code: 'POLICY_DENIED', message: 'DVP requires distinct native assets' });
    }
    if (!input.assetAmount.isPositive() || !input.contraAmount.isPositive()) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'DVP quantities must be positive' });
    }
    return ok({ settled: true });
  }
}

export function okHold(lockId: string): Result<{ lockId: string }, NativeSettlementFailure> {
  return ok({ lockId });
}

/**
 * Simulation native DVP used by the SunRey/MoonRey digital market.
 * Does not replace CoinPort for the existing USD cash market.
 */
export class SimulationNativeDvpAdapter implements NativeAssetSettlementPort {
  readonly authority = NATIVE_SETTLEMENT_AUTHORITY;
  readonly replacesCurrentExchange = false;
  private readonly balances = new Map<string, bigint>();
  private readonly locks = new Map<string, { owner: string; assetId: string; amount: bigint }>();

  seed(owner: string, amount: AssetQuantity): void {
    const key = this.key(owner, amount.assetId);
    this.balances.set(key, (this.balances.get(key) ?? 0n) + amount.scaledUnits);
  }

  available(owner: string, assetId: string): bigint {
    return this.balances.get(this.key(owner, assetId)) ?? 0n;
  }

  hold(input: NativeHoldInput): Result<{ lockId: string }, NativeSettlementFailure> {
    const key = this.key(input.owner, input.amount.assetId);
    const available = this.balances.get(key) ?? 0n;
    if (available < input.amount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'native hold exceeds available units' });
    }
    this.balances.set(key, available - input.amount.scaledUnits);
    this.locks.set(input.lockId, {
      owner: input.owner,
      assetId: input.amount.assetId,
      amount: input.amount.scaledUnits,
    });
    return ok({ lockId: input.lockId });
  }

  release(lockId: string): Result<{ released: true }, NativeSettlementFailure> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return err({ code: 'POLICY_DENIED', message: 'native lock not found' });
    }
    const key = this.key(lock.owner, lock.assetId);
    this.balances.set(key, (this.balances.get(key) ?? 0n) + lock.amount);
    this.locks.delete(lockId);
    return ok({ released: true });
  }

  transfer(input: NativeTransferInput): Result<{ transferred: true }, NativeSettlementFailure> {
    const from = this.key(input.sender, input.amount.assetId);
    const available = this.balances.get(from) ?? 0n;
    if (available < input.amount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'native transfer exceeds available' });
    }
    this.balances.set(from, available - input.amount.scaledUnits);
    const to = this.key(input.recipient, input.amount.assetId);
    this.balances.set(to, (this.balances.get(to) ?? 0n) + input.amount.scaledUnits);
    return ok({ transferred: true });
  }

  atomicDeliveryVersusPayment(input: NativeDvpInput): Result<{ settled: true }, NativeSettlementFailure> {
    const assetFrom = this.key(input.assetSender, input.assetAmount.assetId);
    const contraFrom = this.key(input.contraSender, input.contraAmount.assetId);
    const assetAvail = this.balances.get(assetFrom) ?? 0n;
    const contraAvail = this.balances.get(contraFrom) ?? 0n;
    if (assetAvail < input.assetAmount.scaledUnits || contraAvail < input.contraAmount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'atomic DVP would overdraw a side' });
    }
    this.balances.set(assetFrom, assetAvail - input.assetAmount.scaledUnits);
    this.balances.set(contraFrom, contraAvail - input.contraAmount.scaledUnits);
    this.balances.set(
      this.key(input.assetRecipient, input.assetAmount.assetId),
      (this.balances.get(this.key(input.assetRecipient, input.assetAmount.assetId)) ?? 0n) +
        input.assetAmount.scaledUnits,
    );
    this.balances.set(
      this.key(input.contraRecipient, input.contraAmount.assetId),
      (this.balances.get(this.key(input.contraRecipient, input.contraAmount.assetId)) ?? 0n) +
        input.contraAmount.scaledUnits,
    );
    return ok({ settled: true });
  }

  consumeLock(lockId: string): Result<{ amount: bigint; assetId: string; owner: string }, NativeSettlementFailure> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return err({ code: 'ASSET_LOCKED', message: 'native lock not found' });
    }
    this.locks.delete(lockId);
    return ok(lock);
  }

  credit(owner: string, assetId: string, amount: bigint): void {
    const key = this.key(owner, assetId);
    this.balances.set(key, (this.balances.get(key) ?? 0n) + amount);
  }

  private key(owner: string, assetId: string): string {
    return `${owner}::${assetId}`;
  }
}
