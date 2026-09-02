/**
 * Wave 5 — ProductiveEconomicContribution.
 *
 * A verified productive event accepted for valuation. This object has no
 * monetary authority. It bridges physical production evidence to the
 * Productive Value Engine without conflating GPUV with MoonRey quantity
 * or market price.
 */

import type { GeographyRef, MeasurementPeriod, ProductiveCategory } from '../../../types.ts';
import type { VerifiedProductiveContribution } from '../../../verification.ts';
import type { ProductiveAttributionDecision, ProductiveEconomicEventIdentity } from '../types.ts';

export const PRODUCTIVE_ECONOMIC_CONTRIBUTION_SCHEMA_VERSION = 'sunrey.productive-economic-contribution.v1' as const;

export type InformationConsensusReceipt = {
  readonly receiptId: string;
  readonly receiptVersion: string;
  readonly observationIds: readonly string[];
  readonly sourceQuorumEvidence: readonly string[];
  readonly corroborationMethodologyId: string;
  readonly corroborationMethodologyVersion: string;
  readonly sealedAtUtc: string;
  readonly independentlyCorroborated: true;
};

export type EvidenceProofReference = {
  readonly evidenceId: string;
  readonly evidenceDigest: string;
  readonly verificationMethodologyId: string;
  readonly verificationMethodologyVersion: string;
};

export type RightsLicenseProofReference = {
  readonly rightsId: string;
  readonly licenseId: string | null;
  readonly scopeDigest: string;
};

export type EconomicClaimReference = {
  readonly economicClaimId: string;
  readonly claimFingerprint: string;
  readonly claimType: string;
};

export type ProductiveAssetReference = {
  readonly assetId: string;
  readonly objectId: string;
  readonly category: ProductiveCategory;
};

/**
 * Verified productive event accepted for valuation.
 * No monetary authority is carried by this record.
 */
export type ProductiveEconomicContribution = {
  readonly schemaVersion: typeof PRODUCTIVE_ECONOMIC_CONTRIBUTION_SCHEMA_VERSION;
  readonly contributionId: string;
  readonly contributionFingerprint: string;
  readonly canonicalEvent: ProductiveEconomicEventIdentity & {
    readonly eventFingerprint: string;
    readonly reconciliationStatus: 'RECONCILED' | 'UNRESOLVED';
  };
  readonly productiveAsset: ProductiveAssetReference;
  readonly economicClaim: EconomicClaimReference;
  readonly informationConsensusReceipt: InformationConsensusReceipt;
  readonly evidenceProofs: readonly EvidenceProofReference[];
  readonly rightsLicenseProof: RightsLicenseProofReference;
  readonly category: ProductiveCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly normalizedQuantity: bigint;
  readonly canonicalUnit: string;
  readonly measurementPeriod: MeasurementPeriod;
  readonly geography: GeographyRef;
  readonly verificationMethodologyId: string;
  readonly verificationMethodologyVersion: string;
  readonly verifiedContribution: VerifiedProductiveContribution;
  readonly attributionDecision: ProductiveAttributionDecision | null;
  readonly acceptedAtUtc: string;
  readonly simulation: true;
  readonly hasMonetaryAuthority: false;
};

export const PRODUCTIVE_CONTRIBUTION_REJECTION_CODES = [
  'CONTRIBUTION_NOT_ELIGIBLE',
  'CONTRIBUTION_STALE',
  'EVENT_UNRESOLVED',
  'ATTRIBUTION_NOT_RECONCILED',
  'MISSING_INFORMATION_CONSENSUS',
  'MISSING_EVIDENCE_PROOF',
  'MISSING_RIGHTS_LICENSE_PROOF',
  'MISSING_ECONOMIC_CLAIM',
  'DUPLICATE_PRODUCTIVE_EVENT',
  'PEVE_METHODOLOGY_FORBIDDEN',
] as const;
export type ProductiveContributionRejectionCode = (typeof PRODUCTIVE_CONTRIBUTION_REJECTION_CODES)[number];

export type AcceptContributionInput = {
  readonly verifiedContribution: VerifiedProductiveContribution;
  readonly canonicalEvent: ProductiveEconomicEventIdentity;
  readonly eventFingerprint: string;
  readonly reconciliationStatus: 'RECONCILED' | 'UNRESOLVED';
  readonly economicClaim: EconomicClaimReference;
  readonly informationConsensusReceipt: InformationConsensusReceipt;
  readonly evidenceProofs: readonly EvidenceProofReference[];
  readonly rightsLicenseProof: RightsLicenseProofReference;
  readonly verificationMethodologyId: string;
  readonly verificationMethodologyVersion: string;
  readonly attributionDecision?: ProductiveAttributionDecision | null;
  readonly acceptedAtUtc: string;
  readonly peveMethodologyRequested?: boolean;
};

export type AcceptContributionResult =
  | { readonly ok: true; readonly contribution: ProductiveEconomicContribution }
  | { readonly ok: false; readonly code: ProductiveContributionRejectionCode; readonly detail: string };

export function acceptProductiveEconomicContribution(
  input: AcceptContributionInput,
  options?: {
    readonly valuedEventFingerprints?: ReadonlySet<string>;
    readonly maxAgeEpochs?: bigint;
    readonly currentEpoch?: bigint;
  },
): AcceptContributionResult {
  if (input.peveMethodologyRequested) {
    return { ok: false, code: 'PEVE_METHODOLOGY_FORBIDDEN', detail: 'SunRey PEVE methodology cannot substitute for GPUV' };
  }
  const contribution = input.verifiedContribution;
  if (contribution.status !== 'ELIGIBLE') {
    return { ok: false, code: 'CONTRIBUTION_NOT_ELIGIBLE', detail: 'only ELIGIBLE verified contributions may be accepted for valuation' };
  }
  if (input.reconciliationStatus !== 'RECONCILED') {
    return { ok: false, code: 'EVENT_UNRESOLVED', detail: 'unresolved productive events cannot be valued' };
  }
  if (!input.eventFingerprint) {
    return { ok: false, code: 'EVENT_UNRESOLVED', detail: 'event fingerprint is required' };
  }
  if (input.attributionDecision && !input.attributionDecision.reconciled) {
    return { ok: false, code: 'ATTRIBUTION_NOT_RECONCILED', detail: 'attribution must be reconciled before valuation' };
  }
  if (!input.informationConsensusReceipt.independentlyCorroborated || input.informationConsensusReceipt.observationIds.length === 0) {
    return { ok: false, code: 'MISSING_INFORMATION_CONSENSUS', detail: 'information consensus receipt is required' };
  }
  if (input.evidenceProofs.length === 0) {
    return { ok: false, code: 'MISSING_EVIDENCE_PROOF', detail: 'at least one evidence proof is required' };
  }
  if (!input.rightsLicenseProof.rightsId) {
    return { ok: false, code: 'MISSING_RIGHTS_LICENSE_PROOF', detail: 'rights or license proof is required' };
  }
  if (!input.economicClaim.economicClaimId) {
    return { ok: false, code: 'MISSING_ECONOMIC_CLAIM', detail: 'economic claim reference is required' };
  }
  const valued = options?.valuedEventFingerprints;
  if (valued?.has(input.eventFingerprint)) {
    return { ok: false, code: 'DUPLICATE_PRODUCTIVE_EVENT', detail: 'duplicate productive event cannot be valued twice' };
  }
  const maxAge = options?.maxAgeEpochs;
  const currentEpoch = options?.currentEpoch;
  if (maxAge !== undefined && currentEpoch !== undefined && contribution.measurementPeriod.epoch + Number(maxAge) < Number(currentEpoch)) {
    return { ok: false, code: 'CONTRIBUTION_STALE', detail: 'stale or unverified contribution rejected' };
  }

  return {
    ok: true,
    contribution: Object.freeze({
      schemaVersion: PRODUCTIVE_ECONOMIC_CONTRIBUTION_SCHEMA_VERSION,
      contributionId: contribution.contributionId,
      contributionFingerprint: contribution.fingerprint,
      canonicalEvent: Object.freeze({
        ...input.canonicalEvent,
        eventFingerprint: input.eventFingerprint,
        reconciliationStatus: input.reconciliationStatus,
      }),
      productiveAsset: Object.freeze({
        assetId: contribution.objectId,
        objectId: contribution.objectId,
        category: contribution.category,
      }),
      economicClaim: input.economicClaim,
      informationConsensusReceipt: input.informationConsensusReceipt,
      evidenceProofs: Object.freeze([...input.evidenceProofs]),
      rightsLicenseProof: input.rightsLicenseProof,
      category: contribution.category,
      quantity: contribution.quantity,
      unit: contribution.unit,
      normalizedQuantity: contribution.normalizedQuantity,
      canonicalUnit: contribution.canonicalUnit ?? contribution.baseUnitId,
      measurementPeriod: contribution.measurementPeriod,
      geography: contribution.geography,
      verificationMethodologyId: input.verificationMethodologyId,
      verificationMethodologyVersion: input.verificationMethodologyVersion,
      verifiedContribution: contribution,
      attributionDecision: input.attributionDecision ?? null,
      acceptedAtUtc: input.acceptedAtUtc,
      simulation: true,
      hasMonetaryAuthority: false,
    }),
  };
}
