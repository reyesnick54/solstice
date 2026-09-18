import { sha256Hex } from '../../../../security/src/hash.ts';
import { REGULATORY_TRANSPARENCY_POLICY_VERSION } from './taxonomy.ts';
import type { ExportArtifact, ExportManifest, SupervisoryExportPackage } from './types.ts';
import type { SupervisoryExportRequestId, SupervisoryExportPackageId } from './ids.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v));
}

export function buildManifest(input: {
  readonly packageId: SupervisoryExportPackageId;
  readonly exportRequestId: SupervisoryExportRequestId;
  readonly artifacts: readonly ExportArtifact[];
  readonly generatedAt: UtcInstant;
}): ExportManifest {
  const artifactChecksums: Record<string, string> = {};
  const sourceRefs = new Set<string>();

  for (const artifact of input.artifacts) {
    artifactChecksums[artifact.artifactClass] = artifact.contentHash;
    for (const ref of artifact.sourceEvidenceRefs) {
      sourceRefs.add(ref);
    }
  }

  const manifestBody = {
    packageId: input.packageId,
    exportRequestId: input.exportRequestId,
    policyVersion: REGULATORY_TRANSPARENCY_POLICY_VERSION,
    generatedAt: input.generatedAt,
    artifactChecksums,
    sourceEvidenceRefs: [...sourceRefs].sort(),
  };

  const manifestHash = sha256Hex(canonicalJson(manifestBody));

  return Object.freeze({
    ...manifestBody,
    artifactChecksums: Object.freeze({ ...artifactChecksums }),
    sourceEvidenceRefs: Object.freeze(manifestBody.sourceEvidenceRefs),
    manifestHash,
  });
}

export function computePackageHash(manifest: ExportManifest, artifacts: readonly ExportArtifact[]): string {
  return sha256Hex(
    canonicalJson({
      manifestHash: manifest.manifestHash,
      artifacts: artifacts.map((a) => ({ class: a.artifactClass, hash: a.contentHash })),
    }),
  );
}

export function buildExportPackage(input: {
  readonly packageId: SupervisoryExportPackageId;
  readonly exportRequestId: SupervisoryExportRequestId;
  readonly artifacts: readonly ExportArtifact[];
  readonly generatedAt: UtcInstant;
}): SupervisoryExportPackage {
  const manifest = buildManifest(input);
  const packageHash = computePackageHash(manifest, input.artifacts);
  return Object.freeze({
    packageId: input.packageId,
    exportRequestId: input.exportRequestId,
    manifest,
    artifacts: Object.freeze([...input.artifacts]),
    packageHash,
    grantsFinancialEffect: false as const,
    grantsExecutionAuthority: false as const,
  });
}

export function verifyPackageIntegrity(pkg: SupervisoryExportPackage): boolean {
  const expectedHash = computePackageHash(pkg.manifest, pkg.artifacts);
  if (expectedHash !== pkg.packageHash) {
    return false;
  }
  for (const artifact of pkg.artifacts) {
    const expected = pkg.manifest.artifactChecksums[artifact.artifactClass];
    if (expected !== artifact.contentHash) {
      return false;
    }
  }
  return true;
}
