/**
 * Productive Oracle Mesh evaluation engine.
 *
 * INDEPENDENT PRODUCTIVE SOURCES → OBSERVATIONS → SOURCE-INDEPENDENCE
 * ANALYSIS → CORROBORATION → PRODUCTIVE FACT → CLAIM → PRODUCTIVE VALUE
 *
 * Does not mint MoonRey.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import { adaptProductiveSourceRecord } from './adapter.ts';
import {
  assessTolerance,
  classifyDisagreement,
  detectOutlierProviders,
  disagreementBlocksVerification,
  disagreementRequiresManualReview,
} from './conflict.ts';
import { assessSourceFailures, failureResult, systemContinuesDespiteOutage } from './failure.ts';
import { analyzeProductiveIndependence, providerLineageFromRecord } from './independence.ts';
import {
  hasRequiredDirectEvidence,
  policyForDomain,
  sourceClassSatisfiesPolicy,
} from './policies.ts';
import { createReplayLedger } from './replay.ts';
import { buildProductiveOracleEvaluation } from './receipt.ts';
import { marketReferenceCannotSubstituteForProduction } from './source-classes.ts';
import type {
  OracleMeshExplanationCode,
  OracleMeshResult,
  ProductiveCandidateEvent,
  ProductiveMeshAsset,
  ProductiveOracleEvaluation,
  ProductiveSourceRecord,
  ProductiveVerificationPolicy,
} from './types.ts';
import { ORACLE_MESH_MINTS_MOONREY } from './types.ts';

export type MeshEvaluationInput = {
  readonly asset: ProductiveMeshAsset;
  readonly candidateEvent: ProductiveCandidateEvent;
  readonly sourceRecords: readonly ProductiveSourceRecord[];
  readonly policy?: ProductiveVerificationPolicy;
  readonly evaluatedAtUtc: string;
};

export type MeshEvaluationOutput = {
  readonly evaluation: ProductiveOracleEvaluation;
  readonly mintsMoonRey: false;
  readonly verified: boolean;
};

export function evaluateProductiveOracleMesh(input: MeshEvaluationInput): MeshEvaluationOutput {
  const policy = input.policy ?? policyForDomain(input.asset.domain);
  const ledger = createReplayLedger();
  const explanationCodes: OracleMeshExplanationCode[] = ['ORACLE_CANNOT_MINT'];
  const admitted: { readonly record: ProductiveSourceRecord; readonly observation: ReturnType<typeof adaptProductiveSourceRecord> & { ok: true } }[] = [];
  let staleExcluded = 0;

  for (const record of input.sourceRecords) {
    const replay = ledger.admit({
      providerId: record.providerId,
      sourceRecordId: record.sourceRecordId,
      datasetOriginId: record.datasetOriginId,
    });
    if (replay === 'duplicate') {
      explanationCodes.push('REPLAY_DEDUPLICATED');
      continue;
    }

    if (!sourceClassSatisfiesPolicy(record.sourceClass, policy)) {
      continue;
    }

    if (record.freshnessState === 'STALE' || record.freshnessState === 'EXPIRED') {
      staleExcluded += 1;
      explanationCodes.push('STALE_SOURCE_EXCLUDED');
      continue;
    }

    if (!record.rights.commercialUsePermitted) {
      continue;
    }

    const adapted = adaptProductiveSourceRecord(record);
    if (!adapted.ok) {
      if (adapted.code === 'INVALID_RIGHTS') {
        explanationCodes.push('RIGHTS_INVALID');
      }
      if (adapted.code === 'PROVIDER_UNAVAILABLE') {
        explanationCodes.push('PROVIDER_OPERATIONALLY_UNAVAILABLE');
      }
      continue;
    }

    admitted.push({ record, observation: adapted });
  }

  const lineages = admitted.map((row) =>
    providerLineageFromRecord({
      providerId: row.record.providerId,
      controllerId: row.record.controllerId,
      upstreamOrganizationId: row.record.upstreamOrganizationId,
      datasetOriginId: row.record.datasetOriginId,
      copiedFromProviderId: row.record.copiedFromProviderId,
      derivedFromDatasetId: row.record.derivedFromDatasetId,
      sourceClass: row.record.sourceClass,
    }),
  );

  const independence = analyzeProductiveIndependence(lineages);
  if (independence.collapsedCopies > 0) {
    explanationCodes.push('COPIED_SOURCES_COLLAPSED');
  }

  const sourceClasses = [...new Set(admitted.map((row) => row.record.sourceClass))];
  const failureAssessment = assessSourceFailures({
    providers: input.sourceRecords.map((row) => ({
      providerId: row.providerId,
      available: row.providerAvailable,
    })),
    independentSourceCount: independence.independentSourceCount,
    minimumIndependentSources: policy.minimumIndependentSources,
  });
  explanationCodes.push(...failureAssessment.explanationCodes);

  const numericValues = admitted.map((row) =>
    Object.freeze({ providerId: row.record.providerId, value: row.record.value }),
  );
  const outlierProviderIds = detectOutlierProviders({
    values: numericValues,
    toleranceBps: policy.toleranceRangeBps,
  });
  if (outlierProviderIds.length > 0) {
    explanationCodes.push('OUTLIER_DETECTED');
  }

  const tolerances =
    numericValues.length > 0
      ? assessTolerance(
          numericValues.map((row) => row.value),
          policy.toleranceRangeBps,
        )
      : null;

  const conflicts = classifyDisagreement({
    values: numericValues.map((row) => row.value),
    toleranceBps: policy.toleranceRangeBps,
    outlierProviderIds,
    admittedCount: independence.independentSourceCount,
    minimumRequired: policy.minimumIndependentSources,
  });

  const result = resolveResult({
    policy,
    independence,
    sourceClasses,
    conflicts,
    admittedCount: admitted.length,
    failureAssessment,
    hasMarketReferenceOnly:
      sourceClasses.length > 0 && sourceClasses.every((row) => marketReferenceCannotSubstituteForProduction(row)),
    hasDirectEvidence: hasRequiredDirectEvidence(sourceClasses, policy),
    wrongSourceClassRejected: input.sourceRecords.some(
      (row) => !sourceClassSatisfiesPolicy(row.sourceClass, policy),
    ),
    invalidRights: input.sourceRecords.some((row) => !row.rights.commercialUsePermitted),
    tolerances,
    explanationCodes,
  });

  if (independence.independentSourceCount >= policy.minimumIndependentSources) {
    explanationCodes.push('INDEPENDENT_SOURCES_SATISFIED');
  } else {
    explanationCodes.push('INDEPENDENT_SOURCES_INSUFFICIENT');
  }

  if (policy.prohibitSingleSource && independence.independentSourceCount < 2) {
    explanationCodes.push('SINGLE_SOURCE_PROHIBITED');
  }

  if (tolerances?.withinTolerance) {
    explanationCodes.push('MINOR_VARIANCE_WITHIN_TOLERANCE');
  }
  if (conflicts.disagreementLevel === 'MATERIAL_CONFLICT') {
    explanationCodes.push('MATERIAL_CONFLICT_DETECTED');
  }
  if (disagreementRequiresManualReview(conflicts.disagreementLevel, policy.manualReviewTriggers)) {
    explanationCodes.push('MANUAL_REVIEW_TRIGGERED');
  }

  const evaluation = buildProductiveOracleEvaluation({
    evaluationId: sha256Hex(
      `oracle-mesh.eval.v1:${input.asset.assetId}:${input.candidateEvent.eventId}:${input.evaluatedAtUtc}`,
    ),
    productiveAsset: input.asset,
    candidateEvent: input.candidateEvent,
    observations: admitted.map((row) => row.observation.observation),
    providers: [...new Set(admitted.map((row) => row.record.providerId))].sort(),
    sourceClasses,
    providerLineage: lineages,
    independentSourceCount: independence.independentSourceCount,
    rawSourceCount: input.sourceRecords.length,
    freshness: Object.freeze({
      worstState: worstFreshness(admitted.map((row) => row.record.freshnessState)),
      staleExcludedCount: staleExcluded,
      admittedCount: admitted.length,
    }),
    conflicts,
    tolerances,
    result,
    methodologyPolicyVersion: `${policy.policyId}@${policy.version}`,
    explanationCodes: Object.freeze([...new Set(explanationCodes)].sort() as OracleMeshExplanationCode[]),
    evaluatedAtUtc: input.evaluatedAtUtc,
  });

  const verified =
    result === 'CORROBORATED' ||
    result === 'PRODUCTIVE_FACT_SUPPORTED' ||
    (result === 'SINGLE_SOURCE_ONLY' && !policy.prohibitSingleSource);

  return Object.freeze({
    evaluation,
    mintsMoonRey: ORACLE_MESH_MINTS_MOONREY,
    verified,
  });
}

function resolveResult(input: {
  readonly policy: ProductiveVerificationPolicy;
  readonly independence: ReturnType<typeof analyzeProductiveIndependence>;
  readonly sourceClasses: readonly ProductiveSourceRecord['sourceClass'][];
  readonly conflicts: ReturnType<typeof classifyDisagreement>;
  readonly admittedCount: number;
  readonly failureAssessment: ReturnType<typeof assessSourceFailures>;
  readonly hasMarketReferenceOnly: boolean;
  readonly hasDirectEvidence: boolean;
  readonly wrongSourceClassRejected: boolean;
  readonly invalidRights: boolean;
  readonly tolerances: ReturnType<typeof assessTolerance> | null;
  readonly explanationCodes: OracleMeshExplanationCode[];
}): OracleMeshResult {
  if (input.invalidRights && input.admittedCount === 0) {
    input.explanationCodes.push('RIGHTS_INVALID');
    return 'INVALID_RIGHTS';
  }

  const failure = failureResult(input.failureAssessment, input.admittedCount > 0);
  if (failure === 'PROVIDER_OUTAGE' && input.admittedCount === 0) {
    return 'PROVIDER_OUTAGE';
  }

  if (input.wrongSourceClassRejected && input.admittedCount === 0) {
    input.explanationCodes.push('SOURCE_CLASS_NOT_PERMITTED');
    return 'SOURCE_CLASS_REJECTED';
  }

  if (input.hasMarketReferenceOnly || (!input.hasDirectEvidence && input.policy.requiredDirectEvidence)) {
    input.explanationCodes.push('MARKET_REFERENCE_NOT_PRODUCTION_EVIDENCE');
    if (!input.hasDirectEvidence) {
      input.explanationCodes.push('DIRECT_EVIDENCE_REQUIRED');
    }
    return 'MARKET_REFERENCE_CANNOT_SUBSTITUTE';
  }

  if (input.independence.independentSourceCount < input.policy.minimumIndependentSources) {
    return 'INSUFFICIENT_INDEPENDENT_SOURCES';
  }

  if (disagreementBlocksVerification(input.conflicts.disagreementLevel)) {
    if (input.conflicts.disagreementLevel === 'OUTLIER') {
      return 'MATERIAL_CONFLICT';
    }
    if (input.conflicts.disagreementLevel === 'MATERIAL_CONFLICT') {
      return 'MATERIAL_CONFLICT';
    }
    return 'POLICY_NOT_SATISFIED';
  }

  if (disagreementRequiresManualReview(input.conflicts.disagreementLevel, input.policy.manualReviewTriggers)) {
    return 'REQUIRES_MANUAL_REVIEW';
  }

  if (input.policy.prohibitSingleSource && input.independence.independentSourceCount < 2) {
    return 'INSUFFICIENT_INDEPENDENT_SOURCES';
  }

  if (input.independence.independentSourceCount >= 2 && input.tolerances?.withinTolerance !== false) {
    return 'CORROBORATED';
  }

  if (input.independence.independentSourceCount === 1) {
    return 'SINGLE_SOURCE_ONLY';
  }

  return 'PRODUCTIVE_FACT_SUPPORTED';
}

function worstFreshness(states: readonly ProductiveSourceRecord['freshnessState'][]): ProductiveSourceRecord['freshnessState'] {
  const order = ['EXPIRED', 'STALE', 'AGING', 'FRESH'] as const;
  for (const state of order) {
    if (states.includes(state)) {
      return state;
    }
  }
  return 'FRESH';
}

export function oracleMeshOutputCannotMint(output: MeshEvaluationOutput): boolean {
  return output.mintsMoonRey === false && output.evaluation.mintsMoonRey === false;
}

export { systemContinuesDespiteOutage };
