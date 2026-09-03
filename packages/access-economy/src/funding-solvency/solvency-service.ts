/**
 * ACCESS Wave 1 — Access Solvency Service.
 *
 * Orchestrates funding pools, reservations, and solvency status.
 * Does not post to canonical ledger or make external payments.
 */

import { type UtcInstant } from '../../../domain/src/time.ts';
import { computeSolvencyEquation } from './balance.ts';
import { classifyFundedCapacity } from './funded-capacity.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from './taxonomy.ts';
import { AccessEntitlementReservationStore } from './entitlement-reservation.ts';
import { AccessEntitlementLedger } from './entitlement-ledger.ts';
import { AccessFundingLedger } from './funding-ledger.ts';
import { AccessFundingPoolRegistry } from './funding-pool.ts';
import { AccessFundingReservationStore } from './funding-reservation.ts';
import type {
  FundedCapacityMarker,
  FundingPoolBalance,
  SolvencySnapshot,
  SolvencyStatus,
} from './types.ts';

export type AccessSolvencyServiceConfig = {
  readonly limitedThresholdMinorUnits?: bigint;
};

export class AccessSolvencyService {
  private readonly poolRegistry: AccessFundingPoolRegistry;
  private readonly fundingLedger: AccessFundingLedger;
  private readonly entitlementLedger: AccessEntitlementLedger;
  private readonly fundingReservations: AccessFundingReservationStore;
  private readonly entitlementReservations: AccessEntitlementReservationStore;
  private readonly limitedThreshold: bigint;

  constructor(deps: {
    readonly poolRegistry: AccessFundingPoolRegistry;
    readonly fundingLedger: AccessFundingLedger;
    readonly entitlementLedger: AccessEntitlementLedger;
    readonly fundingReservations: AccessFundingReservationStore;
    readonly entitlementReservations: AccessEntitlementReservationStore;
    readonly config?: AccessSolvencyServiceConfig;
  }) {
    this.poolRegistry = deps.poolRegistry;
    this.fundingLedger = deps.fundingLedger;
    this.entitlementLedger = deps.entitlementLedger;
    this.fundingReservations = deps.fundingReservations;
    this.entitlementReservations = deps.entitlementReservations;
    this.limitedThreshold = deps.config?.limitedThresholdMinorUnits ?? 1_000n;
  }

  getFundingPoolBalance(fundingPoolId: string, currency: string, now: string): FundingPoolBalance {
    const sources = this.poolRegistry.activeSourcesForPool(fundingPoolId, now);
    return this.fundingLedger.getPoolBalance(fundingPoolId, currency, sources, now);
  }

  getAvailableFunding(fundingPoolId: string, currency: string, now: string): bigint {
    return this.getFundingPoolBalance(fundingPoolId, currency, now).availableFunding;
  }

  canReserveFunding(input: {
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly category?: string;
    readonly now: string;
  }): boolean {
    const pool = this.poolRegistry.getPool(input.fundingPoolId);
    if (!pool || pool.status !== 'ACTIVE') {
      return false;
    }
    if (
      pool.categoryPolicy === 'STRICT_CATEGORY' &&
      pool.category !== null &&
      input.category !== undefined &&
      pool.category !== input.category
    ) {
      return false;
    }
    const balance = this.getFundingPoolBalance(input.fundingPoolId, input.currency, input.now);
    return balance.availableCashFunding >= input.amountMinorUnits;
  }

  reserveFunding(input: {
    readonly fundingPoolId: string;
    readonly accessTransactionId: string;
    readonly userId: string;
    readonly currency: string;
    readonly amountMinorUnits: bigint;
    readonly category?: string;
    readonly expiresAt: UtcInstant;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    return this.fundingReservations.reserve(input);
  }

  releaseFunding(input: {
    readonly fundingReservationId: string;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    return this.fundingReservations.release(input);
  }

  consumeFunding(input: {
    readonly fundingReservationId: string;
    readonly evidenceReference: string;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }) {
    return this.fundingReservations.consume(input);
  }

  getCoverageCapacity(input: {
    readonly poolId: string;
    readonly category: string;
    readonly allocatableUnits: bigint;
    readonly allocationRightsUnits: bigint;
    readonly fundingPoolId: string;
    readonly currency: string;
    readonly now: string;
    readonly providerContributedUnits?: bigint;
  }): FundedCapacityMarker {
    const balance = this.getFundingPoolBalance(input.fundingPoolId, input.currency, input.now);
    return classifyFundedCapacity({
      poolId: input.poolId,
      category: input.category,
      allocatableUnits: input.allocatableUnits,
      allocationRightsUnits: input.allocationRightsUnits,
      balance,
      ...(input.providerContributedUnits !== undefined
        ? { providerContributedUnits: input.providerContributedUnits }
        : {}),
    });
  }

  getSolvencyStatus(fundingPoolId: string, currency: string, now: string): SolvencySnapshot {
    const pool = this.poolRegistry.getPool(fundingPoolId);
    const balance = this.getFundingPoolBalance(fundingPoolId, currency, now);
    const equation = computeSolvencyEquation(balance);

    let status: SolvencyStatus;
    if (!pool || pool.status === 'SUSPENDED' || pool.status === 'CLOSED') {
      status = 'SUSPENDED';
    } else if (equation.eligibleAvailableFunding <= 0n) {
      status = 'EXHAUSTED';
    } else if (equation.eligibleAvailableFunding <= this.limitedThreshold) {
      status = 'LIMITED';
    } else {
      status = 'HEALTHY';
    }

    return Object.freeze({
      fundingPoolId,
      currency,
      status,
      balance,
      tokenConversionContribution: TOKEN_CONVERSION_CONTRIBUTION,
    });
  }

  getEntitlementLedger(): AccessEntitlementLedger {
    return this.entitlementLedger;
  }

  getFundingLedger(): AccessFundingLedger {
    return this.fundingLedger;
  }

  getPoolRegistry(): AccessFundingPoolRegistry {
    return this.poolRegistry;
  }

  getEntitlementReservations(): AccessEntitlementReservationStore {
    return this.entitlementReservations;
  }

  getFundingReservations(): AccessFundingReservationStore {
    return this.fundingReservations;
  }

  expireFundingReservations(now: UtcInstant): void {
    this.fundingReservations.expireReservations(now);
  }
}

export function createAccessSolvencyService(
  config?: AccessSolvencyServiceConfig,
): AccessSolvencyService {
  const poolRegistry = new AccessFundingPoolRegistry();
  const fundingLedger = new AccessFundingLedger();
  const entitlementLedger = new AccessEntitlementLedger();

  const fundingReservations = new AccessFundingReservationStore(poolRegistry, fundingLedger);

  const entitlementReservations = new AccessEntitlementReservationStore(entitlementLedger);

  return new AccessSolvencyService({
    poolRegistry,
    fundingLedger,
    entitlementLedger,
    fundingReservations,
    entitlementReservations,
    ...(config !== undefined ? { config } : {}),
  });
}
