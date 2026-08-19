/**
 * Simulation-only MoonReyEconomicShadowEvaluator.
 *
 * Evaluates V1 and V2 on the same underlying verified economic event
 * without double-issuing. V2 shadow evaluation never mutates canonical
 * MoonRey supply.
 */

import { emptyMoonReySupply, type NativeAssetSupplyState } from '../../supply.ts';
import {
  CANONICAL_SUPPLY_MUTATED,
  GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
  LEGACY_ENGINEERING_SIMULATION_V1,
  PRODUCTION_VALUE_PATH,
  V2_PRODUCTION_ACTIVE,
} from './identities.ts';
import type { MoonReyShadowScenario, MoonReyValuePathComparison, ShadowReasonCode } from './types.ts';
import { evaluateLegacyV1 } from './v1.ts';
import { evaluateGovernedV2 } from './v2.ts';

export class MoonReyEconomicShadowEvaluator {
  private readonly seenEvents = new Set<string>();
  private supplySnapshot: NativeAssetSupplyState;

  constructor(supply: NativeAssetSupplyState = emptyMoonReySupply()) {
    this.supplySnapshot = supply;
  }

  evaluate(scenario: MoonReyShadowScenario): MoonReyValuePathComparison {
    const before = this.supplySnapshot;
    const v1 = evaluateLegacyV1(scenario);
    const duplicate = this.seenEvents.has(scenario.eventId);
    const v2Input = duplicate
      ? {
          ...scenario,
          poison: { ...scenario.poison, duplicateOfEventId: scenario.eventId },
        }
      : scenario;
    const v2 = evaluateGovernedV2(v2Input);
    if (v2.valued) {
      this.seenEvents.add(scenario.eventId);
    }
    if (this.supplySnapshot !== before || this.supplySnapshot.issued !== before.issued) {
      throw new Error('shadow evaluation mutated canonical MoonRey supply');
    }
    if (V2_PRODUCTION_ACTIVE) {
      throw new Error('V2 production must remain inactive');
    }

    const bothValued = v1.valued && v2.valued && v1.quantity !== null && v2.quantity !== null;
    const absoluteDelta = bothValued ? v2.quantity! - v1.quantity! : null;
    const relativeDeltaBps =
      bothValued && v1.quantity! !== 0n ? ((v2.quantity! - v1.quantity!) * 10_000n) / v1.quantity! : null;

    const reasonCodes = unique([
      ...v1.reasonCodes,
      ...v2.reasonCodes,
      'SHADOW_SUPPLY_UNCHANGED',
    ] as const satisfies readonly ShadowReasonCode[]);

    return Object.freeze({
      scenarioId: scenario.scenarioId,
      eventId: scenario.eventId,
      contributionId: scenario.contributionId,
      category: scenario.category,
      claimType: scenario.claimType,
      canonicalMeasurement: Object.freeze({
        quantity: scenario.canonicalQuantity,
        unit: scenario.canonicalUnit,
        normalizationVersion: scenario.normalizationVersion,
      }),
      v1Path: LEGACY_ENGINEERING_SIMULATION_V1,
      v1PolicyVersion: v1.policyVersion,
      v1Quantity: v1.quantity,
      v1Valued: v1.valued,
      v2Path: GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
      v2ValuePolicyId: v2.valuePolicyId,
      v2ValuePolicyVersion: v2.valuePolicyVersion,
      v2GpuvValue: v2.gpuvValue,
      v2ConversionPolicyId: v2.conversionPolicyId,
      v2ConversionPolicyVersion: v2.conversionPolicyVersion,
      v2MoonReyCandidateQuantity: v2.quantity,
      v2Valued: v2.valued,
      absoluteDelta,
      relativeDeltaBps,
      attributionShare: scenario.attributionShare,
      capAppliedV1: v1.capApplied,
      capAppliedV2: v2.capApplied,
      reasonCodes: Object.freeze(reasonCodes),
      warnings: Object.freeze([...v2.warnings]),
      supplyMutated: CANONICAL_SUPPLY_MUTATED,
      productionPath: PRODUCTION_VALUE_PATH,
      v2ProductionActive: V2_PRODUCTION_ACTIVE,
    });
  }

  evaluateMany(scenarios: readonly MoonReyShadowScenario[]): readonly MoonReyValuePathComparison[] {
    return Object.freeze(scenarios.map((scenario) => this.evaluate(scenario)));
  }

  canonicalSupply(): NativeAssetSupplyState {
    return this.supplySnapshot;
  }
}

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
