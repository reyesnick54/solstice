import { asUtcInstant } from '../../../domain/src/time.ts';
import { verificationPolicyIdFor, verificationPolicyVersionFor } from '../ids.ts';
import { ECONOMIC_ASSET_CLASSES, type EconomicAssetClass } from '../taxonomy.ts';
import type {
  AssetClassVerificationRule,
  EconomicAssetVerificationPolicy,
  RightsModel,
} from './types.ts';

export const ENGINEERING_VERIFICATION_POLICY_SEED = 'sunrey-economic-asset-verification-engineering-v1';

function rule(
  rightsModel: RightsModel,
  flags: Partial<AssetClassVerificationRule> & {
    readonly requiredSourceClasses?: AssetClassVerificationRule['requiredSourceClasses'];
    readonly requiredDomains?: AssetClassVerificationRule['requiredDomains'];
  } = {},
): AssetClassVerificationRule {
  return Object.freeze({
    enabled: flags.enabled ?? true,
    failClosed: flags.failClosed ?? false,
    rightsModel,
    requiredSourceClasses: Object.freeze([...(flags.requiredSourceClasses ?? [])]),
    forbiddenSourceClasses: Object.freeze([...(flags.forbiddenSourceClasses ?? [])]),
    requiredDomains: Object.freeze([...(flags.requiredDomains ?? [])]),
    requireController: flags.requireController ?? true,
    requireSubject: flags.requireSubject ?? false,
    requireControllerSubjectSeparation: flags.requireControllerSubjectSeparation ?? false,
    requireOperator: flags.requireOperator ?? false,
    requireRightsPolicy: flags.requireRightsPolicy ?? true,
    requireConsent: flags.requireConsent ?? false,
    requirePurpose: flags.requirePurpose ?? false,
    requireLicense: flags.requireLicense ?? false,
    requireUsageRestriction: flags.requireUsageRestriction ?? false,
    requireRetention: flags.requireRetention ?? false,
    requireSourceOrganization: flags.requireSourceOrganization ?? false,
    requireSchema: flags.requireSchema ?? true,
    requireProvenance: flags.requireProvenance ?? true,
    requireContentCommitment: flags.requireContentCommitment ?? true,
    requireObservedAt: flags.requireObservedAt ?? false,
    requireValidityPeriod: flags.requireValidityPeriod ?? false,
    requireLineage: flags.requireLineage ?? false,
    requireCanonicalSource: flags.requireCanonicalSource ?? true,
    requireContributionFingerprint: flags.requireContributionFingerprint ?? false,
    requireVerifiedContributionClaim: flags.requireVerifiedContributionClaim ?? false,
    requireOracleFactLineage: flags.requireOracleFactLineage ?? false,
    requireProductiveCategory: flags.requireProductiveCategory ?? false,
    requireMeasurementPeriod: flags.requireMeasurementPeriod ?? false,
    requireAttestingSource: flags.requireAttestingSource ?? false,
    allowedStorage: flags.allowedStorage ?? null,
    minimumQuality: flags.minimumQuality ?? null,
    minimumConfidence: flags.minimumConfidence ?? null,
    requireCurrentFreshness: flags.requireCurrentFreshness ?? false,
  });
}

export const ENGINEERING_CLASS_RULES: Readonly<Record<EconomicAssetClass, AssetClassVerificationRule>> = Object.freeze({
  DATASET: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['EXTERNAL_REFERENCE', 'ECONOMIC_SIMULATION', 'DERIVED_PROJECTION', 'OTHER_GOVERNED_SOURCE'],
    requireSourceOrganization: true,
    requireSchema: true,
  }),
  INFORMATION_ASSET: rule('HUMAN_INFORMATION', {
    requiredSourceClasses: ['HUMAN_INFORMATION_NETWORK', 'PERSONAL_DATA_VAULT'],
    requiredDomains: ['HUMAN_ECONOMY'],
    requireSubject: true,
    requireControllerSubjectSeparation: true,
    requireConsent: true,
    requirePurpose: true,
    requireUsageRestriction: true,
    requireRetention: true,
    allowedStorage: ['OFF_CHAIN_PROTECTED', 'ON_CHAIN_COMMITMENT_ONLY'],
  }),
  INFORMATION_RIGHT: rule('HUMAN_INFORMATION', {
    requiredSourceClasses: ['HUMAN_INFORMATION_NETWORK', 'CONSENT_LEDGER'],
    requiredDomains: ['HUMAN_ECONOMY'],
    requireConsent: true,
    requirePurpose: true,
    requireRightsPolicy: true,
  }),
  HUMAN_CONTRIBUTION_EVIDENCE: rule('HUMAN_INFORMATION', {
    requiredSourceClasses: ['HUMAN_CONTRIBUTION_REGISTRY'],
    requiredDomains: ['HUMAN_ECONOMY'],
    requireContributionFingerprint: true,
    requireRetention: true,
    allowedStorage: ['OFF_CHAIN_PROTECTED', 'ON_CHAIN_COMMITMENT_ONLY'],
  }),
  HUMAN_CONTRIBUTION_RECORD: rule('HUMAN_INFORMATION', {
    requiredSourceClasses: ['HUMAN_CONTRIBUTION_REGISTRY'],
    requiredDomains: ['HUMAN_ECONOMY'],
    requireContributionFingerprint: true,
    requireVerifiedContributionClaim: true,
    allowedStorage: ['OFF_CHAIN_PROTECTED', 'ON_CHAIN_COMMITMENT_ONLY', 'ON_CHAIN_PUBLIC_METADATA'],
  }),
  REFERENCE_DATASET: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['EXTERNAL_REFERENCE', 'ECONOMIC_SIMULATION', 'DERIVED_PROJECTION'],
    requiredDomains: ['SHARED_REFERENCE'],
    requireSourceOrganization: true,
    requireSchema: true,
    requireCurrentFreshness: true,
    minimumConfidence: ['HIGH', 'MEDIUM'],
    minimumQuality: ['AUTHORITATIVE', 'VERIFIED', 'ATTESTED'],
    allowedStorage: ['OFF_CHAIN_PUBLIC_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA', 'ON_CHAIN_COMMITMENT_ONLY', 'DERIVED_REBUILDABLE'],
  }),
  ECONOMIC_REFERENCE_DATA: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['EXTERNAL_REFERENCE', 'ECONOMIC_SIMULATION', 'DERIVED_PROJECTION'],
    requiredDomains: ['SHARED_REFERENCE'],
    requireSourceOrganization: true,
    requireSchema: true,
    requireCurrentFreshness: true,
    minimumConfidence: ['HIGH', 'MEDIUM'],
    minimumQuality: ['AUTHORITATIVE', 'VERIFIED', 'ATTESTED'],
    allowedStorage: ['OFF_CHAIN_PUBLIC_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA', 'ON_CHAIN_COMMITMENT_ONLY', 'DERIVED_REBUILDABLE'],
  }),
  ORACLE_SOURCE_DATASET: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['ORACLE_NETWORK'],
    forbiddenSourceClasses: ['PERSONAL_DATA_VAULT', 'HUMAN_INFORMATION_NETWORK'],
    requireSourceOrganization: true,
    requireSchema: true,
    requireLicense: true,
    requireController: true,
    allowedStorage: ['OFF_CHAIN_RESTRICTED', 'OFF_CHAIN_PROTECTED', 'ON_CHAIN_COMMITMENT_ONLY'],
  }),
  ORACLE_OBSERVATION_SET: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['ORACLE_NETWORK'],
    requireContentCommitment: true,
    requireProvenance: true,
    requireObservedAt: true,
    allowedStorage: ['ON_CHAIN_COMMITMENT_ONLY', 'OFF_CHAIN_RESTRICTED'],
  }),
  VERIFIED_ECONOMIC_FACT: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['ORACLE_NETWORK'],
    requireLineage: true,
    requireContentCommitment: true,
    minimumQuality: ['AUTHORITATIVE', 'VERIFIED'],
    allowedStorage: ['ON_CHAIN_PUBLIC_METADATA', 'ON_CHAIN_COMMITMENT_ONLY'],
  }),
  PRODUCTIVE_ECONOMIC_OBJECT: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['PRODUCTIVE_OBJECT_REGISTRY'],
    requiredDomains: ['PRODUCTIVE_ECONOMY'],
    requireOperator: true,
    requireLicense: true,
    requireProductiveCategory: true,
    requireSchema: true,
  }),
  PRODUCTIVE_CLAIM: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['PRODUCTIVE_CLAIM_REGISTRY'],
    requiredDomains: ['PRODUCTIVE_ECONOMY'],
    requireLineage: true,
    requireOracleFactLineage: true,
    requireMeasurementPeriod: true,
    requireLicense: true,
  }),
  VERIFIED_PRODUCTIVE_CONTRIBUTION: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['PRODUCTIVE_CLAIM_REGISTRY', 'PRODUCTIVE_OBJECT_REGISTRY'],
    requiredDomains: ['PRODUCTIVE_ECONOMY'],
    requireContributionFingerprint: true,
    requireLineage: true,
    requireOracleFactLineage: true,
    requireRightsPolicy: true,
  }),
  ECONOMIC_ATTESTATION: rule('INDUSTRIAL_COMMERCIAL', {
    requiredSourceClasses: ['ORACLE_NETWORK', 'EXTERNAL_REFERENCE', 'OTHER_GOVERNED_SOURCE', 'HUMAN_CONTRIBUTION_REGISTRY'],
    requireAttestingSource: true,
    requireContentCommitment: true,
    requireValidityPeriod: true,
  }),
  OTHER_GOVERNED_ECONOMIC_ASSET: rule('INDUSTRIAL_COMMERCIAL', {
    enabled: false,
    failClosed: true,
    requiredSourceClasses: [],
  }),
});

function freezePolicy(policy: EconomicAssetVerificationPolicy): EconomicAssetVerificationPolicy {
  return Object.freeze({
    ...policy,
    assetClassRules: Object.freeze({ ...policy.assetClassRules }),
    sourceClassRules: Object.freeze({ ...policy.sourceClassRules }),
    rightsRequirements: Object.freeze({ ...policy.rightsRequirements }),
    provenanceRequirements: Object.freeze({ ...policy.provenanceRequirements }),
    lineageRequirements: Object.freeze({ ...policy.lineageRequirements }),
    storageRequirements: Object.freeze(policy.storageRequirements.map((row) => Object.freeze({ ...row, allowedStorage: Object.freeze([...row.allowedStorage]) }))),
    sensitivityRequirements: Object.freeze({ ...policy.sensitivityRequirements }),
    freshnessRequirements: Object.freeze({ ...policy.freshnessRequirements }),
    confidenceRequirements: Object.freeze({ ...policy.confidenceRequirements }),
    jurisdictionRequirements: Object.freeze({
      mustResolve: true as const,
      allowedCodedJurisdictions: Object.freeze([...policy.jurisdictionRequirements.allowedCodedJurisdictions]),
    }),
    chainAnchorRequirements: Object.freeze({ ...policy.chainAnchorRequirements }),
    retentionRequirements: Object.freeze({ ...policy.retentionRequirements }),
    productionActivated: false,
  });
}

export const ENGINEERING_VERIFICATION_POLICY: EconomicAssetVerificationPolicy = freezePolicy({
  policyId: verificationPolicyIdFor(ENGINEERING_VERIFICATION_POLICY_SEED),
  policyVersion: verificationPolicyVersionFor(ENGINEERING_VERIFICATION_POLICY_SEED),
  schemaVersion: 1,
  state: 'SIMULATION',
  assetClassRules: ENGINEERING_CLASS_RULES,
  sourceClassRules: Object.freeze({
    PERSONAL_DATA_VAULT: Object.freeze({
      permittedAssetClasses: Object.freeze(['INFORMATION_ASSET', 'DATASET'] as const),
      forbiddenStorageForSensitive: Object.freeze(['OFF_CHAIN_PUBLIC_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA'] as const),
    }),
    HUMAN_INFORMATION_NETWORK: Object.freeze({
      permittedAssetClasses: Object.freeze(['INFORMATION_ASSET', 'INFORMATION_RIGHT', 'DATASET'] as const),
      forbiddenStorageForSensitive: Object.freeze(['OFF_CHAIN_PUBLIC_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA'] as const),
    }),
    ORACLE_NETWORK: Object.freeze({
      permittedAssetClasses: Object.freeze([
        'ORACLE_SOURCE_DATASET',
        'ORACLE_OBSERVATION_SET',
        'VERIFIED_ECONOMIC_FACT',
        'ECONOMIC_ATTESTATION',
        'DATASET',
      ] as const),
      forbiddenStorageForSensitive: Object.freeze(['ON_CHAIN_PUBLIC_METADATA'] as const),
    }),
  }),
  rightsRequirements: {
    rolesAreNotOwnership: true,
    legalOwnershipRequiresExplicitRef: true,
  },
  provenanceRequirements: {
    requireCanonicalSource: true,
    rejectConflictingCombinations: true,
  },
  lineageRequirements: {
    rejectCycles: true,
    rejectFabricatedVerifiedBy: true,
    rejectSettledFromWithoutSettlement: true,
    doNotInferCausalityFromTime: true,
  },
  storageRequirements: Object.freeze([
    Object.freeze({ sensitivity: 'SENSITIVE_PERSONAL' as const, allowedStorage: Object.freeze(['OFF_CHAIN_PROTECTED'] as const) }),
    Object.freeze({
      sensitivity: 'PERSONAL' as const,
      allowedStorage: Object.freeze(['OFF_CHAIN_PROTECTED', 'ON_CHAIN_COMMITMENT_ONLY'] as const),
    }),
    Object.freeze({
      sensitivity: 'RESTRICTED_INDUSTRIAL' as const,
      allowedStorage: Object.freeze(['OFF_CHAIN_RESTRICTED', 'ON_CHAIN_COMMITMENT_ONLY'] as const),
    }),
    Object.freeze({
      sensitivity: 'SECRET_REFERENCE_ONLY' as const,
      allowedStorage: Object.freeze(['OFF_CHAIN_PROTECTED', 'ON_CHAIN_COMMITMENT_ONLY'] as const),
    }),
    Object.freeze({
      sensitivity: 'PUBLIC' as const,
      allowedStorage: Object.freeze(['OFF_CHAIN_PUBLIC_REFERENCE', 'ON_CHAIN_PUBLIC_METADATA', 'ON_CHAIN_COMMITMENT_ONLY', 'DERIVED_REBUILDABLE'] as const),
    }),
  ]),
  sensitivityRequirements: {
    noSensitivePayloadOnChain: true,
    secretReferenceNeverExposesPayload: true,
  },
  freshnessRequirements: {
    staleReferenceRequiresAdditionalEvidence: true,
  },
  confidenceRequirements: {
    unscoredInsufficientForReferenceData: true,
  },
  jurisdictionRequirements: {
    mustResolve: true,
    allowedCodedJurisdictions: Object.freeze(['GB', 'US', 'EU', 'CA', 'AU', 'SIMULATION']),
  },
  chainAnchorRequirements: {
    finalizedRequiresSimulationMetadata: true,
    unanchoredForbidsFinalizedClaims: true,
    protectedRawDataMayNotAnchor: true,
    protectedCommitmentsMayAnchor: true,
  },
  retentionRequirements: {
    personalSourceDataRequiresRetention: true,
    chainHistoryIsNotDeleted: true,
  },
  effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
  effectiveUntil: null,
  governanceReference: 'docs/economics/chunk-114-economic-asset-verification.md',
  productionActivated: false,
});

const activated = new Map<string, EconomicAssetVerificationPolicy>();
activated.set(`${ENGINEERING_VERIFICATION_POLICY.policyId}:${ENGINEERING_VERIFICATION_POLICY.policyVersion}`, ENGINEERING_VERIFICATION_POLICY);

export function activateVerificationPolicy(policy: EconomicAssetVerificationPolicy): EconomicAssetVerificationPolicy {
  if (policy.state !== 'SIMULATION' && policy.state !== 'DEVELOPMENT') {
    throw new TypeError('production legal approval is not claimed; only SIMULATION or DEVELOPMENT policies may be activated');
  }
  if (policy.productionActivated !== false) {
    throw new TypeError('productionActivated remains false');
  }
  const key = `${policy.policyId}:${policy.policyVersion}`;
  const existing = activated.get(key);
  const frozen = freezePolicy(policy);
  if (existing && JSON.stringify(existing) !== JSON.stringify(frozen)) {
    throw new TypeError('an activated verification policy is immutable');
  }
  activated.set(key, frozen);
  return frozen;
}

export function getActivatedVerificationPolicy(
  policyId: EconomicAssetVerificationPolicy['policyId'],
  policyVersion: EconomicAssetVerificationPolicy['policyVersion'],
): EconomicAssetVerificationPolicy | undefined {
  return activated.get(`${policyId}:${policyVersion}`);
}

export function classRuleFor(
  policy: EconomicAssetVerificationPolicy,
  assetClass: EconomicAssetClass,
): AssetClassVerificationRule | undefined {
  return policy.assetClassRules[assetClass];
}

export function eligibleAssetClasses(policy: EconomicAssetVerificationPolicy): readonly EconomicAssetClass[] {
  return Object.freeze(
    ECONOMIC_ASSET_CLASSES.filter((assetClass) => {
      const next = policy.assetClassRules[assetClass];
      return next?.enabled === true && next.failClosed !== true;
    }),
  );
}
