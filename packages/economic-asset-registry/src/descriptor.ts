import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  assetIdFor,
  canonicalOwnerRefFor,
  canonicalSourceRefFor,
  contentCommitmentFor,
  controllerRefFor,
  lineageRootFor,
  provenanceDigestFor,
  rightsPolicyRefFor,
  schemaIdFor,
  sha256Canonical,
  type AssetId,
} from './ids.ts';
import { assertAcyclicLineage, normalizeLineage } from './lineage.ts';
import { validateRegisterInput } from './invariants.ts';
import {
  DEFAULT_CLASS_POLICY,
  ECONOMIC_ASSET_SCHEMA_VERSION,
  defaultStorageForSensitivity,
} from './taxonomy.ts';
import {
  AUTHORITY_BOUNDARY,
  PRIVACY_BOUNDARY,
  type EconomicAssetDescriptor,
  type LineageEdge,
  type RegisterAssetInput,
  type RegistryFailure,
  type RoleBindings,
} from './types.ts';

function failure(code: RegistryFailure['code'], message: string): RegistryFailure {
  return Object.freeze({ code, message });
}

export function descriptorLineageRoot(assetId: AssetId, edges: readonly LineageEdge[]): ReturnType<typeof lineageRootFor> {
  return lineageRootFor(`${assetId}:${edges.map((edge) => `${edge.kind}:${edge.fromAssetId}:${edge.toAssetId}`).join('|')}`);
}

export function createEconomicAssetDescriptor(
  input: RegisterAssetInput,
  existingLineage: readonly LineageEdge[] = [],
): Result<EconomicAssetDescriptor, RegistryFailure> {
  const valid = validateRegisterInput(input);
  if (!valid.ok) {
    return valid;
  }
  if (input.legalOwnershipRightsRef == null && (input as { legalOwner?: unknown }).legalOwner) {
    return err(failure('LEGAL_OWNERSHIP_INFERRED', 'legal ownership cannot be inferred from controller, subject, or operator'));
  }

  const assetId = input.assetId ?? assetIdFor(`${input.assetClass}:${input.canonicalOwnerSystem}:${input.sourceSystem}:${input.contentCommitmentMaterial}`);
  const proposedLineage = normalizeLineage(
    (input.lineage ?? []).map((edge) =>
      Object.freeze({
        kind: edge.kind,
        fromAssetId: edge.fromAssetId === edge.fromAssetId ? edge.fromAssetId : assetId,
        toAssetId: edge.toAssetId,
      }),
    ),
  );
  const lineageCheck = assertAcyclicLineage(existingLineage, proposedLineage);
  if (!lineageCheck.ok) {
    return lineageCheck;
  }

  const legalOwnershipEstablished = input.legalOwnershipRightsRef != null;
  const roles: RoleBindings = Object.freeze({
    controllerRef: input.controllerRef ?? controllerRefFor(`${input.canonicalOwnerSystem}:${input.sourceSystem}`),
    rightsHolderRefs: Object.freeze([...(input.rightsHolderRefs ?? [])]),
    custodianRef: input.custodianRef ?? null,
    operatorRef: input.operatorRef ?? null,
    subjectRef: input.subjectRef ?? null,
    controllerIsLegalOwner: false,
    subjectIsLegalOwner: false,
    operatorIsLegalOwner: false,
    legalOwnershipEstablished,
    legalOwnershipRightsRef: input.legalOwnershipRightsRef ?? null,
  });

  const rightsPolicyRef = input.rightsPolicyRef ?? rightsPolicyRefFor(`${input.assetClass}:${input.jurisdiction}`);
  const rights = Object.freeze({
    rightsPolicyRef,
    consentRefs: Object.freeze([...(input.consentRefs ?? [])]),
    purposeRefs: Object.freeze([...(input.purposeRefs ?? [])]),
    licenseRefs: Object.freeze([...(input.licenseRefs ?? [])]),
    usageRestrictionRefs: Object.freeze([...(input.usageRestrictionRefs ?? [])]),
    concepts: Object.freeze([...(input.rightsConcepts ?? [])]),
  });

  const storageClass = input.storageClass ?? defaultStorageForSensitivity(input.sensitivityClass);
  const createdAt = input.createdAt;
  const descriptor: EconomicAssetDescriptor = Object.freeze({
    schemaVersion: ECONOMIC_ASSET_SCHEMA_VERSION,
    assetId,
    assetClass: input.assetClass,
    domain: input.domain,
    canonicalOwner: canonicalOwnerRefFor(input.canonicalOwnerSystem),
    canonicalOwnerSystem: input.canonicalOwnerSystem,
    canonicalSourceRef: input.canonicalSourceRef ?? canonicalSourceRefFor(`${input.sourceSystem}:${input.contentCommitmentMaterial}`),
    schemaId: input.schemaId ?? schemaIdFor(`${input.assetClass}:${input.sourceSchemaVersion ?? '1'}`),
    sourceSchemaVersion: input.sourceSchemaVersion ?? '1',
    controllerRef: roles.controllerRef,
    rightsHolderRefs: roles.rightsHolderRefs,
    custodianRef: roles.custodianRef,
    operatorRef: roles.operatorRef,
    subjectRef: roles.subjectRef,
    roles,
    sourceClass: input.sourceClass,
    sourceSystem: input.sourceSystem,
    sourceOrganizationRef: input.sourceOrganizationRef ?? null,
    jurisdiction: input.jurisdiction,
    geography: input.geography ?? null,
    rights,
    rightsPolicyRef,
    consentRefs: rights.consentRefs,
    purposeRefs: rights.purposeRefs,
    licenseRefs: rights.licenseRefs,
    usageRestrictionRefs: rights.usageRestrictionRefs,
    sensitivityClass: input.sensitivityClass,
    retentionPolicyRef: input.retentionPolicyRef ?? null,
    deletionPolicyRef: input.deletionPolicyRef ?? null,
    qualityClass: input.qualityClass,
    confidenceClass: input.confidenceClass ?? 'UNSCORED',
    freshness: input.freshness ?? 'CURRENT',
    observedAt: input.observedAt ?? null,
    validFrom: input.validFrom,
    validUntil: input.validUntil ?? null,
    economicCategory: input.economicCategory,
    permittedValuationMethodRefs: Object.freeze([...(input.permittedValuationMethodRefs ?? [])]),
    contentCommitment: contentCommitmentFor(input.contentCommitmentMaterial),
    provenanceDigest: provenanceDigestFor(`${input.provenanceMaterial}:${sha256Canonical(input.contentCommitmentMaterial)}`),
    lineageRoot: descriptorLineageRoot(assetId, proposedLineage),
    lineage: proposedLineage,
    storageClass,
    chainAnchor: input.chainAnchor ?? null,
    status: input.status === 'VERIFIED' ? 'REGISTERED' : (input.status ?? 'REGISTERED'),
    createdAt,
    updatedAt: createdAt,
    supersedes: input.supersedes ?? null,
    supersededBy: null,
    corrects: input.corrects ?? null,
    correctedBy: null,
    privacyBoundary: PRIVACY_BOUNDARY,
    authorityBoundary: AUTHORITY_BOUNDARY,
    automaticValue: null,
    automaticSunReyQuantity: null,
    automaticMoonReyQuantity: null,
    issuanceEligible: false,
    verificationPolicyId: null,
    verificationPolicyVersion: null,
    verificationDecisionId: null,
  });

  void DEFAULT_CLASS_POLICY;
  return ok(descriptor);
}

export function replaceDescriptor(
  current: EconomicAssetDescriptor,
  patch: Partial<EconomicAssetDescriptor>,
  updatedAt: EconomicAssetDescriptor['updatedAt'],
): EconomicAssetDescriptor {
  return Object.freeze({
    ...current,
    ...patch,
    schemaVersion: ECONOMIC_ASSET_SCHEMA_VERSION,
    privacyBoundary: PRIVACY_BOUNDARY,
    authorityBoundary: AUTHORITY_BOUNDARY,
    automaticValue: null,
    automaticSunReyQuantity: null,
    automaticMoonReyQuantity: null,
    issuanceEligible: false,
    updatedAt,
  });
}
