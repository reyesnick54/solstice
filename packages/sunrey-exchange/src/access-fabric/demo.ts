import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { asExchangeAccountId } from '../ids.ts';
import { clearCapacityAuction, capacityAuctionOrder, openCapacityAuction, submitCapacityAuctionOrder } from './auction.ts';
import { fiatConsiderationFor, openFixedPriceAccessOffer, takeFixedPriceAccessOffer } from './offers.ts';
import { allocateCapacityQueue, enqueueCapacityRequest } from './queue.ts';
import { awardCapacityRfq, evaluateCapacityQuote, openCapacityRfq, submitCapacityQuote } from './rfq.ts';
import { refundableByDenomination } from './refunds.ts';
import {
  CAPACITY_ACCESS_MARKET_ID,
  COMPUTE_ACCESS_MARKET_ID,
  FACILITY_HOUR_UNIT,
  FORBIDDEN_JURISDICTION,
  SIMULATION_JURISDICTION,
  createCapacityAccessSandbox,
} from './sandbox.ts';
import { ACCESS_FABRIC_POSTURE } from './taxonomy.ts';

function line(label: string, value: unknown): void {
  console.log(`${label.padEnd(42)} ${String(value)}`);
}

const world = createCapacityAccessSandbox();
const buyer = asExchangeAccountId('xacct_buyer_capacity');
const provider = asExchangeAccountId('xacct_provider_capacity');

console.log('== SunRey Exchange capacity access fabric (ACCESS-09, simulation) ==');
line('production activated', ACCESS_FABRIC_POSTURE.productionActivated);
line('fixed SunRey/MoonRey ratio', ACCESS_FABRIC_POSTURE.fixedSunReyMoonReyRatio);
line('stores competing balance ledger', ACCESS_FABRIC_POSTURE.storesCompetingBalanceLedger);

console.log('\n-- productive capacity discovery --');
const listedTerms = world.terms({ termsId: 'terms:northline-week-35', quantity: 1_000n });
world.engine.discovery.publish({
  listingId: 'listing:northline-week-35',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  mechanism: 'FIXED_PRICE_OFFER',
  terms: listedTerms,
  offeredQuantity: 1_000n,
  indicativeUnitPrice: world.unitPrice(),
  at: world.now,
});
const discovered = world.engine.discovery.search({
  productiveCategory: 'MANUFACTURING',
  unit: FACILITY_HOUR_UNIT,
  deliveryLocation: 'GB-MAN',
  jurisdiction: SIMULATION_JURISDICTION,
});
line('listings discovered', discovered.length);
line('target productive object', discovered[0]?.terms.productiveObject.objectId);
line('backing productive claim', discovered[0]?.terms.productiveObject.claimId);
line('canonical unit', discovered[0]?.terms.unit);
line(
  'availability window',
  `${discovered[0]?.terms.availabilityWindow.startHeight}..${discovered[0]?.terms.availabilityWindow.endHeight}`,
);
line(
  'forbidden jurisdiction discovery',
  world.engine.discovery.search({ jurisdiction: FORBIDDEN_JURISDICTION }).length,
);

console.log('\n-- fixed-price access offer --');
const offer = openFixedPriceAccessOffer({
  offerId: 'offer:northline-week-35',
  listingId: 'listing:northline-week-35',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  providerAccountId: provider,
  terms: listedTerms,
  unitPrice: world.unitPrice(),
  offeredQuantity: 1_000n,
  at: world.now,
});
const take = takeFixedPriceAccessOffer(offer, 400n);
line('offer take accepted', take.ok);
const dueFiat = fiatConsiderationFor({
  unitPrice: offer.unitPrice,
  quantity: 400n,
  unit: FACILITY_HOUR_UNIT,
  currency: 'USD',
});
line('fiat consideration (minor units)', dueFiat.minorUnits);

console.log('\n-- fiat reservation on the canonical Ledger --');
world.seedFiat('acct_buyer_usd', 1_000_000n);
const fiatAuthority = world.issueSettlementAuthority('acct_buyer_usd', 'access.northline.week35');
const reserved = world.engine.reserveCapacity({
  reservationId: 'ares:northline-week-35',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  mechanism: 'FIXED_PRICE_OFFER',
  instrument: world.capacityListing,
  terms: listedTerms,
  buyerAccountId: buyer,
  providerAccountId: provider,
  reservedQuantity: 400n,
  unitPrice: offer.unitPrice,
  consideration: [
    {
      kind: 'FIAT',
      amount: dueFiat,
      payerCashAccountId: 'acct_buyer_usd',
      payerOwnerId: 'owner_buyer',
      payeeCashAccountId: 'acct_provider_usd',
      payeeOwnerId: 'owner_provider',
      reservationCashAccountId: 'acct_reservation_pending_usd',
    },
  ],
  actor: world.actorContext(),
  height: 120n,
  authority: fiatAuthority,
  listingId: 'listing:northline-week-35',
  at: world.now,
});
line('reservation state', reserved.reservation.state);
line('clearing outcome', reserved.receipt?.outcome);
line('fiat rail', reserved.receipt?.legs[0]?.rail);
line('ledger journal recorded', Boolean(reserved.receipt?.legs[0]?.journalId));
line('listing committed quantity', world.engine.discovery.get('listing:northline-week-35')?.committedQuantity);

console.log('\n-- partial delivery, exact capture and remainder refund --');
const captureAuthority = world.issueSettlementAuthority(
  'acct_reservation_pending_usd',
  'access.northline.week35.settle',
);
const delivery = world.engine.recordDelivery({
  reservationId: 'ares:northline-week-35',
  evidenceId: 'aev:northline-week-35-1',
  deliveredQuantity: 300n,
  quality: 'FINALIZED',
  oracleFactIds: ['fact:northline-line-7-output-2026w35'],
  productiveClaimId: 'pclm:northline-line-7-delivery-2026w35',
  authority: captureAuthority,
  at: world.now,
});
line('reservation state', delivery.reservation.state);
line('delivered quantity', delivery.reservation.deliveredQuantity);
line('capture outcome', delivery.captureReceipt?.outcome);
line('remainder refund reason', delivery.refundIntent?.reason);
line(
  'remainder refundable',
  delivery.refundIntent ? JSON.stringify(refundableByDenomination(delivery.refundIntent).map((row) => `${row.units} ${row.denomination}`)) : 'none',
);
line('refund is compensating', delivery.refundIntent?.compensating);
line('refund edits original posting', delivery.refundIntent?.editsOriginalPosting);
line('ledger journals posted', world.ledger.journalCount());

console.log('\n-- MoonRey-denominated productive settlement (simulation) --');
const computeTerms = world.computeTerms({ termsId: 'terms:helios-week-35', quantity: 10_000n });
world.seedNative('vault_buyer_moonrey', 'MOONREY_COIN', 5_000_000n);
const moonreyAuthority = world.issueSettlementAuthority('acct_buyer_moonrey', 'access.helios.week35');
const moonreyReserved = world.engine.reserveCapacity({
  reservationId: 'ares:helios-week-35',
  marketId: COMPUTE_ACCESS_MARKET_ID,
  mechanism: 'FIXED_PRICE_OFFER',
  instrument: world.computeListing,
  terms: computeTerms,
  buyerAccountId: buyer,
  providerAccountId: provider,
  reservedQuantity: 10_000n,
  unitPrice: world.nativeUnitPrice(),
  consideration: [
    {
      kind: 'MOONREY_COIN',
      amount: AssetQuantity.fromScaledUnits(400_000n, 'MOONREY_COIN'),
      rail: 'NATIVE_CHAIN',
      payerRef: 'vault_buyer_moonrey',
      payeeRef: 'vault_provider_moonrey',
      payerVaultId: null,
      payeeVaultId: null,
    },
  ],
  actor: world.actorContext({
    purpose: 'MODEL_TRAINING',
    geography: 'GB-LON',
    access: 'MACHINE_ALLOWED',
  }),
  height: 500n,
  authority: moonreyAuthority,
  at: world.now,
});
line('reservation state', moonreyReserved.reservation.state);
line('refusal codes', moonreyReserved.decision.refusalCodes.join(',') || 'none');
line('native rail', moonreyReserved.receipt?.legs[0]?.rail);
line('receipt mints coin', moonreyReserved.receipt?.mintsCoin);
line('receipt production activated', moonreyReserved.receipt?.productionActivated);

console.log('\n-- entitlement-only reservation (no money moves) --');
const journalsBeforeEntitlement = world.ledger.journalCount();
world.entitlements.grant({
  entitlementId: 'ent:northline-included-hours',
  holderId: 'owner_buyer',
  unit: FACILITY_HOUR_UNIT,
  units: 500n,
});
const entitlementReserved = world.engine.reserveCapacity({
  reservationId: 'ares:northline-entitlement',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  mechanism: 'QUEUE_ALLOCATION',
  instrument: world.capacityListing,
  terms: listedTerms,
  buyerAccountId: buyer,
  providerAccountId: provider,
  reservedQuantity: 200n,
  unitPrice: offer.unitPrice,
  consideration: [
    {
      kind: 'ACCESS_ENTITLEMENT',
      entitlementId: 'ent:northline-included-hours',
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
line('reservation state', entitlementReserved.reservation.state);
line('authority required', entitlementReserved.decision.authorityRequired);
line('entitlement rail', entitlementReserved.receipt?.legs[0]?.rail);
line('ledger journals added', world.ledger.journalCount() - journalsBeforeEntitlement);
line(
  'entitlement units left at owner',
  world.entitlements.grantedUnits({
    entitlementId: 'ent:northline-included-hours',
    holderId: 'owner_buyer',
    unit: FACILITY_HOUR_UNIT,
  }),
);

console.log('\n-- forbidden jurisdiction refusal --');
const refused = world.engine.reserveCapacity({
  reservationId: 'ares:northline-forbidden',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  mechanism: 'FIXED_PRICE_OFFER',
  instrument: world.capacityListing,
  terms: listedTerms,
  buyerAccountId: buyer,
  providerAccountId: provider,
  reservedQuantity: 100n,
  unitPrice: offer.unitPrice,
  consideration: [
    {
      kind: 'FIAT',
      amount: Money.fromMinorUnits(25_000n, 'USD'),
      payerCashAccountId: 'acct_buyer_usd',
      payerOwnerId: 'owner_buyer',
      payeeCashAccountId: 'acct_provider_usd',
      payeeOwnerId: 'owner_provider',
      reservationCashAccountId: 'acct_reservation_pending_usd',
    },
  ],
  actor: world.actorContext({ jurisdiction: FORBIDDEN_JURISDICTION }),
  height: 120n,
  authority: world.issueSettlementAuthority('acct_buyer_usd', 'access.northline.forbidden'),
  at: world.now,
});
line('reservation state', refused.reservation.state);
line('refusal codes', refused.decision.refusalCodes.join(','));
line('clearing attempted', refused.receipt !== null);

console.log('\n-- RFQ: regulatory compatibility filters before ranking --');
const rfq = openCapacityRfq({
  rfqId: 'rfq:northline-week-36',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  buyerAccountId: buyer,
  terms: world.terms({ termsId: 'terms:northline-week-36', quantity: 600n }),
  closesAtHeight: 180n,
  at: world.now,
});
const cheapButForbidden = submitCapacityQuote(
  rfq,
  {
    quoteId: 'quote:offshore',
    rfqId: rfq.rfqId,
    providerAccountId: provider,
    providerId: 'provider:offshore-works',
    unitPrice: world.unitPrice({ priceUnits: 100n }),
    offeredQuantity: 600n,
    consideration: 'FIAT',
    deliverableWindow: { startHeight: 100n, endHeight: 200n, startAt: null, endAt: null },
    sequence: 1,
    submittedAtHeight: 150n,
  },
  150n,
);
const permittedQuote = submitCapacityQuote(
  rfq,
  {
    quoteId: 'quote:northline',
    rfqId: rfq.rfqId,
    providerAccountId: provider,
    providerId: 'provider:northline-works',
    unitPrice: world.unitPrice({ priceUnits: 260n }),
    offeredQuantity: 600n,
    consideration: 'FIAT',
    deliverableWindow: { startHeight: 100n, endHeight: 200n, startAt: null, endAt: null },
    sequence: 2,
    submittedAtHeight: 151n,
  },
  151n,
);
const award = awardCapacityRfq({
  rfq,
  quotes: [cheapButForbidden, permittedQuote],
  evaluations: [
    evaluateCapacityQuote({
      rfq,
      quote: cheapButForbidden,
      providerJurisdiction: FORBIDDEN_JURISDICTION,
      providerCapabilities: [],
      providerVerified: true,
    }),
    evaluateCapacityQuote({
      rfq,
      quote: permittedQuote,
      providerJurisdiction: SIMULATION_JURISDICTION,
      providerCapabilities: [],
      providerVerified: true,
    }),
  ],
});
line('cheapest quote', 'quote:offshore (100 minor units)');
line('awarded quote', award.awardedQuoteId);
line('filtered out', award.filteredOut.map((row) => `${row.quoteId}:${row.refusalCodes.join('/')}`).join(','));

console.log('\n-- batch auction on canonical clearing --');
const auctionTerms = world.terms({ termsId: 'terms:northline-week-37', quantity: 900n });
let book = openCapacityAuction({
  auctionId: 'xauc:northline-week-37',
  marketId: CAPACITY_ACCESS_MARKET_ID,
  terms: auctionTerms,
  openHeight: 100n,
  closeHeight: 200n,
});
book = submitCapacityAuctionOrder(
  book,
  capacityAuctionOrder({
    orderId: 'xord:bid-1',
    exchangeAccountId: buyer,
    marketId: CAPACITY_ACCESS_MARKET_ID,
    terms: auctionTerms,
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
    orderId: 'xord:offer-1',
    exchangeAccountId: provider,
    marketId: CAPACITY_ACCESS_MARKET_ID,
    terms: auctionTerms,
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
line('allocations', cleared.allocated.length);
line('uniform clearing price', cleared.clearingPrice?.priceUnits);

console.log('\n-- queue allocation market --');
const queueTerms = world.terms({ termsId: 'terms:grid-slots', quantity: 300n });
const allocation = allocateCapacityQueue({
  queueId: 'queue:grid-interconnect',
  availableQuantity: 250n,
  tickets: [
    enqueueCapacityRequest({
      ticketId: 'tkt:standard',
      queueId: 'queue:grid-interconnect',
      requesterAccountId: buyer,
      terms: queueTerms,
      requestedQuantity: 200n,
      priorityClass: 'STANDARD',
      sequence: 1,
    }),
    enqueueCapacityRequest({
      ticketId: 'tkt:critical',
      queueId: 'queue:grid-interconnect',
      requesterAccountId: buyer,
      terms: queueTerms,
      requestedQuantity: 150n,
      priorityClass: 'CRITICAL_SERVICE',
      sequence: 2,
    }),
  ],
});
line('first allocation', `${allocation.allocated[0]?.ticketId} ${allocation.allocated[0]?.quantity}`);
line('second allocation', `${allocation.allocated[1]?.ticketId} ${allocation.allocated[1]?.quantity}`);
line('unallocated', allocation.unallocatedQuantity);
line('rationing', allocation.rationing);

console.log('\ncapacity access fabric demo: ok');
