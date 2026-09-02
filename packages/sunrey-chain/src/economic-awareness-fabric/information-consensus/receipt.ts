/**
 * Auditable Information Consensus receipt generation.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type { InformationConsensusInput } from './types.ts';
import type {
  ConflictAssessment,
  CorroborationResult,
  ExplanationCode,
  FreshnessAssessment,
  InformationConsensusReceipt,
  InformationConsensusResult,
  ReputationSummary,
  RightsAssessment,
} from './types.ts';
import type { IndependenceAnalysis } from './independence.ts';
import { INFORMATION_CONSENSUS_SCHEMA_VERSION } from './types.ts';

export function evaluationIdOf(input: InformationConsensusInput): string {
  const observationIds = [...input.observations.map((row) => row.observationId)].sort().join(',');
  return sha256Hex(
    `ic.eval.v1:${input.candidate.propositionId}:${observationIds}:${input.methodology.methodologyId}:${input.methodology.version}:${input.evaluatedAt}`,
  );
}

export function buildInformationConsensusReceipt(input: {
  readonly consensusInput: InformationConsensusInput;
  readonly independence: IndependenceAnalysis;
  readonly corroboration: CorroborationResult;
  readonly conflicts: ConflictAssessment;
  readonly freshness: FreshnessAssessment;
  readonly rights: RightsAssessment;
  readonly reputation: ReputationSummary;
  readonly result: InformationConsensusResult;
  readonly explanationCodes: readonly ExplanationCode[];
}): InformationConsensusReceipt {
  const evaluationId = evaluationIdOf(input.consensusInput);
  return Object.freeze({
    schemaVersion: INFORMATION_CONSENSUS_SCHEMA_VERSION,
    evaluationId,
    candidate: input.consensusInput.candidate,
    observationIdsEvaluated: Object.freeze(
      [...input.consensusInput.observations.map((row) => row.observationId)].sort(),
    ),
    independentSourceClasses: Object.freeze(input.independence.independentSourceClasses),
    providerLineage: Object.freeze([...input.consensusInput.providerLineage]),
    corroboration: input.corroboration,
    conflicts: input.conflicts,
    freshness: input.freshness,
    rights: input.rights,
    reputation: input.reputation,
    methodology: input.consensusInput.methodology,
    result: input.result,
    explanationCodes: Object.freeze([...input.explanationCodes]),
    evaluatedAt: input.consensusInput.evaluatedAt,
    referenceTimestamp: input.consensusInput.evaluatedAt,
    grantsMonetaryAuthority: false,
    grantsExecutionAuthority: false,
  });
}
