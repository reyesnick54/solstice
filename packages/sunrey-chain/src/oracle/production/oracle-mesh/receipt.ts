// @ts-nocheck
/**
 * ProductiveOracleEvaluation receipt builder.
 *
 * Auditable mesh output for Information Consensus. Does not mint.
 */

import type {
  MeshFreshnessSummary,
  OracleConflictReport,
  OracleMeshExplanationCode,
  OracleMeshResult,
  ProductiveCandidateEvent,
  ProductiveMeshAsset,
  ProductiveOracleEvaluation,
  ProductiveOracleSourceClass,
  ProviderLineage,
  ToleranceAssessment,
} from './types.ts';
import { ORACLE_MESH_MINTS_MOONREY, ORACLE_MESH_SCHEMA } from './types.ts';
import type { EconomicObservation } from '../../../economic-proof/types.ts';

export function buildProductiveOracleEvaluation(input: {
  readonly evaluationId: string;
  readonly productiveAsset: ProductiveMeshAsset;
  readonly candidateEvent: ProductiveCandidateEvent;
  readonly observations: readonly EconomicObservation[];
  readonly providers: readonly string[];
  readonly sourceClasses: readonly ProductiveOracleSourceClass[];
  readonly providerLineage: readonly ProviderLineage[];
  readonly independentSourceCount: number;
  readonly rawSourceCount: number;
  readonly freshness: MeshFreshnessSummary;
  readonly conflicts: OracleConflictReport;
  readonly tolerances: ToleranceAssessment | null;
  readonly result: OracleMeshResult;
  readonly methodologyPolicyVersion: string;
  readonly explanationCodes: readonly OracleMeshExplanationCode[];
  readonly evaluatedAtUtc: string;
}): ProductiveOracleEvaluation {
  return Object.freeze({
    schema: ORACLE_MESH_SCHEMA,
    evaluationId: input.evaluationId,
    productiveAsset: input.productiveAsset,
    candidateEvent: input.candidateEvent,
    observations: Object.freeze([...input.observations]),
    providers: Object.freeze([...input.providers]),
    sourceClasses: Object.freeze([...input.sourceClasses]),
    providerLineage: Object.freeze([...input.providerLineage]),
    independentSourceCount: input.independentSourceCount,
    rawSourceCount: input.rawSourceCount,
    freshness: input.freshness,
    conflicts: input.conflicts,
    tolerances: input.tolerances,
    result: input.result,
    methodologyPolicyVersion: input.methodologyPolicyVersion,
    explanationCodes: Object.freeze([...input.explanationCodes]),
    evaluatedAtUtc: input.evaluatedAtUtc,
    mintsMoonRey: ORACLE_MESH_MINTS_MOONREY,
    grantsExecutionAuthority: false,
  });
}

export function evaluationFeedsInformationConsensus(
  evaluation: ProductiveOracleEvaluation,
): boolean {
  return evaluation.mintsMoonRey === false && evaluation.grantsExecutionAuthority === false;
}
