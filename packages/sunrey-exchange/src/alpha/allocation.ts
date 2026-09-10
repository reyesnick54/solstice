import { randomUUID } from 'node:crypto';

import {
  MOONREY_COIN_NATIVE_ASSET_ID,
  SUNREY_COIN_NATIVE_ASSET_ID,
  type ExchangeAccountId,
} from '../ids.ts';
import type { NativeClearingEngine } from '../native-clearing/engine.ts';
import type { AlphaLiquidityConfig } from './config.ts';
import type { AlphaAllocationRecord } from './types.ts';

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export class AlphaAllocationLedger {
  readonly records: AlphaAllocationRecord[] = [];
  readonly sandboxUsdByAccount = new Map<string, bigint>();
  private totalSunreyIssued = 0n;
  private totalMoonreyIssued = 0n;

  record(input: Omit<AlphaAllocationRecord, 'allocationId'>): AlphaAllocationRecord {
    const row: AlphaAllocationRecord = Object.freeze({
      allocationId: id('alpha_alloc'),
      ...input,
    });
    this.records.push(row);
    if (row.assetKind === 'SANDBOX_USD') {
      const current = this.sandboxUsdByAccount.get(row.participantId) ?? 0n;
      this.sandboxUsdByAccount.set(row.participantId, current + row.quantity);
    }
    if (row.assetKind === 'SUNREY_COIN') {
      this.totalSunreyIssued += row.quantity;
    }
    if (row.assetKind === 'MOONREY_COIN') {
      this.totalMoonreyIssued += row.quantity;
    }
    return row;
  }

  sandboxUsd(participantId: string): bigint {
    return this.sandboxUsdByAccount.get(participantId) ?? 0n;
  }

  debitSandboxUsd(participantId: string, amount: bigint): { readonly ok: true } | { readonly ok: false; readonly reason: 'INSUFFICIENT_USD' } {
    const current = this.sandboxUsd(participantId);
    if (current < amount) {
      return { ok: false, reason: 'INSUFFICIENT_USD' };
    }
    this.sandboxUsdByAccount.set(participantId, current - amount);
    return { ok: true };
  }

  creditSandboxUsd(input: {
    readonly participantId: string;
    readonly amount: bigint;
    readonly config: AlphaLiquidityConfig;
    readonly provenance: 'GENESIS' | 'REPLENISHMENT';
  }): AlphaAllocationRecord {
    return this.record({
      participantId: input.participantId,
      assetKind: 'SANDBOX_USD',
      quantity: input.amount,
      authority: input.config.allocationAuthority,
      source: input.config.liquiditySource,
      provenance: input.provenance,
    });
  }

  issueNativeToCustody(input: {
    readonly clearing: NativeClearingEngine;
    readonly accountId: ExchangeAccountId;
    readonly participantId: string;
    readonly assetId: typeof SUNREY_COIN_NATIVE_ASSET_ID | typeof MOONREY_COIN_NATIVE_ASSET_ID;
    readonly quantity: bigint;
    readonly config: AlphaLiquidityConfig;
    readonly provenance: 'GENESIS' | 'REPLENISHMENT';
  }): AlphaAllocationRecord {
    input.clearing.faucetToCustody(input.accountId, input.assetId, input.quantity);
    return this.record({
      participantId: input.participantId,
      assetKind: input.assetId === SUNREY_COIN_NATIVE_ASSET_ID ? 'SUNREY_COIN' : 'MOONREY_COIN',
      quantity: input.quantity,
      authority: input.config.allocationAuthority,
      source: input.config.liquiditySource,
      provenance: input.provenance,
    });
  }

  totalIssued(asset: 'SUNREY_COIN' | 'MOONREY_COIN'): bigint {
    return asset === 'SUNREY_COIN' ? this.totalSunreyIssued : this.totalMoonreyIssued;
  }

  snapshot(participantId: string): {
    readonly allocations: readonly AlphaAllocationRecord[];
    readonly sandboxUsdMinor: bigint;
    readonly totalIssuedSunrey: bigint;
    readonly totalIssuedMoonrey: bigint;
  } {
    return Object.freeze({
      allocations: Object.freeze([...this.records]),
      sandboxUsdMinor: this.sandboxUsd(participantId),
      totalIssuedSunrey: this.totalSunreyIssued,
      totalIssuedMoonrey: this.totalMoonreyIssued,
    });
  }

  restore(input: {
    readonly allocations: readonly AlphaAllocationRecord[];
    readonly sandboxUsdMinor: bigint;
    readonly participantId: string;
    readonly totalIssuedSunrey: bigint;
    readonly totalIssuedMoonrey: bigint;
  }): void {
    this.records.length = 0;
    this.records.push(...input.allocations);
    this.sandboxUsdByAccount.set(input.participantId, input.sandboxUsdMinor);
    this.totalSunreyIssued = input.totalIssuedSunrey;
    this.totalMoonreyIssued = input.totalIssuedMoonrey;
  }
}
