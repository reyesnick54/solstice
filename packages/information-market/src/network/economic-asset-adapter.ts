import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  CANONICAL_SYSTEM_OWNERS,
  chainIdFor,
  consentRefFor,
  contentCommitmentFor,
  controllerRefFor,
  networkIdFor,
  projectDescriptor,
  purposeRefFor,
  reflectSourceLifecycle,
  rightsHolderRefFor,
  scanForbiddenPayload,
  subjectRefFor,
  usageRestrictionRefFor,
  type EconomicAssetDescriptor,
  type EconomicAssetRegistryPort,
  type RegisterAssetInput,
  type RegistryFailure,
} from '../../../economic-asset-registry/src/index.ts';
import type {
  HumanInformationAssetDescriptor,
  HumanInformationConsentGrant,
  HumanInformationRight,
  HumanInformationSubject,
  HumanInformationUsageReceipt,
} from './types.ts';

const OWNER = CANONICAL_SYSTEM_OWNERS.hin;

export type HinAssetProjectionInput = {
  readonly descriptor: HumanInformationAssetDescriptor;
  readonly subject: HumanInformationSubject;
  readonly consent?: HumanInformationConsentGrant;
  readonly at: UtcInstant;
};

export type HinRightProjectionInput = {
  readonly right: HumanInformationRight;
  readonly descriptor: HumanInformationAssetDescriptor;
  readonly subject: HumanInformationSubject;
  readonly consent?: HumanInformationConsentGrant;
  readonly usage?: HumanInformationUsageReceipt;
  readonly informationAssetId?: EconomicAssetDescriptor['assetId'];
  readonly at: UtcInstant;
};

/**
 * Privacy-safe HIN → Economic Asset Registry adapter.
 *
 * Maps descriptors and rights. Does not copy raw PDV rows, legal
 * identity, or clean-room source data. Does not fabricate chain finality.
 */
export class HinEconomicAssetAdapter {
  readonly registry: EconomicAssetRegistryPort;

  constructor(registry: EconomicAssetRegistryPort) {
    this.registry = registry;
  }

  projectInformationAsset(input: HinAssetProjectionInput): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapInformationAsset(input);
    if (!mapped.ok) {
      return mapped;
    }
    return projectDescriptor(this.registry, mapped.value);
  }

  projectInformationRight(input: HinRightProjectionInput): Result<EconomicAssetDescriptor, RegistryFailure> {
    const mapped = mapInformationRight(input);
    if (!mapped.ok) {
      return mapped;
    }
    const projected = projectDescriptor(this.registry, mapped.value);
    if (!projected.ok || !input.informationAssetId) {
      return projected;
    }
    if (projected.value.lineage.some((edge) => edge.toAssetId === input.informationAssetId && edge.kind === 'DERIVED_FROM')) {
      return projected;
    }
    return this.registry.addLineage({
      fromAssetId: projected.value.assetId,
      toAssetId: input.informationAssetId,
      kind: 'DERIVED_FROM',
      at: input.at,
    });
  }

  reflectRightStatus(right: HumanInformationRight, at: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure> {
    if (right.status === 'REVOKED') {
      return reflectSourceLifecycle(this.registry, OWNER, right.rightId, 'SUSPENDED', at);
    }
    if (right.status === 'EXPIRED') {
      return reflectSourceLifecycle(this.registry, OWNER, right.rightId, 'RESTRICTED', at);
    }
    const current = this.registry.findBySourceRecord(OWNER, right.rightId);
    if (!current) {
      return err({ code: 'ASSET_NOT_FOUND', message: `right ${right.rightId} has not been projected` });
    }
    return ok(current);
  }
}

export function createHinEconomicAssetAdapter(registry: EconomicAssetRegistryPort): HinEconomicAssetAdapter {
  return new HinEconomicAssetAdapter(registry);
}

export function mapInformationAsset(input: HinAssetProjectionInput): Result<RegisterAssetInput, RegistryFailure> {
  if (input.descriptor.rawContentIncluded !== false || input.subject.legalNameExposed !== false) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'HIN projection cannot include raw personal content' });
  }
  const payload: RegisterAssetInput = {
    assetClass: 'INFORMATION_ASSET',
    domain: 'HUMAN_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: input.descriptor.descriptorId,
    sourceClass: 'HUMAN_INFORMATION_NETWORK',
    sourceSystem: OWNER,
    sourceSchemaVersion: input.descriptor.schema,
    controllerRef: controllerRefFor(`hin-controller:${input.descriptor.descriptorId}`),
    rightsHolderRefs: [rightsHolderRefFor(`hin-subject:${input.subject.internalRef}`)],
    subjectRef: subjectRefFor(input.subject.internalRef),
    jurisdiction: 'GB',
    consentRefs: input.consent ? [consentRefFor(input.consent.canonicalConsentRef ?? input.consent.grantId)] : [],
    purposeRefs: input.consent ? [purposeRefFor(input.consent.purpose)] : [],
    usageRestrictionRefs: [usageRestrictionRefFor(`hin-descriptor:${input.descriptor.descriptorId}`)],
    rightsConcepts: ['SUBJECT_RIGHTS', 'CONTROLLER_RIGHTS', 'USAGE_RIGHTS'],
    sensitivityClass: hinSensitivity(input.descriptor.sensitivityClass),
    qualityClass: input.descriptor.quality.verification === 'ATTESTED' ? 'ATTESTED' : 'DERIVED',
    freshness: 'CURRENT',
    validFrom: input.at,
    economicCategory: hinCategory(input.descriptor.category),
    contentCommitmentMaterial: `hin-desc:${input.descriptor.descriptorId}:${input.descriptor.schema}`,
    provenanceMaterial: `hin-src:${input.descriptor.sourceClass}:${input.descriptor.quality.provenanceConfidence}`,
    storageClass: 'OFF_CHAIN_PROTECTED',
    chainAnchor: {
      networkId: networkIdFor('sunrey-simulation'),
      chainId: chainIdFor('net_sunrey_simulation'),
      transactionId: null,
      blockHeight: null,
      blockId: null,
      stateRootRef: null,
      contentCommitment: contentCommitmentFor(`hin-desc:${input.descriptor.descriptorId}`),
      anchorType: 'DESCRIPTOR_COMMITMENT',
      finalityState: 'UNANCHORED',
    },
    createdAt: input.at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

export function mapInformationRight(input: HinRightProjectionInput): Result<RegisterAssetInput, RegistryFailure> {
  if (input.descriptor.rawContentIncluded !== false) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'HIN right projection cannot include raw personal content' });
  }
  if (input.usage && input.usage.rawPersonalData !== false) {
    return err({ code: 'RAW_SENSITIVE_DATA_FORBIDDEN', message: 'HIN usage receipt cannot carry raw personal data' });
  }
  const usageRef = input.usage
    ? usageRestrictionRefFor(input.usage.receiptId)
    : usageRestrictionRefFor(`hin-right:${input.right.rightId}`);
  const payload: RegisterAssetInput = {
    assetClass: 'INFORMATION_RIGHT',
    domain: 'HUMAN_ECONOMY',
    canonicalOwnerSystem: OWNER,
    sourceRecordId: input.right.rightId,
    sourceClass: 'HUMAN_INFORMATION_NETWORK',
    sourceSystem: OWNER,
    sourceSchemaVersion: input.right.policyVersion,
    controllerRef: controllerRefFor(`hin-controller:${input.right.descriptorId}`),
    rightsHolderRefs: [rightsHolderRefFor(`hin-subject:${input.subject.internalRef}`)],
    subjectRef: subjectRefFor(input.subject.internalRef),
    jurisdiction: 'GB',
    consentRefs: [consentRefFor(input.consent?.canonicalConsentRef ?? input.right.consentGrantId)],
    purposeRefs: [purposeRefFor(input.right.purpose)],
    usageRestrictionRefs: [usageRef],
    rightsConcepts:
      input.right.rightType === 'MODEL_TRAINING_PERMISSION'
        ? ['SUBJECT_RIGHTS', 'USAGE_RIGHTS', 'MODEL_TRAINING_RIGHTS']
        : ['SUBJECT_RIGHTS', 'USAGE_RIGHTS', 'COMPUTATION_RIGHTS'],
    sensitivityClass: hinSensitivity(input.descriptor.sensitivityClass),
    qualityClass: 'ATTESTED',
    freshness: input.right.status === 'ACTIVE' ? 'CURRENT' : 'SUPERSEDED',
    validFrom: input.right.createdAt,
    validUntil: input.right.expiresAt,
    economicCategory: hinCategory(input.descriptor.category),
    contentCommitmentMaterial: `hin-right:${input.right.rightId}:${input.right.policyVersion}`,
    provenanceMaterial: `hin-right-prov:${input.right.consentGrantId}:${input.right.purposeGrantId}`,
    storageClass: 'ON_CHAIN_COMMITMENT_ONLY',
    chainAnchor: {
      networkId: networkIdFor('sunrey-simulation'),
      chainId: chainIdFor('net_sunrey_simulation'),
      transactionId: null,
      blockHeight: input.usage?.chainHeight ?? null,
      blockId: null,
      stateRootRef: null,
      contentCommitment: contentCommitmentFor(`hin-right:${input.right.rightId}`),
      anchorType: 'RIGHTS_COMMITMENT',
      finalityState:
        input.usage?.chainHeight == null || input.usage.chainHeight === 0n ? 'UNANCHORED' : 'FINALIZED_ON_SIMULATION',
    },
    status: input.right.status === 'REVOKED' ? 'SUSPENDED' : input.right.status === 'EXPIRED' ? 'RESTRICTED' : 'REGISTERED',
    createdAt: input.at,
  };
  const scanned = scanForbiddenPayload(payload);
  if (!scanned.ok) {
    return scanned;
  }
  return ok(payload);
}

function hinSensitivity(value: string): RegisterAssetInput['sensitivityClass'] {
  if (value === 'HIGHLY_SENSITIVE' || value === 'SENSITIVE') {
    return 'SENSITIVE_PERSONAL';
  }
  if (value === 'RESTRICTED') {
    return 'RESTRICTED_COMMERCIAL';
  }
  return 'PERSONAL';
}

function hinCategory(value: string): RegisterAssetInput['economicCategory'] {
  if (value === 'PROFESSIONAL_INFORMATION') {
    return 'PROFESSIONAL_SERVICES';
  }
  if (value === 'CREATIVE_ACTIVITY') {
    return 'CREATIVE_PRODUCTION';
  }
  return 'HUMAN_INFORMATION';
}
