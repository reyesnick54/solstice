// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_16_STRESS_SCENARIOS,
  ACCESS_SOLVENCY_INVARIANT_IDS,
  ACCESS_SOLVENCY_INVARIANT_STATEMENTS,
  AccessSolvencyEngine,
  applyRiskHaircuts,
  canFundExternalLiability,
  canTransitionLiability,
  computeSolvencySlices,
  createQuotedLiability,
  createSimulationSolvencyPorts,
  evaluatePoolAdmission,
  projectConsumerAvailability,
  runAllStressScenarios,
  simulationHaircutPolicy,
  transitionLiability,
  type AccessCapacityPoolWithTranches,
  type AccessCapacityTranche,
} from './index.ts';
import { checkSolvencyInvariants } from './invariants.ts';

const SIM_NOW = '2031-06-01T12:00:00.000Z';
const EXPIRES = '2031-12-31T23:59:59.000Z';

function externalTranche(overrides?: Partial<AccessCapacityTranche>): AccessCapacityTranche {
  return Object.freeze({
    trancheId: 'tranche_ext_1',
    poolId: 'pool.hotel.rome.2026-08',
    kind: 'EXTERNAL_FUNDED_CAPACITY',
    providerRef: 'expedia',
    currency: 'USD',
    allocatableUnits: 10n,
    settlementTermsRef: 'terms.expedia.usd',
    fundingReserveRef: 'reserve.expedia.usd',
    providerAgreementRef: 'agreement.expedia',
    deliveryEvidenceRef: 'evidence.expedia',
    expiresAt: EXPIRES,
    evidenceRefs: ['evidence.expedia.current'],
    ...overrides,
  });
}

function basePool(tranches: readonly AccessCapacityTranche[]): AccessCapacityPoolWithTranches {
  const published = tranches.reduce((sum, row) => sum + row.allocatableUnits, 0n);
  return Object.freeze({
    poolId: 'pool.hotel.rome.2026-08',
    category: 'LODGING',
    jurisdiction: 'SIM',
    providerRef: 'expedia',
    tranches,
    publishedUnits: published,
    allocatableUnits: published,
  });
}

function seedPaymentsReserve(
  ports: ReturnType<typeof createSimulationSolvencyPorts>,
  amount: bigint,
): void {
  ports.payments.seed(
    Object.freeze({
      positionId: 'reserve_expedia_usd',
      currency: 'USD',
      jurisdiction: 'SIM',
      providerRef: 'expedia',
      category: 'LODGING',
      epoch: 'epoch.sim.1',
      state: 'AVAILABLE',
      amountMinorUnits: amount,
      canonicalOwnerRef: 'packages/payments',
      evidenceRef: 'evidence.reserve.payments',
    }),
  );
}

describe('ACCESS-16 capacity tranche taxonomy', () => {
  it('declares all six capacity tranche kinds', () => {
    assert.equal(ACCESS_SOLVENCY_INVARIANT_IDS.length, 10);
    const tranche = externalTranche();
    assert.equal(tranche.kind, 'EXTERNAL_FUNDED_CAPACITY');
    assert.equal(tranche.settlementTermsRef !== null, true);
  });
});

describe('ACCESS-16 pool admission', () => {
  it('admits a fully backed external tranche', () => {
    const result = evaluatePoolAdmission({
      tranche: externalTranche(),
      poolId: 'pool.hotel.rome.2026-08',
      providerCapabilityPermitsBooking: true,
      jurisdictionPermitted: true,
      reserveAvailable: true,
      settlementTermsPresent: true,
      evidenceCurrent: true,
      now: SIM_NOW,
    });
    assert.equal(result.admitted, true);
  });

  it('refuses external tranche without settlement reserve', () => {
    const result = evaluatePoolAdmission({
      tranche: externalTranche(),
      poolId: 'pool.hotel.rome.2026-08',
      providerCapabilityPermitsBooking: true,
      jurisdictionPermitted: true,
      reserveAvailable: false,
      settlementTermsPresent: true,
      evidenceCurrent: true,
      now: SIM_NOW,
    });
    assert.equal(result.admitted, false);
    assert.equal(result.refusalCode, 'FUNDING_RESERVE_MISSING');
  });

  it('refuses expired tranche', () => {
    const result = evaluatePoolAdmission({
      tranche: externalTranche({ expiresAt: '2020-01-01T00:00:00.000Z' }),
      poolId: 'pool.hotel.rome.2026-08',
      providerCapabilityPermitsBooking: true,
      jurisdictionPermitted: true,
      reserveAvailable: true,
      settlementTermsPresent: true,
      evidenceCurrent: true,
      now: SIM_NOW,
    });
    assert.equal(result.admitted, false);
    assert.equal(result.refusalCode, 'EXPIRED_TRANCHE');
  });
});

describe('ACCESS-16 solvency equations', () => {
  it('computes SolvencyRatio_d per denomination without blending currencies', () => {
    const ports = createSimulationSolvencyPorts();
    seedPaymentsReserve(ports, 100_000n);
    const liability = createQuotedLiability({
      liabilityId: 'liab_1',
      providerRef: 'expedia',
      reservationId: 'res_1',
      currency: 'USD',
      quotedAmountMinorUnits: 30_000n,
      maximumExposureMinorUnits: 30_000n,
      jurisdiction: 'SIM',
      category: 'LODGING',
      epoch: 'epoch.sim.1',
      expiration: EXPIRES,
      evidenceRefs: ['evidence.liability.1'],
    });
    const reserved = transitionLiability({ ...liability, reservedAmountMinorUnits: 30_000n }, 'RESERVED');
    assert.ok('settlementState' in reserved);
    const committed = transitionLiability(reserved, 'COMMITTED');
    assert.ok('settlementState' in committed);
    const slices = computeSolvencySlices({
      ports,
      liabilities: [committed],
      pools: [basePool([externalTranche()])],
      policy: { targetSolvencyRatioBps: 10_000n, simulationOnly: true },
    });
    const usdSlice = slices.find((row) => row.currency === 'USD');
    assert.ok(usdSlice);
    assert.equal(usdSlice.solvent, true);
    assert.equal(usdSlice.availableSettlementReserveMinorUnits, 100_000n);
    assert.equal(usdSlice.solvencyRatioBps, 33_333n);
  });

  it('refuses funding when liability would exceed reserve', () => {
    const ports = createSimulationSolvencyPorts();
    seedPaymentsReserve(ports, 20_000n);
    const liability = createQuotedLiability({
      liabilityId: 'liab_over',
      providerRef: 'expedia',
      reservationId: 'res_over',
      currency: 'USD',
      quotedAmountMinorUnits: 25_000n,
      maximumExposureMinorUnits: 25_000n,
      jurisdiction: 'SIM',
      category: 'LODGING',
      epoch: 'epoch.sim.1',
      expiration: EXPIRES,
      evidenceRefs: ['evidence.liability.over'],
    });
    const result = canFundExternalLiability(
      { ports, liabilities: [], pools: [basePool([externalTranche()])], policy: { targetSolvencyRatioBps: 10_000n, simulationOnly: true } },
      liability,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'INSUFFICIENT_RESERVE');
    }
  });
});

describe('ACCESS-16 ProviderSettlementLiability lifecycle', () => {
  it('follows QUOTED → RESERVED → COMMITTED → CAPTURED → REFUNDED', () => {
    const quoted = createQuotedLiability({
      liabilityId: 'liab_lc',
      providerRef: 'expedia',
      reservationId: 'res_lc',
      currency: 'USD',
      quotedAmountMinorUnits: 5_000n,
      maximumExposureMinorUnits: 5_000n,
      jurisdiction: 'SIM',
      category: 'LODGING',
      epoch: 'epoch.sim.1',
      expiration: EXPIRES,
      evidenceRefs: ['evidence.lc'],
    });
    assert.equal(canTransitionLiability('QUOTED', 'RESERVED'), true);
    const reserved = transitionLiability({ ...quoted, reservedAmountMinorUnits: 5_000n }, 'RESERVED');
    assert.ok('settlementState' in reserved);
    assert.equal(reserved.settlementState, 'RESERVED');
    const committed = transitionLiability(reserved, 'COMMITTED');
    assert.ok('settlementState' in committed);
    const captured = transitionLiability(committed, 'CAPTURED');
    assert.ok('settlementState' in captured);
    const refunded = transitionLiability(captured, 'REFUNDED');
    assert.ok('settlementState' in refunded);
    assert.equal(refunded.settlementState, 'REFUNDED');
  });

  it('releases reserve on failed booking', () => {
    const quoted = createQuotedLiability({
      liabilityId: 'liab_fail',
      providerRef: 'expedia',
      reservationId: 'res_fail',
      currency: 'USD',
      quotedAmountMinorUnits: 5_000n,
      maximumExposureMinorUnits: 5_000n,
      jurisdiction: 'SIM',
      category: 'LODGING',
      epoch: 'epoch.sim.1',
      expiration: EXPIRES,
      evidenceRefs: ['evidence.fail'],
    });
    const reserved = transitionLiability({ ...quoted, reservedAmountMinorUnits: 5_000n }, 'RESERVED');
    assert.ok('settlementState' in reserved);
    const released = transitionLiability(reserved, 'RELEASED');
    assert.ok('settlementState' in released);
    assert.equal(released.settlementState, 'RELEASED');
  });
});

describe('ACCESS-16 risk haircuts (simulation only)', () => {
  it('applies versioned haircuts to effective allocatable capacity', () => {
    const result = applyRiskHaircuts({
      fundedCapacityMinorUnits: 100_000n,
      haircuts: [
        simulationHaircutPolicy('PROVIDER_QUOTE_VOLATILITY', 1_000n, 'sim.v1'),
        simulationHaircutPolicy('CANCELLATION_RISK', 500n, 'sim.v1'),
      ],
    });
    assert.equal(result.grossCapacityMinorUnits, 100_000n);
    assert.equal(result.effectiveAllocatableMinorUnits, 85_500n);
    assert.equal(result.appliedHaircuts.length, 2);
  });
});

describe('ACCESS-16 consumer availability projection', () => {
  it('never exposes internal treasury detail', () => {
    const available = projectConsumerAvailability({
      poolSolvent: true,
      allocatableUnits: 50n,
      publishedUnits: 100n,
      providerAvailable: true,
    });
    assert.equal(available.posture, 'AVAILABLE');
    assert.equal(available.message.includes('reserve'), false);

    const limited = projectConsumerAvailability({
      poolSolvent: true,
      allocatableUnits: 10n,
      publishedUnits: 100n,
      providerAvailable: true,
    });
    assert.equal(limited.posture, 'LIMITED');

    const unavailable = projectConsumerAvailability({
      poolSolvent: false,
      allocatableUnits: 100n,
      publishedUnits: 100n,
      providerAvailable: true,
    });
    assert.equal(unavailable.posture, 'TEMPORARILY_UNAVAILABLE');
  });
});

describe('ACCESS-16 permanent invariants', () => {
  it('declares all ACCESS-16 invariant ids', () => {
    for (const id of ACCESS_SOLVENCY_INVARIANT_IDS) {
      assert.ok(ACCESS_SOLVENCY_INVARIANT_STATEMENTS[id].length > 0);
    }
  });

  it('holds invariants on a solvent funded pool', () => {
    const ports = createSimulationSolvencyPorts();
    seedPaymentsReserve(ports, 200_000n);
    const engine = new AccessSolvencyEngine(ports, { targetSolvencyRatioBps: 10_000n, simulationOnly: true });
    engine.registerPool(basePool([externalTranche()]));
    const invariants = checkSolvencyInvariants({ snapshot: engine.snapshot() });
    assert.equal(invariants.every((row) => row.held), true);
  });
});

describe('ACCESS-16 stress scenarios', () => {
  it('runs all ten stress scenarios with fail-closed behavior', () => {
    const pool = basePool([externalTranche()]);
    const results = runAllStressScenarios(() => {
      const scenarioPorts = createSimulationSolvencyPorts();
      return {
        engine: new AccessSolvencyEngine(scenarioPorts, { targetSolvencyRatioBps: 10_000n, simulationOnly: true }),
        paymentsPort: scenarioPorts.payments,
        basePool: pool,
        baseReserveMinorUnits: 50_000n,
        currency: 'USD',
        jurisdiction: 'SIM',
        providerRef: 'expedia',
        category: 'LODGING',
        epoch: 'epoch.sim.1',
      };
    });
    assert.equal(results.length, ACCESS_16_STRESS_SCENARIOS.length);
    for (const result of results) {
      assert.equal(result.failClosed, true, `${result.scenarioId}: ${result.notes}`);
    }
  });
});

describe('ACCESS-16 native capacity economics', () => {
  it('does not treat native MoonRey capacity as fiat reserve', () => {
    const ports = createSimulationSolvencyPorts();
    const nativeTranche = Object.freeze({
      trancheId: 'tranche_native',
      poolId: 'pool.compute.gpu',
      kind: 'NATIVE_COMMITTED_CAPACITY' as const,
      providerRef: null,
      currency: 'MR',
      allocatableUnits: 100n,
      settlementTermsRef: 'terms.native.mr',
      fundingReserveRef: null,
      providerAgreementRef: 'agreement.native',
      deliveryEvidenceRef: 'evidence.native',
      expiresAt: EXPIRES,
      evidenceRefs: ['evidence.native'],
    });
    const engine = new AccessSolvencyEngine(ports, { targetSolvencyRatioBps: null, simulationOnly: true });
    engine.registerPool(basePool([nativeTranche]));
    const invariants = checkSolvencyInvariants({ snapshot: engine.snapshot() });
    const nativeInvariant = invariants.find((row) => row.invariantId === 'NATIVE_CAPACITY_NOT_TREATED_AS_FIAT_RESERVE');
    assert.ok(nativeInvariant);
    assert.equal(nativeInvariant.held, true);
  });
});
