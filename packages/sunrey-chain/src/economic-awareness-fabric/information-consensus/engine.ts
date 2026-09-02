/**
 * Information Consensus evaluation engine.
 *
 * Deterministic, policy-driven, auditable. Never creates money.
 */

import type { InformationConsensusInput, InformationConsensusEvaluation, ExplanationCode } from './types.ts';
import type { InformationConsensusEvaluator } from './types.ts';
import { analyzeSourceIndependence } from './independence.ts';
import { evaluateCorroboration } from './corroboration.ts';
import { resolveMethodologyPolicy } from './methodology.ts';
import { assessNumericConflicts, highReputationContradictedByDirectMeasurement } from './conflicts.ts';
import { assessFreshness, anyStaleSupportingCurrentFact } from './freshness.ts';
import { summarizeReputation, type ReputationRecord } from './reputation.ts';
import { buildInformationConsensusReceipt } from './receipt.ts';
import { createInformationVerifiedEconomicFact } from './verified-fact.ts';
import { assessHumanEvidence } from './human-safety.ts';
import { assessProductiveSourceClasses } from './productive-safety.ts';
import { validateAiAssistanceBoundary } from './ai-boundary.ts';

export type InformationConsensusEngineOptions = {
  readonly reputationRecords?: Readonly<Record<string, ReputationRecord>>;
  readonly reputationThreshold?: number;
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function assessRights(input: InformationConsensusInput) {
  const restrictedObservationIds = input.observations
    .filter((row) => row.rightsStatus !== 'CLEAR')
    .map((row) => row.observationId)
    .sort();
  return Object.freeze({
    status: input.rightsStatus,
    restrictedObservationIds: Object.freeze(restrictedObservationIds),
  });
}

function selectVerifiedValue(observations: readonly import('../types.ts').NormalizedEconomicObservation[]): {
  readonly numeric: number | null;
  readonly categorical: string | null;
} {
  const numericValues = observations
    .map((row) => row.numericValue)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const categorical = observations.find((row) => row.categoricalValue)?.categoricalValue ?? null;
  return Object.freeze({
    numeric: median(numericValues),
    categorical,
  });
}

export function createInformationConsensusEngine(
  options: InformationConsensusEngineOptions = {},
): InformationConsensusEvaluator {
  const reputationThreshold = options.reputationThreshold ?? 0.3;

  return Object.freeze({
    evaluate(input: InformationConsensusInput): InformationConsensusEvaluation {
      const codes: ExplanationCode[] = ['ZERO_MONETARY_AUTHORITY'];
      codes.push(...validateAiAssistanceBoundary(input));

      if (input.integrityStatus !== 'VERIFIED') {
        codes.push('INTEGRITY_FAILED');
        const policy = resolveMethodologyPolicy(input.methodology);
        const independence = analyzeSourceIndependence(input.observations);
        const receipt = buildInformationConsensusReceipt({
          consensusInput: input,
          independence,
          corroboration: Object.freeze({
            satisfied: false,
            requiredRules: Object.freeze([]),
            matchedRules: Object.freeze([]),
            independentSourceClassCount: independence.independentSourceClassCount,
            rawProviderCount: independence.rawProviderCount,
          }),
          conflicts: Object.freeze({
            hasMaterialConflict: false,
            hasOutlier: false,
            withinTolerance: true,
            conflicts: Object.freeze([]),
          }),
          freshness: assessFreshness(input.observations, policy.freshnessPolicy, input.evaluatedAt),
          rights: assessRights(input),
          reputation: summarizeReputation(input.observations, options.reputationRecords ?? {}),
          result: 'INVALID',
          explanationCodes: Object.freeze(codes),
        });
        return Object.freeze({ receipt, verifiedFact: null });
      }
      codes.push('INTEGRITY_VERIFIED');

      const policy = resolveMethodologyPolicy(input.methodology);
      const independence = analyzeSourceIndependence(input.observations);
      const corroboration = evaluateCorroboration(policy, input.observations, independence);
      const conflicts = assessNumericConflicts(input.observations, policy.conflictTolerance);
      const freshness = assessFreshness(input.observations, policy.freshnessPolicy, input.evaluatedAt);
      const rights = assessRights(input);
      const reputation = summarizeReputation(input.observations, options.reputationRecords ?? {});

      if (independence.independentLineageRootCount < 1) {
        codes.push('SOURCE_DEPENDENCY_UNAVAILABLE');
      } else if (corroboration.satisfied) {
        codes.push('CORROBORATION_RULE_SATISFIED', 'INDEPENDENT_SOURCE_QUORUM_MET');
      } else {
        codes.push('CORROBORATION_RULE_UNSATISFIED', 'INDEPENDENT_SOURCE_QUORUM_NOT_MET');
      }

      if (independence.sharedUpstreamGroups.some((group) => group.providerIds.length > 1)) {
        codes.push('SHARED_UPSTREAM_LINEAGE');
      }

      if (conflicts.withinTolerance) {
        codes.push('WITHIN_TOLERANCE');
      }
      if (conflicts.hasMaterialConflict) {
        codes.push('MATERIAL_CONFLICT_DETECTED');
      }
      if (conflicts.hasOutlier) {
        codes.push('OUTLIER_EXCLUDED');
      }

      if (anyStaleSupportingCurrentFact(freshness)) {
        codes.push('FRESHNESS_STALE');
      } else {
        codes.push('FRESHNESS_OK');
      }

      if (rights.status === 'CLEAR') {
        codes.push('RIGHTS_CLEAR');
      } else {
        codes.push('RIGHTS_RESTRICTED');
      }

      if (input.entityResolution) {
        codes.push('ENTITY_RESOLUTION_BOUND');
      } else if (policy.requireEntityResolution) {
        codes.push('ENTITY_RESOLUTION_MISSING');
      }

      const unverified = input.observations.filter((row) => !row.providerVerified);
      if (unverified.length > 0) {
        codes.push('PROVIDER_UNVERIFIED');
      }

      if (reputation.scores.every((row) => row.score >= reputationThreshold)) {
        codes.push('REPUTATION_SUPPORTING');
      } else {
        codes.push('REPUTATION_INSUFFICIENT');
      }

      if (input.candidate.domain === 'HUMAN') {
        const human = assessHumanEvidence(input.observations);
        codes.push(...human.codes);
      } else if (input.candidate.domain === 'PRODUCTIVE') {
        const productive = assessProductiveSourceClasses(input.observations);
        codes.push(...productive.codes);
      }

      let result: import('./types.ts').InformationConsensusResult = 'INSUFFICIENT_EVIDENCE';

      if (rights.status === 'RESTRICTED' || rights.status === 'PROHIBITED') {
        result = 'RIGHTS_RESTRICTED';
      } else if (anyStaleSupportingCurrentFact(freshness)) {
        result = 'STALE';
      } else if (independence.independentLineageRootCount < 1) {
        result = 'SOURCE_DEPENDENCY_FAILURE';
      } else if (!policy.allowUnverifiedProviders && unverified.length > 0) {
        result = 'INVALID';
      } else if (conflicts.hasMaterialConflict) {
        result = policy.manualReviewOnConflict ? 'MANUAL_REVIEW_REQUIRED' : 'DISPUTED';
      } else if (!corroboration.satisfied) {
        result = 'INSUFFICIENT_EVIDENCE';
      } else if (policy.requireEntityResolution && !input.entityResolution) {
        result = 'INSUFFICIENT_EVIDENCE';
      } else if (input.candidate.domain === 'HUMAN' && !assessHumanEvidence(input.observations).satisfied) {
        result = 'INSUFFICIENT_EVIDENCE';
      } else if (input.candidate.domain === 'PRODUCTIVE' && !assessProductiveSourceClasses(input.observations).satisfied) {
        result = 'INSUFFICIENT_EVIDENCE';
      } else {
        const directIds = input.observations
          .filter((row) => row.sourceClass === 'DIRECT_SENSOR')
          .map((row) => row.observationId);
        const highRepConflict = reputation.scores.some((row) =>
          highReputationContradictedByDirectMeasurement(row.score, conflicts, directIds),
        );
        if (highRepConflict) {
          result = 'MANUAL_REVIEW_REQUIRED';
          codes.push('MANUAL_REVIEW_TRIGGERED');
        } else {
          result = 'VERIFIED';
        }
      }

      const receipt = buildInformationConsensusReceipt({
        consensusInput: input,
        independence,
        corroboration,
        conflicts,
        freshness,
        rights,
        reputation,
        result,
        explanationCodes: Object.freeze([...new Set(codes)]),
      });

      let verifiedFact = null;
      if (result === 'VERIFIED') {
        const selected = selectVerifiedValue(input.observations);
        const lineageRoots = [...new Set(input.observations.map((row) => row.lineage.lineageRootId))].sort();
        const validUntil = new Date(
          Date.parse(input.evaluatedAt) + policy.freshnessPolicy.maxAgeMs,
        ).toISOString();
        verifiedFact = createInformationVerifiedEconomicFact({
          candidate: input.candidate,
          observations: input.observations,
          independentLineageRootIds: lineageRoots,
          methodology: input.methodology,
          receiptId: receipt.evaluationId,
          verifiedAt: input.evaluatedAt,
          validUntil,
          selectedNumericValue: selected.numeric,
          selectedCategoricalValue: selected.categorical,
        });
      }

      return Object.freeze({ receipt, verifiedFact });
    },
  });
}

export const defaultInformationConsensusEngine = createInformationConsensusEngine();

export function evaluateInformationConsensus(
  input: InformationConsensusInput,
  options?: InformationConsensusEngineOptions,
): InformationConsensusEvaluation {
  return createInformationConsensusEngine(options).evaluate(input);
}
