import { type Brand, brandAs } from '../../domain/src/brand.ts';
import { newSecurityToken } from '../../security/src/random.ts';

export type PersonalDataVaultId = Brand<string, 'PersonalDataVaultId'>;
export type DataAssetId = Brand<string, 'DataAssetId'>;
export type DataAssetVersionId = Brand<string, 'DataAssetVersionId'>;
export type DataPayloadId = Brand<string, 'DataPayloadId'>;
export type DataSourceId = Brand<string, 'DataSourceId'>;
export type DataSchemaId = Brand<string, 'DataSchemaId'>;
export type DataSchemaVersion = Brand<string, 'DataSchemaVersion'>;
export type DataIngestionId = Brand<string, 'DataIngestionId'>;
export type DataAccessRecordId = Brand<string, 'DataAccessRecordId'>;
export type DataExportId = Brand<string, 'DataExportId'>;
export type DataDeletionRequestId = Brand<string, 'DataDeletionRequestId'>;
export type DataDerivationId = Brand<string, 'DataDerivationId'>;

export const PDV_ID_PREFIXES = Object.freeze({
  vault: 'pdv_',
  asset: 'pda_',
  version: 'pdver_',
  payload: 'pld_',
  source: 'pds_',
  schema: 'pdsch_',
  ingestion: 'pdi_',
  access: 'pdar_',
  export: 'pdx_',
  deletion: 'pdd_',
  derivation: 'pddv_',
});

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asPersonalDataVaultId(value: string): PersonalDataVaultId {
  return asPrefixed(value, PDV_ID_PREFIXES.vault, 'PersonalDataVaultId');
}

export function asDataAssetId(value: string): DataAssetId {
  return asPrefixed(value, PDV_ID_PREFIXES.asset, 'DataAssetId');
}

export function asDataAssetVersionId(value: string): DataAssetVersionId {
  return asPrefixed(value, PDV_ID_PREFIXES.version, 'DataAssetVersionId');
}

export function asDataPayloadId(value: string): DataPayloadId {
  return asPrefixed(value, PDV_ID_PREFIXES.payload, 'DataPayloadId');
}

export function asDataSourceId(value: string): DataSourceId {
  return asPrefixed(value, PDV_ID_PREFIXES.source, 'DataSourceId');
}

export function asDataSchemaId(value: string): DataSchemaId {
  return asPrefixed(value, PDV_ID_PREFIXES.schema, 'DataSchemaId');
}

export function asDataSchemaVersion(value: string): DataSchemaVersion {
  if (value.length === 0) {
    throw new TypeError('DataSchemaVersion is required');
  }
  return brandAs<string, 'DataSchemaVersion'>(value);
}

export function asDataIngestionId(value: string): DataIngestionId {
  return asPrefixed(value, PDV_ID_PREFIXES.ingestion, 'DataIngestionId');
}

export function asDataAccessRecordId(value: string): DataAccessRecordId {
  return asPrefixed(value, PDV_ID_PREFIXES.access, 'DataAccessRecordId');
}

export function asDataExportId(value: string): DataExportId {
  return asPrefixed(value, PDV_ID_PREFIXES.export, 'DataExportId');
}

export function asDataDeletionRequestId(value: string): DataDeletionRequestId {
  return asPrefixed(value, PDV_ID_PREFIXES.deletion, 'DataDeletionRequestId');
}

export function asDataDerivationId(value: string): DataDerivationId {
  return asPrefixed(value, PDV_ID_PREFIXES.derivation, 'DataDerivationId');
}

export function newPersonalDataVaultId(): PersonalDataVaultId {
  return asPersonalDataVaultId(`${PDV_ID_PREFIXES.vault}${newSecurityToken()}`);
}

export function newDataAssetId(): DataAssetId {
  return asDataAssetId(`${PDV_ID_PREFIXES.asset}${newSecurityToken()}`);
}

export function newDataAssetVersionId(): DataAssetVersionId {
  return asDataAssetVersionId(`${PDV_ID_PREFIXES.version}${newSecurityToken()}`);
}

export function newDataPayloadId(): DataPayloadId {
  return asDataPayloadId(`${PDV_ID_PREFIXES.payload}${newSecurityToken()}`);
}

export function newDataSourceId(): DataSourceId {
  return asDataSourceId(`${PDV_ID_PREFIXES.source}${newSecurityToken()}`);
}

export function newDataIngestionId(): DataIngestionId {
  return asDataIngestionId(`${PDV_ID_PREFIXES.ingestion}${newSecurityToken()}`);
}

export function newDataAccessRecordId(): DataAccessRecordId {
  return asDataAccessRecordId(`${PDV_ID_PREFIXES.access}${newSecurityToken()}`);
}

export function newDataExportId(): DataExportId {
  return asDataExportId(`${PDV_ID_PREFIXES.export}${newSecurityToken()}`);
}

export function newDataDeletionRequestId(): DataDeletionRequestId {
  return asDataDeletionRequestId(`${PDV_ID_PREFIXES.deletion}${newSecurityToken()}`);
}

export function newDataDerivationId(): DataDerivationId {
  return asDataDerivationId(`${PDV_ID_PREFIXES.derivation}${newSecurityToken()}`);
}

export function vaultIdForSubject(subjectId: string): PersonalDataVaultId {
  const compact = subjectId.replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || 'subject';
  return asPersonalDataVaultId(`${PDV_ID_PREFIXES.vault}${compact}`);
}
