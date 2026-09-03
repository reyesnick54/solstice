// @ts-nocheck
/**
 * ACCESS-22 core metrics computation.
 *
 * Diagnostics only — not forecasts or human desirability scores.
 */

import { herfindahl, ratioBps } from '../seed.ts';
import type {
  Access22CoreMetrics,
  Access22StabilityClassification,
  AccessAllocationRow,
  Access22Scenario,
  ProviderState,
} from './types.ts';

export function computeCoreMetrics(input: {
  readonly scenario: Access22Scenario;
  readonly allocations: readonly AccessAllocationRow[];
  readonly allocatableUnits: bigint;
  readonly totalDemandUnits: bigint;
  readonly redemptionCompletedUnits: bigint;
  readonly redemptionRequestedUnits: bigint;
  readonly refundUnits: bigint;
  readonly settlementFailures: number;
  readonly priorEpochAllocatedUnits: bigint | null;
  readonly providerShares: readonly bigint[];
}): Access22CoreMetrics {
  const allocated = allocationsTotal(input.allocations);
  const accessFillRateBps =
    input.totalDemandUnits > 0n ? ratioBps(allocated < input.totalDemandUnits ? allocated : input.totalDemandUnits, input.totalDemandUnits) : 10_000n;
  const capacityUtilizationBps =
    input.allocatableUnits > 0n ? ratioBps(allocated, input.allocatableUnits) : 0n;
  const unmetDemandUnits =
    input.totalDemandUnits > allocated ? input.totalDemandUnits - allocated : 0n;

  const allocationShares = input.allocations.map((row) => row.allocatedUnits);
  const srShares = input.allocations.map((row) => row.sunreyMinor);
  const mrShares = input.allocations.map((row) => row.moonreyMinor);

  const dualHolders = input.allocations.filter((row) => row.dualHolder).length;
  const dualHolderParticipationBps =
    input.allocations.length > 0 ? ratioBps(BigInt(dualHolders), BigInt(input.allocations.length)) : 0n;

  const redemptionCompletionBps =
    input.redemptionRequestedUnits > 0n
      ? ratioBps(input.redemptionCompletedUnits, input.redemptionRequestedUnits)
      : 10_000n;
  const refundRateBps =
    allocated > 0n ? ratioBps(input.refundUnits, allocated) : 0n;

  const allocationVolatilityBps =
    input.priorEpochAllocatedUnits !== null && input.priorEpochAllocatedUnits > 0n
      ? absDiffBps(allocated, input.priorEpochAllocatedUnits)
      : 0n;

  return Object.freeze({
    accessFillRateBps,
    allocationConcentrationHhi: herfindahl(allocationShares),
    capacityUtilizationBps,
    unmetDemandUnits,
    solvencyRatioByDenominationBps: Object.freeze({
      SUNREY_COIN: scenarioSolvencyBps(input.scenario, 'SUNREY_COIN'),
      MOONREY_COIN: scenarioSolvencyBps(input.scenario, 'MOONREY_COIN'),
      EXTERNAL_PROVIDER: scenarioSolvencyBps(input.scenario, 'EXTERNAL_PROVIDER'),
    }),
    externalProviderLiabilityUnits: input.scenario.capacityState.externalProviderLiabilityUnits,
    nativeCapacityShareBps: input.scenario.capacityState.nativeCapacityShareBps,
    providerConcentrationHhi: herfindahl(input.providerShares),
    oracleConcentrationBps: input.scenario.oracleState.controllerConcentrationBps,
    srHolderConcentrationHhi: herfindahl(srShares),
    mrHolderConcentrationHhi: herfindahl(mrShares),
    dualHolderParticipationBps,
    redemptionCompletionBps,
    refundRateBps,
    settlementFailureCount: input.settlementFailures,
    allocationVolatilityBps,
    epochAccessVolatilityBps: allocationVolatilityBps,
    tokenVelocityBps: input.scenario.tokenPricePath.srPriceChangeBps + input.scenario.tokenPricePath.mrPriceChangeBps,
    exchangeLiquidityUnits: input.scenario.exchangeState.liquidityUnits,
    reserveCoverageBps: input.scenario.reserveState.coverageBps,
    capacityGrowthBps: input.scenario.capacityState.capacityGrowthBps,
    productiveAbundanceIndexBps: input.scenario.capacityState.productiveAbundanceIndexBps,
  });
}

function allocationsTotal(allocations: readonly AccessAllocationRow[]): bigint {
  return allocations.reduce((sum, row) => sum + row.allocatedUnits, 0n);
}

function scenarioSolvencyBps(scenario: Access22Scenario, denomination: string): bigint {
  const liability = scenario.capacityState.externalProviderLiabilityUnits;
  const reserve = scenario.capacityState.fundedReserveUnits;
  if (denomination === 'EXTERNAL_PROVIDER') {
    return liability > 0n ? ratioBps(reserve, liability) : 10_000n;
  }
  return reserve > 0n ? 10_000n : 0n;
}

function absDiffBps(current: bigint, prior: bigint): bigint {
  const diff = current >= prior ? current - prior : prior - current;
  return ratioBps(diff, prior);
}

export function classifyStability(input: {
  readonly metrics: Access22CoreMetrics;
  readonly scenario: Access22Scenario;
  readonly allInvariantsHeld: boolean;
  readonly oversoldUnits: bigint;
}): readonly Access22StabilityClassification[] {
  const out = new Set<Access22StabilityClassification>();
  if (input.allInvariantsHeld && input.oversoldUnits === 0n && input.metrics.unmetDemandUnits === 0n) {
    out.add('HEALTHY_SIMULATION');
  }
  if (input.metrics.capacityUtilizationBps > 9_500n || input.metrics.unmetDemandUnits > 0n) {
    out.add('CAPACITY_STRESS');
  }
  if (input.metrics.allocationConcentrationHhi > 2_500_0000n) {
    out.add('ACCESS_ALLOCATION_STRESS');
  }
  if (input.metrics.providerConcentrationHhi > 3_000_0000n || input.scenario.providerState.topProviderShareBps > 6_000n) {
    out.add('PROVIDER_CONCENTRATION');
  }
  if (
    input.metrics.srHolderConcentrationHhi > 4_000_0000n ||
    input.metrics.mrHolderConcentrationHhi > 4_000_0000n
  ) {
    out.add('TOKEN_CONCENTRATION');
  }
  if (input.scenario.exchangeState.illiquid || input.metrics.exchangeLiquidityUnits < 1_000n) {
    out.add('LIQUIDITY_STRESS');
  }
  const solvencyValues = Object.values(input.metrics.solvencyRatioByDenominationBps);
  if (solvencyValues.some((value) => value < 8_000n) || input.scenario.reserveState.depleted) {
    out.add('SOLVENCY_STRESS');
  }
  if (input.scenario.oracleState.degraded || input.scenario.oracleState.staleEvidence) {
    out.add('ORACLE_DEPENDENCY');
  }
  if (input.scenario.reserveState.depleted || input.metrics.reserveCoverageBps < 5_000n) {
    out.add('RESERVE_STRESS');
  }
  if (input.metrics.unmetDemandUnits > 0n && input.metrics.accessFillRateBps < 7_000n) {
    out.add('DEMAND_IMBALANCE');
  }
  if (input.metrics.productiveAbundanceIndexBps > 20_000n) {
    out.add('PRODUCTIVE_CONCENTRATION');
  }
  if (input.metrics.epochAccessVolatilityBps > 2_500n) {
    out.add('ACCESS_VOLATILITY');
  }
  if (input.scenario.providerState.collapsed) {
    out.add('SYSTEMIC_PROVIDER_FAILURE');
  }
  return Object.freeze([...out].sort());
}

export function providerSharesFromState(providerState: ProviderState, providerCount: number): readonly bigint[] {
  if (providerCount <= 0) {
    return Object.freeze([]);
  }
  const top = providerState.topProviderShareBps;
  const remainingProviders = providerCount - 1;
  const remaining = 10_000n - top;
  const even = remainingProviders > 0 ? remaining / BigInt(remainingProviders) : 0n;
  const shares: bigint[] = [top];
  for (let index = 1; index < providerCount; index += 1) {
    shares.push(even);
  }
  return Object.freeze(shares);
}
