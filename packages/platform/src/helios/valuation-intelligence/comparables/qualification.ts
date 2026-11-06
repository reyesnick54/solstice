import {
  COMPARABLE_MULTIPLE_KINDS,
  HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED,
  HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED,
  PEER_SELECTION_METHODS,
} from './taxonomy.ts';

export { HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED, HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED };

export type Val08ProbabilisticComparablesQualificationChecks = {
  readonly pointInTimePeerGraph: boolean;
  readonly multiAlgorithmPeerSelection: boolean;
  readonly noSilentPeerDeletion: boolean;
  readonly distributionalOutputs: boolean;
  readonly justifiedMultipleNormalization: boolean;
  readonly outlierEvidencePreserved: boolean;
  readonly crossBorderAwareness: boolean;
  readonly peerDisagreementMetrics: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Val08ProbabilisticComparablesQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED
    | typeof HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly peerSelectionMethods: readonly (typeof PEER_SELECTION_METHODS)[number][];
  readonly multipleKindsSupported: readonly (typeof COMPARABLE_MULTIPLE_KINDS)[number][];
};

export function evaluateVal08ProbabilisticComparablesQualification(
  checks: Val08ProbabilisticComparablesQualificationChecks,
): Val08ProbabilisticComparablesQualificationResult {
  const entries: [keyof Val08ProbabilisticComparablesQualificationChecks, string][] = [
    ['pointInTimePeerGraph', 'point_in_time_peer_graph'],
    ['multiAlgorithmPeerSelection', 'multi_algorithm_peer_selection'],
    ['noSilentPeerDeletion', 'no_silent_peer_deletion'],
    ['distributionalOutputs', 'distributional_outputs'],
    ['justifiedMultipleNormalization', 'justified_multiple_normalization'],
    ['outlierEvidencePreserved', 'outlier_evidence_preserved'],
    ['crossBorderAwareness', 'cross_border_awareness'],
    ['peerDisagreementMetrics', 'peer_disagreement_metrics'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED
      : HELIOS_VAL08_PROBABILISTIC_COMPARABLES_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    peerSelectionMethods: PEER_SELECTION_METHODS,
    multipleKindsSupported: COMPARABLE_MULTIPLE_KINDS,
  });
}
