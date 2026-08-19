import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import {
  blockIdFor,
  chainIdFor,
  consentRefFor,
  contentCommitmentFor,
  controllerRefFor,
  licenseRefFor,
  networkIdFor,
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
import type { EconomicAssetClass, RightsConcept } from './taxonomy.ts';

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
  | 'human-contribution'
  | 'reference-dataset'
  | 'oracle-source'
  | 'verified-fact'
  | 'productive-object'
  | 'productive-contribution'
  | 'ai-compute';

const KIND_CLASS: Readonly<Record<FixtureKind, EconomicAssetClass>> = Object.freeze({
  'hin-information': 'INFORMATION_ASSET',
  'human-contribution': 'HUMAN_CONTRIBUTION_RECORD',
  'reference-dataset': 'REFERENCE_DATASET',
  'oracle-source': 'ORACLE_SOURCE_DATASET',
  'verified-fact': 'VERIFIED_ECONOMIC_FACT',
  'productive-object': 'PRODUCTIVE_ECONOMIC_OBJECT',
  'productive-contribution': 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
  'ai-compute': 'DATASET',
});

export function fixtureAsset(kind: FixtureKind, seed: string = kind): RegisterAssetInput {
  const human = kind === 'hin-information' || kind === 'human-contribution';
  const productive = kind === 'productive-object' || kind === 'productive-contribution' || kind === 'ai-compute';
  const oracle = kind === 'oracle-source' || kind === 'verified-fact';
  const rightsConcepts: readonly RightsConcept[] = human
    ? ['SUBJECT_RIGHTS', 'CONTROLLER_RIGHTS', 'USAGE_RIGHTS', 'MODEL_TRAINING_RIGHTS']
    : productive
      ? ['CONTROLLER_RIGHTS', 'USAGE_RIGHTS', 'COMMERCIALIZATION_RIGHTS']
      : ['USAGE_RIGHTS', 'REDISTRIBUTION_RIGHTS'];

  const ownerSystem = human
    ? kind === 'hin-information'
      ? CANONICAL_SYSTEM_OWNERS.hin
      : CANONICAL_SYSTEM_OWNERS.humanContribution
    : oracle
      ? CANONICAL_SYSTEM_OWNERS.oracle
      : kind === 'ai-compute'
        ? CANONICAL_SYSTEM_OWNERS.thisRegistry
        : CANONICAL_SYSTEM_OWNERS.productive;

  return {
    assetClass: KIND_CLASS[kind],
    domain: human ? 'HUMAN_ECONOMY' : productive ? 'PRODUCTIVE_ECONOMY' : 'SHARED_REFERENCE',
    canonicalOwnerSystem: ownerSystem,
    sourceClass: human
      ? kind === 'hin-information'
        ? 'HUMAN_INFORMATION_NETWORK'
        : 'HUMAN_CONTRIBUTION_REGISTRY'
      : oracle
        ? 'ORACLE_NETWORK'
        : kind === 'ai-compute'
          ? 'DERIVED_PROJECTION'
          : kind === 'productive-object'
            ? 'PRODUCTIVE_OBJECT_REGISTRY'
            : kind === 'productive-contribution'
              ? 'PRODUCTIVE_CLAIM_REGISTRY'
              : 'EXTERNAL_REFERENCE',
    sourceSystem: ownerSystem,
    sourceOrganizationRef: sourceOrganizationRefFor(seed),
    controllerRef: controllerRefFor(`${kind}-controller`),
    rightsHolderRefs: [rightsHolderRefFor(`${kind}-holder`)],
    subjectRef: human ? subjectRefFor('synthetic-contributor-ada') : null,
    jurisdiction: human ? 'GB' : 'US',
    geography: oracle || productive ? 'REGION_A' : null,
    rightsPolicyRef: rightsPolicyRefFor(`${kind}-policy`),
    consentRefs: human ? [consentRefFor(`${seed}-consent`)] : [],
    purposeRefs: [purposeRefFor(`${seed}-purpose`)],
    licenseRefs: kind === 'reference-dataset' ? [licenseRefFor(`${seed}-license`)] : [],
    usageRestrictionRefs: human ? [usageRestrictionRefFor(`${seed}-usage`)] : [],
    rightsConcepts,
    sensitivityClass: human ? 'PERSONAL' : kind === 'ai-compute' ? 'RESTRICTED_COMMERCIAL' : oracle ? 'INTERNAL' : 'CONFIDENTIAL',
    retentionPolicyRef: retentionPolicyRefFor(`${kind}-retention`),
    qualityClass: kind === 'verified-fact' || kind === 'human-contribution' || kind === 'productive-contribution' ? 'VERIFIED' : kind === 'reference-dataset' ? 'AUTHORITATIVE' : 'ATTESTED',
    freshness: 'CURRENT',
    observedAt: FIXTURE_NOW,
    validFrom: FIXTURE_NOW,
    validUntil: FIXTURE_UNTIL,
    economicCategory: human
      ? kind === 'hin-information'
        ? 'HUMAN_INFORMATION'
        : 'ECONOMIC_PARTICIPATION'
      : kind === 'oracle-source' || kind === 'verified-fact' || kind === 'productive-object' || kind === 'productive-contribution'
        ? 'ENERGY'
        : kind === 'ai-compute'
          ? 'AI_COMPUTE'
          : 'SHARED_ECONOMIC_REFERENCE',
    permittedValuationMethodRefs: [valuationMethodRefFor('policy-gated-later-chunk')],
    contentCommitmentMaterial: `commit:${kind}:${seed}`,
    provenanceMaterial: `prov:${kind}:${seed}`,
    storageClass: human ? 'OFF_CHAIN_PROTECTED' : kind === 'ai-compute' ? 'OFF_CHAIN_RESTRICTED' : kind === 'reference-dataset' ? 'OFF_CHAIN_PUBLIC_REFERENCE' : 'ON_CHAIN_COMMITMENT_ONLY',
    chainAnchor: fixtureAnchor(seed),
    createdAt: FIXTURE_NOW,
  };
}
