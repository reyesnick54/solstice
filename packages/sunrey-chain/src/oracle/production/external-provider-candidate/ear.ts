import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { asUtcInstant } from '../../../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  controllerRefFor,
  operatorRefFor,
  projectDescriptor,
  scanForbiddenPayload,
  sourceOrganizationRefFor,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../../../economic-asset-registry/src/index.ts';
import type { ExternalEconomicOracleProviderCandidateProfile, ExternalProviderFeedProfile } from './types.ts';

const FORBIDDEN = /authorization|api[_-]?key|client_secret|access_token|refresh_token|-----BEGIN|contractText|licenseText/i;

export function mapCandidateToEconomicAsset(input: {
  readonly profile: ExternalEconomicOracleProviderCandidateProfile;
  readonly feed: ExternalProviderFeedProfile;
  readonly observationSetCommitment: string;
  readonly nowUnix: bigint;
}): Result<RegisterAssetInput, RegistryFailure> {
  const payload: RegisterAssetInput = {
    assetClass: 'ORACLE_SOURCE_DATASET',
    domain: 'SHARED_REFERENCE',
    canonicalOwnerSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceRecordId: `candidate:${input.profile.profileId}:${input.feed.feedId}`,
    sourceClass: 'ORACLE_NETWORK',
    sourceSystem: CANONICAL_SYSTEM_OWNERS.oracle,
    sourceOrganizationRef: sourceOrganizationRefFor(input.profile.providerId),
    sourceSchemaVersion: `${input.feed.canonicalSchemaId}:${input.feed.mappingVersion}`,
    controllerRef: controllerRefFor(input.profile.controllerId),
    operatorRef: operatorRefFor(input.profile.providerId),
    jurisdiction: 'US',
    rightsConcepts: ['USAGE_RIGHTS', 'CONTROLLER_RIGHTS'],
    sensitivityClass: 'INTERNAL',
    qualityClass: 'ATTESTED',
    freshness: 'CURRENT',
    validFrom: asUtcInstant(new Date(Number(input.nowUnix) * 1000).toISOString()),
    validUntil: null,
    economicCategory: input.feed.productiveCategory ?? 'SHARED_ECONOMIC_REFERENCE',
    contentCommitmentMaterial: `candidate-meta:${input.profile.profileId}:${input.feed.feedId}:${input.observationSetCommitment}`.slice(0, 256),
    provenanceMaterial: `candidate-prov:${input.profile.providerId}:${input.feed.sourceId}:${input.feed.providerSchemaId}`.slice(0, 256),
    storageClass: 'OFF_CHAIN_RESTRICTED',
    status: 'REGISTERED',
    createdAt: asUtcInstant(new Date(Number(input.nowUnix) * 1000).toISOString()),
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  if (FORBIDDEN.test(JSON.stringify(payload))) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'candidate projection cannot store credentials or contract text' });
  }
  return ok(payload);
}

export function projectCandidateMetadata(
  registry: EconomicAssetRegistryPort,
  input: Parameters<typeof mapCandidateToEconomicAsset>[0],
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const mapped = mapCandidateToEconomicAsset(input);
  if (!mapped.ok) {
    return mapped;
  }
  return projectDescriptor(registry, mapped.value);
}
