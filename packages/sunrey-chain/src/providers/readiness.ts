/**
 * Feed provider acceptance into Chunk 65 mainnet readiness and the
 * Production Network Candidate V2 surface.
 *
 * Chunk 81 Candidate V2 is not reimplemented here. This module
 * produces a provider-acceptance feed the existing readiness
 * evaluator and genesis-candidate tooling can consume.
 */

import { digestJson } from '../infra/hash.ts';
import type { ReadinessEvidenceRecord } from '../mainnet/types.ts';
import { freezeEvidence } from '../mainnet/evidence.ts';
import type { ProductionNetworkCandidate } from '../mainnet/types.ts';
import type { ProviderAcceptanceReport, ProductionProviderMatrix } from './types.ts';

export const CANDIDATE_V2_PROVIDER_SURFACE = 'ProductionNetworkCandidateV2.providerAcceptance' as const;

export type ProviderAcceptanceReadinessFeed = {
  readonly surface: typeof CANDIDATE_V2_PROVIDER_SURFACE;
  readonly technicalAcceptance: boolean;
  readonly securityEvidence: boolean;
  readonly commercialEvidence: boolean;
  readonly legalRegulatoryEvidence: boolean;
  readonly humanAcceptance: boolean;
  readonly productionEligibleProviders: number;
  readonly anyProductionEligible: boolean;
  readonly secretValuePresent: false;
  readonly reportDigest: string;
  readonly matrixDigest: string;
  readonly mainnetEnabled: false;
  readonly liveFlagsUnchanged: true;
};

export function buildProviderAcceptanceReadinessFeed(
  report: ProviderAcceptanceReport,
  matrix: ProductionProviderMatrix,
): ProviderAcceptanceReadinessFeed {
  return Object.freeze({
    surface: CANDIDATE_V2_PROVIDER_SURFACE,
    technicalAcceptance: report.technicalAcceptance,
    securityEvidence: report.securityEvidence,
    commercialEvidence: report.commercialEvidence,
    legalRegulatoryEvidence: report.legalRegulatoryEvidence,
    humanAcceptance: report.humanAcceptance,
    productionEligibleProviders: report.results.filter((row) => row.productionEligible).length,
    anyProductionEligible: matrix.anyProductionEligible,
    secretValuePresent: false,
    reportDigest: report.reportDigest,
    matrixDigest: matrix.matrixDigest,
    mainnetEnabled: false,
    liveFlagsUnchanged: true,
  });
}

export function providerAcceptanceEvidenceRecords(
  feed: ProviderAcceptanceReadinessFeed,
): readonly ReadinessEvidenceRecord[] {
  return Object.freeze([
    freezeEvidence({
      requirementId: 'REQ-PROVIDER-001',
      dimension: 'PARTNER_DEPENDENCIES',
      description: 'Chunk 82 external production provider acceptance harness',
      scope: 'PARTNERS',
      evidenceType: 'SOFTWARE_TEST',
      source: 'packages/sunrey-chain/src/providers',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Local/sandbox provider acceptance only. External contracts, licenses, and commercial HSM evidence remain unfilled.',
      externalEvidence: false,
      chunkReference: 'CHUNK-82',
      verificationStatus: 'ENGINEERING_VERIFIED',
      evidenceHash: feed.reportDigest,
      evidenceReference: `provider-acceptance:${feed.reportDigest}`,
    }),
    freezeEvidence({
      requirementId: 'REQ-PROVIDER-002',
      dimension: 'PARTNER_DEPENDENCIES',
      description: 'External provider contracts, licenses, and commercial rights',
      scope: 'PARTNERS',
      evidenceType: 'PARTNER_AGREEMENT',
      source: 'external-provider-slot',
      authorizedVerifierRole: 'COUNSEL',
      expirationOrReviewDateUtc: null,
      notes: 'No fabricated partner agreement. Missing contract stays missing.',
      externalEvidence: true,
      chunkReference: 'CHUNK-82',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
    freezeEvidence({
      requirementId: 'REQ-PROVIDER-003',
      dimension: 'HUMAN_AUTHORIZATION',
      description: 'Human acceptance of external production providers',
      scope: 'PARTNERS',
      evidenceType: 'HUMAN_AUTHORIZATION',
      source: 'packages/sunrey-chain/src/providers/evaluation.ts',
      authorizedVerifierRole: 'HUMAN_AUTHORITY',
      expirationOrReviewDateUtc: null,
      notes: 'AI cannot mark HUMAN_ACCEPTED or PRODUCTION_ELIGIBLE.',
      externalEvidence: true,
      chunkReference: 'CHUNK-82',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash: null,
      evidenceReference: null,
    }),
  ]);
}

export function attachProviderFeedToCandidate(
  candidate: ProductionNetworkCandidate,
  feed: ProviderAcceptanceReadinessFeed,
): {
  readonly candidate: ProductionNetworkCandidate;
  readonly providerFeed: ProviderAcceptanceReadinessFeed;
  readonly candidateHashUnchangedByProviderEligibility: true;
  readonly feedDigest: string;
} {
  return Object.freeze({
    candidate,
    providerFeed: feed,
    candidateHashUnchangedByProviderEligibility: true,
    feedDigest: digestJson(feed),
  });
}
