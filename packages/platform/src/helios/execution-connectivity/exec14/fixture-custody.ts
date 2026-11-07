import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import type { CustodyCapabilityManifest } from './custody-capability-manifest.ts';

export type Exec14CustodyStatement = Readonly<{
  readonly statementId: string;
  readonly asOf: UtcInstant;
  readonly cashMinorUnits: string;
  readonly positions: Readonly<Record<string, string>>;
  readonly simulation: true;
}>;

export type Exec14CustodyConformancePort = Readonly<{
  readonly providerId: string;
  readonly manifest: CustodyCapabilityManifest;
  readonly liveNetworkConnected: false;
  readonly productionAuthorized: false;
  authenticate(): { readonly ok: boolean; readonly evidenceRef: string };
  creditDeposit(walletId: string, quantity: bigint, depositRef: string): { readonly ok: boolean };
  submitWithdrawal(withdrawalId: string, walletId: string, quantity: bigint): { readonly ok: boolean; readonly state: string };
  getStatement(accountId: string, now: UtcInstant): Exec14CustodyStatement;
  restart(): void;
}>;

export function createFixtureExec14CustodyPort(manifest: CustodyCapabilityManifest): Exec14CustodyConformancePort {
  const wallets = new Map<string, bigint>();
  const processedIds = new Set<string>();
  let cashMinor = 500_000n;

  const ensureWallet = (walletId: string): void => {
    if (!wallets.has(walletId)) {
      wallets.set(walletId, 0n);
    }
  };

  return Object.freeze({
    providerId: manifest.providerId,
    manifest,
    liveNetworkConnected: false,
    productionAuthorized: false,

    authenticate() {
      return Object.freeze({ ok: true, evidenceRef: `ev_custody_auth_${manifest.providerId}` });
    },

    creditDeposit(walletId, quantity, depositRef) {
      if (processedIds.has(depositRef)) {
        return { ok: true };
      }
      processedIds.add(depositRef);
      ensureWallet(walletId);
      wallets.set(walletId, (wallets.get(walletId) ?? 0n) + quantity);
      return { ok: true };
    },

    submitWithdrawal(withdrawalId, walletId, quantity) {
      if (processedIds.has(withdrawalId)) {
        return Object.freeze({ ok: true, state: 'FINALIZED' });
      }
      processedIds.add(withdrawalId);
      ensureWallet(walletId);
      const balance = wallets.get(walletId) ?? 0n;
      if (balance < quantity) {
        return Object.freeze({ ok: false, state: 'REJECTED' });
      }
      wallets.set(walletId, balance - quantity);
      cashMinor += quantity;
      return Object.freeze({ ok: true, state: 'FINALIZED' });
    },

    getStatement(accountId: string, now: UtcInstant) {
      const positions: Record<string, string> = {};
      for (const [walletId, qty] of wallets.entries()) {
        positions[walletId] = qty.toString();
      }
      return Object.freeze({
        statementId: `cstmt_${accountId}_${now.slice(0, 10)}`,
        asOf: now,
        cashMinorUnits: cashMinor.toString(),
        positions: Object.freeze(positions),
        simulation: true,
      });
    },

    restart() {
      wallets.clear();
      processedIds.clear();
      cashMinor = 500_000n;
    },
  });
}

export const EXEC14_CUSTODY_NOW = asUtcInstant('2026-09-21T12:00:00.000Z');
