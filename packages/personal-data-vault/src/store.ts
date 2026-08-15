import type { EncryptedPayloadStore, InMemoryEncryptedPayloadStore } from './encryption.ts';
import type {
  DataAccessRecord,
  DataAsset,
  DataAssetVersion,
  DataDeletionRequest,
  DataDerivation,
  DataExportManifest,
  DataIngestionRecord,
  PersonalDataVaultRecord,
  PersonalDataVaultStoreSnapshot,
} from './types.ts';
import type { DataAssetId, DataPayloadId, PersonalDataVaultId } from './ids.ts';

export class PersonalDataVaultStore {
  private readonly vaults = new Map<string, PersonalDataVaultRecord>();
  private readonly assets = new Map<string, DataAsset>();
  private readonly versions = new Map<string, DataAssetVersion>();
  private readonly ingestions = new Map<string, DataIngestionRecord>();
  private readonly access: DataAccessRecord[] = [];
  private readonly derivations = new Map<string, DataDerivation>();
  private readonly exports = new Map<string, DataExportManifest>();
  private readonly deletions = new Map<string, DataDeletionRequest>();

  putVault(vault: PersonalDataVaultRecord): PersonalDataVaultRecord {
    this.vaults.set(vault.vaultId, vault);
    this.vaults.set(vault.subjectId, vault);
    return vault;
  }

  getVault(vaultId: PersonalDataVaultId): PersonalDataVaultRecord | undefined {
    return this.vaults.get(vaultId);
  }

  getVaultBySubject(subjectId: string): PersonalDataVaultRecord | undefined {
    return this.vaults.get(subjectId);
  }

  putAsset(asset: DataAsset): DataAsset {
    this.assets.set(asset.assetId, asset);
    return asset;
  }

  getAsset(assetId: DataAssetId): DataAsset | undefined {
    return this.assets.get(assetId);
  }

  assetsForSubject(subjectId: string): readonly DataAsset[] {
    return Object.freeze([...this.assets.values()].filter((asset) => asset.subjectId === subjectId));
  }

  putVersion(version: DataAssetVersion): DataAssetVersion {
    this.versions.set(version.versionId, version);
    return version;
  }

  versionsFor(assetId: DataAssetId): readonly DataAssetVersion[] {
    return Object.freeze(
      [...this.versions.values()]
        .filter((row) => row.assetId === assetId)
        .sort((a, b) => a.sequence - b.sequence),
    );
  }

  putIngestion(record: DataIngestionRecord): DataIngestionRecord {
    this.ingestions.set(idempotencyKey(record.sourceId, record.sourceRecordRef, record.idempotencyKey), record);
    this.ingestions.set(record.ingestionId, record);
    return record;
  }

  findIngestion(sourceId: string, sourceRecordRef: string, key: string): DataIngestionRecord | undefined {
    return this.ingestions.get(idempotencyKey(sourceId, sourceRecordRef, key));
  }

  ingestionsForSubject(subjectId: string): readonly DataIngestionRecord[] {
    return Object.freeze(
      [...this.ingestions.values()].filter((row, index, all) => all.findIndex((item) => item.ingestionId === row.ingestionId) === index && row.subjectId === subjectId),
    );
  }

  putAccess(record: DataAccessRecord): DataAccessRecord {
    this.access.push(record);
    return record;
  }

  accessForSubject(subjectId: string): readonly DataAccessRecord[] {
    return Object.freeze(this.access.filter((row) => row.subjectId === subjectId));
  }

  putDerivation(record: DataDerivation): DataDerivation {
    this.derivations.set(record.derivationId, record);
    return record;
  }

  derivationsFor(assetId: DataAssetId): readonly DataDerivation[] {
    return Object.freeze(
      [...this.derivations.values()].filter(
        (row) => row.outputAssetId === assetId || row.sourceAssetIds.includes(assetId),
      ),
    );
  }

  putExport(manifest: DataExportManifest): DataExportManifest {
    this.exports.set(manifest.exportId, manifest);
    return manifest;
  }

  putDeletion(request: DataDeletionRequest): DataDeletionRequest {
    this.deletions.set(request.requestId, request);
    return request;
  }

  snapshot(payloads: EncryptedPayloadStore): PersonalDataVaultStoreSnapshot {
    const payloadRows =
      'snapshot' in payloads
        ? (payloads as InMemoryEncryptedPayloadStore).snapshot()
        : Object.freeze([]);
    return Object.freeze({
      vaults: Object.freeze(
        [...this.vaults.values()].filter((row, index, all) => all.findIndex((item) => item.vaultId === row.vaultId) === index),
      ),
      assets: Object.freeze([...this.assets.values()]),
      versions: Object.freeze([...this.versions.values()]),
      ingestions: Object.freeze(
        [...this.ingestions.values()].filter(
          (row, index, all) => all.findIndex((item) => item.ingestionId === row.ingestionId) === index,
        ),
      ),
      access: Object.freeze([...this.access]),
      derivations: Object.freeze([...this.derivations.values()]),
      exports: Object.freeze([...this.exports.values()]),
      deletions: Object.freeze([...this.deletions.values()]),
      payloads: payloadRows,
    });
  }

  restore(state: PersonalDataVaultStoreSnapshot, payloads: EncryptedPayloadStore): void {
    this.vaults.clear();
    this.assets.clear();
    this.versions.clear();
    this.ingestions.clear();
    this.access.length = 0;
    this.derivations.clear();
    this.exports.clear();
    this.deletions.clear();
    for (const vault of state.vaults) {
      this.putVault(vault);
    }
    for (const asset of state.assets) {
      this.putAsset(asset);
    }
    for (const version of state.versions) {
      this.putVersion(version);
    }
    for (const ingestion of state.ingestions) {
      this.putIngestion(ingestion);
    }
    for (const row of state.access) {
      this.putAccess(row);
    }
    for (const row of state.derivations) {
      this.putDerivation(row);
    }
    for (const row of state.exports) {
      this.putExport(row);
    }
    for (const row of state.deletions) {
      this.putDeletion(row);
    }
    if ('restore' in payloads) {
      (payloads as InMemoryEncryptedPayloadStore).restore(state.payloads);
    }
  }
}

function idempotencyKey(sourceId: string, sourceRecordRef: string, key: string): string {
  return `${sourceId}:${sourceRecordRef}:${key}`;
}

export function payloadExists(store: EncryptedPayloadStore, payloadId: DataPayloadId | null): boolean {
  return payloadId !== null && store.exists(payloadId);
}
