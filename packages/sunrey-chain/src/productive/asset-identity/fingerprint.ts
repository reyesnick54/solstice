/**
 * Deterministic productive asset fingerprinting.
 *
 * Supports duplicate detection without embedding commercially sensitive
 * raw payloads in the fingerprint material.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type {
  AssetResolutionHint,
  CanonicalProductiveAsset,
  ProductiveAssetFingerprint,
  RegisterProductiveAssetInput,
} from './types.ts';
import { commitValue } from './commitment.ts';

const FINGERPRINT_DOMAIN = 'sunrey.productive.asset-identity.v1:fingerprint' as const;

export function asFingerprint(value: string): ProductiveAssetFingerprint {
  return value as ProductiveAssetFingerprint;
}

function sortedMetadata(metadata: Readonly<Record<string, string>>): string {
  return Object.keys(metadata)
    .sort()
    .map((key) => `${key}=${metadata[key]}`)
    .join(';');
}

function commissionedYear(commissionedAtUtc: string | null | undefined): string {
  if (!commissionedAtUtc) {
    return '';
  }
  return commissionedAtUtc.slice(0, 4);
}

export function deriveAssetFingerprint(input: {
  readonly assetClass: RegisterProductiveAssetInput['assetClass'];
  readonly jurisdiction: string;
  readonly geography: RegisterProductiveAssetInput['geography'];
  readonly technologyMetadata?: Readonly<Record<string, string>>;
  readonly externalIdentifiers?: readonly RegisterProductiveAssetInput['externalIdentifiers'];
  readonly commissionedAtUtc?: string | null;
  readonly resolutionHint?: AssetResolutionHint;
}): ProductiveAssetFingerprint {
  const official =
    input.externalIdentifiers?.find((row) => row.kind === 'OFFICIAL_FACILITY_ID')?.valueCommitment ??
    (input.resolutionHint?.officialFacilityId
      ? commitValue('official-facility-id', input.resolutionHint.officialFacilityId)
      : '');
  const operator =
    input.externalIdentifiers?.find((row) => row.kind === 'OPERATOR_ASSET_ID')?.valueCommitment ??
    (input.resolutionHint?.operatorAssetId
      ? commitValue('operator-asset-id', input.resolutionHint.operatorAssetId)
      : '');
  const government =
    input.externalIdentifiers?.find((row) => row.kind === 'GOVERNMENT_REGISTRY_ID')?.valueCommitment ??
    (input.resolutionHint?.governmentRegistryId
      ? commitValue('government-registry-id', input.resolutionHint.governmentRegistryId)
      : '');
  const coordinates =
    input.geography.coordinatesCommitment ??
    input.resolutionHint?.coordinatesCommitment ??
  '';
  const technology =
    input.technologyMetadata?.technology ??
    input.technologyMetadata?.fuelType ??
    input.resolutionHint?.technology ??
    '';

  const material = [
    FINGERPRINT_DOMAIN,
    input.assetClass,
    input.jurisdiction,
    input.geography.region ?? '',
    input.geography.locality ?? '',
    coordinates,
    official,
    operator,
    government,
    technology,
    commissionedYear(input.commissionedAtUtc),
    String(input.resolutionHint?.commissionedYear ?? ''),
  ].join('|');

  return asFingerprint(sha256Hex(material));
}

export function fingerprintOfAsset(asset: CanonicalProductiveAsset): ProductiveAssetFingerprint {
  return deriveAssetFingerprint({
    assetClass: asset.assetClass,
    jurisdiction: asset.jurisdiction,
    geography: asset.geography,
    technologyMetadata: asset.technologyMetadata,
    externalIdentifiers: asset.externalIdentifiers,
    commissionedAtUtc: asset.commissionedAtUtc,
  });
}
