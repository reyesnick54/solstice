/**
 * Canonical Information Consensus — re-exported from sunrey-chain EAF.
 *
 * This is the single semantic authority for information consensus evaluation.
 */
export {
  createInformationConsensusEngine,
  defaultInformationConsensusEngine,
  evaluateInformationConsensus,
  informationConsensusCreatesMoney,
  toOracleVerifiedEconomicFactCandidate,
  buildConsensusInput,
  buildInformationConsensusReceipt,
  evaluateCorroboration,
  analyzeSourceIndependence,
  effectiveIndependentCount,
  assessNumericConflicts,
  assessFreshness,
  resolveMethodologyPolicy,
  PRODUCTIVE_ENERGY_METHODOLOGY,
  HUMAN_CONTRIBUTION_METHODOLOGY,
  THREE_INDEPENDENT_SOURCES,
  THREE_PROVIDERS_ONE_UPSTREAM,
  PRODUCTIVE_ENERGY_CANDIDATE,
  HUMAN_CONTRIBUTION_CANDIDATE,
  INFORMATION_CONSENSUS_CREATES_MONEY,
  INFORMATION_CONSENSUS_GRANTS_EXECUTION_AUTHORITY,
} from '@solstice/sunrey-chain/economic-awareness-fabric';

export type {
  InformationConsensusInput,
  InformationConsensusEvaluation,
  InformationConsensusEvaluator,
  InformationConsensusResult,
  InformationConsensusReceipt,
  CorroborationResult,
  ExplanationCode,
  MethodologyReference,
  InformationVerifiedEconomicFact,
} from '@solstice/sunrey-chain/economic-awareness-fabric';
