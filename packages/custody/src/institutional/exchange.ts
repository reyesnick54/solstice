/**
 * Canonical exchange custody port for Chunk 48.
 *
 * No order matching lives here. Exchange settlement still follows
 * custody approval and signing policy.
 */

import type { NativeQueryResult } from '../../../sunrey-chain/src/native-custody/port.ts';
import type { VaultId } from './ids.ts';
import type { InstitutionalReconciliationReport } from './types.ts';

export type ExchangeReservation = {
  readonly reservationId: string;
  readonly vaultId: VaultId;
  readonly quantity: bigint;
  readonly assetId: 'SUNREY_COIN';
  readonly released: boolean;
};

export type ExchangeCustodyPort = {
  exchangeDepositAddress(vaultId: VaultId): string | null;
  reserveForExchange(vaultId: VaultId, quantity: bigint): ExchangeReservation | { readonly rejected: true; readonly code: string };
  releaseReservation(reservationId: string): ExchangeReservation | { readonly rejected: true; readonly code: string };
  signSettlement(reservationId: string): { readonly rejected: true; readonly code: 'REQUIRES_CUSTODY_APPROVAL' } | { readonly previewHash: string };
  withdrawFromExchange(vaultId: VaultId, destination: string, quantity: bigint): { readonly rejected: true; readonly code: string } | { readonly withdrawalRef: string };
  queryFinality(txId: string): NativeQueryResult;
  reconcileExchangeVault(vaultId: VaultId): InstitutionalReconciliationReport;
};
