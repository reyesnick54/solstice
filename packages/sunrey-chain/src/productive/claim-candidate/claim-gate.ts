import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { FactType, UnitCode } from '../../oracle/types.ts';
import type { DataSourceCategory } from '../../oracle/production/types.ts';
import { validateSourceFactClaimMapping } from '../../oracle/source-taxonomy/validator.ts';
import type { SourceClaimCompatibilityRejection } from '../../oracle/source-taxonomy/types.ts';
import type { ProductiveClaim } from '../claims.ts';
import type { ProductiveEconomicObject } from '../objects.ts';
import { verifyProductiveClaim, type VerificationContext, type VerificationResult } from '../verification.ts';
import type { ProductiveClaimCandidate } from './types.ts';

export type MappedClaimSubmission = {
  readonly claim: ProductiveClaim;
  readonly object: ProductiveEconomicObject;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly sourceUnit: UnitCode;
  readonly mappingId?: string | null;
  readonly mappingVersion?: number | null;
};

export function gateMappedClaimSubmission(
  input: MappedClaimSubmission,
): Result<ProductiveClaim, SourceClaimCompatibilityRejection> {
  if (input.claim.objectId !== input.object.objectId) {
    return err({
      code: 'PRODUCTIVE_OBJECT_REQUIRED',
      detail: `claim ${input.claim.claimId} object ${input.claim.objectId} does not match ${input.object.objectId}`,
    });
  }
  if (input.claim.category !== input.object.category) {
    return err({
      code: 'FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY',
      detail: `claim category ${input.claim.category} does not match object ${input.object.category}`,
    });
  }
  const mapped = validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    sourceUnit: input.sourceUnit,
    productiveCategory: input.claim.category,
    claimType: input.claim.claimType,
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
  });
  if (!mapped.ok) {
    return mapped;
  }
  return ok(input.claim);
}

export function claimFromCandidate(
  candidate: ProductiveClaimCandidate,
  claimId: string,
  controller: string,
): ProductiveClaim {
  return Object.freeze({
    schemaVersion: 1,
    claimId,
    objectId: candidate.objectId,
    claimType: candidate.proposedClaimType,
    category: candidate.productiveCategory,
    quantity: candidate.quantity,
    unit: candidate.sourceUnit,
    measurementPeriod: candidate.measurementPeriod,
    geography: candidate.geography,
    oracleFactIds: [candidate.factId],
    rightsReferences: [...candidate.rightsReferences],
    controller,
    proofReferences: [`mapping:${candidate.mappingId}@${candidate.mappingVersion}`],
    status: 'SUBMITTED',
    upstreamContributionIds: [],
  });
}

export function verifyMappedClaim(
  input: MappedClaimSubmission,
  context: VerificationContext,
): VerificationResult | { readonly ok: false; readonly code: SourceClaimCompatibilityRejection['code'] } {
  const gated = gateMappedClaimSubmission(input);
  if (!gated.ok) {
    return { ok: false, code: gated.error.code };
  }
  return verifyProductiveClaim(gated.value, context);
}

export function mappingVersionOf(candidate: ProductiveClaimCandidate): {
  readonly mappingId: string;
  readonly mappingVersion: number;
} {
  return Object.freeze({
    mappingId: candidate.mappingId,
    mappingVersion: candidate.mappingVersion,
  });
}
