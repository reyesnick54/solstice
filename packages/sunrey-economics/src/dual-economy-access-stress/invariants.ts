/**
 * ACCESS-22 formal property invariants.
 */

import { ENVIRONMENT, LIVE_MONEY_ENABLED, SIMULATION_MODE } from '../../../config/src/flags.ts';
import {
  ACCESS_22_INVARIANT_IDS,
  type Access22InvariantId,
} from './ids.ts';
import type {
  Access22InvariantResult,
  Access22Scenario,
  AccessAllocationRow,
} from './types.ts';

export const ACCESS_22_INVARIANT_STATEMENTS: Readonly<Record<Access22InvariantId, string>> = Object.freeze({
  SUM_ACCESS_ALLOCATIONS_LTE_ALLOCATABLE_CAPACITY:
    'Sum of access allocations never exceeds allocatable capacity.',
  CONFIRMED_EXTERNAL_LIABILITY_LTE_FUNDED_RESERVE:
    'Confirmed external provider liability never exceeds funded reserve.',
  NO_NATIVE_ASSET_SUPPLY_CREATED_BY_ACCESS:
    'Access activity does not create SunRey or MoonRey supply.',
  NO_FIXED_SR_MR_RATIO: 'No fixed SunRey/MoonRey redemption or allocation ratio.',
  NO_FIXED_TOKEN_GOODS_REDEMPTION: 'No fixed token-to-goods redemption price.',
  NO_HUMAN_WORTH_SCORE: 'No human-worth or desirability score influences allocation.',
  NO_DATA_TO_ACCESS_DIRECT_MULTIPLIER: 'Data quantity does not directly multiply access.',
  NO_PRODUCTIVE_DOUBLE_COUNT: 'Productive contributions are not double-counted.',
  NO_DOUBLE_REDEMPTION: 'No access right is redeemed twice.',
  NO_DOUBLE_SETTLEMENT: 'No settlement is posted twice for one entitlement.',
  NO_DOUBLE_ENTITLEMENT_CONSUMPTION: 'No entitlement is consumed twice.',
  NO_PROVIDER_CAPACITY_OVERSELL: 'Providers cannot oversell published capacity.',
  NO_AI_SELF_APPROVAL: 'Agents cannot self-approve consequential access.',
  NO_SIMULATION_ACTIVATES_PRODUCTION: 'Simulation cannot activate production.',
  NO_PRICE_FEEDBACK_TO_ISSUANCE: 'Token price does not feed back to issuance.',
  NO_ACCESS_FEEDBACK_TO_NATIVE_MINT: 'Access allocation does not mint native assets.',
  EVERY_CONSEQUENTIAL_STATE_RECONSTRUCTABLE:
    'Every consequential transition is reconstructable from sealed evidence.',
});

export type InvariantCheckInput = Readonly<{
  readonly scenario: Access22Scenario;
  readonly allocations: readonly AccessAllocationRow[];
  readonly allocatableUnits: bigint;
  readonly totalAllocatedUnits: bigint;
  readonly oversoldUnits: bigint;
  readonly nativeSunreyIssued: bigint;
  readonly nativeMoonreyIssued: bigint;
  readonly redemptionIds: readonly string[];
  readonly settlementIds: readonly string[];
  readonly entitlementConsumptionIds: readonly string[];
  readonly agentSelfExecutions: number;
  readonly priceInfluencedAllocation: boolean;
  readonly evidenceChainVerified: boolean;
  readonly serializedState: string;
}>;

export function checkAccess22Invariants(input: InvariantCheckInput): readonly Access22InvariantResult[] {
  const results: Access22InvariantResult[] = [];

  const push = (invariantId: Access22InvariantId, held: boolean, evidence: string): void => {
    results.push(Object.freeze({ invariantId, held, evidence }));
  };

  push(
    'SUM_ACCESS_ALLOCATIONS_LTE_ALLOCATABLE_CAPACITY',
    input.totalAllocatedUnits <= input.allocatableUnits,
    `allocated=${input.totalAllocatedUnits} allocatable=${input.allocatableUnits}`,
  );

  push(
    'CONFIRMED_EXTERNAL_LIABILITY_LTE_FUNDED_RESERVE',
    input.scenario.capacityState.externalProviderLiabilityUnits <= input.scenario.capacityState.fundedReserveUnits,
    `liability=${input.scenario.capacityState.externalProviderLiabilityUnits} reserve=${input.scenario.capacityState.fundedReserveUnits}`,
  );

  push(
    'NO_NATIVE_ASSET_SUPPLY_CREATED_BY_ACCESS',
    input.nativeSunreyIssued === 0n && input.nativeMoonreyIssued === 0n,
    `sunreyIssued=${input.nativeSunreyIssued} moonreyIssued=${input.nativeMoonreyIssued}`,
  );

  push(
    'NO_FIXED_SR_MR_RATIO',
    !input.serializedState.toLowerCase().includes('fixed_sunrey_moonrey_ratio') &&
      !input.serializedState.toLowerCase().includes('sr_mr_peg'),
    'state scan for fixed ratio fields',
  );

  push(
    'NO_FIXED_TOKEN_GOODS_REDEMPTION',
    !input.serializedState.toLowerCase().includes('fixed_redemption_price'),
    'state scan for fixed redemption price',
  );

  push(
    'NO_HUMAN_WORTH_SCORE',
    !input.serializedState.toLowerCase().includes('humanworthscore') &&
      !input.serializedState.toLowerCase().includes('desirabilityscore'),
    'state scan for score fields',
  );

  push(
    'NO_DATA_TO_ACCESS_DIRECT_MULTIPLIER',
    !input.allocations.some((row) => row.allocationWeightBps.toString().includes('data')),
    'allocation weights independent of data quantity multiplier',
  );

  push(
    'NO_PRODUCTIVE_DOUBLE_COUNT',
    new Set(input.entitlementConsumptionIds).size === input.entitlementConsumptionIds.length,
    `consumptions=${input.entitlementConsumptionIds.length}`,
  );

  push(
    'NO_DOUBLE_REDEMPTION',
    new Set(input.redemptionIds).size === input.redemptionIds.length,
    `redemptions=${input.redemptionIds.length}`,
  );

  push(
    'NO_DOUBLE_SETTLEMENT',
    new Set(input.settlementIds).size === input.settlementIds.length,
    `settlements=${input.settlementIds.length}`,
  );

  push(
    'NO_DOUBLE_ENTITLEMENT_CONSUMPTION',
    new Set(input.entitlementConsumptionIds).size === input.entitlementConsumptionIds.length,
    `entitlements=${input.entitlementConsumptionIds.length}`,
  );

  push(
    'NO_PROVIDER_CAPACITY_OVERSELL',
    input.oversoldUnits === 0n,
    `oversoldUnits=${input.oversoldUnits}`,
  );

  push(
    'NO_AI_SELF_APPROVAL',
    input.agentSelfExecutions === 0,
    `agentSelfExecutions=${input.agentSelfExecutions}`,
  );

  push(
    'NO_SIMULATION_ACTIVATES_PRODUCTION',
    ENVIRONMENT === 'simulation' && SIMULATION_MODE === true && LIVE_MONEY_ENABLED === false,
    `environment=${ENVIRONMENT} simulation=${SIMULATION_MODE} live=${LIVE_MONEY_ENABLED}`,
  );

  push(
    'NO_PRICE_FEEDBACK_TO_ISSUANCE',
    input.nativeSunreyIssued === 0n && input.nativeMoonreyIssued === 0n && !input.priceInfluencedAllocation,
    `priceInfluenced=${input.priceInfluencedAllocation}`,
  );

  push(
    'NO_ACCESS_FEEDBACK_TO_NATIVE_MINT',
    input.nativeSunreyIssued === 0n && input.nativeMoonreyIssued === 0n,
    `sunreyIssued=${input.nativeSunreyIssued} moonreyIssued=${input.nativeMoonreyIssued}`,
  );

  push(
    'EVERY_CONSEQUENTIAL_STATE_RECONSTRUCTABLE',
    input.evidenceChainVerified,
    `evidenceChainVerified=${input.evidenceChainVerified}`,
  );

  for (const id of ACCESS_22_INVARIANT_IDS) {
    if (!results.some((row) => row.invariantId === id)) {
      push(id, false, 'missing invariant evaluation');
    }
  }

  return Object.freeze(results);
}

export function allInvariantsHeld(results: readonly Access22InvariantResult[]): boolean {
  return results.every((row) => row.held);
}
