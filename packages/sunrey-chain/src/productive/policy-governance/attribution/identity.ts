import { sha256Hex } from '../../../../../security/src/hash.ts';
import {
  capacityOutputEventFingerprint,
  crossCategoryEventFingerprint,
  governedContributionFingerprint,
  type GovernedFingerprintInput,
} from '../fingerprint.ts';
import { contributionFingerprint, type ContributionFingerprintInput } from '../../fingerprint.ts';
import type { ProductiveCategory } from '../../types.ts';
import {
  EVENT_FINGERPRINT_V3_DOMAIN,
  HISTORICAL_FINGERPRINT_DOMAINS,
  confidenceCanEstablishSameUnderlyingEvent,
  type EventIdentityEvidence,
  type HistoricalFingerprintSet,
  type IdentityRef,
  type LinkageAssessment,
} from './types.ts';

const RAW_INDUSTRIAL_HINT =
  /\b(scada|mes raw|telemetry payload|factory credential|raw[-_ ]?(dataset|content|telemetry)|industrial payload)\b/i;

/**
 * Hash an identifier into a reference. Callers pass opaque ids.
 * Raw industrial payloads are rejected, not stored.
 */
export function identityRef(label: string, value: string): IdentityRef {
  if (containsRawIndustrialData(value) || containsRawIndustrialData(label)) {
    throw new Error('RAW_INDUSTRIAL_DATA_FORBIDDEN');
  }
  return sha256Hex(`ref:${label}:${value}`);
}

export function containsRawIndustrialData(value: unknown): boolean {
  if (typeof value === 'string') {
    return RAW_INDUSTRIAL_HINT.test(value);
  }
  if (Array.isArray(value)) {
    return value.some(containsRawIndustrialData);
  }
  if (value && typeof value === 'object') {
    if ('moonreyQuantity' in value || 'moonReyQuantity' in value) {
      return true;
    }
    return Object.entries(value as Record<string, unknown>).some(
      ([key, item]) => RAW_INDUSTRIAL_HINT.test(key) || containsRawIndustrialData(item),
    );
  }
  return false;
}

export function sortRefs(refs: readonly IdentityRef[]): readonly IdentityRef[] {
  return Object.freeze([...new Set(refs)].sort());
}

export function sharedRefs(left: readonly IdentityRef[], right: readonly IdentityRef[]): readonly IdentityRef[] {
  const set = new Set(left);
  return Object.freeze(right.filter((ref) => set.has(ref)).sort());
}

export function periodsOverlap(
  left: EventIdentityEvidence['measurementPeriod'],
  right: EventIdentityEvidence['measurementPeriod'],
): boolean {
  return left.validFromUnixSeconds < right.validUntilUnixSeconds && right.validFromUnixSeconds < left.validUntilUnixSeconds;
}

export function hasStrongCrossObjectIdentity(evidence: EventIdentityEvidence): boolean {
  return Boolean(
    evidence.transformationRef ||
      evidence.alternateViewGroupRef ||
      evidence.economicTransformationRef ||
      evidence.outputLotRefs.length > 0 ||
      evidence.serialAssetRefs.length > 0,
  );
}

/**
 * Event fingerprint v3. Category, single objectId, controller, claim
 * type, and source system are excluded so alternate observations of
 * the same underlying event hash together.
 *
 * v1 and v2 fingerprints remain historical and unchanged.
 */
export function economicEventFingerprintV3(evidence: EventIdentityEvidence): string {
  if (containsRawIndustrialData(evidence)) {
    throw new Error('RAW_INDUSTRIAL_DATA_FORBIDDEN');
  }
  const strong = hasStrongCrossObjectIdentity(evidence);
  const objectFallback = strong ? '' : sortRefs(evidence.physicalObjectRefs).join(',');
  const canonical = [
    EVENT_FINGERPRINT_V3_DOMAIN,
    evidence.transformationRef ?? evidence.economicTransformationRef ?? '',
    evidence.alternateViewGroupRef ?? '',
    sortRefs(evidence.outputLotRefs).join(','),
    sortRefs(evidence.inputLotRefs).join(','),
    sortRefs(evidence.serialAssetRefs).join(','),
    sortRefs(evidence.canonicalMeasurementRefs).join(','),
    String(evidence.measurementPeriod.epoch),
    evidence.measurementPeriod.validFromUnixSeconds.toString(),
    evidence.measurementPeriod.validUntilUnixSeconds.toString(),
    evidence.deliveryPeriod.fromUnixSeconds.toString(),
    evidence.deliveryPeriod.untilUnixSeconds.toString(),
    evidence.geographyId,
    objectFallback,
  ].join('|');
  return sha256Hex(canonical);
}

export function evidenceDigest(evidence: EventIdentityEvidence): string {
  return sha256Hex(
    [
      'evidence',
      economicEventFingerprintV3(evidence),
      sortRefs(evidence.sourceObjectRefs).join(','),
      sortRefs(evidence.oracleFactRefs).join(','),
      sortRefs(evidence.sourceProvenanceRefs).join(','),
      sortRefs(evidence.upstreamEventRefs).join(','),
      sortRefs(evidence.downstreamEventRefs).join(','),
      sortRefs(evidence.controllerRefs).join(','),
      sortRefs(evidence.participantRefs).join(','),
      sortRefs(evidence.sourceSystemRefs).join(','),
      evidence.lineageRoot ?? '',
    ].join('|'),
  );
}

export function historicalFingerprints(input: {
  readonly v1?: ContributionFingerprintInput;
  readonly v2Governed?: GovernedFingerprintInput;
  readonly v2CrossCategory?: Parameters<typeof crossCategoryEventFingerprint>[0];
  readonly v2CapacityOutput?: {
    readonly objectId: string;
    readonly category: ProductiveCategory;
    readonly measurementPeriodEpoch: number;
    readonly validFromUnixSeconds: bigint;
    readonly validUntilUnixSeconds: bigint;
  };
}): HistoricalFingerprintSet {
  return Object.freeze({
    v1Contribution: input.v1 ? contributionFingerprint(input.v1) : null,
    v2GovernedContribution: input.v2Governed ? governedContributionFingerprint(input.v2Governed) : null,
    v2CrossCategory: input.v2CrossCategory ? crossCategoryEventFingerprint(input.v2CrossCategory) : null,
    v2CapacityOutput: input.v2CapacityOutput ? capacityOutputEventFingerprint(input.v2CapacityOutput) : null,
  });
}

export function historicalFingerprintDomains(): typeof HISTORICAL_FINGERPRINT_DOMAINS {
  return HISTORICAL_FINGERPRINT_DOMAINS;
}

/**
 * Only AUTHORITATIVE_LINK and VERIFIED_LINK may establish
 * SAME_UNDERLYING_EVENT. POSSIBLE_MATCH generates review only.
 */
export function assessEventLinkage(left: EventIdentityEvidence, right: EventIdentityEvidence): LinkageAssessment {
  const sameTransform =
    Boolean(left.transformationRef && left.transformationRef === right.transformationRef) ||
    Boolean(left.economicTransformationRef && left.economicTransformationRef === right.economicTransformationRef);
  const sameAlternateView = Boolean(
    left.alternateViewGroupRef && left.alternateViewGroupRef === right.alternateViewGroupRef,
  );
  const sameLineageRoot = Boolean(left.lineageRoot && left.lineageRoot === right.lineageRoot);
  const sharedLots = sharedRefs(left.outputLotRefs, right.outputLotRefs);
  const sharedSerials = sharedRefs(left.serialAssetRefs, right.serialAssetRefs);
  const sharedMeasurements = sharedRefs(left.canonicalMeasurementRefs, right.canonicalMeasurementRefs);
  const overlap = periodsOverlap(left.measurementPeriod, right.measurementPeriod);
  const sameGeography = left.geographyId === right.geographyId;
  const controllerLineageProvesCommon = sameTransform || sameAlternateView || sameLineageRoot;

  if ((sameTransform || sameAlternateView) && sharedLots.length > 0 && overlap) {
    return freezeAssessment('AUTHORITATIVE_LINK', 'SAME_UNDERLYING_EVENT', true, false);
  }
  if (sharedLots.length > 0 && overlap && sameGeography && (controllerLineageProvesCommon || sharedSerials.length > 0)) {
    return freezeAssessment('VERIFIED_LINK', 'SAME_UNDERLYING_EVENT', true, false);
  }
  if ((sameTransform || sameAlternateView || sharedLots.length > 0 || sharedSerials.length > 0) && overlap) {
    return freezeAssessment('STRONG_EVIDENCE', 'DERIVED_VIEW_OF', false, true);
  }
  if (sharedMeasurements.length > 0 && overlap && sameGeography) {
    return freezeAssessment('STRONG_EVIDENCE', null, false, true);
  }
  if (overlap && sameGeography) {
    return freezeAssessment('POSSIBLE_MATCH', null, false, true);
  }
  return freezeAssessment('UNRELATED', null, false, false);
}

export function eventIdentityCannotAuthorizeIssuance(): false {
  return false;
}

export function fingerprintV1RemainsHistorical(input: ContributionFingerprintInput): string {
  const print = contributionFingerprint(input);
  if (!print || print.length !== 64) {
    throw new Error('v1 fingerprint must remain a historical sha256 hex digest');
  }
  return print;
}

export function fingerprintV2RemainsHistorical(input: {
  readonly governed: GovernedFingerprintInput;
  readonly crossCategory: Parameters<typeof crossCategoryEventFingerprint>[0];
  readonly capacity: {
    readonly objectId: string;
    readonly category: ProductiveCategory;
    readonly measurementPeriodEpoch: number;
    readonly validFromUnixSeconds: bigint;
    readonly validUntilUnixSeconds: bigint;
    readonly claimType?: ClaimType;
  };
}): { readonly governed: string; readonly crossCategory: string; readonly capacity: string } {
  return Object.freeze({
    governed: governedContributionFingerprint(input.governed),
    crossCategory: crossCategoryEventFingerprint(input.crossCategory),
    capacity: capacityOutputEventFingerprint(input.capacity),
  });
}

function freezeAssessment(
  confidence: LinkageAssessment['confidence'],
  relation: LinkageAssessment['relation'],
  _same: boolean,
  reviewRequired: boolean,
): LinkageAssessment {
  return Object.freeze({
    confidence,
    relation,
    canEstablishSameUnderlyingEvent: confidenceCanEstablishSameUnderlyingEvent(confidence),
    reviewRequired,
  });
}
