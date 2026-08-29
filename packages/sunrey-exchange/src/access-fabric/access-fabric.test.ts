import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { asExchangeAccountId } from '../ids.ts';
import { exchangePrice } from '../price.ts';
import type { EligibilityContext } from '../types-universal.ts';
import { clearCapacityAuction, capacityAuctionOrder, openCapacityAuction, submitCapacityAuctionOrder } from './auction.ts';
import { considerationDenominations, prorateConsiderationUnits } from './consideration.ts';
import { fiatConsiderationFor, openFixedPriceAccessOffer, takeFixedPriceAccessOffer } from './offers.ts';
import { allocateCapacityQueue, enqueueCapacityRequest } from './queue.ts';
import { legUnits, refundableByDenomination, splitConsiderationForPartialDelivery } from './refunds.ts';
import { awardCapacityRfq, evaluateCapacityQuote, openCapacityRfq, submitCapacityQuote } from './rfq.ts';
import {
  CAPACITY_ACCESS_MARKET_ID,
  COMPUTE_ACCESS_MARKET_ID,
  FACILITY_HOUR_UNIT,
  FORBIDDEN_JURISDICTION,
  SIMULATION_JURISDICTION,
  createCapacityAccessSandbox,
} from './sandbox.ts';
import { ACCESS_FABRIC_POSTURE } from './taxonomy.ts';
import { capacityAccessTerms, evaluateTermsCompleteness } from './terms.ts';
import type { CapacityAccessTerms, ConsiderationLeg } from './types.ts';

const BUYER = asExchangeAccountId('xacct_buyer_capacity');
const PROVIDER = asExchangeAccountId('xacct_provider_capacity');
const BUYER_CASH = 'acct_buyer_usd';
const PROVIDER_CASH = 'acct_provider_usd';
const RESERVATION_CASH = 'acct_reservation_pending_usd';

type World = ReturnType<typeof createCapacityAccessSandbox>;

function fiatLeg(amount: Money): ConsiderationLeg {
  return {
    kind: 'FIAT',
    amount,
    payerCashAccountId: BUYER_CASH,
    payerOwnerId: 'owner_buyer',
    payeeCashAccountId: PROVIDER_CASH,
    payeeOwnerId: 'owner_provider',
    reservationCashAccountId: RESERVATION_CASH,
  };
}

function nativeLeg(input: {
  readonly kind: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly units: bigint;
  readonly rail: 'CUSTODY_ASSET' | 'NATIVE_CHAIN';
}): ConsiderationLeg {
  return {
    kind: input.kind,
    amount: AssetQuantity.fromScaledUnits(input.units, input.kind),
    rail: input.rail,
    payerRef: `vault_buyer_${input.kind.toLowerCase()}`,
    payeeRef: `vault_provider_${input.kind.toLowerCase()}`,
    payerVaultId: `vault_buyer_${input.kind.toLowerCase()}`,
    payeeVaultId: `vault_provider_${input.kind.toLowerCase()}`,
  } as ConsiderationLeg;
}

function reserveFiatCapacity(
  world: World,
  input: {
    readonly reservationId: string;
    readonly quantity?: bigint;
    readonly terms?: CapacityAccessTerms;
    readonly actor?: EligibilityContext;
    readonly authorityKey?: string;
  },
) {
  const terms = input.terms ?? world.terms({ termsId: `terms:${input.reservationId}` });
  const quantity = input.quantity ?? 400n;
  const unitPrice = world.unitPrice();
  const due = fiatConsiderationFor({
    unitPrice,
    quantity,
    unit: terms.unit,
    currency: 'USD',
  });
  const authority = world.issueSettlementAuthority(
    BUYER_CASH,
    input.authorityKey ?? `access.${input.reservationId}`,
  );
  const result = world.engine.reserveCapacity({
    reservationId: input.reservationId,
    marketId: CAPACITY_ACCESS_MARKET_ID,
    mechanism: 'FIXED_PRICE_OFFER',
    instrument: world.capacityListing,
    terms,
    buyerAccountId: BUYER,
    providerAccountId: PROVIDER,
    reservedQuantity: quantity,
    unitPrice,
    consideration: [fiatLeg(due)],
    actor: input.actor ?? world.actorContext(),
    height: 120n,
    authority,
    at: world.now,
  });
  return { ...result, due, terms, quantity, authority };
}

describe('ACCESS-09 capacity access terms', () => {
  it('carries every required capacity attribute and refuses an incomplete term sheet', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({ termsId: 'terms:complete' });

    assert.equal(terms.productiveObject.objectId, 'pobj:northline-line-7');
    assert.equal(terms.productiveObject.claimId, 'pclm:northline-line-7-capacity-2026w35');
    assert.equal(terms.productiveObject.claimType, 'CAPACITY');
    assert.equal(terms.productiveObject.tokenizesTitle, false);
    assert.equal(terms.quantity, 1_000n);
    assert.equal(terms.unit, FACILITY_HOUR_UNIT);
    assert.equal(terms.availabilityWindow.startHeight, 100n);
    assert.equal(terms.geography.deliveryLocation, 'GB-MAN');
    assert.equal(terms.serviceClass.capacityCategory, 'MANUFACTURING');
    assert.equal(terms.rightsTerms.grantsUseNotOwnership, true);
    assert.equal(terms.policyRequirements.requireVerifiedAccount, true);
    assert.equal(terms.jurisdiction, SIMULATION_JURISDICTION);
    assert.equal(terms.provenance.providerId, 'provider:northline-works');
    assert.equal(terms.deliveryRequirements.requiresOracleAttestation, true);
    assert.equal(evaluateTermsCompleteness(terms).complete, true);

    const stripped = Object.freeze({
      ...terms,
      geography: { deliveryLocation: '', region: null, gridOrNetworkZone: null },
      provenance: { ...terms.provenance, attestationRefs: [], oracleFactIds: [] },
    });
    const incomplete = evaluateTermsCompleteness(stripped);
    assert.equal(incomplete.complete, false);
    assert.ok(incomplete.missing.includes('geography.deliveryLocation'));
    assert.ok(incomplete.missing.includes('provenance.attestation'));
  });

  it('refuses a capacity unit that is not the canonical productive unit', () => {
    const world = createCapacityAccessSandbox();
    const valid = world.terms({ termsId: 'terms:unit-base' });
    assert.throws(
      () =>
        capacityAccessTerms({
          termsId: 'terms:unit-mismatch',
          family: valid.family,
          instrumentId: String(valid.instrumentId),
          productiveObject: valid.productiveObject,
          quantity: valid.quantity,
          unit: 'machine_h',
          availabilityWindow: valid.availabilityWindow,
          geography: valid.geography,
          serviceClass: valid.serviceClass,
          rightsTerms: valid.rightsTerms,
          policyRequirements: valid.policyRequirements,
          jurisdiction: valid.jurisdiction,
          provenance: valid.provenance,
          deliveryRequirements: valid.deliveryRequirements,
          permittedConsideration: valid.permittedConsideration,
        }),
      /must equal the canonical productive unit/,
    );
  });
});

describe('ACCESS-09 fiat reservation', () => {
  it('reserves fiat consideration on the canonical Ledger under a scoped authority', () => {
    const world = createCapacityAccessSandbox();
    const before = world.ledger.journalCount();
    const reserved = reserveFiatCapacity(world, { reservationId: 'ares:fiat' });

    assert.equal(reserved.decision.permitted, true);
    assert.equal(reserved.decision.authorityRequired, true);
    assert.equal(reserved.receipt?.outcome, 'CLEARED');
    assert.equal(reserved.reservation.state, 'CONFIRMED');
    assert.equal(reserved.due.minorUnits, 100_000n);

    const leg = reserved.receipt?.legs[0];
    assert.equal(leg?.kind, 'FIAT');
    assert.equal(leg?.rail, 'LEDGER_FIAT');
    assert.ok(leg?.journalId);
    assert.equal(world.ledger.journalCount(), before + 1);

    const journal = world.ledger.getJournal(String(leg?.journalId));
    assert.ok(journal);
    assert.equal(journal.classBridgeName, 'DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT');
    assert.equal(journal.sourceDomain, 'exchange');
    assert.equal(world.ledger.projectAccountBalance(BUYER_CASH).debits, 100_000n);
    assert.equal(world.ledger.projectAccountBalance(RESERVATION_CASH).credits, 100_000n);
  });

  it('refuses a fiat reservation with no Execution Authority and posts nothing', () => {
    const world = createCapacityAccessSandbox();
    const before = world.ledger.journalCount();
    const terms = world.terms({ termsId: 'terms:no-authority' });
    const result = world.engine.reserveCapacity({
      reservationId: 'ares:no-authority',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.capacityListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 100n,
      unitPrice: world.unitPrice(),
      consideration: [fiatLeg(Money.fromMinorUnits(25_000n, 'USD'))],
      actor: world.actorContext(),
      height: 120n,
      authority: null,
      at: world.now,
    });

    assert.equal(result.decision.authorityRequired, true);
    assert.equal(result.decision.authorityPresent, false);
    assert.equal(result.decision.permitted, false);
    assert.equal(result.reservation.state, 'POLICY_REFUSED');
    assert.equal(result.receipt, null);
    assert.equal(world.ledger.journalCount(), before);
  });
});

describe('ACCESS-09 SunRey-denominated permitted simulation', () => {
  it('clears a SunRey Coin capacity reservation on the custody rail where the product permits it', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({
      termsId: 'terms:sunrey',
      permittedConsideration: ['SUNREY_COIN'],
    });
    const authority = world.issueSettlementAuthority(BUYER_CASH, 'access.sunrey.capacity');
    const result = world.engine.reserveCapacity({
      reservationId: 'ares:sunrey',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.capacityListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 400n,
      unitPrice: exchangePrice({
        baseAssetId: FACILITY_HOUR_UNIT,
        quoteAssetId: 'SUNREY_COIN',
        quoteKind: 'ASSET',
        priceUnits: 200n,
        basePrecision: 0,
      }),
      consideration: [nativeLeg({ kind: 'SUNREY_COIN', units: 80_000n, rail: 'CUSTODY_ASSET' })],
      actor: world.actorContext(),
      height: 120n,
      authority,
      at: world.now,
    });

    assert.equal(result.decision.permitted, true);
    assert.equal(result.receipt?.outcome, 'CLEARED');
    assert.equal(result.reservation.state, 'CONFIRMED');
    assert.equal(result.receipt?.legs[0]?.kind, 'SUNREY_COIN');
    assert.equal(result.receipt?.legs[0]?.rail, 'CUSTODY_ASSET');
    assert.equal(result.receipt?.legs[0]?.journalId, null);
    assert.equal(result.receipt?.mintsCoin, false);
    assert.equal(result.receipt?.productionActivated, false);
    assert.equal(world.ledger.journalCount(), 0);
  });

  it('refuses SunRey Coin where the product configuration does not permit it', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.computeTerms({
      termsId: 'terms:compute-sunrey',
      permittedConsideration: ['SUNREY_COIN'],
    });
    const result = world.engine.reserveCapacity({
      reservationId: 'ares:compute-sunrey',
      marketId: COMPUTE_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.computeListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 1_000n,
      unitPrice: world.nativeUnitPrice({ assetId: 'SUNREY_COIN' }),
      consideration: [nativeLeg({ kind: 'SUNREY_COIN', units: 40_000n, rail: 'NATIVE_CHAIN' })],
      actor: world.actorContext({ purpose: 'MODEL_TRAINING', access: 'MACHINE_ALLOWED' }),
      height: 500n,
      authority: world.issueSettlementAuthority(BUYER_CASH, 'access.compute.sunrey'),
      at: world.now,
    });

    assert.equal(result.decision.permitted, false);
    assert.ok(result.decision.refusalCodes.includes('CONSIDERATION_NOT_PERMITTED'));
    assert.equal(result.reservation.state, 'POLICY_REFUSED');
    assert.equal(result.receipt, null);
  });
});

describe('ACCESS-09 MoonRey productive settlement simulation', () => {
  it('settles a MoonRey-denominated compute reservation on the chain rail without minting', () => {
    const world = createCapacityAccessSandbox();
    world.seedNative('vault_buyer_moonrey_coin', 'MOONREY_COIN', 5_000_000n);
    const terms = world.computeTerms({ termsId: 'terms:moonrey', quantity: 10_000n });
    const authority = world.issueSettlementAuthority(BUYER_CASH, 'access.moonrey.compute');

    const reserved = world.engine.reserveCapacity({
      reservationId: 'ares:moonrey',
      marketId: COMPUTE_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.computeListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 10_000n,
      unitPrice: world.nativeUnitPrice(),
      consideration: [nativeLeg({ kind: 'MOONREY_COIN', units: 400_000n, rail: 'NATIVE_CHAIN' })],
      actor: world.actorContext({ purpose: 'MODEL_TRAINING', access: 'MACHINE_ALLOWED' }),
      height: 500n,
      authority,
      at: world.now,
    });
    assert.equal(reserved.decision.permitted, true);
    assert.equal(reserved.receipt?.outcome, 'CLEARED');
    assert.equal(reserved.reservation.consideration.semantics, 'DELIVERY_VERSUS_PAYMENT');

    const delivered = world.engine.recordDelivery({
      reservationId: 'ares:moonrey',
      evidenceId: 'aev:moonrey-1',
      deliveredQuantity: 10_000n,
      quality: 'FINALIZED',
      oracleFactIds: ['fact:helios-gpu-seconds-2026w35'],
      productiveClaimId: 'pclm:helios-gpu-delivery-2026w35',
      authority,
      at: world.now,
    });

    assert.deepEqual(delivered.rejectedReasons, []);
    assert.equal(delivered.captureReceipt?.outcome, 'CLEARED');
    assert.equal(delivered.captureReceipt?.mintsCoin, false);
    assert.equal(delivered.captureReceipt?.productionActivated, false);
    assert.equal(delivered.captureReceipt?.legs[0]?.rail, 'NATIVE_CHAIN');
    assert.ok(delivered.captureReceipt?.legs[0]?.chainTxId);
    assert.equal(delivered.reservation.state, 'DELIVERED');
    assert.equal(delivered.refundIntent, null);
    assert.equal(world.ledger.journalCount(), 0);
    assert.equal(world.chain.available('vault_provider_moonrey_coin', 'MOONREY_COIN'), 400_000n);
    assert.equal(
      world.engine
        .evidenceFor('ares:moonrey')
        .every((evidence) => evidence.productiveClaimId !== null),
      true,
    );
  });

  it('reports independent denominations for mixed consideration and never a converted total', () => {
    const legs: readonly ConsiderationLeg[] = [
      fiatLeg(Money.fromMinorUnits(50_000n, 'USD')),
      nativeLeg({ kind: 'SUNREY_COIN', units: 1_000n, rail: 'NATIVE_CHAIN' }),
      nativeLeg({ kind: 'MOONREY_COIN', units: 2_000n, rail: 'NATIVE_CHAIN' }),
    ];
    const denominations = considerationDenominations(legs);
    assert.deepEqual(
      denominations.map((row) => row.denomination),
      ['USD', 'SUNREY_COIN', 'MOONREY_COIN'],
    );
    assert.equal(new Set(denominations.map((row) => row.denomination)).size, 3);
    assert.equal(ACCESS_FABRIC_POSTURE.fixedSunReyMoonReyRatio, false);
    assert.equal(ACCESS_FABRIC_POSTURE.createsThirdCurrency, false);
  });
});

describe('ACCESS-09 entitlement-only reservation', () => {
  it('consumes entitlement units at the owning port and moves no money', () => {
    const world = createCapacityAccessSandbox();
    world.entitlements.grant({
      entitlementId: 'ent:included-hours',
      holderId: 'owner_buyer',
      unit: FACILITY_HOUR_UNIT,
      units: 500n,
    });
    const terms = world.terms({
      termsId: 'terms:entitlement',
      permittedConsideration: ['ACCESS_ENTITLEMENT'],
    });

    const result = world.engine.reserveCapacity({
      reservationId: 'ares:entitlement',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'QUEUE_ALLOCATION',
      instrument: world.capacityListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 200n,
      unitPrice: world.unitPrice(),
      consideration: [
        {
          kind: 'ACCESS_ENTITLEMENT',
          entitlementId: 'ent:included-hours',
          holderId: 'owner_buyer',
          units: 200n,
          unit: FACILITY_HOUR_UNIT,
          transferable: false,
          redeemableForMoney: false,
        },
      ],
      actor: world.actorContext(),
      height: 120n,
      authority: null,
      at: world.now,
    });

    assert.equal(result.decision.authorityRequired, false);
    assert.equal(result.decision.permitted, true);
    assert.equal(result.receipt?.outcome, 'CLEARED');
    assert.equal(result.reservation.state, 'CONFIRMED');
    assert.equal(result.receipt?.legs[0]?.rail, 'ENTITLEMENT_PORT');
    assert.equal(result.receipt?.legs[0]?.journalId, null);
    assert.equal(world.ledger.journalCount(), 0);
    assert.equal(
      world.entitlements.grantedUnits({
        entitlementId: 'ent:included-hours',
        holderId: 'owner_buyer',
        unit: FACILITY_HOUR_UNIT,
      }),
      300n,
    );
    assert.equal(world.entitlements.transferable, false);
    assert.equal(world.entitlements.redeemableForMoney, false);
    assert.equal('transfer' in world.entitlements, false);
  });

  it('refuses an entitlement reservation larger than the granted units', () => {
    const world = createCapacityAccessSandbox();
    world.entitlements.grant({
      entitlementId: 'ent:small',
      holderId: 'owner_buyer',
      unit: FACILITY_HOUR_UNIT,
      units: 10n,
    });
    const terms = world.terms({
      termsId: 'terms:entitlement-short',
      permittedConsideration: ['ACCESS_ENTITLEMENT'],
    });
    const result = world.engine.reserveCapacity({
      reservationId: 'ares:entitlement-short',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'QUEUE_ALLOCATION',
      instrument: world.capacityListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 200n,
      unitPrice: world.unitPrice(),
      consideration: [
        {
          kind: 'ACCESS_ENTITLEMENT',
          entitlementId: 'ent:small',
          holderId: 'owner_buyer',
          units: 200n,
          unit: FACILITY_HOUR_UNIT,
          transferable: false,
          redeemableForMoney: false,
        },
      ],
      actor: world.actorContext(),
      height: 120n,
      authority: null,
      at: world.now,
    });

    assert.equal(result.receipt?.outcome, 'FAILED');
    assert.equal(result.receipt?.failureCode, 'ENTITLEMENT_INSUFFICIENT');
    assert.equal(result.reservation.state, 'FAILED');
    assert.deepEqual(result.receipt?.compensations, []);
  });
});

describe('ACCESS-09 failed delivery-versus-payment', () => {
  it('reports REQUIRES_COMPENSATION with compensating intents when a later leg fails', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({
      termsId: 'terms:dvp',
      semantics: 'DELIVERY_VERSUS_PAYMENT',
      permittedConsideration: ['FIAT', 'SUNREY_COIN'],
      partialDeliveryAllowed: false,
    });
    const reserveAuthority = world.issueSettlementAuthority(BUYER_CASH, 'access.dvp');
    const legs: readonly ConsiderationLeg[] = [
      fiatLeg(Money.fromMinorUnits(100_000n, 'USD')),
      nativeLeg({ kind: 'SUNREY_COIN', units: 5_000n, rail: 'CUSTODY_ASSET' }),
    ];

    const reserved = world.engine.reserveCapacity({
      reservationId: 'ares:dvp',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.capacityListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 400n,
      unitPrice: world.unitPrice(),
      consideration: legs,
      actor: world.actorContext(),
      height: 120n,
      authority: reserveAuthority,
      at: world.now,
    });
    assert.equal(reserved.receipt?.outcome, 'CLEARED');

    // The custody provider stops confirming between reservation and delivery.
    world.custody.nextFinality = 'PENDING';
    const captureAuthority = world.issueSettlementAuthority(RESERVATION_CASH, 'access.dvp.settle');
    const delivered = world.engine.recordDelivery({
      reservationId: 'ares:dvp',
      evidenceId: 'aev:dvp-1',
      deliveredQuantity: 400n,
      quality: 'FINALIZED',
      oracleFactIds: ['fact:northline-line-7-output-2026w35'],
      authority: captureAuthority,
      at: world.now,
    });

    assert.equal(delivered.captureReceipt?.outcome, 'REQUIRES_COMPENSATION');
    assert.equal(delivered.captureReceipt?.failureCode, 'DVP_LEG_FAILED');
    assert.equal(delivered.reservation.state, 'REQUIRES_COMPENSATION');
    assert.ok(delivered.captureReceipt && delivered.captureReceipt.compensations.length >= 1);
    for (const compensation of delivered.captureReceipt.compensations) {
      assert.equal(compensation.compensating, true);
      assert.equal(compensation.editsOriginalPosting, false);
    }
    assert.equal(
      world.engine.refundIntentsFor('ares:dvp').length,
      delivered.captureReceipt.compensations.length,
    );
  });

  it('refuses delivery settlement without attested delivery evidence', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({ termsId: 'terms:no-evidence' });
    const reserved = reserveFiatCapacity(world, {
      reservationId: 'ares:no-evidence',
      terms,
    });
    assert.equal(reserved.receipt?.outcome, 'CLEARED');
    const before = world.ledger.journalCount();

    const rejected = world.engine.recordDelivery({
      reservationId: 'ares:no-evidence',
      evidenceId: 'aev:self-report',
      deliveredQuantity: 400n,
      quality: 'SELF_REPORT',
      oracleFactIds: [],
      authority: world.issueSettlementAuthority(RESERVATION_CASH, 'access.no-evidence.settle'),
      at: world.now,
    });

    assert.equal(rejected.captureReceipt, null);
    assert.ok(rejected.rejectedReasons.length >= 1);
    assert.equal(world.ledger.journalCount(), before);
  });
});

describe('ACCESS-09 refund and cancellation', () => {
  it('returns reserved fiat with a new compensating journal and never edits the original', () => {
    const world = createCapacityAccessSandbox();
    const reserved = reserveFiatCapacity(world, { reservationId: 'ares:refund' });
    const originalJournalId = String(reserved.receipt?.legs[0]?.journalId);
    assert.equal(world.ledger.journalCount(), 1);

    const cancelled = world.engine.cancelReservation({
      reservationId: 'ares:refund',
      reason: 'BUYER_CANCELLED',
      authority: world.issueSettlementAuthority(RESERVATION_CASH, 'access.refund.settle'),
      at: world.now,
    });

    assert.equal(cancelled.intent.reason, 'BUYER_CANCELLED');
    assert.equal(cancelled.intent.compensating, true);
    assert.equal(cancelled.intent.editsOriginalPosting, false);
    assert.equal(cancelled.intent.requiresExecutionAuthority, true);
    assert.equal(cancelled.receipt.outcome, 'CLEARED');
    assert.equal(cancelled.reservation.state, 'REFUNDED');

    assert.equal(world.ledger.journalCount(), 2);
    assert.ok(world.ledger.getJournal(originalJournalId));
    assert.equal(world.ledger.projectAccountBalance(RESERVATION_CASH).posted.minorUnits, 0n);
    assert.equal(world.ledger.projectAccountBalance(BUYER_CASH).posted.minorUnits, 0n);
    assert.deepEqual(
      refundableByDenomination(cancelled.intent).map((row) => [row.denomination, row.units, row.monetary]),
      [['USD', 100_000n, true]],
    );
  });

  it('refuses a refund journal whose authority is scoped to a different account', () => {
    const world = createCapacityAccessSandbox();
    reserveFiatCapacity(world, { reservationId: 'ares:refund-scope' });
    const before = world.ledger.journalCount();

    const cancelled = world.engine.cancelReservation({
      reservationId: 'ares:refund-scope',
      reason: 'BUYER_CANCELLED',
      authority: world.issueSettlementAuthority('acct_unrelated_usd', 'access.refund-scope.settle'),
      at: world.now,
    });

    assert.equal(cancelled.receipt.outcome, 'FAILED');
    assert.equal(cancelled.receipt.failureCode, 'AUTHORITY_SCOPE_MISMATCH');
    assert.equal(cancelled.reservation.state, 'CANCELLED');
    assert.equal(world.ledger.journalCount(), before);
  });
});

describe('ACCESS-09 partial delivery', () => {
  it('captures the exact delivered share and refunds the remainder with no rounding leakage', () => {
    const world = createCapacityAccessSandbox();
    const reserved = reserveFiatCapacity(world, { reservationId: 'ares:partial' });
    assert.equal(reserved.due.minorUnits, 100_000n);

    const delivered = world.engine.recordDelivery({
      reservationId: 'ares:partial',
      evidenceId: 'aev:partial-1',
      deliveredQuantity: 300n,
      quality: 'FINALIZED',
      oracleFactIds: ['fact:northline-line-7-output-2026w35'],
      productiveClaimId: 'pclm:northline-line-7-delivery-2026w35',
      authority: world.issueSettlementAuthority(RESERVATION_CASH, 'access.partial.settle'),
      at: world.now,
    });

    assert.deepEqual(delivered.rejectedReasons, []);
    assert.equal(delivered.captureReceipt?.outcome, 'CLEARED');
    assert.equal(delivered.reservation.deliveredQuantity, 300n);
    assert.equal(delivered.refundIntent?.reason, 'UNDELIVERED_REMAINDER');
    assert.equal(delivered.refundReceipt?.outcome, 'CLEARED');
    assert.equal(delivered.reservation.state, 'REFUNDED');

    // Reserved 100_000, captured 75_000 for 300 of 400 units, returned 25_000.
    assert.equal(world.ledger.projectAccountBalance(PROVIDER_CASH).posted.minorUnits, 75_000n);
    assert.equal(world.ledger.projectAccountBalance(BUYER_CASH).posted.minorUnits, -75_000n);
    assert.equal(world.ledger.projectAccountBalance(RESERVATION_CASH).posted.minorUnits, 0n);
    assert.equal(world.ledger.journalCount(), 3);
  });

  it('splits consideration exactly so captured plus remainder equals the reserved amount', () => {
    const legs: readonly ConsiderationLeg[] = [fiatLeg(Money.fromMinorUnits(1_000n, 'USD'))];
    const split = splitConsiderationForPartialDelivery({
      legs,
      reservedQuantity: 3n,
      deliveredQuantity: 1n,
    });
    const captured = split.captured.reduce((sum, leg) => sum + legUnits(leg), 0n);
    const remainder = split.remainder.reduce((sum, leg) => sum + legUnits(leg), 0n);
    assert.equal(captured, 333n);
    assert.equal(remainder, 667n);
    assert.equal(captured + remainder, 1_000n);

    const prorated = prorateConsiderationUnits({
      reservedUnits: 1_000n,
      reservedQuantity: 3n,
      deliveredQuantity: 1n,
    });
    assert.equal(prorated.capturedUnits + prorated.remainderUnits, 1_000n);
  });
});

describe('ACCESS-09 forbidden jurisdiction', () => {
  it('refuses a capacity reservation from a forbidden jurisdiction and settles nothing', () => {
    const world = createCapacityAccessSandbox();
    const before = world.ledger.journalCount();
    const result = reserveFiatCapacity(world, {
      reservationId: 'ares:forbidden',
      actor: world.actorContext({ jurisdiction: FORBIDDEN_JURISDICTION }),
    });

    assert.equal(result.decision.permitted, false);
    assert.ok(result.decision.refusalCodes.includes('JURISDICTION_FORBIDDEN'));
    assert.ok(result.decision.eligibilityReasonCodes.includes('JURISDICTION_DENIED'));
    assert.equal(result.reservation.state, 'POLICY_REFUSED');
    assert.equal(result.receipt, null);
    assert.equal(world.ledger.journalCount(), before);
  });

  it('excludes forbidden jurisdictions from discovery and filters them out of RFQ before ranking', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({ termsId: 'terms:rfq' });
    world.engine.discovery.publish({
      listingId: 'listing:rfq',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'REQUEST_FOR_QUOTE',
      terms,
      offeredQuantity: 1_000n,
      at: world.now,
    });
    assert.equal(world.engine.discovery.search({ jurisdiction: SIMULATION_JURISDICTION }).length, 1);
    assert.equal(world.engine.discovery.search({ jurisdiction: FORBIDDEN_JURISDICTION }).length, 0);

    const rfq = openCapacityRfq({
      rfqId: 'rfq:capacity',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      buyerAccountId: BUYER,
      terms,
      closesAtHeight: 180n,
      at: world.now,
    });
    const window = { startHeight: 100n, endHeight: 200n, startAt: null, endAt: null };
    const cheapForbidden = submitCapacityQuote(
      rfq,
      {
        quoteId: 'quote:forbidden',
        rfqId: rfq.rfqId,
        providerAccountId: PROVIDER,
        providerId: 'provider:offshore-works',
        unitPrice: world.unitPrice({ priceUnits: 10n }),
        offeredQuantity: 1_000n,
        consideration: 'FIAT',
        deliverableWindow: window,
        sequence: 1,
        submittedAtHeight: 150n,
      },
      150n,
    );
    const permitted = submitCapacityQuote(
      rfq,
      {
        quoteId: 'quote:permitted',
        rfqId: rfq.rfqId,
        providerAccountId: PROVIDER,
        providerId: 'provider:northline-works',
        unitPrice: world.unitPrice({ priceUnits: 900n }),
        offeredQuantity: 1_000n,
        consideration: 'FIAT',
        deliverableWindow: window,
        sequence: 2,
        submittedAtHeight: 151n,
      },
      151n,
    );

    const award = awardCapacityRfq({
      rfq,
      quotes: [cheapForbidden, permitted],
      evaluations: [
        evaluateCapacityQuote({
          rfq,
          quote: cheapForbidden,
          providerJurisdiction: FORBIDDEN_JURISDICTION,
          providerCapabilities: [],
          providerVerified: true,
        }),
        evaluateCapacityQuote({
          rfq,
          quote: permitted,
          providerJurisdiction: SIMULATION_JURISDICTION,
          providerCapabilities: [],
          providerVerified: true,
        }),
      ],
    });

    assert.equal(award.awardedQuoteId, 'quote:permitted');
    assert.deepEqual(award.consideredQuoteIds, ['quote:permitted']);
    assert.equal(award.filteredOut.length, 1);
    assert.ok(award.filteredOut[0]?.refusalCodes.includes('JURISDICTION_FORBIDDEN'));
    assert.equal(award.tieBreak, 'PRICE_THEN_SEQUENCE_THEN_QUOTE_ID');
  });
});

describe('ACCESS-09 custody unavailable', () => {
  it('fails closed when the custody rail is unavailable and moves nothing', () => {
    const world = createCapacityAccessSandbox();
    world.custody.available = false;
    const terms = world.terms({
      termsId: 'terms:custody-down',
      permittedConsideration: ['SUNREY_COIN'],
    });

    const result = world.engine.reserveCapacity({
      reservationId: 'ares:custody-down',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.capacityListing,
      terms,
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 400n,
      unitPrice: exchangePrice({
        baseAssetId: FACILITY_HOUR_UNIT,
        quoteAssetId: 'SUNREY_COIN',
        quoteKind: 'ASSET',
        priceUnits: 200n,
        basePrecision: 0,
      }),
      consideration: [nativeLeg({ kind: 'SUNREY_COIN', units: 80_000n, rail: 'CUSTODY_ASSET' })],
      actor: world.actorContext(),
      height: 120n,
      authority: world.issueSettlementAuthority(BUYER_CASH, 'access.custody-down'),
      at: world.now,
    });

    assert.equal(result.decision.permitted, true);
    assert.equal(result.receipt?.outcome, 'FAILED');
    assert.equal(result.receipt?.failureCode, 'CUSTODY_UNAVAILABLE');
    assert.equal(result.receipt?.legs[0]?.committed, false);
    assert.deepEqual(result.receipt?.compensations, []);
    assert.equal(result.reservation.state, 'FAILED');
    assert.equal(world.ledger.journalCount(), 0);
  });

  it('fails closed when no custody rail is wired at all', () => {
    const world = createCapacityAccessSandbox();
    const railsWithoutCustody = { ...world.rails };
    delete (railsWithoutCustody as { custody?: unknown }).custody;
    const engine = new (world.engine.constructor as new (ports: unknown) => typeof world.engine)({
      rails: railsWithoutCustody,
      entitlements: world.entitlements,
      rewards: world.rewards,
    });
    engine.configureMarket({
      ...(world.engine.configurationFor(CAPACITY_ACCESS_MARKET_ID) as NonNullable<
        ReturnType<typeof world.engine.configurationFor>
      >),
    });

    const result = engine.reserveCapacity({
      reservationId: 'ares:custody-missing',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      mechanism: 'FIXED_PRICE_OFFER',
      instrument: world.capacityListing,
      terms: world.terms({
        termsId: 'terms:custody-missing',
        permittedConsideration: ['SUNREY_COIN'],
      }),
      buyerAccountId: BUYER,
      providerAccountId: PROVIDER,
      reservedQuantity: 400n,
      unitPrice: exchangePrice({
        baseAssetId: FACILITY_HOUR_UNIT,
        quoteAssetId: 'SUNREY_COIN',
        quoteKind: 'ASSET',
        priceUnits: 200n,
        basePrecision: 0,
      }),
      consideration: [nativeLeg({ kind: 'SUNREY_COIN', units: 80_000n, rail: 'CUSTODY_ASSET' })],
      actor: world.actorContext(),
      height: 120n,
      authority: world.issueSettlementAuthority(BUYER_CASH, 'access.custody-missing'),
      at: world.now,
    });

    assert.equal(result.receipt?.outcome, 'FAILED');
    assert.equal(result.receipt?.failureCode, 'CUSTODY_RAIL_MISSING');
    assert.equal(result.reservation.state, 'FAILED');
  });
});

describe('ACCESS-09 no balance duplication', () => {
  it('reads positions from the canonical Ledger and keeps no balance in the access fabric', () => {
    const world = createCapacityAccessSandbox();
    const reserved = reserveFiatCapacity(world, { reservationId: 'ares:no-duplication' });

    const reservationKeys = Object.keys(reserved.reservation);
    for (const forbidden of ['balance', 'balances', 'availableBalance', 'holdings', 'position']) {
      assert.equal(reservationKeys.includes(forbidden), false, forbidden);
    }
    const receiptKeys = Object.keys(reserved.receipt ?? {});
    assert.equal(receiptKeys.includes('balance'), false);

    // The only authoritative fiat position is the canonical Ledger projection.
    assert.equal(world.ledger.projectAccountBalance(BUYER_CASH).posted.minorUnits, -100_000n);
    assert.equal(world.ledger.projectAccountBalance(RESERVATION_CASH).posted.minorUnits, 100_000n);
    assert.equal(ACCESS_FABRIC_POSTURE.storesCompetingBalanceLedger, false);
    assert.equal(ACCESS_FABRIC_POSTURE.fiatSettlesOnCanonicalLedger, true);
  });

  it('blocks a replayed reservation instead of posting a second journal', () => {
    const world = createCapacityAccessSandbox();
    const reserved = reserveFiatCapacity(world, { reservationId: 'ares:replay' });
    assert.equal(reserved.receipt?.outcome, 'CLEARED');
    assert.equal(world.ledger.journalCount(), 1);

    const replay = world.engine.clearing.reserveConsideration({
      reservationId: 'ares:replay',
      consideration: reserved.reservation.consideration,
      authority: reserved.authority,
      actorId: String(BUYER),
      at: world.now,
    });

    assert.equal(replay.outcome, 'REFUSED');
    assert.equal(replay.failureCode, 'DUPLICATE_CLEARING_BLOCKED');
    assert.equal(world.ledger.journalCount(), 1);
    assert.equal(world.engine.clearing.alreadyCommitted('RESERVE_CONSIDERATION', 'ares:replay'), true);
  });

  it('declares no balance, holdings, or position field anywhere in the access fabric', () => {
    const root = join(import.meta.dirname);
    const files = readdirSync(root)
      .filter((entry) => entry.endsWith('.ts'))
      .filter((entry) => !entry.endsWith('.test.ts') && entry !== 'demo.ts' && entry !== 'sandbox.ts')
      .map((entry) => join(root, entry));
    assert.ok(files.length >= 12);
    const forbidden =
      /^\s*(readonly\s+)?(balance|balances|availableBalance|cashBalance|coinBalance|holdings|positions?)\s*\??\s*:/m;
    for (const file of files) {
      assert.equal(statSync(file).isFile(), true);
      const source = readFileSync(file, 'utf8');
      assert.equal(forbidden.test(source), false, `${file} must not declare a balance field`);
      assert.equal(/APY|APR|blended return|yield rate/i.test(source), false, file);
      assert.equal(/SUNREY_PER_MOONREY|MOONREY_PER_SUNREY|coinConversionRate|sunreyMoonreyRate/i.test(source), false, file);
    }
  });
});

describe('ACCESS-09 architecture guards', () => {
  it('keeps clearing on canonical rails and creates no competing owner', () => {
    const repoRoot = join(import.meta.dirname, '..', '..', '..', '..');
    for (const forbiddenPath of [
      'packages/access-fabric',
      'packages/capacity-exchange',
      'packages/capacity-market',
      'packages/dual-economy-clearing',
      'packages/clearing-house',
      'packages/entitlements',
      'packages/access-ledger',
      'packages/exchange-v2',
    ]) {
      assert.equal(existsSync(join(repoRoot, forbiddenPath)), false, forbiddenPath);
    }

    const clearing = readFileSync(join(import.meta.dirname, 'clearing.ts'), 'utf8');
    assert.match(clearing, /from '\.\.\/\.\.\/\.\.\/ledger\/src\/types\.ts'/);
    assert.match(clearing, /rail\.ledger\.postJournal\(/);
    assert.match(clearing, /executionAuthority: authority/);
    assert.match(clearing, /mintsCoin: false/);
    assert.equal(/\.mint\(|mintCoin\(|issueCoin\(|finalizeIssuance\(/.test(clearing), false);
    assert.equal(/AuthorityIssuer/.test(clearing), false);

    const engine = readFileSync(join(import.meta.dirname, 'engine.ts'), 'utf8');
    assert.equal(/postJournal/.test(engine), false);
    assert.equal(/from ['"].*services\//.test(engine), false);

    const taxonomy = readFileSync(join(import.meta.dirname, 'taxonomy.ts'), 'utf8');
    assert.match(taxonomy, /productionActivated: false as const/);
    assert.match(taxonomy, /mintsSunReyCoin: false as const/);
    assert.match(taxonomy, /mintsMoonReyCoin: false as const/);
    assert.match(taxonomy, /fixedSunReyMoonReyRatio: false as const/);
    assert.match(taxonomy, /entitlementIsTransferableMoney: false as const/);
    assert.match(taxonomy, /storesCompetingBalanceLedger: false as const/);
  });

  it('delegates capacity auction clearing to the canonical auction module', () => {
    const world = createCapacityAccessSandbox();
    const auctionSource = readFileSync(join(import.meta.dirname, 'auction.ts'), 'utf8');
    assert.match(auctionSource, /from '\.\.\/auction\.ts'/);

    const terms = world.terms({ termsId: 'terms:auction', quantity: 900n });
    let book = openCapacityAuction({
      auctionId: 'xauc:capacity',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      terms,
      openHeight: 100n,
      closeHeight: 200n,
    });
    book = submitCapacityAuctionOrder(
      book,
      capacityAuctionOrder({
        orderId: 'xord:bid',
        exchangeAccountId: BUYER,
        marketId: CAPACITY_ACCESS_MARKET_ID,
        terms,
        side: 'BUY',
        quantity: 500n,
        limitPrice: world.unitPrice({ priceUnits: 300n }),
        actorClass: 'INSTITUTION',
        jurisdiction: SIMULATION_JURISDICTION,
        sequence: 1,
      }),
      120n,
    );
    book = submitCapacityAuctionOrder(
      book,
      capacityAuctionOrder({
        orderId: 'xord:offer',
        exchangeAccountId: PROVIDER,
        marketId: CAPACITY_ACCESS_MARKET_ID,
        terms,
        side: 'SELL',
        quantity: 500n,
        limitPrice: world.unitPrice({ priceUnits: 250n }),
        actorClass: 'INSTITUTION',
        jurisdiction: SIMULATION_JURISDICTION,
        sequence: 2,
      }),
      121n,
    );

    const cleared = clearCapacityAuction(book);
    assert.equal(cleared.allocated.length, 1);
    assert.equal(cleared.clearingPrice?.priceUnits, 250n);
    assert.equal(cleared.tieBreak, 'PRICE_THEN_SEQUENCE');
    assert.throws(() => submitCapacityAuctionOrder(book, book.bids[0]!, 500n), /not accepting orders/);
  });

  it('allocates a queue market by priority then arrival sequence', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({ termsId: 'terms:queue', quantity: 300n });
    const allocation = allocateCapacityQueue({
      queueId: 'queue:grid',
      availableQuantity: 250n,
      tickets: [
        enqueueCapacityRequest({
          ticketId: 'tkt:standard',
          queueId: 'queue:grid',
          requesterAccountId: BUYER,
          terms,
          requestedQuantity: 200n,
          priorityClass: 'STANDARD',
          sequence: 1,
        }),
        enqueueCapacityRequest({
          ticketId: 'tkt:critical',
          queueId: 'queue:grid',
          requesterAccountId: BUYER,
          terms,
          requestedQuantity: 150n,
          priorityClass: 'CRITICAL_SERVICE',
          sequence: 2,
        }),
      ],
    });

    assert.deepEqual(
      allocation.allocated.map((row) => [row.ticketId, row.quantity]),
      [
        ['tkt:critical', 150n],
        ['tkt:standard', 100n],
      ],
    );
    assert.equal(allocation.unallocatedQuantity, 0n);
    assert.deepEqual(allocation.unservedTicketIds, ['tkt:standard']);
    assert.equal(allocation.rationing, 'PRIORITY_THEN_SEQUENCE');
  });

  it('takes a fixed-price access offer without inventing a price', () => {
    const world = createCapacityAccessSandbox();
    const terms = world.terms({ termsId: 'terms:offer' });
    const offer = openFixedPriceAccessOffer({
      offerId: 'offer:capacity',
      listingId: 'listing:capacity',
      marketId: CAPACITY_ACCESS_MARKET_ID,
      providerAccountId: PROVIDER,
      terms,
      unitPrice: world.unitPrice(),
      offeredQuantity: 1_000n,
      minimumTakeQuantity: 100n,
      at: world.now,
    });

    const tooSmall = takeFixedPriceAccessOffer(offer, 50n);
    assert.equal(tooSmall.ok, false);
    const taken = takeFixedPriceAccessOffer(offer, 400n);
    assert.equal(taken.ok, true);
    assert.ok(taken.ok);
    assert.equal(taken.offer.state, 'PARTIALLY_TAKEN');
    assert.equal(taken.unitPrice.priceUnits, offer.unitPrice.priceUnits);
    const exhausted = takeFixedPriceAccessOffer(taken.offer, 600n);
    assert.ok(exhausted.ok);
    assert.equal(exhausted.offer.state, 'EXHAUSTED');
    assert.equal(takeFixedPriceAccessOffer(exhausted.offer, 1n).ok, false);
  });
});
