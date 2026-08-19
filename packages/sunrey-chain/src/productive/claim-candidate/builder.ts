import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { isUnitCode } from '../../oracle/types.ts';
import {
  mappingRejection,
  type AttributionState,
  type SourceClaimCompatibilityRejection,
} from '../../oracle/source-taxonomy/types.ts';
import { validateSourceFactClaimMapping } from '../../oracle/source-taxonomy/validator.ts';
import { periodIsDefined } from '../claims.ts';
import { CLAIM_CANDIDATE_SCHEMA_VERSION, type ClaimCandidateBuildInput, type ProductiveClaimCandidate } from './types.ts';
import { evaluateProductiveObjectMatch } from './object-match.ts';
import { evaluateFactFinality } from './quality.ts';

export class ProductiveClaimCandidateBuilder {
  build(input: ClaimCandidateBuildInput): Result<ProductiveClaimCandidate, SourceClaimCompatibilityRejection> {
    return buildProductiveClaimCandidate(input);
  }
}

export function buildProductiveClaimCandidate(
  input: ClaimCandidateBuildInput,
): Result<ProductiveClaimCandidate, SourceClaimCompatibilityRejection> {
  if (input.mapping.referenceDataOnly) {
    return err(
      mappingRejection(
        'REFERENCE_DATA_CANNOT_CREATE_CLAIM',
        `mapping ${input.mapping.mappingId} is reference data and cannot create a productive claim`,
      ),
    );
  }
  if (input.mapping.status === 'SUPERSEDED') {
    return err(
      mappingRejection(
        'MAPPING_SUPERSEDED',
        `mapping ${input.mapping.mappingId}@${input.mapping.mappingVersion} is superseded`,
      ),
    );
  }
  if (input.mapping.status === 'RETIRED') {
    return err(mappingRejection('SOURCE_CATEGORY_RETIRED', `mapping ${input.mapping.mappingId} is retired`));
  }
  if (!isUnitCode(input.fact.aggregatedValue.unit)) {
    return err(mappingRejection('SOURCE_UNIT_NOT_ALLOWED', `fact unit ${input.fact.aggregatedValue.unit} is not a source unit`));
  }

  const mapped = validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    sourceUnit: input.fact.aggregatedValue.unit,
    productiveCategory: input.mapping.productiveCategory,
    claimType: input.proposedClaimType,
    mappingId: input.mapping.mappingId,
    mappingVersion: input.mapping.mappingVersion,
  });
  if (!mapped.ok) {
    return mapped;
  }

  const quality = evaluateFactFinality(input.fact, input.nowUnix);
  if (quality) {
    if (input.fact.qualityStatus === 'CONFLICTED') {
      return err(mappingRejection('VERIFIED_FACT_REQUIRED', `conflicted fact ${input.fact.factId} cannot support a claim candidate`));
    }
    if (input.fact.qualityStatus === 'STALE' || input.nowUnix > input.fact.validUntilUnix) {
      return err(mappingRejection('VERIFIED_FACT_REQUIRED', `stale fact ${input.fact.factId} cannot support a claim candidate`));
    }
    if (input.fact.qualityStatus === 'PENDING' || input.fact.qualityStatus === 'SUPERSEDED') {
      return err(mappingRejection('VERIFIED_FACT_REQUIRED', `unverified fact ${input.fact.factId} cannot support a claim candidate`));
    }
    return err(quality);
  }

  const objectMatch = evaluateProductiveObjectMatch({
    object: input.object,
    fact: input.fact,
    mapping: input.mapping,
    measurementPeriod: input.measurementPeriod,
    geography: input.geography,
    rightsReferences: input.rightsReferences,
    nowUnix: input.nowUnix,
    height: input.fact.finalizedHeight,
  });
  if (objectMatch) {
    return err(objectMatch);
  }

  if (input.mapping.requiresQuorum && input.quorumCount !== null && input.quorumCount < 1) {
    return err(mappingRejection('QUORUM_REQUIRED', `fact ${input.fact.factId} does not meet required quorum`));
  }

  let attributionState: AttributionState = mapped.value.attributionState;
  if (input.mapping.requiresAttributionPolicy) {
    if (input.attributionPolicyRef && input.attributionPolicyRef.length > 0) {
      attributionState = 'ATTRIBUTION_POLICY_ATTACHED';
    } else if (input.requireApprovedAttributionPolicy) {
      return err(
        mappingRejection(
          'ATTRIBUTION_POLICY_REQUIRED',
          `mapping ${input.mapping.mappingId} requires an approved simulation attribution-policy reference`,
        ),
      );
    } else {
      attributionState = 'ATTRIBUTION_REVIEW_REQUIRED';
    }
  }

  const period = input.measurementPeriod;
  if (!period || !periodIsDefined(period)) {
    return err(mappingRejection('MEASUREMENT_PERIOD_REQUIRED', 'a defined measurement period is required'));
  }

  const geography = input.geography ?? input.object.geography;
  const candidateId = candidateIdOf(input.object.objectId, input.fact.factId, input.mapping.mappingId, input.mapping.mappingVersion);

  return ok(
    Object.freeze({
      schemaVersion: CLAIM_CANDIDATE_SCHEMA_VERSION,
      candidateId,
      objectId: input.object.objectId,
      factId: input.fact.factId,
      mappingId: input.mapping.mappingId,
      mappingVersion: input.mapping.mappingVersion,
      productiveCategory: input.mapping.productiveCategory!,
      proposedClaimType: input.proposedClaimType,
      quantity: input.fact.aggregatedValue.mantissa,
      sourceUnit: input.fact.aggregatedValue.unit,
      measurementPeriod: period,
      geography,
      rightsReferences: Object.freeze([...input.rightsReferences]),
      oracleReferences: Object.freeze({
        feedId: input.fact.feedId,
        factId: input.fact.factId,
        sourceObservationIds: Object.freeze([...input.fact.sourceObservationIds]),
        sourceId: input.sourceId,
      }),
      automaticIssuance: false,
      verified: false,
      issued: false,
      attributionState,
      attributionPolicyRef: input.attributionPolicyRef,
      lineageAssetIds: Object.freeze([]),
    }),
  );
}

function candidateIdOf(objectId: string, factId: string, mappingId: string, mappingVersion: number): string {
  const digest = createHash('sha256')
    .update(`pcc:${objectId}:${factId}:${mappingId}:${mappingVersion}`)
    .digest('hex')
    .slice(0, 32);
  return `pcc.${digest}`;
}
