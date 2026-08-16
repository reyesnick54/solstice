import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { TravelRuleDecision } from './types.ts';

/**
 * Simulation policy packs only. Thresholds are engineering test values
 * labeled RESEARCH_REQUIRED. They are not a legal Travel Rule threshold
 * and are not presented as counsel-confirmed truth.
 */
export type TravelRulePack = {
  readonly packId: string;
  readonly packVersion: string;
  readonly jurisdiction: Jurisdiction;
  readonly appliesToVaspCounterparties: boolean;
  readonly simulationThresholdScaled: bigint;
  readonly legalStatus: 'RESEARCH_REQUIRED';
};

export const GB_SIMULATION_TRAVEL_RULE_PACK: TravelRulePack = Object.freeze({
  packId: 'pack-gb-travel-rule-simulation',
  packVersion: '1',
  jurisdiction: 'GB' as Jurisdiction,
  appliesToVaspCounterparties: true,
  simulationThresholdScaled: 1n,
  legalStatus: 'RESEARCH_REQUIRED',
});

export function evaluateTravelRuleApplicability(input: {
  readonly pack: TravelRulePack;
  readonly originatorJurisdiction: Jurisdiction;
  readonly quantity: AssetQuantity;
  readonly counterpartyIsVasp: boolean;
}): TravelRuleDecision {
  if (input.originatorJurisdiction !== input.pack.jurisdiction) {
    return Object.freeze({
      applicability: 'RESEARCH_REQUIRED',
      packId: input.pack.packId,
      packVersion: input.pack.packVersion,
      thresholdSource: 'SIMULATION_POLICY_PACK',
      legalStatus: 'RESEARCH_REQUIRED',
      notALegalConclusion: true,
    });
  }
  if (!input.pack.appliesToVaspCounterparties || !input.counterpartyIsVasp) {
    return Object.freeze({
      applicability: 'NOT_APPLICABLE',
      packId: input.pack.packId,
      packVersion: input.pack.packVersion,
      thresholdSource: 'SIMULATION_POLICY_PACK',
      legalStatus: 'RESEARCH_REQUIRED',
      notALegalConclusion: true,
    });
  }
  if (input.quantity.scaledUnits >= input.pack.simulationThresholdScaled) {
    return Object.freeze({
      applicability: 'REQUIRED_BY_PACK',
      packId: input.pack.packId,
      packVersion: input.pack.packVersion,
      thresholdSource: 'SIMULATION_POLICY_PACK',
      legalStatus: 'RESEARCH_REQUIRED',
      notALegalConclusion: true,
    });
  }
  return Object.freeze({
    applicability: 'NOT_APPLICABLE',
    packId: input.pack.packId,
    packVersion: input.pack.packVersion,
    thresholdSource: 'SIMULATION_POLICY_PACK',
    legalStatus: 'RESEARCH_REQUIRED',
    notALegalConclusion: true,
  });
}
