import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DataAsset, DataDerivation, DataProvenance } from '../types.ts';
import type { DataKind, VerificationState } from './kinds.ts';

export const COLLECTION_METHODS = [
  'USER_DECLARED',
  'USER_UPLOAD',
  'SIMULATED_CONNECTOR',
  'DERIVATION',
  'AI_INFERENCE',
  'IMPORT',
] as const;
export type CollectionMethod = (typeof COLLECTION_METHODS)[number];

export type RecordProvenance = {
  readonly origin: string;
  readonly providerSource: string;
  readonly collectionMethod: CollectionMethod;
  readonly ingestedAt: UtcInstant;
  readonly observedAt: UtcInstant;
  readonly verification: VerificationState;
  readonly transformationHistory: readonly {
    readonly method: string;
    readonly methodVersion: string;
    readonly at: UtcInstant;
  }[];
  readonly parentRecordIds: readonly string[];
  readonly integrityHash: string | null;
  readonly licenseRef: string | null;
  readonly rightsRef: string | null;
};

export function collectionMethodFromProvenance(kind: string, dataKind: DataKind): CollectionMethod {
  if (dataKind === 'AI_INFERENCE') {
    return 'AI_INFERENCE';
  }
  if (kind === 'DERIVED') {
    return 'DERIVATION';
  }
  if (kind === 'USER_DECLARED') {
    return 'USER_DECLARED';
  }
  if (kind === 'USER_UPLOADED') {
    return 'USER_UPLOAD';
  }
  if (kind === 'IMPORTED_ARCHIVE') {
    return 'IMPORT';
  }
  return 'SIMULATED_CONNECTOR';
}

export function enhanceProvenance(input: {
  readonly asset: DataAsset;
  readonly dataKind: DataKind;
  readonly verification: VerificationState;
  readonly derivations: readonly DataDerivation[];
  readonly parentRecordIds?: readonly string[];
  readonly licenseRef?: string | null;
}): RecordProvenance {
  const source: DataProvenance = input.asset.provenance;
  const history = input.derivations
    .filter((row) => row.outputAssetId === input.asset.assetId)
    .map((row) =>
      Object.freeze({
        method: row.method,
        methodVersion: row.methodVersion,
        at: row.createdAt,
      }),
    );
  const parents = [
    ...(input.parentRecordIds ?? []),
    ...input.derivations.flatMap((row) =>
      row.outputAssetId === input.asset.assetId ? row.sourceAssetIds : [],
    ),
  ];
  return Object.freeze({
    origin: source.kind,
    providerSource: source.sourceId,
    collectionMethod: collectionMethodFromProvenance(source.kind, input.dataKind),
    ingestedAt: source.ingestedAt,
    observedAt: source.observedAt,
    verification: input.verification,
    transformationHistory: Object.freeze(history),
    parentRecordIds: Object.freeze([...new Set(parents)]),
    integrityHash: input.asset.contentSha256,
    licenseRef: input.licenseRef ?? null,
    rightsRef: null,
  });
}
