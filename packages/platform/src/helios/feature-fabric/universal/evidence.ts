import type { EvidenceVault } from '@solstice/evidence';
import type { FeatureManifest } from './types.ts';

export function sealUniversalFeatureManifest(
  vault: EvidenceVault | undefined,
  manifest: FeatureManifest,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_AAFV2_STRATEGY_LAB_FEATURE_MANIFEST', {
    manifestId: manifest.manifestId,
    manifestHash: manifest.manifestHash,
    decisionTime: manifest.decisionTime,
    compilerVersion: manifest.compilerVersion,
    entityUniverse: manifest.entityUniverse,
    instrumentUniverse: manifest.instrumentUniverse,
    featureCount: manifest.featureSnapshotIds.length,
    pointInTimeRule: manifest.pointInTimeRule,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
  return sealed?.evidenceId ?? null;
}
