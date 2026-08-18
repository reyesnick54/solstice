/**
 * Incremental WalletSyncCursor bound to network, chain, wallet,
 * finalized height, projection sequence, and schema version.
 */

import { createHash } from 'node:crypto';

import {
  MOBILE_SYNC_API_VERSION,
  MOBILE_SYNC_SCHEMA_VERSION,
  type WalletSyncCursor,
} from './types.ts';

export function createSyncCursor(input: {
  readonly networkId: string;
  readonly chainId: string;
  readonly walletId: string;
  readonly finalizedHeight: number;
  readonly projectionSequence: number;
}): WalletSyncCursor {
  const cursorId = createHash('sha256')
    .update(
      [
        input.networkId,
        input.chainId,
        input.walletId,
        String(input.finalizedHeight),
        String(input.projectionSequence),
        String(MOBILE_SYNC_SCHEMA_VERSION),
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 24);
  return Object.freeze({
    schemaVersion: MOBILE_SYNC_SCHEMA_VERSION,
    apiVersion: MOBILE_SYNC_API_VERSION,
    networkId: input.networkId,
    chainId: input.chainId,
    walletId: input.walletId,
    finalizedHeight: input.finalizedHeight,
    projectionSequence: input.projectionSequence,
    cursorId,
  });
}

export function encodeSyncCursor(cursor: WalletSyncCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeSyncCursor(encoded: string): WalletSyncCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as WalletSyncCursor;
    if (
      parsed.schemaVersion !== MOBILE_SYNC_SCHEMA_VERSION ||
      parsed.apiVersion !== MOBILE_SYNC_API_VERSION ||
      typeof parsed.networkId !== 'string' ||
      typeof parsed.chainId !== 'string' ||
      typeof parsed.walletId !== 'string'
    ) {
      return null;
    }
    return createSyncCursor(parsed);
  } catch {
    return null;
  }
}

export function cursorBindsRequiredFields(cursor: WalletSyncCursor): boolean {
  return (
    cursor.networkId.length > 0 &&
    cursor.chainId.length > 0 &&
    cursor.walletId.length > 0 &&
    Number.isInteger(cursor.finalizedHeight) &&
    Number.isInteger(cursor.projectionSequence) &&
    cursor.schemaVersion === MOBILE_SYNC_SCHEMA_VERSION
  );
}
