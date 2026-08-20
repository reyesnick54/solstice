/**
 * Version-safe institutional custody records.
 *
 * schemaVersion 1 = historical SunRey-only compatibility.
 * schemaVersion 2 = dual native assets.
 *
 * Historical v1 records are not silently reinterpreted as dual-asset.
 */

import { isNativeCustodyAssetId, type NativeCustodyAssetId } from '../native-assets.ts';
import { VAULT_SCHEMA_VERSION, VAULT_SCHEMA_VERSION_V2 } from './taxonomy.ts';
import type { CustodyVault, CustodyVaultV1, CustodyVaultV2 } from './types.ts';

export type InstitutionalRecordParseFailure = {
  readonly rejected: true;
  readonly code: 'UNKNOWN_SCHEMA' | 'V1_SUNREY_ONLY' | 'INVALID_ASSET' | 'MALFORMED_RECORD';
  readonly message: string;
};

export function isCustodyVaultV1(vault: CustodyVault): vault is CustodyVaultV1 {
  return vault.schemaVersion === VAULT_SCHEMA_VERSION;
}

export function isCustodyVaultV2(vault: CustodyVault): vault is CustodyVaultV2 {
  return vault.schemaVersion === VAULT_SCHEMA_VERSION_V2;
}

export function vaultAuthorizes(
  vault: CustodyVault,
  assetId: NativeCustodyAssetId,
): boolean {
  return (vault.authorizedAssets as readonly NativeCustodyAssetId[]).includes(assetId);
}

export function parseInstitutionalVaultRecord(
  raw: unknown,
): CustodyVaultV1 | CustodyVaultV2 | InstitutionalRecordParseFailure {
  if (raw === null || typeof raw !== 'object') {
    return { rejected: true, code: 'MALFORMED_RECORD', message: 'vault record is not an object' };
  }
  const record = raw as Record<string, unknown>;
  const schemaVersion = record.schemaVersion;
  const authorizedAssets = record.authorizedAssets;
  if (!Array.isArray(authorizedAssets) || authorizedAssets.length === 0) {
    return { rejected: true, code: 'MALFORMED_RECORD', message: 'authorizedAssets missing' };
  }
  if (schemaVersion === 1 || schemaVersion === undefined) {
    if (authorizedAssets.length !== 1 || authorizedAssets[0] !== 'SUNREY_COIN') {
      return {
        rejected: true,
        code: 'V1_SUNREY_ONLY',
        message: 'schemaVersion 1 authorizes SUNREY_COIN only and is not reinterpreted',
      };
    }
    return Object.freeze({
      ...(record as unknown as CustodyVaultV1),
      authorizedAssets: Object.freeze(['SUNREY_COIN'] as const),
      schemaVersion: 1,
    });
  }
  if (schemaVersion === 2) {
    const assets: NativeCustodyAssetId[] = [];
    for (const asset of authorizedAssets) {
      if (typeof asset !== 'string' || !isNativeCustodyAssetId(asset)) {
        return { rejected: true, code: 'INVALID_ASSET', message: `unsupported asset ${String(asset)}` };
      }
      if (!assets.includes(asset)) {
        assets.push(asset);
      }
    }
    return Object.freeze({
      ...(record as unknown as CustodyVaultV2),
      authorizedAssets: Object.freeze(assets),
      schemaVersion: 2,
    });
  }
  return {
    rejected: true,
    code: 'UNKNOWN_SCHEMA',
    message: `unknown institutional vault schemaVersion ${String(schemaVersion)}`,
  };
}

export function upgradeVaultRecordSilently(_raw: unknown): never {
  throw new Error('historical institutional records must not be silently upgraded');
}
