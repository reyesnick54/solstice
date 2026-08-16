import { createHash, randomUUID } from 'node:crypto';

import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../ids.ts';
import type { NativeFinality } from '../taxonomy.ts';
import {
  EXCHANGE_SETTLEMENT_ISSUER,
  NATIVE_SETTLEMENT_POLICY,
  type ExchangeSettlementIntent,
  type NativeFeeLeg,
} from './types.ts';

export type SimulatedHolding = {
  available: bigint;
  locked: bigint;
};

export type SimulatedLock = {
  lockId: string;
  owner: string;
  assetId: string;
  quantity: bigint;
  status: 'LOCKED' | 'RELEASED';
};

export type SimulatedTx = {
  readonly transactionId: string;
  readonly kind: 'TRANSFER' | 'LOCK' | 'UNLOCK' | 'ISSUE' | 'EXCHANGE_SETTLEMENT';
  readonly settlementId: string | null;
  status: 'PENDING_PROPOSAL' | 'BFT_FINALIZED' | 'REJECTED';
  readonly payload: Record<string, unknown>;
};

export class InMemoryNativeChain {
  readonly networkId = 'net_sunrey_development';
  readonly chainId = 'chn_sunrey_development';
  height = 0n;
  blockId = 'blk_genesis';
  stateRoot = '0'.repeat(64);
  readonly holdings = new Map<string, SimulatedHolding>();
  readonly locks = new Map<string, SimulatedLock>();
  readonly txs = new Map<string, SimulatedTx>();
  readonly usedSettlements = new Set<string>();
  readonly settledTrades = new Set<string>();
  readonly usedNonces = new Set<string>();
  readonly exchangeKeys = new Set<string>();
  readonly issued = new Map<string, bigint>();
  readonly mempool: string[] = [];

  key(owner: string, assetId: string): string {
    return `${owner}:${assetId}`;
  }

  holding(owner: string, assetId: string): SimulatedHolding {
    return this.holdings.get(this.key(owner, assetId)) ?? { available: 0n, locked: 0n };
  }

  setHolding(owner: string, assetId: string, next: SimulatedHolding): void {
    if (next.available === 0n && next.locked === 0n) {
      this.holdings.delete(this.key(owner, assetId));
    } else {
      this.holdings.set(this.key(owner, assetId), next);
    }
  }

  registerExchangeKey(signature: string): void {
    this.exchangeKeys.add(signature);
  }

  issue(owner: string, assetId: string, quantity: bigint): string {
    this.assertAsset(assetId);
    const current = this.holding(owner, assetId);
    this.setHolding(owner, assetId, { ...current, available: current.available + quantity });
    this.issued.set(assetId, (this.issued.get(assetId) ?? 0n) + quantity);
    return this.commit('ISSUE', null, { owner, assetId, quantity: quantity.toString() });
  }

  transfer(from: string, to: string, assetId: string, quantity: bigint): string {
    this.assertAsset(assetId);
    const sender = this.holding(from, assetId);
    if (sender.available < quantity) {
      throw Object.assign(new Error('INSUFFICIENT_ASSET'), { code: 'INSUFFICIENT_ASSET' });
    }
    this.setHolding(from, assetId, { ...sender, available: sender.available - quantity });
    const recipient = this.holding(to, assetId);
    this.setHolding(to, assetId, { ...recipient, available: recipient.available + quantity });
    return this.commit('TRANSFER', null, { from, to, assetId, quantity: quantity.toString() });
  }

  lock(lockId: string, owner: string, assetId: string, quantity: bigint): string {
    if (this.locks.has(lockId)) {
      throw Object.assign(new Error('STATEFUL_INVALID'), { code: 'STATEFUL_INVALID' });
    }
    const current = this.holding(owner, assetId);
    if (current.available < quantity) {
      throw Object.assign(new Error('INSUFFICIENT_ASSET'), { code: 'INSUFFICIENT_ASSET' });
    }
    this.setHolding(owner, assetId, {
      available: current.available - quantity,
      locked: current.locked + quantity,
    });
    this.locks.set(lockId, { lockId, owner, assetId, quantity, status: 'LOCKED' });
    return this.commit('LOCK', null, { lockId, owner, assetId, quantity: quantity.toString() });
  }

  unlock(lockId: string): string {
    const lock = this.locks.get(lockId);
    if (!lock || lock.status !== 'LOCKED') {
      throw Object.assign(new Error('LOCK_NOT_FOUND'), { code: 'LOCK_NOT_FOUND' });
    }
    const current = this.holding(lock.owner, lock.assetId);
    this.setHolding(lock.owner, lock.assetId, {
      available: current.available + lock.quantity,
      locked: current.locked - lock.quantity,
    });
    this.locks.set(lockId, { ...lock, status: 'RELEASED', quantity: 0n });
    return this.commit('UNLOCK', null, { lockId });
  }

  submitSettlement(intent: ExchangeSettlementIntent): SimulatedTx {
    const transactionId = `ntx_${randomUUID().replace(/-/g, '')}`;
    const tx: SimulatedTx = {
      transactionId,
      kind: 'EXCHANGE_SETTLEMENT',
      settlementId: intent.settlementId,
      status: 'PENDING_PROPOSAL',
      payload: { intent },
    };
    this.txs.set(transactionId, tx);
    this.mempool.push(transactionId);
    return tx;
  }

  finalize(transactionId: string): SimulatedTx {
    const tx = this.txs.get(transactionId);
    if (!tx) {
      throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
    }
    if (tx.status === 'BFT_FINALIZED') {
      return tx;
    }
    if (tx.kind === 'EXCHANGE_SETTLEMENT') {
      this.applySettlement(tx.payload.intent as ExchangeSettlementIntent);
    }
    tx.status = 'BFT_FINALIZED';
    this.height += 1n;
    this.blockId = `blk_${this.height.toString()}`;
    this.stateRoot = createHash('sha256').update(this.canonical()).digest('hex');
    return tx;
  }

  rejectPending(transactionId: string, code: string): SimulatedTx {
    const tx = this.txs.get(transactionId);
    if (!tx) {
      throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
    }
    tx.status = 'REJECTED';
    tx.payload = { ...tx.payload, reject: code };
    return tx;
  }

  query(transactionId: string): { found: boolean; finality: NativeFinality | 'UNKNOWN'; settlementId: string | null } {
    const tx = this.txs.get(transactionId);
    if (!tx) {
      return { found: false, finality: 'UNKNOWN', settlementId: null };
    }
    return {
      found: true,
      finality: tx.status === 'BFT_FINALIZED' ? 'BFT_FINALIZED' : tx.status === 'PENDING_PROPOSAL' ? 'PENDING_PROPOSAL' : 'UNKNOWN',
      settlementId: tx.settlementId,
    };
  }

  applySettlement(intent: ExchangeSettlementIntent): void {
    if (intent.policyVersion !== NATIVE_SETTLEMENT_POLICY) {
      throw Object.assign(new Error('POLICY_DENIED'), { code: 'POLICY_DENIED' });
    }
    if (intent.networkId !== this.networkId) {
      throw Object.assign(new Error('WRONG_NETWORK'), { code: 'WRONG_NETWORK' });
    }
    if (intent.chainId !== this.chainId) {
      throw Object.assign(new Error('WRONG_CHAIN'), { code: 'WRONG_CHAIN' });
    }
    if (!intent.exchangeSignature.startsWith(`${EXCHANGE_SETTLEMENT_ISSUER}:`)) {
      throw Object.assign(new Error('WRONG_AUTHORITY'), { code: 'WRONG_AUTHORITY' });
    }
    if (this.exchangeKeys.size > 0 && !this.exchangeKeys.has(intent.exchangeSignature)) {
      throw Object.assign(new Error('WRONG_AUTHORITY'), { code: 'WRONG_AUTHORITY' });
    }
    if (this.usedSettlements.has(intent.settlementId) || this.usedNonces.has(`${intent.exchangeSignature}:${intent.nonce}`)) {
      throw Object.assign(new Error('SETTLEMENT_REPLAY'), { code: 'SETTLEMENT_REPLAY' });
    }
    for (const tradeId of intent.tradeIds) {
      if (this.settledTrades.has(tradeId)) {
        throw Object.assign(new Error('TRADE_ALREADY_SETTLED'), { code: 'TRADE_ALREADY_SETTLED' });
      }
    }
    if (intent.baseAsset === intent.quoteAsset) {
      throw Object.assign(new Error('WRONG_ASSET'), { code: 'WRONG_ASSET' });
    }
    const snapshot = this.snapshot();
    try {
      this.consume(intent.sellerCustody, intent.baseAsset, intent.baseQuantity, intent.reservationRefs);
      this.credit(intent.buyerCustody, intent.baseAsset, intent.baseQuantity);
      this.consume(intent.buyerCustody, intent.quoteAsset, intent.quoteQuantity, intent.reservationRefs);
      this.credit(intent.sellerCustody, intent.quoteAsset, intent.quoteQuantity);
      for (const fee of intent.feeLegs) {
        const payer = this.payerCustody(fee, intent);
        try {
          this.consume(payer, fee.assetId, fee.quantity, intent.reservationRefs);
        } catch {
          this.debitAvailable(payer, fee.assetId, fee.quantity);
        }
        this.credit(fee.recipient, fee.assetId, fee.quantity);
      }
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
    this.usedSettlements.add(intent.settlementId);
    this.usedNonces.add(`${intent.exchangeSignature}:${intent.nonce}`);
    for (const tradeId of intent.tradeIds) {
      this.settledTrades.add(tradeId);
    }
    if (this.exchangeKeys.size === 0) {
      this.exchangeKeys.add(intent.exchangeSignature);
    }
  }

  private payerCustody(fee: NativeFeeLeg, intent: ExchangeSettlementIntent): string {
    return fee.payer === intent.buyer ? intent.buyerCustody : intent.sellerCustody;
  }

  private consume(owner: string, assetId: string, quantity: bigint, reservationRefs: readonly string[]): void {
    let remaining = quantity;
    for (const lockId of reservationRefs) {
      const lock = this.locks.get(lockId);
      if (!lock || lock.status !== 'LOCKED' || lock.owner !== owner || lock.assetId !== assetId) {
        continue;
      }
      const take = lock.quantity < remaining ? lock.quantity : remaining;
      const current = this.holding(owner, assetId);
      this.setHolding(owner, assetId, { ...current, locked: current.locked - take });
      const nextQty = lock.quantity - take;
      this.locks.set(lockId, { ...lock, quantity: nextQty, status: nextQty === 0n ? 'RELEASED' : 'LOCKED' });
      remaining -= take;
      if (remaining === 0n) {
        return;
      }
    }
    if (remaining > 0n) {
      throw Object.assign(new Error('INSUFFICIENT_RESERVATION'), { code: 'INSUFFICIENT_RESERVATION' });
    }
  }

  private debitAvailable(owner: string, assetId: string, quantity: bigint): void {
    const current = this.holding(owner, assetId);
    if (current.available < quantity) {
      throw Object.assign(new Error('INSUFFICIENT_ASSET'), { code: 'INSUFFICIENT_ASSET' });
    }
    this.setHolding(owner, assetId, { ...current, available: current.available - quantity });
  }

  private credit(owner: string, assetId: string, quantity: bigint): void {
    const current = this.holding(owner, assetId);
    this.setHolding(owner, assetId, { ...current, available: current.available + quantity });
  }

  private snapshot(): string {
    return JSON.stringify({
      holdings: [...this.holdings.entries()].map(([key, value]) => [
        key,
        { available: value.available.toString(), locked: value.locked.toString() },
      ]),
      locks: [...this.locks.entries()].map(([key, value]) => [
        key,
        { ...value, quantity: value.quantity.toString() },
      ]),
    });
  }

  private restore(raw: string): void {
    const parsed = JSON.parse(raw) as {
      holdings: Array<[string, { available: string; locked: string }]>;
      locks: Array<[string, { lockId: string; owner: string; assetId: string; quantity: string; status: SimulatedLock['status'] }]>;
    };
    this.holdings.clear();
    for (const [key, value] of parsed.holdings) {
      this.holdings.set(key, { available: BigInt(value.available), locked: BigInt(value.locked) });
    }
    this.locks.clear();
    for (const [key, value] of parsed.locks) {
      this.locks.set(key, { ...value, quantity: BigInt(value.quantity) });
    }
  }

  private commit(kind: SimulatedTx['kind'], settlementId: string | null, payload: Record<string, unknown>): string {
    this.height += 1n;
    this.blockId = `blk_${this.height.toString()}`;
    this.stateRoot = createHash('sha256').update(this.canonical()).digest('hex');
    const transactionId = `ntx_${randomUUID().replace(/-/g, '')}`;
    this.txs.set(transactionId, {
      transactionId,
      kind,
      settlementId,
      status: 'BFT_FINALIZED',
      payload,
    });
    return transactionId;
  }

  private canonical(): string {
    return [
      ...[...this.holdings.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value.available}:${value.locked}`),
      ...[...this.locks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value.quantity}:${value.status}`),
      ...[...this.usedSettlements].sort(),
    ].join('|');
  }

  private assertAsset(assetId: string): void {
    if (assetId !== SUNREY_COIN_NATIVE_ASSET_ID && assetId !== MOONREY_COIN_NATIVE_ASSET_ID) {
      throw Object.assign(new Error('WRONG_ASSET'), { code: 'WRONG_ASSET' });
    }
  }

  reconcile(): void {
    for (const assetId of [SUNREY_COIN_NATIVE_ASSET_ID, MOONREY_COIN_NATIVE_ASSET_ID]) {
      let held = 0n;
      for (const [key, holding] of this.holdings) {
        if (key.endsWith(`:${assetId}`)) {
          held += holding.available + holding.locked;
        }
      }
      const issued = this.issued.get(assetId) ?? 0n;
      if (held !== issued) {
        throw Object.assign(new Error('SUPPLY_INCONSISTENCY'), { code: 'SUPPLY_INCONSISTENCY' });
      }
    }
  }
}
