/**
 * HELIOS CF08 — market response and execution counterfactual twin qualification.
 */

import {
  HELIOS_CF08_MARKET_RESPONSE_TWIN_BLOCKED,
  HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED,
} from './counterfactual-taxonomy.ts';

export type Cf08QualificationChecks = {
  readonly threeFidelityLevelsDefined: boolean;
  readonly passiveReplayNoMarketImpactAssumption: boolean;
  readonly executionTwinUsesNativeSimulator: boolean;
  readonly responsiveSimulatorInterfacePresent: boolean;
  readonly deterministicBaselineImplemented: boolean;
  readonly counterfactualProvenanceComplete: boolean;
  readonly validationDimensionsRecorded: boolean;
  readonly levelThreeMarkedNonFactual: boolean;
  readonly learnedAdaptersNotFactualByPolicy: boolean;
};

export type Cf08QualificationResult = {
  readonly marker:
    | typeof HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED
    | typeof HELIOS_CF08_MARKET_RESPONSE_TWIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_LABELS: Record<keyof Cf08QualificationChecks, string> = {
  threeFidelityLevelsDefined: 'three fidelity levels (L1/L2/L3) defined',
  passiveReplayNoMarketImpactAssumption: 'Level 1 passive replay assumes no market impact',
  executionTwinUsesNativeSimulator: 'Level 2 uses native execution twin (OS03)',
  responsiveSimulatorInterfacePresent: 'ResponsiveMarketSimulator interface present',
  deterministicBaselineImplemented: 'deterministic responsive baseline implemented',
  counterfactualProvenanceComplete: 'counterfactual provenance includes fidelity, version, calibration, uncertainty',
  validationDimensionsRecorded: 'validation scores cover realism, counterfactual validity, sensitivity, stylized facts, impact, reversion',
  levelThreeMarkedNonFactual: 'Level 3 outcomes marked non-factual',
  learnedAdaptersNotFactualByPolicy: 'learned simulator adapters cannot be treated as factual',
};

export function evaluateCf08MarketResponseTwinQualification(checks: Cf08QualificationChecks): Cf08QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Cf08QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(CHECK_LABELS[key]);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_CF08_MARKET_RESPONSE_TWIN_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
