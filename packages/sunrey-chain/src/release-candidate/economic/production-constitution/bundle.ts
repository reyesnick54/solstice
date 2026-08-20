/**
 * Deterministic candidate bundle and economic constitution hashes.
 *
 * Freeze packages an immutable review/audit snapshot. Freeze is not
 * approval, activation, or authorization.
 */

import { encodeString, sha256Hex } from '../../../validators/canonical.ts';
import { economicUtcNow, resolveEconomicSourceCommit } from '../identity.ts';
import { FIRST_ECONOMIC_RC_ID } from '../types.ts';
import { FIRST_MAINNET_RC_ID } from '../../mainnet/types.ts';

import { hashOf } from './bindings.ts';
import {
  PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID,
  PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION,
  PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION,
  type FrozenProductionEconomicConstitutionCandidateBundle,
  type ProductionEconomicConstitutionCandidateBundle,
} from './types.ts';

export const BUNDLE_HASH_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_CONSTITUTION_CANDIDATE_BUNDLE_V1' as const;
export const CONSTITUTION_HASH_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_CONSTITUTION_V1' as const;

export type BundleHashInput = Omit<
  ProductionEconomicConstitutionCandidateBundle,
  'bundleHash' | 'economicConstitutionHash' | 'productionActivated'
>;

const BUNDLE_HASH_FIELDS: readonly (keyof BundleHashInput)[] = [
  'bundleId',
  'schemaVersion',
  'bundleVersion',
  'sourceCommit',
  'economicRcId',
  'mainnetRcId',
  'monetaryConstitutionHash',
  'parameterPackageHash',
  'sunreyPolicyCandidateHash',
  'sunreyValuationPolicyHash',
  'sunreyConversionPolicyHash',
  'moonreyPolicyCandidateHash',
  'moonreyProductiveValuePolicyHash',
  'moonreyConversionPolicyHash',
  'sourceTaxonomyHash',
  'unitConstitutionHash',
  'attributionPolicyHash',
  'oracleCertificationPolicyHash',
  'economicDataFabricHash',
  'HINPolicyHash',
  'HINChainAnchorCapabilityHash',
  'economicAssetVerificationHash',
  'feePolicyHash',
  'burnPolicyHash',
  'supplyGuardHash',
  'genesisAllocationManifestHash',
  'rehearsalReportHash',
  'stressReportHash',
  'firewallDecisionHash',
];

const CONSTITUTION_HASH_FIELDS: readonly (keyof BundleHashInput)[] = [
  'monetaryConstitutionHash',
  'parameterPackageHash',
  'sunreyValuationPolicyHash',
  'sunreyConversionPolicyHash',
  'moonreyProductiveValuePolicyHash',
  'moonreyConversionPolicyHash',
  'feePolicyHash',
  'burnPolicyHash',
  'supplyGuardHash',
  'genesisAllocationManifestHash',
];

export function hashBundleFields(input: BundleHashInput): string {
  const parts = [
    encodeString(BUNDLE_HASH_DOMAIN),
    encodeString(String(input.schemaVersion)),
    encodeString(input.bundleVersion),
  ];
  for (const field of BUNDLE_HASH_FIELDS) {
    parts.push(encodeString(field), encodeString(String(input[field])));
  }
  return sha256Hex(Buffer.concat(parts));
}

export function hashEconomicConstitution(input: BundleHashInput): string {
  const parts = [encodeString(CONSTITUTION_HASH_DOMAIN)];
  for (const field of CONSTITUTION_HASH_FIELDS) {
    parts.push(encodeString(field), encodeString(String(input[field])));
  }
  return sha256Hex(Buffer.concat(parts));
}

export function assembleCandidateBundle(input: BundleHashInput): ProductionEconomicConstitutionCandidateBundle {
  return Object.freeze({
    ...input,
    bundleHash: hashBundleFields(input),
    economicConstitutionHash: hashEconomicConstitution(input),
    productionActivated: false,
  });
}

export function candidateBundleDefaults(root = process.cwd()): Pick<
  BundleHashInput,
  'bundleId' | 'schemaVersion' | 'bundleVersion' | 'sourceCommit' | 'economicRcId' | 'mainnetRcId'
> {
  return Object.freeze({
    bundleId: PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_ID,
    schemaVersion: PRODUCTION_ECONOMIC_CONSTITUTION_SCHEMA_VERSION,
    bundleVersion: PRODUCTION_ECONOMIC_CONSTITUTION_BUNDLE_VERSION,
    sourceCommit: resolveEconomicSourceCommit(root),
    economicRcId: FIRST_ECONOMIC_RC_ID,
    mainnetRcId: FIRST_MAINNET_RC_ID,
  });
}

export function freezeCandidateBundle(
  bundle: ProductionEconomicConstitutionCandidateBundle,
  now = economicUtcNow(),
): FrozenProductionEconomicConstitutionCandidateBundle {
  return Object.freeze({
    bundle: Object.freeze({ ...bundle, productionActivated: false }),
    frozen: true,
    frozenAtUtc: now,
    approved: false,
    activated: false,
    authorized: false,
  });
}

export function bundleOverrideFirewallRejected(
  bundle: ProductionEconomicConstitutionCandidateBundle,
  firewallDecisionHash: string,
): boolean {
  return bundle.firewallDecisionHash !== firewallDecisionHash;
}

export function componentHash(label: string, versionId: string): string {
  return hashOf(`${label}:${versionId}`);
}
