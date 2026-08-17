/**
 * Dedicated testnet faucet. Distributions occur only as canonical
 * blockchain transactions. Credentials are separate from validator
 * and governance keys and are valid only on designated test networks.
 */

import type { NativeAssetId } from '../protocol/assets.ts';
import { SUNREY_TESTNET_1_NETWORK_ID, isTestnetNetworkId } from './identity.ts';
import { TESTNET_FAUCET_AUTHORITY_ID, TESTNET_MOONREY_FAUCET_ALLOCATION, TESTNET_SUNREY_FAUCET_ALLOCATION } from './genesis.ts';
import { assertFaucetNetwork, faucetMayGovern, faucetMayValidate } from './security.ts';
import { faucetAuthorityLabel } from './validators.ts';

export const FAUCET_ACTOR = 'testnet.faucet' as const;
export const FAUCET_POLICY = 'sunrey.issuance.testnet_faucet.v1' as const;

export type FaucetLimits = {
  readonly perAddressSunRey: bigint;
  readonly perAddressMoonRey: bigint;
  readonly perClientWindowMs: number;
  readonly perClientMaxRequests: number;
  readonly cooldownMs: number;
};

export const DEFAULT_FAUCET_LIMITS: FaucetLimits = Object.freeze({
  perAddressSunRey: 1_000_000_000n,
  perAddressMoonRey: 10_000_000n,
  perClientWindowMs: 60_000,
  perClientMaxRequests: 8,
  cooldownMs: 5_000,
});

export type FaucetRequest = {
  readonly address: string;
  readonly asset: NativeAssetId;
  readonly quantity: bigint;
  readonly clientId: string;
  readonly nowMs: number;
};

export type FaucetRejection =
  | 'NETWORK_FORBIDDEN'
  | 'ASSET_NOT_PERMITTED'
  | 'ADDRESS_LIMIT'
  | 'CLIENT_RATE_LIMIT'
  | 'COOLDOWN'
  | 'ABUSE_DETECTED'
  | 'INSUFFICIENT_FAUCET_BALANCE'
  | 'QUANTITY_ZERO';

export type FaucetTx = {
  readonly txId: string;
  readonly networkId: string;
  readonly actorId: typeof FAUCET_ACTOR;
  readonly asset: NativeAssetId;
  readonly recipient: string;
  readonly quantity: bigint;
  readonly authorizationId: string;
  readonly policy: typeof FAUCET_POLICY;
  readonly finalized: boolean;
  readonly height: number | null;
};

export type FaucetLogEntry = {
  readonly atMs: number;
  readonly clientId: string;
  readonly address: string;
  readonly asset: NativeAssetId;
  readonly quantity: bigint;
  readonly result: 'ISSUED' | FaucetRejection;
};

export class TestnetFaucet {
  readonly networkId: string;
  readonly authorityId = TESTNET_FAUCET_AUTHORITY_ID;
  readonly authorityLabel = faucetAuthorityLabel();
  readonly mayGovern = faucetMayGovern();
  readonly mayValidate = faucetMayValidate();
  private readonly limits: FaucetLimits;
  private readonly issuedByAddress = new Map<string, { sunrey: bigint; moonrey: bigint }>();
  private readonly clientWindows = new Map<string, number[]>();
  private readonly lastByClient = new Map<string, number>();
  private readonly logs: FaucetLogEntry[] = [];
  private abuseFlags = 0;
  private sunreyBalance: bigint;
  private moonreyBalance: bigint;
  private height = 0;
  private nonce = 0;

  constructor(input?: { readonly networkId?: string; readonly limits?: FaucetLimits }) {
    this.networkId = input?.networkId ?? SUNREY_TESTNET_1_NETWORK_ID;
    assertFaucetNetwork(this.networkId);
    if (!isTestnetNetworkId(this.networkId)) {
      throw new Error('faucet credentials are valid only for designated test networks');
    }
    this.limits = input?.limits ?? DEFAULT_FAUCET_LIMITS;
    this.sunreyBalance = TESTNET_SUNREY_FAUCET_ALLOCATION;
    this.moonreyBalance = TESTNET_MOONREY_FAUCET_ALLOCATION;
  }

  request(input: FaucetRequest): { readonly ok: true; readonly tx: FaucetTx } | { readonly ok: false; readonly code: FaucetRejection } {
    const rejected = this.evaluate(input);
    this.logs.push({
      atMs: input.nowMs,
      clientId: input.clientId,
      address: input.address,
      asset: input.asset,
      quantity: input.quantity,
      result: rejected ?? 'ISSUED',
    });
    if (rejected) {
      return { ok: false, code: rejected };
    }
    this.record(input);
    this.nonce += 1;
    const tx: FaucetTx = {
      txId: `tx.faucet.${this.networkId}.${this.nonce}`,
      networkId: this.networkId,
      actorId: FAUCET_ACTOR,
      asset: input.asset,
      recipient: input.address,
      quantity: input.quantity,
      authorizationId: `auth.faucet.${this.nonce}`,
      policy: FAUCET_POLICY,
      finalized: false,
      height: null,
    };
    return { ok: true, tx };
  }

  markFinal(txId: string, height: number): FaucetTx | null {
    this.height = Math.max(this.height, height);
    return {
      txId,
      networkId: this.networkId,
      actorId: FAUCET_ACTOR,
      asset: 'SUNREY_COIN',
      recipient: '',
      quantity: 0n,
      authorizationId: txId,
      policy: FAUCET_POLICY,
      finalized: true,
      height,
    };
  }

  balances(): { readonly sunrey: bigint; readonly moonrey: bigint; readonly height: number } {
    return { sunrey: this.sunreyBalance, moonrey: this.moonreyBalance, height: this.height };
  }

  requestLog(): readonly FaucetLogEntry[] {
    return this.logs;
  }

  abuseHookCount(): number {
    return this.abuseFlags;
  }

  health(): 'UP' | 'DOWN' | 'EMPTY' {
    if (this.sunreyBalance <= 0n && this.moonreyBalance <= 0n) {
      return 'EMPTY';
    }
    return 'UP';
  }

  private evaluate(input: FaucetRequest): FaucetRejection | null {
    if (input.quantity <= 0n) {
      return 'QUANTITY_ZERO';
    }
    if (!isTestnetNetworkId(this.networkId)) {
      return 'NETWORK_FORBIDDEN';
    }
    if (input.asset !== 'SUNREY_COIN' && input.asset !== 'MOONREY_COIN') {
      return 'ASSET_NOT_PERMITTED';
    }
    const prior = this.issuedByAddress.get(input.address) ?? { sunrey: 0n, moonrey: 0n };
    if (input.asset === 'SUNREY_COIN' && prior.sunrey + input.quantity > this.limits.perAddressSunRey) {
      return 'ADDRESS_LIMIT';
    }
    if (input.asset === 'MOONREY_COIN' && prior.moonrey + input.quantity > this.limits.perAddressMoonRey) {
      return 'ADDRESS_LIMIT';
    }
    const last = this.lastByClient.get(input.clientId);
    if (last !== undefined && input.nowMs - last < this.limits.cooldownMs) {
      return 'COOLDOWN';
    }
    const window = (this.clientWindows.get(input.clientId) ?? []).filter(
      (ts) => input.nowMs - ts < this.limits.perClientWindowMs,
    );
    if (window.length >= this.limits.perClientMaxRequests) {
      this.abuseFlags += 1;
      return 'CLIENT_RATE_LIMIT';
    }
    if (input.quantity > this.limits.perAddressSunRey) {
      this.abuseFlags += 1;
      return 'ABUSE_DETECTED';
    }
    if (input.asset === 'SUNREY_COIN' && this.sunreyBalance < input.quantity) {
      return 'INSUFFICIENT_FAUCET_BALANCE';
    }
    if (input.asset === 'MOONREY_COIN' && this.moonreyBalance < input.quantity) {
      return 'INSUFFICIENT_FAUCET_BALANCE';
    }
    return null;
  }

  private record(input: FaucetRequest): void {
    const prior = this.issuedByAddress.get(input.address) ?? { sunrey: 0n, moonrey: 0n };
    if (input.asset === 'SUNREY_COIN') {
      prior.sunrey += input.quantity;
      this.sunreyBalance -= input.quantity;
    } else {
      prior.moonrey += input.quantity;
      this.moonreyBalance -= input.quantity;
    }
    this.issuedByAddress.set(input.address, prior);
    const window = (this.clientWindows.get(input.clientId) ?? []).filter(
      (ts) => input.nowMs - ts < this.limits.perClientWindowMs,
    );
    window.push(input.nowMs);
    this.clientWindows.set(input.clientId, window);
    this.lastByClient.set(input.clientId, input.nowMs);
  }
}
