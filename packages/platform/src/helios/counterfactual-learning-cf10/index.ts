/**
 * HELIOS CF10 — counterfactual decision regret and gate attribution (ESTIMATED).
 */

export {
  HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED,
  HELIOS_COUNTERFACTUAL_LEARNING_CF10_SCHEMA,
  HELIOS_CF10_GATE_FAMILIES,
  HELIOS_CF10_POLICY_PROTECTIVE_GATE_FAMILIES,
  HELIOS_CF10_REJECTION_CLASSIFICATIONS,
  isHeliosCf10GateFamily,
  type HeliosCf10GateFamily,
  type HeliosCf10RejectionClassification,
} from './taxonomy.ts';

export type {
  HeliosCf10DecisionAttributionReport,
  HeliosCf10DecisionGateAttribution,
  HeliosCf10EstimatedDecisionRegret,
  HeliosCf10GateCalibrationState,
  HeliosCf10GateDecisionObservation,
  HeliosCf10MultivariateOutcomeVector,
  HeliosCf10OpportunityCostEstimate,
  HeliosCf10PerObservationAttribution,
  HeliosCf10RejectionReasonPerformance,
} from './types.ts';

export { buildHeliosCf10DecisionAttributionReport } from './engine.ts';

export const HELIOS_COUNTERFACTUAL_LEARNING_CF10 = 'HELIOS_COUNTERFACTUAL_LEARNING_CF10' as const;
