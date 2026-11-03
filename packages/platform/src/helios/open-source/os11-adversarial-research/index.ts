export {
  RESEARCH_DEBATE_SCHEMA,
  HELIOS_OS11_ADVERSARIAL_RESEARCH_QUALIFIED,
  RESEARCH_DEBATE_PARTICIPANT_ROLES,
  RESEARCH_DEBATE_PHASES,
  DEBATE_INFORMATION_VALUE_HINTS,
  MAX_REBUTTAL_ROUNDS,
  type ResearchDebateParticipantRole,
  type ResearchDebatePhase,
  type DebateInformationValueHint,
} from './taxonomy.ts';

export type {
  DebateEvidenceRef,
  FrozenEvidencePack,
  StructuredResearchClaim,
  CounterEvidenceChallenge,
  ResearchDebateParticipant,
  BullCase,
  BearCase,
  RiskCase,
  ResearchSynthesis,
  ResearchDisagreementMetric,
  ResearchConsensus,
  ResearchDebate,
  ResearchDebateInput,
} from './types.ts';

export { freezeEvidencePack, assertEvidencePackUnchanged } from './evidence-pack.ts';
export {
  defaultDebateParticipants,
  buildBullCase,
  buildBearCase,
  buildRiskCase,
} from './participants.ts';
export { runRebuttalRound } from './rebuttal.ts';
export { synthesizeResearchDebate } from './synthesis.ts';
export { computeResearchDisagreementMetric } from './calibration.ts';
export { buildResearchConsensus } from './consensus.ts';
export { runResearchDebate } from './service.ts';
export {
  enrichResearchValueWithDebate,
  permitAdditionalDebateRound,
  debateBoostsInformationValue,
} from './h20-bridge.ts';
