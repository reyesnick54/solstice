/**
 * HELIOS FORWARD ALPHA08 — multiple-strategy and data-snooping firewall (extends EVOL09).
 */

export {
  HELIOS_ALPHA08_SCHEMA,
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED,
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
  ALPHA08_MINIMUM_FORWARD_PERIODS,
  ALPHA08_MIN_CANDIDATES_FOR_BOOTSTRAP,
  ALPHA08_BLOCK_BOOTSTRAP_DEFAULT_BLOCK,
  ALPHA08_SERIAL_DEPENDENCE_AUTOCORR_THRESHOLD,
  EVOL09_SCHEMA_BRIDGE,
} from './taxonomy.ts';

export type {
  ForwardTrialCandidateId,
  ForwardTrialFamilyId,
  ForwardCandidateKind,
  ForwardMonitoringOutcome,
  ForwardTrialFamily,
  ForwardTrialCandidate,
  ForwardMultipleTestingState,
  BenchmarkCandidateComparison,
  RealityCheckResult,
  SpaResult,
  StrategySelectionPenalty,
  ForwardDataSnoopingFirewallEvidence,
} from './types.ts';

export { forwardTrialFamilyIdFromParts, forwardTrialCandidateIdFromFingerprint } from './ids.ts';

export {
  createForwardTrialRegistry,
  assertForwardTrialUniverseRetainsAll,
  type ForwardTrialRegistry,
  type ForwardTrialRegistrySnapshot,
  type RecordForwardTrialCandidateInput,
} from './trial-registry.ts';

export {
  buildForwardMultipleTestingState,
  runWhiteRealityCheck,
  runHansenSpaTest,
  computeStrategySelectionPenalty,
} from './stats.ts';

export { buildForwardDataSnoopingFirewallEvidence } from './evidence.ts';

export {
  evaluateAlpha08DataSnoopingFirewallQualification,
  type Alpha08QualificationResult,
} from './qualification.ts';
