import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  EconomicAssetDescriptor,
  EconomicAssetRegistryPort,
  RegistryFailure,
} from '../../../../../economic-asset-registry/src/index.ts';
import type { ProductiveAttributionEntry } from './types.ts';

/**
 * Reflect attribution decision and event lineage into the Economic Asset
 * Registry. The productive attribution book remains the source of truth.
 * Accounting shares are not stored as dataset payload.
 */
export function reflectAttributionLineage(input: {
  readonly registry: EconomicAssetRegistryPort;
  readonly contributionAssetId: EconomicAssetDescriptor['assetId'];
  readonly eventAssetId?: EconomicAssetDescriptor['assetId'];
  readonly relatedEventAssetIds?: readonly EconomicAssetDescriptor['assetId'][];
  readonly priorContributionAssetId?: EconomicAssetDescriptor['assetId'];
  readonly entry: ProductiveAttributionEntry;
  readonly at: UtcInstant;
}): Result<EconomicAssetDescriptor, RegistryFailure> {
  const existing = input.registry.getDescriptor(input.contributionAssetId);
  if (!existing) {
    return err({
      code: 'ASSET_NOT_FOUND',
      message: `contribution asset ${input.contributionAssetId} is not registered`,
    });
  }
  let current: Result<EconomicAssetDescriptor, RegistryFailure> = ok(existing);

  if (input.eventAssetId) {
    const attested = input.registry.addLineage({
      fromAssetId: current.value.assetId,
      toAssetId: input.eventAssetId,
      kind: 'ATTESTED_BY',
      at: input.at,
    });
    if (!attested.ok) {
      return attested;
    }
    current = attested;
  }

  for (const relatedId of input.relatedEventAssetIds ?? []) {
    const linked = input.registry.addLineage({
      fromAssetId: current.value.assetId,
      toAssetId: relatedId,
      kind: 'AGGREGATED_FROM',
      at: input.at,
    });
    if (!linked.ok) {
      return linked;
    }
    current = linked;
  }

  if (input.priorContributionAssetId) {
    const corrects = input.registry.addLineage({
      fromAssetId: current.value.assetId,
      toAssetId: input.priorContributionAssetId,
      kind: input.entry.status === 'SUPERSEDED' ? 'SUPERSEDES' : 'CORRECTS',
      at: input.at,
    });
    if (!corrects.ok) {
      return corrects;
    }
    current = corrects;
  }

  void input.entry.attributionDecisionId;
  void input.entry.allocatedShare;
  return ok(current.value);
}

export function attributionStateIsNotRegistryDataset(entry: ProductiveAttributionEntry): true {
  void entry;
  return true;
}

export function refuseRawAttributionDatasetStore(): Result<never, RegistryFailure> {
  return err({
    code: 'RAW_SENSITIVE_DATA_FORBIDDEN',
    message: 'attribution accounting state is not stored as an economic-asset dataset',
  });
}
