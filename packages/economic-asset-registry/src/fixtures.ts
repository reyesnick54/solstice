import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import {
  blockIdFor,
  chainIdFor,
  consentRefFor,
  contentCommitmentFor,
  controllerRefFor,
  deletionPolicyRefFor,
  licenseRefFor,
  networkIdFor,
  operatorRefFor,
  purposeRefFor,
  retentionPolicyRefFor,
  rightsHolderRefFor,
  rightsPolicyRefFor,
  sourceOrganizationRefFor,
  stateRootRefFor,
  subjectRefFor,
  transactionIdFor,
  usageRestrictionRefFor,
  valuationMethodRefFor,
} from './ids.ts';
import { CANONICAL_SYSTEM_OWNERS } from './ids.ts';
import type { EconomicAssetChainAnchor, RegisterAssetInput } from './types.ts';
import type { ConfidenceClass, EconomicAssetClass, RightsConcept, SensitivityClass, StorageClass } from './taxonomy.ts';

export const FIXTURE_NOW: UtcInstant = asUtcInstant('2026-08-19T12:00:00.000Z');
export const FIXTURE_UNTIL: UtcInstant = asUtcInstant('2026-11-19T12:00:00.000Z');

export function fixtureAnchor(seed: string): EconomicAssetChainAnchor {
  return Object.freeze({
    networkId: networkIdFor('sunrey-simulation'),
    chainId: chainIdFor('net_sunrey_simulation'),
    transactionId: transactionIdFor(seed),
    blockHeight: 1001n,
    blockId: blockIdFor(`block-${seed}`),
    stateRootRef: stateRootRefFor(`state-${seed}`),
    contentCommitment: contentCommitmentFor(`anchor-${seed}`),
    anchorType: 'DESCRIPTOR_COMMITMENT',
    finalityState: 'ANCHORED',
  });
}

type FixtureKind =
  | 'hin-information'
  | 'information-right'
  | 'human-contribution'
  | 'contribution-evidence'
  | 'reference-dataset'
  | 'oracle-source'
  | 'observation-set'
  | 'verified-fact'
  | 'productive-object'
  | 'productive-claim'
  | 'productive-contribution'
  | 'attestation'
  | 'ai-compute';

const KIND_CLASS: Readonly<Record<FixtureKind, EconomicAssetClass>> = Object.freeze({
  'hin-information': 'INFORMATION_ASSET',
  'information-right': 'INFORMATION_RIGHT',
  'human-contribution': 'HUMAN_CONTRIBUTION_RECORD',
  'contribution-evidence': 'HUMAN_CONTRIBUTION_EVIDENCE',
  'reference-dataset': 'REFERENCE_DATASET',
  'oracle-source': 'ORACLE_SOURCE_DATASET',
  'observation-set': 'ORACLE_OBSERVATION_SET',
  'verified-fact': 'VERIFIED_ECONOMIC_FACT',
  'productive-object': 'PRODUCTIVE_ECONOMIC_OBJECT',
  'productive-claim': 'PRODUCTIVE_CLAIM',
  'productive-contribution': 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
  'attestation': 'ECONOMIC_ATTESTATION',
  'ai-compute': 'DATASET',
});

function ownerSystemFor(kind: FixtureKind): string {
  if (kind === 'hin-information' || kind === 'information-right') {
    return CANONICAL_SYSTEM_OWNERS.hin;
  }
  if (kind === 'human-contribution' || kind === 'contribution-evidence') {
    return CANONICAL_SYSTEM_OWNERS.humanContribution;
  }
  if (kind === 'oracle-source' || kind === 'observation-set' || kind === 'verified-fact' || kind === 'attestation') {
    return CANONICAL_SYSTEM_OWNERS.oracle;
  }
  if (kind === 'ai-compute' || kind === 'reference-dataset') {
    return kind === 'ai-compute' ? CANONICAL_SYSTEM_OWNERS.thisRegistry : CANONICAL_SYSTEM_OWNERS.thisRegistry;
  }
  return CANONICAL_SYSTEM_OWNERS.productive;
}

function sourceClassFor(kind: FixtureKind): RegisterAssetInput['sourceClass'] {
  if (kind === 'hin-information' || kind === 'information-right') {
    return 'HUMAN_INFORMATION_NETWORK';
  }
  if (kind === 'human-contribution' || kind === 'contribution-evidence') {
    return 'HUMAN_CONTRIBUTION_REGISTRY';
  }
  if (kind === 'oracle-source' || kind === 'observation-set' || kind === 'verified-fact' || kind === 'attestation') {
    return 'ORACLE_NETWORK';
  }
  if (kind === 'productive-object') {
    return 'PRODUCTIVE_OBJECT_REGISTRY';
  }
  if (kind === 'productive-claim' || kind === 'productive-contribution') {
    return 'PRODUCTIVE_CLAIM_REGISTRY';
  }
  if (kind === 'ai-compute') {
    return 'DERIVED_PROJECTION';
  }
  return 'EXTERNAL_REFERENCE';
}

export function fixtureAsset(kind: FixtureKind, seed: string = kind): RegisterAssetInput {
  const human =
    kind === 'hin-information' ||
    kind === 'information-right' ||
    kind === 'human-contribution' ||
    kind === 'contribution-evidence';
  const productive =
    kind === 'productive-object' || kind === 'productive-claim' || kind === 'productive-contribution' || kind === 'ai-compute';
  const oracle = kind === 'oracle-source' || kind === 'observation-set' || kind === 'verified-fact' || kind === 'attestation';
  const rightsConcepts: readonly RightsConcept[] = human
    ? ['SUBJECT_RIGHTS', 'CONTROLLER_RIGHTS', 'USAGE_RIGHTS', 'MODEL_TRAINING_RIGHTS']
    : productive
      ? ['CONTROLLER_RIGHTS', 'USAGE_RIGHTS', 'COMMERCIALIZATION_RIGHTS']
      : ['USAGE_RIGHTS', 'REDISTRIBUTION_RIGHTS'];

  const ownerSystem = ownerSystemFor(kind);
  const industrialLicense = oracle || productive || kind === 'reference-dataset';
  const sensitivityClass: SensitivityClass = human
    ? 'PERSONAL'
    : kind === 'ai-compute'
      ? 'RESTRICTED_COMMERCIAL'
      : kind === 'oracle-source'
        ? 'RESTRICTED_INDUSTRIAL'
        : kind === 'reference-dataset'
          ? 'PUBLIC'
          : oracle
            ? 'INTERNAL'
            : 'CONFIDENTIAL';
  const storageClass: StorageClass = human
    ? 'OFF_CHAIN_PROTECTED'
    : kind === 'ai-compute' || kind === 'oracle-source'
      ? 'OFF_CHAIN_RESTRICTED'
      : kind === 'reference-dataset'
        ? 'OFF_CHAIN_PUBLIC_REFERENCE'
        : 'ON_CHAIN_COMMITMENT_ONLY';
  const confidenceClass: ConfidenceClass =
    kind === 'reference-dataset' || kind === 'verified-fact' || kind === 'oracle-source' ? 'HIGH' : 'MEDIUM';

  return {
    assetClass: KIND_CLASS[kind],
    domain: human ? 'HUMAN_ECONOMY' : productive ? 'PRODUCTIVE_ECONOMY' : 'SHARED_REFERENCE',
    canonicalOwnerSystem: ownerSystem,
    sourceClass: sourceClassFor(kind),
    sourceSystem: ownerSystem,
    sourceOrganizationRef: sourceOrganizationRefFor(seed),
    controllerRef: controllerRefFor(`${kind}-controller`),
    rightsHolderRefs: [rightsHolderRefFor(`${kind}-holder`)],
    operatorRef: productive ? operatorRefFor(`${kind}-operator`) : null,
    subjectRef: human ? subjectRefFor('synthetic-contributor-ada') : kind === 'attestation' ? subjectRefFor('attested-object') : null,
    jurisdiction: human ? 'GB' : 'US',
    geography: oracle || productive ? 'REGION_A' : null,
    rightsPolicyRef: rightsPolicyRefFor(`${kind}-policy`),
    consentRefs: human ? [consentRefFor(`${seed}-consent`)] : [],
    purposeRefs: human ? [purposeRefFor(`${seed}-purpose`)] : [],
    licenseRefs: industrialLicense ? [licenseRefFor(`${seed}-license`)] : [],
    usageRestrictionRefs: human ? [usageRestrictionRefFor(`${seed}-usage`)] : [],
    rightsConcepts,
    sensitivityClass,
    retentionPolicyRef: retentionPolicyRefFor(`${kind}-retention`),
    deletionPolicyRef: human ? deletionPolicyRefFor(`${kind}-deletion`) : null,
    qualityClass:
      kind === 'verified-fact' || kind === 'human-contribution' || kind === 'productive-contribution'
        ? 'VERIFIED'
        : kind === 'reference-dataset'
          ? 'AUTHORITATIVE'
          : 'ATTESTED',
    confidenceClass,
    freshness: 'CURRENT',
    observedAt: FIXTURE_NOW,
    validFrom: FIXTURE_NOW,
    validUntil: FIXTURE_UNTIL,
    economicCategory: human
      ? kind === 'hin-information' || kind === 'information-right'
        ? 'HUMAN_INFORMATION'
        : 'ECONOMIC_PARTICIPATION'
      : kind === 'oracle-source' ||
          kind === 'observation-set' ||
          kind === 'verified-fact' ||
          kind === 'productive-object' ||
          kind === 'productive-claim' ||
          kind === 'productive-contribution'
        ? 'ENERGY'
        : kind === 'ai-compute'
          ? 'AI_COMPUTE'
          : 'SHARED_ECONOMIC_REFERENCE',
    permittedValuationMethodRefs: [valuationMethodRefFor('policy-gated-later-chunk')],
    contentCommitmentMaterial: `commit:${kind}:${seed}`,
    provenanceMaterial: `prov:${kind}:${seed}`,
    storageClass,
    chainAnchor: fixtureAnchor(seed),
    createdAt: FIXTURE_NOW,
  };
}
