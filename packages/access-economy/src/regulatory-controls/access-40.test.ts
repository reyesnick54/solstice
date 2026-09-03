import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { createAccessSolvencyService } from '../funding-solvency/index.ts';
import {
  accessEconomicPosture,
  accessUnits,
  assertProductionSettlementAllowed,
  isFiatMinorUnits,
  AccessAccountingEventStore,
  AccessComplianceGate,
  AccessDisclosureAcknowledgmentStore,
  AccessDisclosureRegistry,
  AccessGlMappingRegistry,
  AccessJurisdictionPolicyRegistry,
  AccessPaymentProviderGateRegistry,
  AccessProviderContractGateRegistry,
  AccessTreasuryKillSwitch,
  assertNoFixedTokenRedemptionRate,
  assertNotMoneyAmount,
  assertTokenConversionContributionZero,
  buildCancellationPreview,
  buildPriceComponents,
  buildTaxComponents,
  canCommitNewFunding,
  classifyFundingSource,
  coveragePromiseBoundary,
  createSimulationComplianceKernel,
  DEFAULT_ACCESS_GL_MAPPINGS,
  DEFAULT_ACCESS_TREASURY_POLICY,
  DEFAULT_FUNDING_RESTRICTION_POLICIES,
  deriveAccessTreasuryExposure,
  evaluatePaymentProviderGate,
  evaluateTreasuryLimits,
  forbidMixedArithmetic,
  hasOnlyProviderRefundPending,
  isFullyRefundedToUser,
  proportionalRefundSplit,
  resolveCheckoutDisclosures,
  runMustangFullRefundScenario,
  runPartialRefundScenario,
  settlementAccountingEventSequence,
  appendRefundState,
  createRefundTransparency,
  checkCommittedFundingEligible,
  checkFundingNonNegative,
  checkTokenConversionZero,
  allWave1InvariantsHeld,
  checkAllWave1Invariants,
  treasuryCapabilitiesForState,
  validateFundingRestriction,
  discountCapacityIsNotUnrestrictedCash,
} from './index.ts';

const NOW = asUtcInstant('2026-08-31T12:00:00.000Z');

describe('ACCESS-40 regulatory controls', () => {
  it('1. classifies Access as NON_CASH_ACCESS_RIGHT', () => {
    const posture = accessEconomicPosture();
    assert.equal(posture.classification, 'NON_CASH_ACCESS_RIGHT');
    assert.equal(posture.isNonCash, true);
    assert.equal(posture.isGuaranteedFiatRedemption, false);
    assert.ok(posture.forbiddenClassifications.includes('BANK_DEPOSIT'));
  });

  it('2. prevents AccessUnitQuantity from mixing with Money', () => {
    const units = accessUnits(3n);
    const money = { minorUnits: 100_00n, currency: 'USD' };
    assert.throws(() => assertNotMoneyAmount(money, 'units'), TypeError);
    assert.throws(() => forbidMixedArithmetic(units, money), TypeError);
    assert.equal(typeof units, 'bigint');
    assert.equal(isFiatMinorUnits(money), true);
  });

  it('3. rejects fixed SR/MR redemption rates and zero token conversion', () => {
    assert.throws(() => assertNoFixedTokenRedemptionRate(1n, 100_00n, 'SR'), Error);
    assert.throws(() => assertNoFixedTokenRedemptionRate(1n, 100_00n, 'MR'), Error);
    assert.throws(() => assertTokenConversionContributionZero(1n), Error);
    assert.doesNotThrow(() => assertTokenConversionContributionZero(0n));
  });

  it('4. generates accounting events with liability stages', () => {
    const store = new AccessAccountingEventStore();
    const events = settlementAccountingEventSequence({
      accessTransactionId: 'txn_1',
      fundingPoolId: 'pool_1',
      currency: 'USD',
      accessPoolContribution: 300_00n,
      userCopay: 100_00n,
      providerAmount: 400_00n,
      tokenConversionContribution: 0n,
      canonicalAuthorizeRef: 'money:auth',
      canonicalCaptureRef: 'money:capture',
      evidenceReference: 'evidence:1',
      createdAt: NOW,
    });
    for (const event of events) {
      store.append(event);
    }
    assert.ok(events.some((e) => e.eventType === 'ACCESS_FUNDING_RESERVED'));
    assert.ok(events.some((e) => e.eventType === 'ACCESS_PROVIDER_PAYMENT_CAPTURED'));
    assert.equal(store.listByTransaction('txn_1').length, events.length);
  });

  it('5. derives treasury exposure from funding balance', () => {
    const service = createAccessSolvencyService();
    const pool = service.getPoolRegistry().createPool({
      name: 'Test',
      category: 'MOBILITY',
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: NOW,
    });
    const source = service.getPoolRegistry().addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'TREASURY',
      currency: 'USD',
      amountCommitted: 1000_00n,
      amountReceived: 1000_00n,
      effectiveFrom: NOW,
      evidenceReference: 'ev',
    });
    service.getFundingLedger().recordFundingReceived({
      fundingPoolId: pool.fundingPoolId,
      sourceId: source.sourceId,
      currency: 'USD',
      amountMinorUnits: 1000_00n,
      transactionReference: 'seed',
      evidenceReference: 'ev',
      createdAt: NOW,
    });
    const balance = service.getFundingPoolBalance(pool.fundingPoolId, 'USD', NOW);
    const exposure = deriveAccessTreasuryExposure({
      category: 'MOBILITY',
      currency: 'USD',
      balance,
      calculatedAt: NOW,
    });
    assert.equal(exposure.availableFunding, balance.availableFunding);
    assert.equal(exposure.status, 'WITHIN_LIMITS');
  });

  it('6. evaluates treasury limits', () => {
    const service = createAccessSolvencyService();
    const pool = service.getPoolRegistry().createPool({
      name: 'Test',
      category: 'MOBILITY',
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: NOW,
    });
    const source = service.getPoolRegistry().addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'TREASURY',
      currency: 'USD',
      amountCommitted: 100_000_00n,
      amountReceived: 100_000_00n,
      effectiveFrom: NOW,
      evidenceReference: 'ev',
    });
    service.getFundingLedger().recordFundingReceived({
      fundingPoolId: pool.fundingPoolId,
      sourceId: source.sourceId,
      currency: 'USD',
      amountMinorUnits: 100_000_00n,
      transactionReference: 'seed',
      evidenceReference: 'ev',
      createdAt: NOW,
    });
    const balance = service.getFundingPoolBalance(pool.fundingPoolId, 'USD', NOW);
    const exposure = deriveAccessTreasuryExposure({
      category: 'MOBILITY',
      currency: 'USD',
      balance,
      calculatedAt: NOW,
    });
    const results = evaluateTreasuryLimits({
      policy: DEFAULT_ACCESS_TREASURY_POLICY,
      exposure,
      transactionAmountMinorUnits: 400_00n,
    });
    assert.ok(results.length > 0);
    assert.ok(results.every((r) => r.withinLimit));
  });

  it('7. treasury kill switch pauses new funding without blocking refunds', () => {
    const killSwitch = new AccessTreasuryKillSwitch();
    killSwitch.setState('NEW_REDEMPTIONS_PAUSED');
    const caps = killSwitch.capabilities();
    assert.equal(caps.newFundingCommitments, false);
    assert.equal(caps.refunds, true);
    assert.equal(caps.reconciliation, true);
    assert.equal(caps.existingEntitlementServicing, true);
    assert.throws(() => killSwitch.assertCanCommitFunding(), Error);
    const emergency = treasuryCapabilitiesForState('EMERGENCY_RECONCILIATION_ONLY');
    assert.equal(emergency.newRedemptions, false);
    assert.equal(emergency.refunds, true);
  });

  it('8. enforces solvency invariants', () => {
    const service = createAccessSolvencyService();
    const pool = service.getPoolRegistry().createPool({
      name: 'Solvency',
      category: 'MOBILITY',
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: NOW,
    });
    const source = service.getPoolRegistry().addSource({
      fundingPoolId: pool.fundingPoolId,
      sourceType: 'TREASURY',
      currency: 'USD',
      amountCommitted: 500_00n,
      amountReceived: 500_00n,
      effectiveFrom: NOW,
      evidenceReference: 'ev',
    });
    service.getFundingLedger().recordFundingReceived({
      fundingPoolId: pool.fundingPoolId,
      sourceId: source.sourceId,
      currency: 'USD',
      amountMinorUnits: 500_00n,
      transactionReference: 'seed',
      evidenceReference: 'ev',
      createdAt: NOW,
    });
    const balance = service.getFundingPoolBalance(pool.fundingPoolId, 'USD', NOW);
    const results = checkAllWave1Invariants({ fundingBalance: balance });
    assert.ok(allWave1InvariantsHeld(results));
    assert.ok(checkFundingNonNegative(balance).held);
    assert.ok(checkCommittedFundingEligible(balance).held);
    assert.ok(checkTokenConversionZero().held);
  });

  it('9. enforces category funding restrictions', () => {
    const result = validateFundingRestriction({
      classification: 'EMPLOYER_FUNDED',
      restrictions: { category: 'TRAVEL' },
      category: 'MOBILITY',
      geography: 'US',
      providerId: 'turo',
    });
    assert.equal(result.allowed, false);
    const allowed = validateFundingRestriction({
      classification: 'EMPLOYER_FUNDED',
      restrictions: { category: 'MOBILITY' },
      category: 'MOBILITY',
      geography: 'US',
      providerId: 'turo',
      policy: DEFAULT_FUNDING_RESTRICTION_POLICIES[0]!,
    });
    assert.equal(allowed.allowed, true);
  });

  it('10. enforces sponsor geography restrictions', () => {
    const policy = DEFAULT_FUNDING_RESTRICTION_POLICIES[1]!;
    const denied = validateFundingRestriction({
      classification: 'SPONSOR_FUNDED',
      restrictions: {},
      category: 'EXPERIENCES',
      geography: 'US-CA',
      providerId: null,
      policy,
    });
    assert.equal(denied.allowed, false);
    const allowed = validateFundingRestriction({
      classification: 'SPONSOR_FUNDED',
      restrictions: {},
      category: 'EXPERIENCES',
      geography: 'US-FL-Miami',
      providerId: null,
      policy,
    });
    assert.equal(allowed.allowed, true);
  });

  it('11. enforces employer category restrictions', () => {
    const policy = DEFAULT_FUNDING_RESTRICTION_POLICIES[0]!;
    const allowed = validateFundingRestriction({
      classification: 'EMPLOYER_FUNDED',
      restrictions: {},
      category: 'TRAVEL',
      geography: 'US',
      providerId: null,
      policy,
    });
    assert.equal(allowed.allowed, true);
    const denied = validateFundingRestriction({
      classification: 'EMPLOYER_FUNDED',
      restrictions: {},
      category: 'FOOD',
      geography: 'US',
      providerId: null,
      policy,
    });
    assert.equal(denied.allowed, false);
  });

  it('12. resolves checkout disclosures from backend', () => {
    const registry = new AccessDisclosureRegistry();
    const price = buildPriceComponents({
      basePriceMinorUnits: 350_00n,
      taxMinorUnits: 50_00n,
      mandatoryFeesMinorUnits: 0n,
      optionalFeesMinorUnits: 0n,
      depositMinorUnits: 500_00n,
      accessCoverageMinorUnits: 300_00n,
      userContributionMinorUnits: 100_00n,
      currency: 'USD',
    });
    const requirements = resolveCheckoutDisclosures({
      registry,
      at: NOW,
      jurisdiction: 'US',
      category: 'MOBILITY',
      price,
      fundingAvailabilityLimited: true,
      hasSecurityDeposit: true,
      hasProviderTerms: true,
    });
    assert.ok(requirements.some((r) => r.disclosure.disclosureType === 'ACCESS_NON_CASH_RIGHT'));
    assert.ok(requirements.some((r) => r.disclosure.disclosureType === 'NO_TOKEN_REDEMPTION'));
    assert.ok(requirements.some((r) => r.disclosure.disclosureType === 'SECURITY_DEPOSIT'));
    assert.ok(requirements.some((r) => r.disclosure.disclosureType === 'CAPACITY_LIMITATION'));
  });

  it('13. records disclosure acknowledgments with version', () => {
    const registry = new AccessDisclosureRegistry();
    const store = new AccessDisclosureAcknowledgmentStore();
    const disclosure = registry.getActive('access-non-cash-right', NOW)!;
    const ack = store.record({
      disclosureId: disclosure.disclosureId,
      version: disclosure.version,
      userId: 'user:1',
      transactionId: 'txn:1',
      acknowledgedAt: NOW,
    });
    assert.equal(ack.version, '1.0.0');
    assert.equal(store.forTransaction('txn:1').length, 1);
  });

  it('14. preserves disclosure version on transactions', () => {
    const registry = new AccessDisclosureRegistry();
    registry.register({
      disclosureId: 'access-non-cash-right',
      version: '2.0.0',
      disclosureType: 'ACCESS_NON_CASH_RIGHT',
      jurisdiction: 'GLOBAL',
      category: null,
      effectiveFrom: asUtcInstant('2026-09-01T00:00:00.000Z'),
      requiredAcknowledgement: true,
      displayContentReference: 'content:v2',
      status: 'ACTIVE',
    });
    const v1 = registry.getVersion('access-non-cash-right', '1.0.0');
    const v2 = registry.getVersion('access-non-cash-right', '2.0.0');
    assert.ok(v1);
    assert.ok(v2);
    assert.notEqual(v1!.version, v2!.version);
  });

  it('15. exposes price transparency components', () => {
    const price = buildPriceComponents({
      basePriceMinorUnits: 300_00n,
      taxMinorUnits: 50_00n,
      mandatoryFeesMinorUnits: 50_00n,
      optionalFeesMinorUnits: 0n,
      depositMinorUnits: 0n,
      accessCoverageMinorUnits: 300_00n,
      userContributionMinorUnits: 100_00n,
      currency: 'USD',
    });
    assert.equal(price.providerTotalMinorUnits, 400_00n);
    assert.equal(price.accessCoverageMinorUnits + price.userContributionMinorUnits, 400_00n);
    assert.throws(
      () =>
        buildPriceComponents({
          basePriceMinorUnits: 300_00n,
          taxMinorUnits: 0n,
          mandatoryFeesMinorUnits: 0n,
          optionalFeesMinorUnits: 0n,
          depositMinorUnits: 0n,
          accessCoverageMinorUnits: 200_00n,
          userContributionMinorUnits: 50_00n,
          currency: 'USD',
        }),
      Error,
    );
  });

  it('16. requires deposit disclosure when deposit present', () => {
    const registry = new AccessDisclosureRegistry();
    const requirements = resolveCheckoutDisclosures({
      registry,
      at: NOW,
      jurisdiction: 'US',
      category: 'MOBILITY',
      price: buildPriceComponents({
        basePriceMinorUnits: 250_00n,
        taxMinorUnits: 0n,
        mandatoryFeesMinorUnits: 0n,
        optionalFeesMinorUnits: 0n,
        depositMinorUnits: 500_00n,
        accessCoverageMinorUnits: 200_00n,
        userContributionMinorUnits: 50_00n,
        currency: 'USD',
      }),
      fundingAvailabilityLimited: false,
      hasSecurityDeposit: false,
      hasProviderTerms: false,
    });
    assert.ok(requirements.some((r) => r.disclosure.disclosureType === 'SECURITY_DEPOSIT'));
  });

  it('17. exposes cancellation preview with estimated amounts', () => {
    const preview = buildCancellationPreview({
      transactionId: 'txn:1',
      providerPenaltyMinorUnits: 50_00n,
      estimatedRefundableMinorUnits: 350_00n,
      estimatedAccessRestorationUnits: 1n,
      estimatedUserRefundMinorUnits: 75_00n,
      amountsConfirmed: false,
      disclosureIds: ['cancellation-policy', 'refund-policy'],
    });
    assert.equal(preview.amountsConfirmed, false);
    assert.equal(preview.providerPenaltyMinorUnits, 50_00n);
  });

  it('18. distinguishes refund states transparently', () => {
    let transparency = createRefundTransparency({
      transactionId: 'txn:1',
      currency: 'USD',
      now: NOW,
    });
    transparency = appendRefundState(transparency, 'PROVIDER_REFUND_PENDING', {
      amountMinorUnits: 400_00n,
      currency: 'USD',
      estimated: true,
      updatedAt: NOW,
    });
    assert.ok(hasOnlyProviderRefundPending(transparency));
    assert.equal(isFullyRefundedToUser(transparency), false);
    transparency = appendRefundState(transparency, 'USER_REFUNDED', {
      amountMinorUnits: 100_00n,
      currency: 'USD',
      estimated: false,
      updatedAt: NOW,
    });
    assert.equal(isFullyRefundedToUser(transparency), true);
  });

  it('19. blocks production booking for unsigned providers', () => {
    const registry = new AccessProviderContractGateRegistry();
    assert.throws(() => registry.assertProductionBooking('expedia'), Error);
    assert.throws(() => registry.assertProductionBooking('amazon'), Error);
    assert.doesNotThrow(() => registry.assertProductionBooking('turo'));
  });

  it('20. blocks sandbox payment provider in non-simulation', () => {
    const gate = evaluatePaymentProviderGate({
      paymentProviderId: 'restricted-virtual-card-sim',
      state: 'SANDBOX_ONLY',
      environment: 'production',
      credentialsValid: true,
      complianceReady: true,
    });
    assert.equal(gate.environment, 'production');
    assert.throws(() => assertProductionSettlementAllowed(gate), Error);
    const registry = new AccessPaymentProviderGateRegistry();
    assert.doesNotThrow(() => registry.assertSettlement('restricted-virtual-card-sim'));
  });

  it('21. routes compliance through Kernel gate', async () => {
    const gate = new AccessComplianceGate(createSimulationComplianceKernel());
    const result = await gate.evaluateFinancialOperation({
      actionType: 'ACCESS_SETTLEMENT',
      actorId: 'user:1',
      accessTransactionId: 'txn:1',
      providerId: 'turo',
      amountMinorUnits: 400_00n,
      currency: 'USD',
      evidenceReference: 'evidence:1',
    });
    assert.equal(result.allowed, true);
    assert.ok(result.kernelDecisionRef);
  });

  it('22. Mustang full refund accounting reconciles', async () => {
    const { purchase, fullRefund } = await runMustangFullRefundScenario();
    assert.equal(purchase.providerTotal, 400_00n);
    assert.equal(purchase.accessCoverage, 300_00n);
    assert.equal(purchase.userContribution, 100_00n);
    assert.equal(purchase.tokenContribution, 0n);
    assert.equal(purchase.providerSettlement, 400_00n);
    assert.equal(purchase.reconciled, true);
    assert.equal(fullRefund.reconciled, true);
  });

  it('23. partial refund accounting reconciles 75/25 split', () => {
    const result = runPartialRefundScenario();
    assert.equal(result.accessFundingRestored, 150_00n);
    assert.equal(result.userRefund, 50_00n);
    assert.equal(result.reconciled, true);
    const split = proportionalRefundSplit({
      providerRefundMinorUnits: 200_00n,
      originalAccessCoverage: 300_00n,
      originalUserContribution: 100_00n,
    });
    assert.equal(split.accessRestored, 150_00n);
    assert.equal(split.userRefunded, 50_00n);
  });

  it('24. confirms no token movement in settlement events', () => {
    assert.throws(
      () =>
        settlementAccountingEventSequence({
          accessTransactionId: 'txn',
          fundingPoolId: 'pool',
          currency: 'USD',
          accessPoolContribution: 300_00n,
          userCopay: 100_00n,
          providerAmount: 400_00n,
          tokenConversionContribution: 1n,
          canonicalAuthorizeRef: null,
          canonicalCaptureRef: null,
          evidenceReference: 'ev',
          createdAt: NOW,
        }),
      Error,
    );
  });

  it('25. rejects negative funding', () => {
    const service = createAccessSolvencyService();
    const pool = service.getPoolRegistry().createPool({
      name: 'Empty',
      category: 'MOBILITY',
      currency: 'USD',
      categoryPolicy: 'STRICT_CATEGORY',
      now: NOW,
    });
    const balance = service.getFundingPoolBalance(pool.fundingPoolId, 'USD', NOW);
    assert.ok(checkFundingNonNegative(balance).held);
    assert.equal(balance.availableFunding, 0n);
  });

  it('26. GL mappings are configurable placeholders', () => {
    const registry = new AccessGlMappingRegistry();
    assert.equal(registry.list().length, DEFAULT_ACCESS_GL_MAPPINGS.length);
    const cash = registry.byRole('ACCESS_PROGRAM_CASH');
    assert.ok(cash);
    assert.ok(cash!.accountCodePlaceholder.startsWith('TBD'));
    assert.equal(cash!.status, 'DRAFT');
  });

  it('27. discount capacity is not unrestricted cash', () => {
    assert.equal(discountCapacityIsNotUnrestrictedCash('DISCOUNT_CAPACITY'), true);
    assert.equal(classifyFundingSource('PROVIDER_DISCOUNT'), 'DISCOUNT_CAPACITY');
    assert.equal(classifyFundingSource('TREASURY'), 'CASH_FUNDED');
  });

  it('28. coverage promise boundary distinguishes entitlement from funding', () => {
    const boundary = coveragePromiseBoundary({
      entitlementUnitsRemaining: 3n,
      fundedRedemptionAvailability: 'LIMITED',
    });
    assert.equal(boundary.hasEntitlementUnits, true);
    assert.equal(boundary.fundedRedemptionLimited, true);
    assert.match(boundary.message, /distinct states/);
  });

  it('29. jurisdiction policy is configurable', () => {
    const registry = new AccessJurisdictionPolicyRegistry();
    const result = registry.evaluate({
      country: 'US',
      stateProvince: 'US-FL',
      category: 'EXPERIENCES',
      programId: 'sponsor-demo',
      at: NOW,
    });
    assert.equal(result.allowed, true);
  });

  it('30. tax components preserve provider-supplied values', () => {
    const components = buildTaxComponents({
      providerCollectedTax: 50_00n,
      sunreyFee: 0n,
      userFee: 0n,
      accessSubsidy: 300_00n,
      currency: 'USD',
      jurisdiction: 'US-FL',
    });
    const providerTax = components.find((c) => c.role === 'PROVIDER_COLLECTED_TAX');
    assert.equal(providerTax!.providerSupplied, true);
    assert.equal(providerTax!.amountMinorUnits, 50_00n);
  });

  it('31. treasury policy blocks funding when paused', () => {
    const policy = { ...DEFAULT_ACCESS_TREASURY_POLICY, operationalState: 'NEW_REDEMPTIONS_PAUSED' as const };
    assert.equal(canCommitNewFunding(policy), false);
  });
});
