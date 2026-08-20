/**
 * Assemble the full-platform candidate bundle from bound hashes.
 * Freeze is review-ready packaging, not approval or activation.
 */

import { FIRST_MAINNET_RC_ID } from '../../release-candidate/mainnet/types.ts';
import { BUNDLE_HASH_DOMAIN, hashDomainFields } from './hash.ts';
import { resolveFullPlatformSourceCommit } from './identity.ts';
import {
  FULL_PLATFORM_CANDIDATE_BUNDLE_ID,
  FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION,
  FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION,
  FULL_PLATFORM_DEFAULT_SEED,
  FULL_PLATFORM_FIXTURE_VERSION,
  COMPONENT_EVIDENCE_KEYS,
  type BurnInProfile,
  type ComponentEvidenceKey,
  type FullPlatformCandidateBundle,
} from './types.ts';

export type BundleHashInput = Omit<FullPlatformCandidateBundle, 'bundleHash' | 'productionActivated'>;

export function hashBundleFields(input: BundleHashInput): string {
  const fields: Record<string, string> = {
    bundleId: input.bundleId,
    schemaVersion: String(input.schemaVersion),
    bundleVersion: input.bundleVersion,
    sourceCommit: input.sourceCommit,
    fixtureVersion: input.fixtureVersion,
    seed: input.seed,
    profile: input.profile,
    mainnetRcId: input.mainnetRcId,
    mainnetRcHash: input.mainnetRcHash,
    economicConstitutionHash: input.economicConstitutionHash,
    firewallDecisionHash: input.firewallDecisionHash,
    productionHandoffPackageHash: input.productionHandoffPackageHash,
    architectureIntegrityHash: input.architectureIntegrityHash,
    burnInCanonicalHash: input.burnInCanonicalHash,
  };
  for (const key of COMPONENT_EVIDENCE_KEYS) {
    fields[`component.${key}`] = input.componentHashes[key];
  }
  return hashDomainFields(BUNDLE_HASH_DOMAIN, fields);
}

export function assembleCandidateBundle(input: BundleHashInput): FullPlatformCandidateBundle {
  return Object.freeze({
    ...input,
    bundleHash: hashBundleFields(input),
    productionActivated: false,
  });
}

export function candidateBundleDefaults(
  root = process.cwd(),
  profile: BurnInProfile = 'SMOKE',
): Pick<
  BundleHashInput,
  'bundleId' | 'schemaVersion' | 'bundleVersion' | 'sourceCommit' | 'fixtureVersion' | 'seed' | 'profile' | 'mainnetRcId'
> {
  return Object.freeze({
    bundleId: FULL_PLATFORM_CANDIDATE_BUNDLE_ID,
    schemaVersion: FULL_PLATFORM_CANDIDATE_SCHEMA_VERSION,
    bundleVersion: FULL_PLATFORM_CANDIDATE_BUNDLE_VERSION,
    sourceCommit: resolveFullPlatformSourceCommit(root),
    fixtureVersion: FULL_PLATFORM_FIXTURE_VERSION,
    seed: FULL_PLATFORM_DEFAULT_SEED,
    profile,
    mainnetRcId: FIRST_MAINNET_RC_ID,
  });
}

export function componentHashMap(hashes: Readonly<Record<ComponentEvidenceKey, string>>): Readonly<
  Record<ComponentEvidenceKey, string>
> {
  const next = {} as Record<ComponentEvidenceKey, string>;
  for (const key of COMPONENT_EVIDENCE_KEYS) {
    next[key] = hashes[key];
  }
  return Object.freeze(next);
}

export function bundleOverrideFirewallRejected(
  bundle: FullPlatformCandidateBundle,
  firewallDecisionHash: string,
): boolean {
  return bundle.firewallDecisionHash !== firewallDecisionHash;
}
