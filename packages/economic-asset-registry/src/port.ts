import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { contentCommitmentFor, type AssetId } from './ids.ts';
import type {
  EconomicAssetDescriptor,
  EconomicAssetQuery,
  RegisterAssetInput,
  RegistryFailure,
} from './types.ts';

/**
 * Narrow public port for cross-domain projection.
 *
 * Source domains map privacy-safe metadata onto this contract.
 * The port does not expose the in-memory store, query indexes,
 * or any raw-dataset API.
 */
export type EconomicAssetRegistryPort = {
  registerDescriptor(input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure>;
  verifyDescriptor(assetId: AssetId, verifiedAt: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure>;
  getDescriptor(assetId: AssetId): EconomicAssetDescriptor | undefined;
  queryDescriptors(criteria: EconomicAssetQuery): readonly EconomicAssetDescriptor[];
  addLineage(input: AddLineageInput): Result<EconomicAssetDescriptor, RegistryFailure>;
  supersede(priorId: AssetId, input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure>;
  correct(priorId: AssetId, input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure>;
  restrict(assetId: AssetId, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure>;
  suspend(assetId: AssetId, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure>;
  findBySourceRecord(canonicalOwnerSystem: string, sourceRecordId: string): EconomicAssetDescriptor | undefined;
};

export type AddLineageInput = {
  readonly fromAssetId: AssetId;
  readonly toAssetId: AssetId;
  readonly kind: EconomicAssetDescriptor['lineage'][number]['kind'];
  readonly at: UtcInstant;
};

export type SourceProjectionKey = {
  readonly canonicalOwnerSystem: string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly contentCommitmentMaterial: string;
};

export function sourceIdentityKey(canonicalOwnerSystem: string, sourceRecordId: string): string {
  return `${canonicalOwnerSystem}:${sourceRecordId}`;
}

export function sourceProjectionKey(key: SourceProjectionKey): string {
  return `${sourceIdentityKey(key.canonicalOwnerSystem, key.sourceRecordId)}:${key.sourceVersion}:${key.contentCommitmentMaterial}`;
}

/**
 * Idempotent projection of a canonical source artifact.
 *
 * Same source + same version + same content commitment returns the
 * existing descriptor. A changed canonical version supersedes. A
 * same-version content change is recorded as a correction.
 */
export function projectDescriptor(
  port: EconomicAssetRegistryPort,
  input: RegisterAssetInput,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const sourceRecordId = input.sourceRecordId ?? input.contentCommitmentMaterial;
  const existing = port.findBySourceRecord(input.canonicalOwnerSystem, sourceRecordId);
  if (!existing) {
    return port.registerDescriptor({ ...input, sourceRecordId });
  }
  const sameCommitment = existing.contentCommitment === contentCommitmentFor(input.contentCommitmentMaterial);
  const sameVersion = existing.sourceSchemaVersion === (input.sourceSchemaVersion ?? '1');
  if (sameCommitment && sameVersion) {
    return ok(existing);
  }
  if (existing.supersededBy || existing.status === 'SUPERSEDED' || existing.status === 'RETIRED') {
    return err({
      code: 'ALREADY_SUPERSEDED',
      message: `source ${sourceRecordId} already has a historical head; project the current version`,
    });
  }
  if (!sameVersion) {
    return port.supersede(existing.assetId, { ...input, sourceRecordId });
  }
  return port.correct(existing.assetId, { ...input, sourceRecordId });
}

export function reflectSourceLifecycle(
  port: EconomicAssetRegistryPort,
  canonicalOwnerSystem: string,
  sourceRecordId: string,
  status: 'RESTRICTED' | 'SUSPENDED',
  at: UtcInstant,
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const existing = port.findBySourceRecord(canonicalOwnerSystem, sourceRecordId);
  if (!existing) {
    return err({
      code: 'ASSET_NOT_FOUND',
      message: `no projected descriptor for source ${sourceRecordId}`,
    });
  }
  if (status === 'SUSPENDED') {
    return port.suspend(existing.assetId, at);
  }
  return port.restrict(existing.assetId, at);
}
