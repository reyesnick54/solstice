/**
 * ACCESS Wave 3 test harness — seeds solvency and builds orchestrator fixtures.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../ids.ts';
import { accessDomainEntitlementIdFor, accessUserIdFor } from '../domain/ids.ts';
import { createAccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import { AccessProviderGateway } from '../providers/gateway.ts';
import { createSimulationTuroProvider } from '../providers/adapters/turo/simulation.ts';
import { buildQuote } from '../providers/adapters/shared.ts';
import type { ProviderQuote } from '../providers/types.ts';
import { ConfigurableSimulationProvider } from './simulation-provider.ts';
import { AccessPaymentRail } from './payment-rail.ts';
import { createAccessTransactionOrchestrator } from './orchestrator.ts';
import type { OrchestratorOutcome } from './types.ts';

export const WAVE3_NOW = asUtcInstant('2026-08-31T08:00:00.000Z');

export function requireOrchestratorValue<T>(outcome: OrchestratorOutcome<T>): T {
  if (!outcome.ok) {
    throw new Error(`expected orchestrator success: ${outcome.code} ${outcome.message}`);
  }
  return outcome.value;
}
export const WAVE3_USER = accessUserIdFor('mustang-user');
export const WAVE3_EXPIRES = asUtcInstant('2026-09-01T12:00:00.000Z');

export function createWave3TestStack() {
  const solvency = createAccessSolvencyService();
  const simulationProvider = new ConfigurableSimulationProvider(createSimulationTuroProvider());
  const gateway = new AccessProviderGateway({ providers: { turo: simulationProvider } });
  const paymentRail = new AccessPaymentRail();
  const orchestrator = createAccessTransactionOrchestrator({
    solvency,
    gateway,
    paymentRail,
    simulationProvider,
  });
  return { solvency, simulationProvider, gateway, paymentRail, orchestrator };
}

export function seedMobilityEntitlement(
  solvency: ReturnType<typeof createAccessSolvencyService>,
  quantity: bigint,
  entitlementMaterial = 'mobility-mustang',
): string {
  const entitlementId = accessDomainEntitlementIdFor(entitlementMaterial);
  solvency.getEntitlementLedger().allocate({
    entitlementId,
    userId: subjectRefFor('mustang-user'),
    category: 'MOBILITY',
    unit: 'VEHICLE_DAY',
    quantity,
    allocationReference: 'alloc:mustang',
    evidenceReference: 'evidence:mustang-alloc',
    createdAt: WAVE3_NOW,
    idempotencyKey: `alloc:${entitlementId}`,
  });
  return entitlementId;
}

export function seedMobilityFundingPool(
  solvency: ReturnType<typeof createAccessSolvencyService>,
  amountMinorUnits: bigint,
): string {
  const poolRegistry = solvency.getPoolRegistry();
  const fundingLedger = solvency.getFundingLedger();
  const pool = poolRegistry.createPool({
    name: 'Mobility Pool',
    category: 'MOBILITY',
    currency: 'USD',
    categoryPolicy: 'STRICT_CATEGORY',
    now: WAVE3_NOW,
  });
  const source = poolRegistry.addSource({
    fundingPoolId: pool.fundingPoolId,
    sourceType: 'TREASURY',
    currency: 'USD',
    amountCommitted: amountMinorUnits,
    amountReceived: amountMinorUnits,
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    evidenceReference: 'evidence:treasury-mustang',
  });
  fundingLedger.recordFundingReceived({
    fundingPoolId: pool.fundingPoolId,
    sourceId: source.sourceId,
    currency: 'USD',
    amountMinorUnits,
    transactionReference: 'treasury:mustang',
    evidenceReference: 'evidence:treasury-mustang',
    createdAt: WAVE3_NOW,
    idempotencyKey: `fund:${pool.fundingPoolId}`,
  });
  return pool.fundingPoolId;
}

export function mustangProviderQuote(idempotencyKey = 'mustang-quote'): ProviderQuote {
  return withFutureQuoteExpiry(
    buildQuote({
      quoteId: `pq_mustang_${idempotencyKey}`,
      providerId: 'turo',
      catalogItemId: 'turo_mustang_gt_miami',
      canonicalUnit: 'VEHICLE_DAY',
      quantity: 1n,
      providerPriceMinorUnits: 340_00n,
    }),
  );
}

const WAVE3_QUOTE_EXPIRES = asUtcInstant('2026-09-01T12:00:00.000Z');

export function withFutureQuoteExpiry(quote: ProviderQuote): ProviderQuote {
  return Object.freeze({ ...quote, expiresAt: WAVE3_QUOTE_EXPIRES });
}
