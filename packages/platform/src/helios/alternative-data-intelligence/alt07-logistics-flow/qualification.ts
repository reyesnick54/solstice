import { ALT07_EXECUTION_MODE, HELIOS_ALT07_LOGISTICS_FLOW_BLOCKED, HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED } from './taxonomy.ts';

export { HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED, HELIOS_ALT07_LOGISTICS_FLOW_BLOCKED };

export type Alt07QualificationChecks = {
  readonly wave5MaritimeLogisticsBridge: boolean;
  readonly cargoClassesDistinguished: boolean;
  readonly inferredNotPresentedAsObserved: boolean;
  readonly aisGatedWhenUnlicensed: boolean;
  readonly firmExposureEvidencePresent: boolean;
  readonly deterministicGraphBaseline: boolean;
  readonly supplyDemandFeaturesEmitted: boolean;
  readonly weatherOverlayPermitted: boolean;
  readonly researchAdapterNoExecution: boolean;
  readonly executionModeDisabled: boolean;
};

export type Alt07QualificationResult = {
  readonly marker: typeof HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED | typeof HELIOS_ALT07_LOGISTICS_FLOW_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt07LogisticsFlowQualification(
  checks: Alt07QualificationChecks,
): Alt07QualificationResult {
  const blockers: string[] = [];
  const entries: [keyof Alt07QualificationChecks, string][] = [
    ['wave5MaritimeLogisticsBridge', 'wave5_bridge'],
    ['cargoClassesDistinguished', 'cargo_classes'],
    ['inferredNotPresentedAsObserved', 'inferred_presentation'],
    ['aisGatedWhenUnlicensed', 'ais_license_gate'],
    ['firmExposureEvidencePresent', 'firm_exposure_evidence'],
    ['deterministicGraphBaseline', 'deterministic_graph'],
    ['supplyDemandFeaturesEmitted', 'supply_demand_features'],
    ['weatherOverlayPermitted', 'weather_overlay'],
    ['researchAdapterNoExecution', 'research_no_execution'],
    ['executionModeDisabled', 'execution_mode'],
  ];
  for (const [key, label] of entries) {
    if (!checks[key]) blockers.push(label);
  }
  if (ALT07_EXECUTION_MODE !== 'DISABLED_RESEARCH_ONLY') {
    blockers.push('execution_mode_constant');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT07_LOGISTICS_FLOW_QUALIFIED : HELIOS_ALT07_LOGISTICS_FLOW_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
