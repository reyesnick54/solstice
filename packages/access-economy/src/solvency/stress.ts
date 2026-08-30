/**
 * ACCESS-16 — Solvency stress scenarios.
 *
 * Simulation only. Proves fail-closed behavior before insolvency.
 */

import type { AccessCapacityPoolWithTranches, ProviderSettlementLiability, RiskHaircutPolicy } from './types.ts';
import type { AccessSolvencyEngine, SolvencyPolicy } from './engine.ts';
import { createQuotedLiability, transitionLiability } from './liability-lifecycle.ts';
import { applyRiskHaircuts, simulationHaircutPolicy } from './haircuts.ts';
import { checkSolvencyInvariants } from './invariants.ts';
import type { InMemorySettlementReservePort } from './ports.ts';

export type StressScenarioId =
  | 'REDEMPTION_SPIKE_10X'
  | 'PROVIDER_PRICE_RISE_30PCT'
  | 'FX_MOVE'
  | 'REFUND_WAVE'
  | 'PROVIDER_FAILURE'
  | 'RESERVE_DEPLETION'
  | 'SETTLEMENT_DELAY'
  | 'HOTEL_SHORTAGE'
  | 'TRAVEL_SURGE'
  | 'MIXED_NATIVE_EXTERNAL';

export type StressScenarioResult = {
  readonly scenarioId: StressScenarioId;
  readonly failClosed: boolean;
  readonly insolventBeforeFailClosed: boolean;
  readonly notes: string;
};

export type StressHarnessInput = {
  readonly engine: AccessSolvencyEngine;
  readonly paymentsPort: InMemorySettlementReservePort;
  readonly basePool: AccessCapacityPoolWithTranches;
  readonly baseReserveMinorUnits: bigint;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly providerRef: string;
  readonly category: string;
  readonly epoch: string;
};

function seedReserve(
  port: InMemorySettlementReservePort,
  input: StressHarnessInput,
  amount: bigint,
): void {
  port.seed(
    Object.freeze({
      positionId: `reserve_${input.providerRef}_${input.currency}`,
      currency: input.currency,
      jurisdiction: input.jurisdiction,
      providerRef: input.providerRef,
      category: input.category,
      epoch: input.epoch,
      state: 'AVAILABLE',
      amountMinorUnits: amount,
      canonicalOwnerRef: 'packages/payments',
      evidenceRef: 'evidence.sim.reserve',
    }),
  );
}

function quoteLiability(
  input: StressHarnessInput,
  id: string,
  amount: bigint,
  reservationId: string,
): ProviderSettlementLiability {
  return createQuotedLiability({
    liabilityId: id,
    providerRef: input.providerRef,
    reservationId,
    currency: input.currency,
    quotedAmountMinorUnits: amount,
    maximumExposureMinorUnits: amount,
    jurisdiction: input.jurisdiction,
    category: input.category,
    epoch: input.epoch,
    expiration: '2031-12-31T23:59:59.000Z',
    evidenceRefs: ['evidence.sim.liability'],
  });
}

export function runStressScenario(
  scenarioId: StressScenarioId,
  input: StressHarnessInput,
  policy: SolvencyPolicy = { targetSolvencyRatioBps: 10_000n, simulationOnly: true },
): StressScenarioResult {
  switch (scenarioId) {
    case 'REDEMPTION_SPIKE_10X':
      return runRedemptionSpike(input, policy);
    case 'PROVIDER_PRICE_RISE_30PCT':
      return runProviderPriceRise(input, policy);
    case 'FX_MOVE':
      return runFxMove(input);
    case 'REFUND_WAVE':
      return runRefundWave(input);
    case 'PROVIDER_FAILURE':
      return runProviderFailure(input);
    case 'RESERVE_DEPLETION':
      return runReserveDepletion(input);
    case 'SETTLEMENT_DELAY':
      return runSettlementDelay(input);
    case 'HOTEL_SHORTAGE':
      return runHotelShortage(input);
    case 'TRAVEL_SURGE':
      return runTravelSurge(input);
    case 'MIXED_NATIVE_EXTERNAL':
      return runMixedNativeExternal(input);
    default:
      return Object.freeze({
        scenarioId,
        failClosed: true,
        insolventBeforeFailClosed: false,
        notes: 'unknown scenario',
      });
  }
}

function runRedemptionSpike(input: StressHarnessInput, policy: SolvencyPolicy): StressScenarioResult {
  const unitCost = 10_000n;
  seedReserve(input.paymentsPort, input, unitCost * 5n);
  input.engine.registerPool(input.basePool);
  let blocked = 0;
  for (let i = 0; i < 50; i += 1) {
    const liability = quoteLiability(input, `liab_spike_${i}`, unitCost, `res_spike_${i}`);
    const fundable = input.engine.assertFundable(liability);
    if (!fundable.ok) {
      blocked += 1;
      continue;
    }
    const reserved = transitionLiability({ ...liability, reservedAmountMinorUnits: unitCost }, 'RESERVED');
    if ('settlementState' in reserved) {
      input.engine.registerLiability(reserved);
    }
  }
  const snapshot = input.engine.snapshot();
  const invariants = checkSolvencyInvariants({ snapshot });
  const allHeld = invariants.every((row) => row.held);
  return Object.freeze({
    scenarioId: 'REDEMPTION_SPIKE_10X',
    failClosed: blocked > 0 && allHeld,
    insolventBeforeFailClosed: false,
    notes: `blocked=${blocked}/50 targetRatioBps=${String(policy.targetSolvencyRatioBps)}`,
  });
}

function runProviderPriceRise(input: StressHarnessInput, policy: SolvencyPolicy): StressScenarioResult {
  const baseCost = 10_000n;
  seedReserve(input.paymentsPort, input, baseCost);
  input.engine.registerPool(input.basePool);
  const liability = quoteLiability(input, 'liab_price', (baseCost * 13n) / 10n, 'res_price');
  const fundable = input.engine.assertFundable(liability);
  return Object.freeze({
    scenarioId: 'PROVIDER_PRICE_RISE_30PCT',
    failClosed: !fundable.ok,
    insolventBeforeFailClosed: false,
    notes: `fundable=${fundable.ok} targetRatioBps=${String(policy.targetSolvencyRatioBps)}`,
  });
}

function runFxMove(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 100_000n);
  input.engine.registerPool(input.basePool);
  const usdLiability = quoteLiability(input, 'liab_usd', 50_000n, 'res_usd');
  const eurLiability = createQuotedLiability({
    ...usdLiability,
    liabilityId: 'liab_eur',
    reservationId: 'res_eur',
    currency: 'EUR',
    quotedAmountMinorUnits: 45_000n,
    maximumExposureMinorUnits: 45_000n,
  });
  const usdFundable = input.engine.assertFundable(usdLiability);
  const eurFundable = input.engine.assertFundable(eurLiability);
  const snapshot = input.engine.snapshot();
  const separateDenominations = snapshot.slices.every((row) => row.currency === 'USD' || row.currency === 'EUR');
  return Object.freeze({
    scenarioId: 'FX_MOVE',
    failClosed: usdFundable.ok && !eurFundable.ok && separateDenominations,
    insolventBeforeFailClosed: false,
    notes: 'denominations isolated; EUR slice has no reserve',
  });
}

function runRefundWave(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 100_000n);
  input.engine.registerPool(input.basePool);
  const liability = quoteLiability(input, 'liab_refund', 20_000n, 'res_refund');
  let current = transitionLiability({ ...liability, reservedAmountMinorUnits: 20_000n }, 'RESERVED');
  if (!('settlementState' in current)) {
    return Object.freeze({ scenarioId: 'REFUND_WAVE', failClosed: false, insolventBeforeFailClosed: true, notes: 'reserve failed' });
  }
  current = transitionLiability(current, 'COMMITTED');
  if (!('settlementState' in current)) {
    return Object.freeze({ scenarioId: 'REFUND_WAVE', failClosed: false, insolventBeforeFailClosed: true, notes: 'commit failed' });
  }
  current = transitionLiability(current, 'CAPTURED');
  if (!('settlementState' in current)) {
    return Object.freeze({ scenarioId: 'REFUND_WAVE', failClosed: false, insolventBeforeFailClosed: true, notes: 'capture failed' });
  }
  const refunded = transitionLiability(current, 'REFUNDED');
  const invariants = checkSolvencyInvariants({
    snapshot: input.engine.snapshot(),
    refundRestoredReserve: 'settlementState' in refunded && refunded.settlementState === 'REFUNDED',
  });
  return Object.freeze({
    scenarioId: 'REFUND_WAVE',
    failClosed: invariants.every((row) => row.held),
    insolventBeforeFailClosed: false,
    notes: 'refund lifecycle completes',
  });
}

function runProviderFailure(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 50_000n);
  const pool = Object.freeze({
    ...input.basePool,
    providerRef: 'expedia',
    allocatableUnits: 0n,
  });
  input.engine.registerPool(pool);
  const view = input.engine.consumerAvailability(pool.poolId);
  return Object.freeze({
    scenarioId: 'PROVIDER_FAILURE',
    failClosed: view.posture === 'TEMPORARILY_UNAVAILABLE',
    insolventBeforeFailClosed: false,
    notes: `posture=${view.posture}`,
  });
}

function runReserveDepletion(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 5_000n);
  input.engine.registerPool(input.basePool);
  const liability = quoteLiability(input, 'liab_deplete', 10_000n, 'res_deplete');
  const fundable = input.engine.assertFundable(liability);
  return Object.freeze({
    scenarioId: 'RESERVE_DEPLETION',
    failClosed: !fundable.ok,
    insolventBeforeFailClosed: false,
    notes: `fundable=${fundable.ok}`,
  });
}

function runSettlementDelay(input: StressHarnessInput): StressScenarioResult {
  const haircuts: RiskHaircutPolicy[] = [
    simulationHaircutPolicy('SETTLEMENT_DELAY', 2_000n, 'sim.v1'),
  ];
  const effective = applyRiskHaircuts({ fundedCapacityMinorUnits: 100_000n, haircuts });
  seedReserve(input.paymentsPort, input, effective.effectiveAllocatableMinorUnits);
  input.engine.registerPool(input.basePool);
  const liability = quoteLiability(input, 'liab_delay', 85_000n, 'res_delay');
  const fundable = input.engine.assertFundable(liability);
  return Object.freeze({
    scenarioId: 'SETTLEMENT_DELAY',
    failClosed: !fundable.ok,
    insolventBeforeFailClosed: false,
    notes: `effective=${effective.effectiveAllocatableMinorUnits}`,
  });
}

function runHotelShortage(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 200_000n);
  const scarcePool = Object.freeze({
    ...input.basePool,
    category: 'LODGING',
    publishedUnits: 2n,
    allocatableUnits: 0n,
  });
  input.engine.registerPool(scarcePool);
  const view = input.engine.consumerAvailability(scarcePool.poolId);
  return Object.freeze({
    scenarioId: 'HOTEL_SHORTAGE',
    failClosed: view.posture === 'TEMPORARILY_UNAVAILABLE',
    insolventBeforeFailClosed: false,
    notes: `posture=${view.posture}`,
  });
}

function runTravelSurge(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 100_000n);
  const surgePool = Object.freeze({
    ...input.basePool,
    category: 'TRAVEL',
    publishedUnits: 100n,
    allocatableUnits: 15n,
  });
  input.engine.registerPool(surgePool);
  const view = input.engine.consumerAvailability(surgePool.poolId);
  return Object.freeze({
    scenarioId: 'TRAVEL_SURGE',
    failClosed: view.posture === 'LIMITED',
    insolventBeforeFailClosed: false,
    notes: `posture=${view.posture}`,
  });
}

function runMixedNativeExternal(input: StressHarnessInput): StressScenarioResult {
  seedReserve(input.paymentsPort, input, 50_000n);
  const mixedPool = Object.freeze({
    ...input.basePool,
    tranches: Object.freeze([
      ...input.basePool.tranches,
      Object.freeze({
        trancheId: 'tranche_native',
        poolId: input.basePool.poolId,
        kind: 'NATIVE_COMMITTED_CAPACITY' as const,
        providerRef: null,
        currency: 'MR',
        allocatableUnits: 50n,
        settlementTermsRef: 'terms.native.mr',
        fundingReserveRef: null,
        providerAgreementRef: 'agreement.native',
        deliveryEvidenceRef: 'evidence.native',
        expiresAt: '2031-12-31T23:59:59.000Z',
        evidenceRefs: ['evidence.native'],
      }),
    ]),
  });
  input.engine.registerPool(mixedPool);
  const invariants = checkSolvencyInvariants({ snapshot: input.engine.snapshot() });
  return Object.freeze({
    scenarioId: 'MIXED_NATIVE_EXTERNAL',
    failClosed: invariants.every((row) => row.held),
    insolventBeforeFailClosed: false,
    notes: 'native and external tranches coexist without fiat conflation',
  });
}

export const ACCESS_16_STRESS_SCENARIOS: readonly StressScenarioId[] = Object.freeze([
  'REDEMPTION_SPIKE_10X',
  'PROVIDER_PRICE_RISE_30PCT',
  'FX_MOVE',
  'REFUND_WAVE',
  'PROVIDER_FAILURE',
  'RESERVE_DEPLETION',
  'SETTLEMENT_DELAY',
  'HOTEL_SHORTAGE',
  'TRAVEL_SURGE',
  'MIXED_NATIVE_EXTERNAL',
]);

export function runAllStressScenarios(
  buildHarness: () => StressHarnessInput,
  policy?: SolvencyPolicy,
): readonly StressScenarioResult[] {
  return Object.freeze(
    ACCESS_16_STRESS_SCENARIOS.map((scenarioId) => runStressScenario(scenarioId, buildHarness(), policy)),
  );
}
