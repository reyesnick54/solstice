/**
 * Information Consensus promotion boundary for attestation mesh receipts.
 *
 * This module defines serializable promotion payloads without importing
 * sunrey-chain. Integration tests wire these into Wave 4 IC evaluation.
 */

import type { HumanContributionVerificationReceipt } from './types.ts';

export type AttestationMeshIcObservation = {
  readonly observationId: string;
  readonly providerId: string;
  readonly sourceClass: string;
  readonly subjectRef: string;
  readonly numericValue: number | null;
  readonly categoricalValue: string | null;
  readonly observedAt: string;
  readonly rightsStatus: 'CLEAR' | 'RESTRICTED' | 'UNKNOWN';
  readonly lineage: {
    readonly lineageRootId: string;
    readonly upstreamOrganizationId: string;
    readonly sourceClass: string;
    readonly sharedControlGroup: string | null;
  };
};

export type AttestationMeshIcPromotion = {
  readonly receipt: HumanContributionVerificationReceipt;
  readonly observations: readonly AttestationMeshIcObservation[];
  readonly independentLineageRootIds: readonly string[];
  readonly eligibleForVerifiedFact: boolean;
  readonly eligibleForHumanEconomicClaim: boolean;
  readonly grantsMonetaryAuthority: false;
  readonly grantsExecutionAuthority: false;
  readonly createsPeve: false;
  readonly authorizesSunReyIssuance: false;
};

export type HumanEconomicClaimPromotion = {
  readonly economicClaimId: string;
  readonly subjectRef: string;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly supportingFactIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly temporalBounds: { readonly startUtc: string; readonly endUtc: string };
  readonly verificationStatus: 'VERIFIED' | 'PROPOSED';
  readonly grantsMonetaryAuthority: false;
  readonly authorizesSunReyIssuance: false;
  readonly createsPeve: false;
};

export function buildAttestationMeshIcPromotion(receipt: HumanContributionVerificationReceipt): AttestationMeshIcPromotion {
  const observations: AttestationMeshIcObservation[] = receipt.sourceLineage.flatMap((lineage, index) =>
    lineage.attestationIds.map((attestationId, attIndex) =>
      Object.freeze({
        observationId: `amo_${receipt.receiptId.slice(5, 13)}_${index}_${attIndex}`,
        providerId: `attestation-mesh:${lineage.upstreamOrganizationId}`,
        sourceClass: lineage.issuerClasses[0] ?? 'ATTESTATION',
        subjectRef: String(receipt.humanActorRef),
        numericValue: 1,
        categoricalValue: receipt.contributionClass,
        observedAt: receipt.freshness.evaluatedAt,
        rightsStatus: receipt.rightsStatus,
        lineage: Object.freeze({
          lineageRootId: lineage.lineageRootId,
          upstreamOrganizationId: lineage.upstreamOrganizationId,
          sourceClass: lineage.issuerClasses[0] ?? 'ATTESTATION',
          sharedControlGroup: null,
        }),
      }),
    ),
  );

  const eligible = receipt.result === 'VERIFIED';

  return Object.freeze({
    receipt,
    observations: Object.freeze(observations),
    independentLineageRootIds: Object.freeze(
      receipt.sourceLineage.filter((row) => row.countsAsIndependent).map((row) => row.lineageRootId).sort(),
    ),
    eligibleForVerifiedFact: eligible,
    eligibleForHumanEconomicClaim: eligible,
    grantsMonetaryAuthority: false,
    grantsExecutionAuthority: false,
    createsPeve: false,
    authorizesSunReyIssuance: false,
  });
}

export function buildHumanEconomicClaimPromotion(
  receipt: HumanContributionVerificationReceipt,
  verifiedFactId: string,
): HumanEconomicClaimPromotion | null {
  if (receipt.result !== 'VERIFIED') {
    return null;
  }
  return Object.freeze({
    economicClaimId: `hec_claim_${receipt.receiptId.slice(5, 21)}`,
    subjectRef: String(receipt.humanActorRef),
    canonicalEntityId: `entity:${String(receipt.humanActorRef)}`,
    canonicalEventId: `event:${String(receipt.contributionEventRef)}`,
    supportingFactIds: Object.freeze([verifiedFactId]),
    evidenceRefs: Object.freeze([...receipt.evidenceRefs]),
    temporalBounds: Object.freeze({
      startUtc: receipt.freshness.evaluatedAt,
      endUtc: receipt.freshness.evaluatedAt,
    }),
    verificationStatus: 'VERIFIED',
    grantsMonetaryAuthority: false,
    authorizesSunReyIssuance: false,
    createsPeve: false,
  });
}

export function attestationMeshCreatesMoney(): false {
  return false;
}

export function attestationMeshCreatesPeve(): false {
  return false;
}

export function attestationMeshAuthorizesSunReyIssuance(): false {
  return false;
}
