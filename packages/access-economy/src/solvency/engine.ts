/**
 * ACCESS-16 — Access Capacity Reserve and Solvency Engine.
 *
 * For denomination d:
 *   SolvencyRatio_d = AvailableSettlementReserve_d / CommittedExternalLiability_d
 *
 * Denominations are never combined without an actual quoted conversion.
 */

import { isExternalFundedTranche, isNativeTranche } from './taxonomy.ts';
import { aggregateReservePositions, type SolvencyPorts } from './ports.ts';
import type {
  AccessCapacityPoolWithTranches,
  ConsumerAvailabilityInput,
  ConsumerAvailabilityView,
  ProviderSettlementLiability,
  SettlementReservePosition,
  SolvencyEngineSnapshot,
  SolvencySlice,
} from './types.ts';
import { isConfirmedLiability } from './liability-lifecycle.ts';

export type SolvencyPolicy = {
  /** Simulation may model targetSolvencyRatio >= 1.0; production remains unconfigured. */
  readonly targetSolvencyRatioBps: bigint | null;
  readonly simulationOnly: boolean;
};

export type SolvencyEngineInput = {
  readonly ports: SolvencyPorts;
  readonly liabilities: readonly ProviderSettlementLiability[];
  readonly pools: readonly AccessCapacityPoolWithTranches[];
  readonly policy: SolvencyPolicy;
};

function sliceKey(
  currency: string,
  jurisdiction: string,
  providerRef: string | null,
  category: string | null,
  epoch: string,
): string {
  return [currency, jurisdiction, providerRef ?? '*', category ?? '*', epoch].join('|');
}

function availableReserveForSlice(
  positions: readonly SettlementReservePosition[],
  currency: string,
  jurisdiction: string,
  providerRef: string | null,
  category: string | null,
  epoch: string,
): bigint {
  return positions
    .filter(
      (row) =>
        row.currency === currency &&
        row.jurisdiction === jurisdiction &&
        row.epoch === epoch &&
        (row.providerRef === null || row.providerRef === providerRef) &&
        (row.category === null || row.category === category) &&
        row.state === 'AVAILABLE',
    )
    .reduce((sum, row) => sum + row.amountMinorUnits, 0n);
}

function committedLiabilityForSlice(
  liabilities: readonly ProviderSettlementLiability[],
  currency: string,
  jurisdiction: string,
  providerRef: string | null,
  category: string | null,
  epoch: string,
): bigint {
  return liabilities
    .filter(
      (row) =>
        row.currency === currency &&
        row.jurisdiction === jurisdiction &&
        row.epoch === epoch &&
        row.providerRef === providerRef &&
        row.category === category &&
        isConfirmedLiability(row),
    )
    .reduce((sum, row) => sum + row.reservedAmountMinorUnits, 0n);
}

function reservedLiabilityForSlice(
  liabilities: readonly ProviderSettlementLiability[],
  currency: string,
  jurisdiction: string,
  providerRef: string | null,
  category: string | null,
  epoch: string,
): bigint {
  return liabilities
    .filter(
      (row) =>
        row.currency === currency &&
        row.jurisdiction === jurisdiction &&
        row.epoch === epoch &&
        row.providerRef === providerRef &&
        row.category === category &&
        row.settlementState === 'RESERVED',
    )
    .reduce((sum, row) => sum + row.reservedAmountMinorUnits, 0n);
}

export function computeSolvencySlices(input: SolvencyEngineInput): readonly SolvencySlice[] {
  const positions = aggregateReservePositions(input.ports);
  const keys = new Set<string>();

  for (const liability of input.liabilities) {
    keys.add(
      sliceKey(liability.currency, liability.jurisdiction, liability.providerRef, liability.category, liability.epoch),
    );
  }
  for (const position of positions) {
    keys.add(
      sliceKey(position.currency, position.jurisdiction, position.providerRef, position.category, position.epoch),
    );
  }

  const slices: SolvencySlice[] = [];
  for (const key of keys) {
    const [currency, jurisdiction, providerRaw, categoryRaw, epoch] = key.split('|');
    const providerRef = providerRaw === '*' ? null : providerRaw!;
    const category = categoryRaw === '*' ? null : categoryRaw!;

    const available = availableReserveForSlice(positions, currency!, jurisdiction!, providerRef, category, epoch!);
    const committed = committedLiabilityForSlice(
      input.liabilities,
      currency!,
      jurisdiction!,
      providerRef,
      category,
      epoch!,
    );
    const reserved = reservedLiabilityForSlice(
      input.liabilities,
      currency!,
      jurisdiction!,
      providerRef,
      category,
      epoch!,
    );
    const totalExposure = committed + reserved;

    const solvencyRatioBps =
      totalExposure > 0n ? (available * 10_000n) / totalExposure : available > 0n ? 10_000n : null;

    const target = input.policy.targetSolvencyRatioBps;
    const solvent =
      committed <= available &&
      (target === null || solvencyRatioBps === null || solvencyRatioBps >= target);

    slices.push(
      Object.freeze({
        currency: currency!,
        jurisdiction: jurisdiction!,
        providerRef,
        category,
        epoch: epoch!,
        availableSettlementReserveMinorUnits: available,
        committedExternalLiabilityMinorUnits: totalExposure,
        solvencyRatioBps,
        targetSolvencyRatioBps: target,
        solvent,
      }),
    );
  }

  return Object.freeze(slices);
}

export function buildSolvencySnapshot(input: SolvencyEngineInput): SolvencyEngineSnapshot {
  return Object.freeze({
    slices: computeSolvencySlices(input),
    liabilities: Object.freeze([...input.liabilities]),
    reservePositions: aggregateReservePositions(input.ports),
    pools: Object.freeze([...input.pools]),
  });
}

export function canFundExternalLiability(
  input: SolvencyEngineInput,
  liability: ProviderSettlementLiability,
): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
  const snapshot = buildSolvencySnapshot(input);
  const slice = snapshot.slices.find(
    (row) =>
      row.currency === liability.currency &&
      row.jurisdiction === liability.jurisdiction &&
      row.providerRef === liability.providerRef &&
      row.category === liability.category &&
      row.epoch === liability.epoch,
  );
  if (!slice) {
    return Object.freeze({ ok: false, code: 'NO_RESERVE_SLICE', message: 'no settlement reserve slice for liability' });
  }
  const projectedExposure = slice.committedExternalLiabilityMinorUnits + liability.quotedAmountMinorUnits;
  if (projectedExposure > slice.availableSettlementReserveMinorUnits) {
    return Object.freeze({
      ok: false,
      code: 'INSUFFICIENT_RESERVE',
      message: 'confirmed liability would exceed available reserve',
    });
  }
  return Object.freeze({ ok: true });
}

export function poolBackedUnits(pool: AccessCapacityPoolWithTranches): bigint {
  return pool.tranches.reduce((sum, tranche) => sum + tranche.allocatableUnits, 0n);
}

export function nativeTrancheUnits(pool: AccessCapacityPoolWithTranches): bigint {
  return pool.tranches
    .filter((row) => isNativeTranche(row.kind))
    .reduce((sum, row) => sum + row.allocatableUnits, 0n);
}

export function externalTrancheUnits(pool: AccessCapacityPoolWithTranches): bigint {
  return pool.tranches
    .filter((row) => isExternalFundedTranche(row.kind))
    .reduce((sum, row) => sum + row.allocatableUnits, 0n);
}

export function projectConsumerAvailability(input: ConsumerAvailabilityInput): ConsumerAvailabilityView {
  if (!input.providerAvailable) {
    return Object.freeze({
      posture: 'TEMPORARILY_UNAVAILABLE',
      message: 'This experience is temporarily unavailable.',
    });
  }
  if (!input.poolSolvent) {
    return Object.freeze({
      posture: 'TEMPORARILY_UNAVAILABLE',
      message: 'This experience is temporarily unavailable.',
    });
  }
  if (input.allocatableUnits <= 0n) {
    return Object.freeze({
      posture: 'TEMPORARILY_UNAVAILABLE',
      message: 'This experience is temporarily unavailable.',
    });
  }
  const utilizationBps =
    input.publishedUnits > 0n ? ((input.publishedUnits - input.allocatableUnits) * 10_000n) / input.publishedUnits : 0n;
  if (utilizationBps >= 8_000n) {
    return Object.freeze({
      posture: 'LIMITED',
      message: 'Limited availability.',
    });
  }
  return Object.freeze({
    posture: 'AVAILABLE',
    message: 'Available.',
  });
}

export class AccessSolvencyEngine {
  private readonly ports: SolvencyPorts;
  private liabilities: ProviderSettlementLiability[] = [];
  private pools: AccessCapacityPoolWithTranches[] = [];
  private readonly policy: SolvencyPolicy;

  constructor(ports: SolvencyPorts, policy: SolvencyPolicy) {
    this.ports = ports;
    this.policy = policy;
  }

  registerPool(pool: AccessCapacityPoolWithTranches): void {
    this.pools.push(Object.freeze({ ...pool, tranches: Object.freeze([...pool.tranches]) }));
  }

  registerLiability(liability: ProviderSettlementLiability): void {
    this.liabilities.push(Object.freeze({ ...liability }));
  }

  updateLiability(liability: ProviderSettlementLiability): void {
    const index = this.liabilities.findIndex((row) => row.liabilityId === liability.liabilityId);
    if (index >= 0) {
      this.liabilities[index] = Object.freeze({ ...liability });
    }
  }

  snapshot(): SolvencyEngineSnapshot {
    return buildSolvencySnapshot({
      ports: this.ports,
      liabilities: this.liabilities,
      pools: this.pools,
      policy: this.policy,
    });
  }

  assertFundable(liability: ProviderSettlementLiability): { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string } {
    return canFundExternalLiability(
      { ports: this.ports, liabilities: this.liabilities, pools: this.pools, policy: this.policy },
      liability,
    );
  }

  consumerAvailability(poolId: string): ConsumerAvailabilityView {
    const pool = this.pools.find((row) => row.poolId === poolId);
    if (!pool) {
      return Object.freeze({
        posture: 'TEMPORARILY_UNAVAILABLE',
        message: 'This experience is temporarily unavailable.',
      });
    }
    const snapshot = this.snapshot();
    const externalSlices = snapshot.slices.filter((row) => row.providerRef !== null);
    const poolSolvent = externalSlices.length === 0 || externalSlices.every((row) => row.solvent);
    return projectConsumerAvailability({
      poolSolvent,
      allocatableUnits: pool.allocatableUnits,
      publishedUnits: pool.publishedUnits,
      providerAvailable: true,
    });
  }
}
