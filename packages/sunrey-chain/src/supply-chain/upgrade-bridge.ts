/**
 * Chunk 54 / Chunk 40 integration.
 *
 * Software release approval signs artifacts. It does not activate an
 * UpgradePlan or change blockchain state. A binary that only matches a
 * version string must not pass the operator precheck.
 */

import { assessReadiness, type NodeCapability, type UpgradePlan } from '../governance/index.ts';
import { upgradePrecheck, type UpgradePrecheck } from '../ops/upgrade.ts';
import { releaseWarning } from './release.ts';
import type { SupplyChainReleaseRecord } from './types.ts';

export function softwareReleaseActivatesProtocol(_record: SupplyChainReleaseRecord): false {
  return false;
}

export function upgradePlanReferencesApprovedRelease(plan: UpgradePlan, record: SupplyChainReleaseRecord): boolean {
  if (record.status !== 'ACTIVE') {
    return false;
  }
  if (plan.releaseArtifactHash !== record.artifactDigests.primary) {
    return false;
  }
  if (plan.releaseManifest.artifactHash !== record.artifactDigests.primary) {
    return false;
  }
  const moduleHashes = Object.values(plan.newModuleHashes);
  if (moduleHashes.some((hash) => hash.length !== 64)) {
    return false;
  }
  const schemaHashes = Object.values(plan.releaseManifest.schemaHashes);
  if (schemaHashes.some((hash) => hash.length !== 64)) {
    return false;
  }
  return true;
}

export function versionStringIsNotIdentity(version: string, artifactHash: string, claimedHash: string): boolean {
  return version.length > 0 && artifactHash !== claimedHash;
}

export function operatorUpgradePrecheck(input: Parameters<typeof upgradePrecheck>[0] & {
  readonly installedArtifactHash: string;
  readonly claimedVersion: string;
  readonly release?: SupplyChainReleaseRecord;
}): UpgradePrecheck & { readonly artifactIdentityOk: boolean; readonly releaseWarning: string | null } {
  const base = upgradePrecheck(input);
  const pending = input.manager.pending();
  const identityOk = pending
    ? input.installedArtifactHash === pending.releaseArtifactHash
      && pending.releaseManifest.artifactHash === pending.releaseArtifactHash
      && input.node.artifactHashes.includes(pending.releaseArtifactHash)
    : true;
  const versionOnly = pending
    ? versionStringIsNotIdentity(input.claimedVersion, input.installedArtifactHash, pending.releaseArtifactHash)
    : false;
  const warning = input.release ? releaseWarning(input.release) : null;
  return {
    ...base,
    artifactIdentityOk: identityOk && !versionOnly,
    releaseWarning: warning,
    checks: [
      ...base.checks,
      {
        id: 'release-artifact-identity',
        ok: identityOk && !versionOnly,
        detail: identityOk && !versionOnly
          ? 'installed artifact hash matches the approved release'
          : 'version string is not artifact identity',
      },
      {
        id: 'release-revocation',
        ok: warning === null,
        detail: warning ?? 'release ACTIVE',
      },
    ],
  };
}

export function randomBinarySameVersionFails(plan: UpgradePlan, randomHash: string): boolean {
  const node: NodeCapability = {
    protocolVersion: plan.currentProtocolVersion,
    supportedProtocolVersions: [plan.currentProtocolVersion, plan.targetProtocolVersion],
    artifactHashes: [randomHash],
    codecIds: plan.codecs.map((codec) => codec.codecId),
    suiteIds: plan.cryptoSchedule ? [plan.cryptoSchedule.suiteId] : ['SUNREY_DEV_ED25519_SHA256'],
    migrationHashes: plan.stateMigrationHash ? [plan.stateMigrationHash] : [],
  };
  const readiness = assessReadiness(plan, node);
  return readiness.status === 'MISSING_ARTIFACT' || readiness.status === 'HASH_MISMATCH';
}
