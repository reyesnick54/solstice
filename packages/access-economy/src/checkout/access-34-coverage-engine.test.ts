// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../ids.ts';
import {
  AccessCoverageEngine,
  AccessCheckoutCoveragePolicyRegistry,
  buildFirmProviderQuote,
  classifyProviderQuoteCosts,
  createAccessCoverageEngine,
  createAccessSolvencyService,
  TOKEN_CONVERSION_CONTRIBUTION,
} from '../index.ts';
import type { ProviderFxQuotePort } from '../providers/fx-port.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-08-31T18:00:00.000Z');
const EXPIRED = asUtcInstant('2026-08-30T12:00:00.000Z');

function seedFundingPool(
  service: ReturnType<typeof createAccessSolvencyService>,
  amount: bigint,
  category: string | null = 'MOBILITY',
  providerRestriction?: string,
): { poolId: string } {
  const poolRegistry = service.getPoolRegistry();
  const fundingLedger = service.getFundingLedger();
  const pool = poolRegistry.createPool({
    name: `${category ?? 'GLOBAL'} Pool`,
    category,
    currency: 'USD',
    categoryPolicy: category ? 'STRICT_CATEGORY' : 'SHARED_POOL',
    now: NOW,
  });
  const source = poolRegistry.addSource({
    fundingPoolId: pool.fundingPoolId,
    sourceType: 'TREASURY',
    currency: 'USD',
    amountCommitted: amount,
    amountReceived: amount,
    restrictions: providerRestriction ? { providerId: providerRestriction } : {},
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    evidenceReference: 'evidence:treasury',
  });
  fundingLedger.recordFundingReceived({
    fundingPoolId: pool.fundingPoolId,
    sourceId: source.sourceId,
    currency: 'USD',
    amountMinorUnits: amount,
    transactionReference: 'treasury:seed',
    evidenceReference: 'evidence:treasury',
    createdAt: NOW,
    idempotencyKey: `fund:${pool.fundingPoolId}`,
  });
  return { poolId: pool.fundingPoolId };
}

function baseEntitlement(remainingUnits = 1n) {
  return Object.freeze({
    entitlementId: 'ent_mobility_1',
    userId: subjectRefFor('user-1'),
    category: 'MOBILITY',
    entitlementClass: 'MOBILITY_STANDARD',
    unit: 'day',
    canonicalUnit: 'VEHICLE_DAY' as const,
    remainingUnits,
  });
}

function vehicleRentalQuote(overrides: Partial<Parameters<typeof buildFirmProviderQuote>[0]> = {}) {
  return buildFirmProviderQuote({
    quoteId: 'pq_vehicle_1',
    providerId: 'turo',
    catalogItemId: 'turo_mustang_gt_miami',
    canonicalUnit: 'VEHICLE_DAY',
    quantity: 1n,
    baseAmount: 34_000n,
    taxes: 6_000n,
    securityDeposit: 50_000n,
    expiresAt: EXPIRES,
    ...overrides,
  });
}

function buildEngine(
  fundingAmount = 300_00n,
  category: string | null = 'MOBILITY',
  providerRestriction?: string,
  fxPort?: ProviderFxQuotePort,
) {
  const solvency = createAccessSolvencyService();
  const { poolId } = seedFundingPool(solvency, fundingAmount, category, providerRestriction);
  const engine = createAccessCoverageEngine({
    solvencyService: solvency,
    fxReferencePort: fxPort,
  });
  return { engine, solvency, poolId };
}

function checkoutRequest(
  engine: AccessCoverageEngine,
  poolId: string,
  overrides: Partial<Parameters<AccessCoverageEngine['calculateCheckoutQuote']>[0]> = {},
) {
  return {
    accessTransactionId: 'atx_1',
    userId: subjectRefFor('user-1'),
    category: 'MOBILITY',
    providerQuote: vehicleRentalQuote(),
    entitlement: baseEntitlement(),
    requestedUnits: 1n,
    fundingPoolId: poolId,
    fundingCurrency: 'USD',
    idempotencyKey: `idem_${Math.random().toString(36).slice(2)}`,
    evidenceReference: 'evidence:checkout',
    now: NOW,
    ...overrides,
  };
}

describe('ACCESS-34 AccessCoverageEngine', () => {
  it('1. accepts firm quote for settlement', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.status, 'SETTLEABLE');
    assert.equal(result.quote.providerQuoteId, 'pq_vehicle_1');
  });

  it('2. rejects indicative quote for settlement', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ classification: 'INDICATIVE' }),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'QUOTE_INDICATIVE');
  });

  it('3. rejects expired quote', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ expiresAt: EXPIRED }),
        now: NOW,
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'QUOTE_EXPIRED');
  });

  it('4. classifies base cost as access-eligible', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const base = result.quote.classifiedComponents.find((row) => row.code === 'BASE_SERVICE');
    assert.ok(base);
    assert.equal(base.classification, 'ACCESS_ELIGIBLE');
  });

  it('5. classifies tax according to policy', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const tax = result.quote.classifiedComponents.find((row) => row.code === 'TAX');
    assert.ok(tax);
    assert.equal(tax.classification, 'ACCESS_ELIGIBLE');
  });

  it('6. classifies mandatory fee', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ mandatoryFees: 2_500n }),
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const fee = result.quote.classifiedComponents.find((row) => row.code === 'MANDATORY_FEE');
    assert.ok(fee);
    assert.equal(fee.classification, 'ACCESS_ELIGIBLE');
    assert.equal(fee.amountMinorUnits, 2_500n);
  });

  it('7. classifies optional fee as user responsibility', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ optionalFees: 1_500n }),
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const optional = result.quote.classifiedComponents.find((row) => row.code === 'OPTIONAL_FEE');
    assert.ok(optional);
    assert.equal(optional.classification, 'OPTIONAL_FEE');
  });

  it('8. excludes security deposit from access coverage', () => {
    const { engine, poolId } = buildEngine(300_00n);
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const deposit = result.quote.classifiedComponents.find((row) => row.code === 'SECURITY_DEPOSIT');
    assert.ok(deposit);
    assert.equal(deposit.classification, 'SECURITY_DEPOSIT');
    assert.equal(result.quote.coverage.accessCoverageAmount, 30_000n);
    assert.equal(result.quote.coverage.userFiatContribution, 10_000n);
    assert.equal(result.quote.pricing.totalProviderAmount, 40_000n);
    assert.equal(result.quote.reservationPlan.securityDepositUserSecured, 50_000n);
    assert.equal(result.quote.funding.fundingToReserve, 30_000n);
  });

  it('9. excludes contingent liability', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ contingentLiability: 12_000n }),
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const contingent = result.quote.classifiedComponents.find((row) => row.code === 'CONTINGENT_LIABILITY');
    assert.ok(contingent);
    assert.equal(contingent.classification, 'CONTINGENT_LIABILITY');
    assert.equal(result.quote.coverage.excludedAmount >= 62_000n, true);
  });

  it('10. supports partial coverage', () => {
    const { engine, poolId } = buildEngine(15_000n);
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.coverage.accessCoverageAmount, 15_000n);
    assert.equal(result.quote.coverage.userFiatContribution, 25_000n);
  });

  it('11. supports full coverage', () => {
    const { engine, poolId } = buildEngine(100_000n);
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.coverage.accessCoverageAmount, 40_000n);
    assert.equal(result.quote.coverage.userFiatContribution, 0n);
  });

  it('12. returns zero funding when pool exhausted', () => {
    const solvency = createAccessSolvencyService();
    const pool = solvency.getPoolRegistry().createPool({
      name: 'Empty Pool',
      category: 'MOBILITY',
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: NOW,
    });
    const engine = createAccessCoverageEngine({ solvencyService: solvency });
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, pool.fundingPoolId));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'ACCESS_FUNDING_UNAVAILABLE');
    assert.equal(result.quote?.coverage.accessCoverageAmount, 0n);
  });

  it('13. rejects insufficient entitlement units', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        entitlement: baseEntitlement(0n),
        requestedUnits: 1n,
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'ENTITLEMENT_INSUFFICIENT');
  });

  it('14. enforces category funding restriction', () => {
    const { engine, poolId } = buildEngine(50_000n, 'STAY');
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        category: 'MOBILITY',
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'CATEGORY_FUNDING_RESTRICTED');
  });

  it('15. enforces provider funding restriction', () => {
    const { engine, poolId } = buildEngine(50_000n, 'MOBILITY', 'expedia');
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'PROVIDER_FUNDING_RESTRICTED');
  });

  it('16. calculates user contribution correctly', () => {
    const { engine, poolId } = buildEngine(30_000n);
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.quote.coverage.userFiatContribution,
      result.quote.pricing.totalProviderAmount - result.quote.coverage.accessCoverageAmount,
    );
  });

  it('17. preserves bigint decimal precision', () => {
    const { engine, poolId } = buildEngine(33_333n);
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ baseAmount: 33_331n, taxes: 2n }),
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.coverage.accessCoverageAmount, 33_333n);
    assert.equal(result.quote.coverage.userFiatContribution, 0n);
  });

  it('18. handles multi-currency with reference FX only', () => {
    const fxPort: ProviderFxQuotePort = {
      getQuote(request) {
        return Object.freeze({
          quoteId: request.quoteId,
          baseCurrency: request.baseCurrency,
          quoteCurrency: request.quoteCurrency,
          sourceAmountMinorUnits: request.sourceAmountMinorUnits,
          destinationAmountMinorUnits: request.sourceAmountMinorUnits,
          expiresAt: EXPIRES,
          rateNumerator: 1n,
          rateDenominator: 1n,
          simulationOnly: true,
        });
      },
    };
    const { engine, poolId } = buildEngine(50_000n, 'MOBILITY', undefined, fxPort);
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ currency: 'EUR' }),
        fundingCurrency: 'USD',
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.funding.fxQuoteKind, 'REFERENCE_FX');
    assert.equal(result.quote.funding.referenceFxEstimateMinorUnits, 40_000n);
  });

  it('19. enforces quote expiration at min(provider, checkout)', () => {
    const { engine, poolId } = buildEngine();
    const shortExpiry = asUtcInstant('2026-08-31T12:05:00.000Z');
    const result = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ expiresAt: shortExpiry }),
        sunreyCheckoutExpiryMinutes: 60,
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.expiresAt, shortExpiry);
  });

  it('20. recalculates on provider price change', () => {
    const { engine, poolId } = buildEngine(50_000n);
    const first = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, { idempotencyKey: 'idem_price_1' }),
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const repriced = engine.recalculateForProviderQuoteChange({
      previousCheckoutQuoteId: first.quote.checkoutQuoteId,
      request: checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({
          quoteId: 'pq_vehicle_2',
          previousQuoteId: 'pq_vehicle_1',
          baseAmount: 20_000n,
          taxes: 5_000n,
          securityDeposit: 50_000n,
        }),
        idempotencyKey: 'idem_price_2',
      }),
    });
    assert.equal(repriced.ok, true);
    if (!repriced.ok) return;
    assert.equal(repriced.quote.replacementProviderQuoteId, 'pq_vehicle_1');
    assert.equal(repriced.quote.coverage.accessCoverageAmount, 25_000n);
    const prior = engine.getQuoteStore().getByCheckoutQuoteId(first.quote.checkoutQuoteId);
    assert.equal(prior?.status, 'SUPERSEDED');
  });

  it('21. retains policy version on quote', () => {
    const { engine, poolId } = buildEngine();
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.policyId, 'MOBILITY_CHECKOUT_STANDARD');
    assert.equal(result.quote.policyVersion, 'v1');
  });

  it('22. generates reservation plan', () => {
    const { engine, poolId } = buildEngine(30_000n);
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.reservationPlan.entitlementUnitsToReserve, 1n);
    assert.equal(result.quote.reservationPlan.fundingToReserve, 30_000n);
    assert.equal(result.quote.reservationPlan.userPaymentRequired, 10_000n);
    assert.equal(result.quote.reservationPlan.providerAmountRequired, 40_000n);
  });

  it('23. does not mutate funding ledger', () => {
    const { engine, solvency, poolId } = buildEngine(30_000n);
    const before = solvency.getFundingLedger().listEntries().length;
    engine.calculateCheckoutQuote(checkoutRequest(engine, poolId, { idempotencyKey: 'idem_ledger_funding' }));
    const after = solvency.getFundingLedger().listEntries().length;
    assert.equal(before, after);
  });

  it('24. does not mutate entitlement ledger', () => {
    const { engine, solvency, poolId } = buildEngine(30_000n);
    const before = solvency.getEntitlementLedger().listEntries().length;
    engine.calculateCheckoutQuote(checkoutRequest(engine, poolId, { idempotencyKey: 'idem_ledger_entitlement' }));
    const after = solvency.getEntitlementLedger().listEntries().length;
    assert.equal(before, after);
  });

  it('25. leaves SR/MR token conversion at zero', () => {
    const { engine, poolId } = buildEngine(30_000n);
    const result = engine.calculateCheckoutQuote(checkoutRequest(engine, poolId));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.quote.coverage.tokenConversionContribution, TOKEN_CONVERSION_CONTRIBUTION);
    assert.equal(result.quote.coverage.tokenConversionContribution, 0n);
  });
});

describe('ACCESS-34 idempotency and reference quote rejection', () => {
  it('rejects reference quotes and deduplicates identical requests', () => {
    const { engine, poolId } = buildEngine();
    const reference = engine.calculateCheckoutQuote(
      checkoutRequest(engine, poolId, {
        providerQuote: vehicleRentalQuote({ classification: 'REFERENCE' }),
        idempotencyKey: 'idem_ref',
      }),
    );
    assert.equal(reference.ok, false);
    if (reference.ok) return;
    assert.equal(reference.code, 'QUOTE_REFERENCE');

    const request = checkoutRequest(engine, poolId, { idempotencyKey: 'idem_same' });
    const first = engine.calculateCheckoutQuote(request);
    const second = engine.calculateCheckoutQuote(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.idempotent, true);
    assert.equal(first.quote.checkoutQuoteId, second.quote.checkoutQuoteId);
  });
});

describe('ACCESS-34 cost classification helpers', () => {
  it('classifies every monetary component', () => {
    const registry = new AccessCheckoutCoveragePolicyRegistry();
    const policy = registry.resolve('MOBILITY', NOW);
    assert.ok(policy);
    const quote = vehicleRentalQuote({
      mandatoryFees: 1_000n,
      optionalFees: 500n,
      contingentLiability: 2_000n,
    });
    const classified = classifyProviderQuoteCosts(quote, policy);
    assert.equal(classified.length, 6);
    assert.equal(
      classified.every((row) => row.classification.length > 0),
      true,
    );
  });
});
