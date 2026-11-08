/**
 * ALPHA06 — execution realism qualification gate.
 */

import {
  HELIOS_ALPHA06_EXECUTION_REALISM_BLOCKED,
  HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED,
} from './taxonomy.ts';
import type { Alpha06ForwardExecutionResult } from './types.ts';
import { alpha06SimulationPostureOk } from './engine.ts';

export { HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED, HELIOS_ALPHA06_EXECUTION_REALISM_BLOCKED };

export type Alpha06QualificationChecks = {
  readonly dualLanesPresent: boolean;
  readonly signalLaneTheoreticalOnly: boolean;
  readonly implementableIncludesFriction: boolean;
  readonly noMidPriceFills: boolean;
  readonly partialOrUnfilledModeled: boolean;
  readonly routingAttached: boolean;
  readonly algorithmScheduleAttached: boolean;
  readonly tcaAttachedWhenFilled: boolean;
  readonly decayComputed: boolean;
  readonly decayBlocksVanishedAlpha: boolean;
  readonly md15PostureOk: boolean;
  readonly simulationPosture: boolean;
};

export type Alpha06QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED
    | typeof HELIOS_ALPHA06_EXECUTION_REALISM_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const LABELS: Record<keyof Alpha06QualificationChecks, string> = {
  dualLanesPresent: 'SIGNAL_ONLY and IMPLEMENTABLE lanes',
  signalLaneTheoreticalOnly: 'signal lane excludes execution friction',
  implementableIncludesFriction: 'implementable lane includes spread/fees/slippage',
  noMidPriceFills: 'fills do not use mid with spread',
  partialOrUnfilledModeled: 'partial fill or unfilled quantity',
  routingAttached: 'EXEC05 routing decision attached',
  algorithmScheduleAttached: 'EXEC06 schedule slices attached',
  tcaAttachedWhenFilled: 'EXEC07 TCA when fills exist',
  decayComputed: 'SignalToImplementationDecay computed',
  decayBlocksVanishedAlpha: 'vanished alpha blocks promotion',
  md15PostureOk: 'MD15 market-data posture',
  simulationPosture: 'simulation posture preserved',
};

export function buildAlpha06QualificationChecks(input: {
  readonly surviving: Alpha06ForwardExecutionResult;
  readonly decayed: Alpha06ForwardExecutionResult;
  readonly md15PostureOk: boolean;
}): Alpha06QualificationChecks {
  const impl = input.surviving.implementable;
  const friction =
    impl.explicitFeesMinor > 0n ||
    impl.spreadPaidMinor > 0n ||
    impl.slippageMinor !== 0n ||
    impl.marketImpactMinor > 0n;
  return Object.freeze({
    dualLanesPresent:
      input.surviving.lanes.length === 2 &&
      input.surviving.lanes.some((row) => row.lane === 'SIGNAL_ONLY_RETURN') &&
      input.surviving.lanes.some((row) => row.lane === 'IMPLEMENTABLE_RETURN'),
    signalLaneTheoreticalOnly:
      input.surviving.lanes.find((row) => row.lane === 'SIGNAL_ONLY_RETURN')!.netPnlMinor >
      input.surviving.lanes.find((row) => row.lane === 'IMPLEMENTABLE_RETURN')!.netPnlMinor,
    implementableIncludesFriction: friction,
    noMidPriceFills: !impl.usedMidPriceForFill,
    partialOrUnfilledModeled:
      impl.unfilledEntryUnits > 0n ||
      impl.unfilledExitUnits > 0n ||
      input.decayed.implementable.unfilledEntryUnits > 0n,
    routingAttached: impl.routing.selectedVenueId != null,
    algorithmScheduleAttached: impl.algorithmChildSlices >= 1,
    tcaAttachedWhenFilled: impl.entryFills.length > 0 ? impl.transactionCost != null : true,
    decayComputed: input.surviving.signalToImplementationDecayBps != null,
    decayBlocksVanishedAlpha: input.decayed.promote === false && input.decayed.promotionOutcome === 'REJECT_DECAY',
    md15PostureOk: input.md15PostureOk,
    simulationPosture: alpha06SimulationPostureOk(),
  });
}

export function evaluateAlpha06ExecutionRealismQualification(
  checks: Alpha06QualificationChecks,
): Alpha06QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof Alpha06QualificationChecks, boolean][]) {
    if (!passed) {
      blockers.push(LABELS[key]);
    }
  }
  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }
  return Object.freeze({
    marker: HELIOS_ALPHA06_EXECUTION_REALISM_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
