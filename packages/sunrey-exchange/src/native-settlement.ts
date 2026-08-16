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

export function okHold(lockId: string): Result<{ lockId: string }, NativeSettlementFailure> {
  return ok({ lockId });
}
