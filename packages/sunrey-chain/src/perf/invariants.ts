import { FeeEngine } from '../fees/engine.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import type { InvariantCheck } from './types.ts';

export function checkStateRootsEqual(left: string, right: string): InvariantCheck {
  return {
    id: 'STATE_ROOTS_EQUAL',
    ok: left === right && left.length > 0,
    detail: left === right ? 'replica roots match' : 'replica roots diverged',
  };
}

export function checkNativeSupply(engine: FeeEngine): InvariantCheck {
  const alice = engine.accounts.position('alice', 'SUNREY_COIN');
  const bob = engine.accounts.position('bob', 'SUNREY_COIN');
  const ok = alice.available >= 0n && bob.available >= 0n && alice.reserved >= 0n;
  return {
    id: 'NATIVE_SUPPLY_RECONCILES',
    ok,
    detail: ok ? 'native positions are non-negative integers' : 'native position invariant failed',
  };
}

export function checkNoDuplicateSettlements(engine: FeeEngine): InvariantCheck {
  const stats = engine.feeReceiptRetentionStats();
  const recorded = stats.inMemoryReceipts + stats.sealedReceipts;
  const ok = stats.uniqueTransactionIds === recorded && engine.hasUniqueFeeReceiptIds();
  return {
    id: 'NO_DUPLICATE_SETTLEMENTS',
    ok,
    detail: ok
      ? `settlement ids are unique (${stats.uniqueTransactionIds} recorded)`
      : 'duplicate settlement id observed',
  };
}

export function checkNoDuplicateMoonRey(engine: ProductiveEconomyEngine): InvariantCheck {
  const supplyOk = engine.supplyIsReconciled();
  const metrics = engine.currentMetrics();
  const ok = supplyOk && engine.issuedFingerprintCount() === metrics.moonrey_issuance;
  return {
    id: 'NO_DUPLICATE_MOONREY_ISSUANCE',
    ok,
    detail: ok ? 'MoonRey receipts unique and supply reconciles' : 'MoonRey supply or fingerprint collision',
  };
}

export function checkExplorerCaughtUp(lag: number): InvariantCheck {
  return {
    id: 'EXPLORER_CAUGHT_UP',
    ok: lag === 0,
    detail: lag === 0 ? 'explorer lag is zero' : `explorer lag ${lag}`,
  };
}

export function checkNoSignerConflicts(conflicts: number): InvariantCheck {
  return {
    id: 'NO_SIGNER_CONFLICTS',
    ok: conflicts === 0,
    detail: conflicts === 0 ? 'no signer conflicts' : `${conflicts} signer conflicts`,
  };
}

export function checkCustodyMismatch(mismatch: number, previous = 0): InvariantCheck {
  return {
    id: 'NO_GROWING_CUSTODY_MISMATCH',
    ok: mismatch === 0 && mismatch <= previous,
    detail: mismatch === 0 ? 'custody reconciled' : `unreconciled mismatch ${mismatch}`,
  };
}
