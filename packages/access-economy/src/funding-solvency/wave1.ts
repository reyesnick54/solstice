/**
 * ACCESS Wave 1 — End-to-end orchestration.
 *
 * SR/MR participation → allocation → entitlement ledger → funding pool.
 * No provider booking, merchant payment, or token sale.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../ids.ts';
import {
  demoEpoch,
  demoParticipants,
  demoPools,
  demoSupply,
  runDualTokenAllocation,
} from '../dual-token-allocation/engine.ts';
import { TOKEN_CONVERSION_CONTRIBUTION } from './taxonomy.ts';
import type { AccessWave1Result } from './types.ts';
import type { AccessSolvencyService } from './solvency-service.ts';

const CATEGORY_FUNDING_DEFAULTS: Record<string, bigint> = {
  MOBILITY: 100_000_00n,
  STAY: 50_000_00n,
  TRAVEL: 50_000_00n,
  FOOD: 25_000_00n,
  SHOP: 25_000_00n,
  EXPERIENCES: 25_000_00n,
  AI_COMPUTE: 25_000_00n,
  ROBOTICS: 25_000_00n,
  ENERGY: 25_000_00n,
};

export type RunAccessWave1Input = {
  readonly service: AccessSolvencyService;
  readonly userId?: string;
  readonly categories?: readonly string[];
  readonly now?: string;
};

export function runAccessWave1(input: RunAccessWave1Input): AccessWave1Result {
  const now = input.now ?? '2026-08-31T23:59:59.999Z';
  const userId = input.userId ?? 'participant-a';
  const subjectRef = subjectRefFor(userId);
  const evidenceReferences: string[] = [];

  const epoch = demoEpoch();
  const allocation = runDualTokenAllocation({
    epoch,
    participants: demoParticipants(),
    supply: demoSupply(),
    pools: demoPools(epoch.epochId),
    categories: (input.categories ?? ['MOBILITY', 'STAY']) as Parameters<
      typeof runDualTokenAllocation
    >[0]['categories'],
  });

  const entitlementLedger = input.service.getEntitlementLedger();
  const poolRegistry = input.service.getPoolRegistry();
  const fundingLedger = input.service.getFundingLedger();

  const userEntitlements = allocation.entitlements.filter(
    (row) => row.subjectRef === subjectRef,
  );

  for (const entitlement of userEntitlements) {
    entitlementLedger.allocate({
      entitlementId: entitlement.entitlementId,
      userId: subjectRef,
      category: entitlement.category,
      unit: entitlement.unit,
      quantity: entitlement.quantity,
      allocationReference: `alloc:${allocation.epoch.epochId}:${entitlement.category}`,
      evidenceReference: `evidence:allocation:${entitlement.entitlementId}`,
      createdAt: asUtcInstant(now),
      idempotencyKey: `allocate:${entitlement.entitlementId}`,
    });
    evidenceReferences.push(`evidence:allocation:${entitlement.entitlementId}`);
  }

  const fundingPools: AccessWave1Result['fundingPools'] = [];
  const categories = input.categories ?? ['MOBILITY', 'STAY'];

  for (const category of categories) {
    const defaultFunding = CATEGORY_FUNDING_DEFAULTS[category] ?? 25_000_00n;
    const pool = poolRegistry.createPool({
      name: `${category} Funding Pool`,
      category,
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: asUtcInstant(now),
    });

    const source = poolRegistry.addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'TREASURY',
      currency: 'USD',
      amountCommitted: defaultFunding,
      amountReceived: defaultFunding,
      effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
      evidenceReference: `evidence:treasury:${category}`,
    });

    fundingLedger.recordFundingReceived({
      fundingPoolId: pool.fundingPoolId,
      sourceId: source.sourceId,
      currency: 'USD',
      amountMinorUnits: defaultFunding,
      transactionReference: `treasury:${category}`,
      evidenceReference: `evidence:treasury:${category}`,
      createdAt: asUtcInstant(now),
      idempotencyKey: `fund:${pool.fundingPoolId}`,
    });

    evidenceReferences.push(`evidence:treasury:${category}`);

    const balance = input.service.getFundingPoolBalance(pool.fundingPoolId, 'USD', now);
    fundingPools.push(
      Object.freeze({
        category,
        fundingPoolId: pool.fundingPoolId,
        availableFundingMinorUnits: balance.availableFunding,
        currency: 'USD',
      }),
    );
  }

  return Object.freeze({
    userId: subjectRef,
    entitlements: Object.freeze(
      userEntitlements.map((row) =>
        Object.freeze({
          category: row.category,
          quantity: row.quantity,
          unit: row.unit,
          entitlementId: row.entitlementId,
        }),
      ),
    ),
    fundingPools: Object.freeze(fundingPools),
    tokenConversionContribution: TOKEN_CONVERSION_CONTRIBUTION,
    evidenceReferences: Object.freeze(evidenceReferences),
  });
}
