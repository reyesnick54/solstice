export {
  CLAIM_CANDIDATE_SCHEMA_VERSION,
  candidateAutomaticIssuance,
  candidateCannotIssue,
  candidateCannotVerify,
} from './types.ts';
export type { ClaimCandidateBuildInput, ProductiveClaimCandidate } from './types.ts';
export { ProductiveClaimCandidateBuilder, buildProductiveClaimCandidate } from './builder.ts';
export { evaluateFactFinality, factQualityRejectionCode } from './quality.ts';
export { evaluateProductiveObjectMatch } from './object-match.ts';
export {
  claimFromCandidate,
  gateMappedClaimSubmission,
  mappingVersionOf,
  verifyMappedClaim,
} from './claim-gate.ts';
export type { MappedClaimSubmission } from './claim-gate.ts';
export {
  attachVerifiedContributionLineage,
  recordCompatibilityLineage,
  registryDoesNotAuthorizeMint,
} from './lineage.ts';
export type { CompatibilityLineageRefs } from './lineage.ts';
