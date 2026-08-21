import { encodeBool, encodeString, encodeU32, sha256Hex } from '../../../validators/canonical.ts';
import { containsPrivateKeyMaterial } from '../../../governance-ops/hash.ts';
import { recordContainsRawSecret } from '../../../providers/production-binding/secrets.ts';

import {
  LAUNCH_FREEZE_DOMAIN,
  LAUNCH_FREEZE_SCHEMA_VERSION,
  REJECTED_IMPLICIT_VERSIONS,
  type ExactVersionBinding,
  type ProductionLaunchCandidateFreezeInput,
} from './types.ts';

export function implicitVersionRejected(versionId: string): boolean {
  const normalized = versionId.trim().toLowerCase();
  return (REJECTED_IMPLICIT_VERSIONS as readonly string[]).includes(normalized);
}

export function hashCanonicalText(value: string): string {
  return sha256Hex(encodeString(value));
}

export function hashCanonicalJson(value: unknown): string {
  return sha256Hex(encodeString(stableJson(value)));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (typeof inner === 'bigint') {
      return inner.toString();
    }
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(inner as Record<string, unknown>).sort()) {
        sorted[key] = (inner as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return inner;
  });
}

export function hashOrderedStrings(domain: string, values: readonly string[]): string {
  const ordered = [...values].sort();
  return sha256Hex(
    Buffer.concat([encodeString(domain), encodeU32(ordered.length), ...ordered.map((row) => encodeString(row))]),
  );
}

export function encodeOptionalString(value: string | null | undefined): Buffer {
  return encodeString(value ?? '');
}

export function hashExactBinding(binding: ExactVersionBinding): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('SUNREY_LAUNCH_FREEZE_BINDING_V1'),
      encodeString(binding.componentId),
      encodeString(binding.schemaVersion),
      encodeString(binding.contentVersion),
      encodeString(binding.contentHash),
    ]),
  );
}

export function hashLaunchFreezeMaterial(input: ProductionLaunchCandidateFreezeInput): string {
  const bindings = [...input.bindings].sort((left, right) => left.componentId.localeCompare(right.componentId));
  const payload = Buffer.concat([
    encodeString(LAUNCH_FREEZE_DOMAIN),
    encodeU32(LAUNCH_FREEZE_SCHEMA_VERSION),
    encodeString(input.freezeId),
    encodeU32(input.freezeVersion ?? 1),
    encodeString(input.sourceCommit),
    encodeOptionalString(input.sourceTreeHash),
    encodeString(input.architectureManifestHash),
    encodeString(input.architectureIntegrityBaselineHash),
    encodeString(input.packageLockHash),
    encodeString(input.mainnetRcId),
    encodeString(input.mainnetRcHash),
    encodeString(input.economicRcId),
    encodeString(input.economicRcHash),
    encodeString(input.fullPlatformCandidateHash),
    encodeString(input.productionEconomicAuthorizationHash),
    encodeString(input.productionParameterPackageHash),
    encodeString(input.externalEvidenceSnapshotHash),
    encodeString(input.operatingScopeSnapshotHash),
    encodeString(input.providerBindingSnapshotHash),
    encodeString(input.validatorCandidateSetHash),
    encodeString(input.cryptographicPolicyHash),
    encodeString(input.genesisCandidateId),
    encodeString(input.genesisCandidateHash),
    encodeString(input.genesisAllocationManifestHash),
    encodeString(input.productionCeremonyPlanHash),
    encodeString(input.databaseMigrationManifestHash),
    encodeString(input.configurationBaselineHash),
    encodeString(input.sbomHash),
    encodeString(input.provenanceHash),
    encodeString(input.auditBundleHash),
    encodeString(input.testReceiptBundleHash),
    encodeString(input.adversarialCampaignHash),
    encodeString(input.burnInReportHash),
    encodeU32(bindings.length),
    ...bindings.flatMap((row) => [
      encodeString(row.componentId),
      encodeString(row.schemaVersion),
      encodeString(row.contentVersion),
      encodeString(row.contentHash),
    ]),
    encodeOptionalString(input.supersededBy ?? null),
    encodeBool(false),
    encodeBool(false),
    encodeBool(false),
  ]);
  return sha256Hex(payload);
}

export function launchFreezeContainsSecret(value: unknown): boolean {
  return recordContainsRawSecret(value) !== null;
}

export function launchFreezeContainsPrivateKey(value: unknown): boolean {
  return containsPrivateKeyMaterial(value);
}

export { containsPrivateKeyMaterial, recordContainsRawSecret };
