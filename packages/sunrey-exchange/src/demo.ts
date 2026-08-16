import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import type { VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import {
  InMemoryCoinPort,
  InMemoryFiatPort,
  RecordingChainAnchorPort,
  StubInformationMarketPort,
} from './adapters.ts';
import { SubjectScopedSunReyExchangeTool } from './agent-tool.ts';
import { AGGREGATE_RESEARCH_LISTING_ID, SUNREY_COIN_USD_MARKET_ID } from './ids.ts';
import { exchangePrice } from './price.ts';
import { SunReyExchangeService } from './service.ts';
import { PRICE_LABEL } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const GB = asJurisdiction('GB');
const CAPS = ['EXCHANGE_VIEW', 'EXCHANGE_OPERATE_REQUEST', 'SUNREY_COIN_VIEW'] as const;

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-15T16:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
}

function coins(whole: bigint): AssetQuantity {
  return AssetQuantity.fromScaledUnits(whole * 1_000_000n, SUNREY_COIN_ASSET_ID);
}

function usdPerCoin(cents: bigint) {
  return exchangePrice({
    baseAssetId: SUNREY_COIN_ASSET_ID,
    quoteAssetId: 'USD',
    quoteKind: 'FIAT_MONEY',
    priceUnits: cents,
    basePrecision: 6,
  });
}

function provision(
  identity: SimulatedIdentityAdapter,
  actorId: string,
  identityId: string,
  customerId: string,
): VerifiedActorContext {
  const result = identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: asCustomerId(customerId),
    capabilities: [...CAPS] as never,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function requireOk<T>(outcome: { outcome: string } & Record<string, unknown>, label: string): T {
  if (outcome.outcome !== 'OK') {
    throw new Error(`${label} failed: ${JSON.stringify(outcome)}`);
  }
  return outcome.value as T;
}

async function main(): Promise<void> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('sunrey-exchange-demo');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
  const chain = new RecordingChainAnchorPort();
  const exchange = new SunReyExchangeService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    coin,
    fiat,
    informationMarket: new StubInformationMarketPort(),
    chain,
  });

  const sellerCust = customer('cust_exchange_a');
  const buyerCust = customer('cust_exchange_b');
  customers.set(sellerCust.id, sellerCust);
  customers.set(buyerCust.id, buyerCust);
  const seller = provision(identity, 'actor_exchange_a', 'idn_exchange_a', sellerCust.id);
  const buyer = provision(identity, 'actor_exchange_b', 'idn_exchange_b', buyerCust.id);

  coin.seed(sellerCust.id, coins(10n), 'custody_a');
  fiat.seed('cash_b', Money.fromMinorUnits(50_00n, 'USD'));

  const sellerAccount = requireOk<{ accountId: string }>(
    exchange.openExchangeAccount({
      actorId: seller.actorId,
      customerId: sellerCust.id,
      identityId: seller.subjectId,
      jurisdiction: GB,
      custodyAccountId: 'custody_a',
      cashAccountId: 'cash_a',
    }),
    'open seller',
  );
  const buyerAccount = requireOk<{ accountId: string }>(
    exchange.openExchangeAccount({
      actorId: buyer.actorId,
      customerId: buyerCust.id,
      identityId: buyer.subjectId,
      jurisdiction: GB,
      custodyAccountId: 'custody_b',
      cashAccountId: 'cash_b',
    }),
    'open buyer',
  );

  const supplyBefore = coin.supply().circulating.scaledUnits;
  const sell = requireOk<{ orderId: string; remaining: AssetQuantity; status: string }>(
    exchange.placeDigitalOrder({
      actorId: seller.actorId,
      customerId: sellerCust.id,
      exchangeAccountId: sellerAccount.accountId as never,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(10n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'demo-sell-10-200',
    }),
    'sell 10 @ 2.00',
  );
  const buy = requireOk<{ orderId: string; status: string }>(
    exchange.placeDigitalOrder({
      actorId: buyer.actorId,
      customerId: buyerCust.id,
      exchangeAccountId: buyerAccount.accountId as never,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(6n),
      limitPrice: usdPerCoin(210n),
      clientIdempotencyKey: 'demo-buy-6-210',
    }),
    'buy 6 @ 2.10',
  );

  const trade = exchange.trades(SUNREY_COIN_USD_MARKET_ID)[0];
  if (!trade) {
    throw new Error('expected one trade');
  }
  const remainder = exchange.getOrder(sell.orderId);
  const cancelled = requireOk<{ status: string }>(
    exchange.cancelDigitalOrder({
      actorId: seller.actorId,
      customerId: sellerCust.id,
      orderId: sell.orderId as never,
      clientIdempotencyKey: 'demo-cancel-remainder',
    }),
    'cancel remainder',
  );
  const data = exchange.marketData(SUNREY_COIN_USD_MARKET_ID);
  const report = exchange.reconcile();
  const compute = requireOk<{ rawRows: false; receiptId: string }>(
    exchange.acceptComputeContract({
      actorId: buyer.actorId,
      listingId: AGGREGATE_RESEARCH_LISTING_ID,
      sponsorCustomerId: buyerCust.id,
    }),
    'compute contract',
  );
  const tool = new SubjectScopedSunReyExchangeTool(exchange);
  const agentPlace = tool.placeDigitalOrder();

  console.log('SunRey Exchange simulation demo');
  console.log(`  market: ${SUNREY_COIN_USD_MARKET_ID}`);
  console.log(`  seller opened ${sellerAccount.accountId} (no stored balance)`);
  console.log(`  buyer opened ${buyerAccount.accountId}`);
  console.log(`  sell 10 @ 2.00 -> ${sell.status}`);
  console.log(`  buy 6 @ 2.10 -> ${buy.status}`);
  console.log(`  trade quantity ${trade.quantity.scaledUnits} at maker ${trade.price.priceUnits} cents = ${trade.quoteAmount.minorUnits} USD cents`);
  console.log(`  price label: ${PRICE_LABEL}`);
  console.log(`  seller remainder before cancel: ${remainder?.remaining.scaledUnits ?? 'missing'}`);
  console.log(`  remainder cancel: ${cancelled.status}`);
  console.log(`  coin supply before/after: ${supplyBefore} / ${coin.supply().circulating.scaledUnits}`);
  console.log(`  buyer coin available: ${coin.position(buyerCust.id).available.scaledUnits}`);
  console.log(`  seller coin available after cancel: ${coin.position(sellerCust.id).available.scaledUnits}`);
  console.log(`  seller cash: ${fiat.available('cash_a').minorUnits} cents`);
  console.log(`  fees: maker ${exchange.feeSchedule.makerFeeMinor} taker ${exchange.feeSchedule.takerFeeMinor} (${exchange.feeSchedule.commercialPermanence})`);
  console.log(`  last price label: ${data.lastPriceLabel}`);
  console.log(`  chain anchor authoritative: ${chain.anchors[0]?.authoritative ?? 'none'}`);
  console.log(`  reconciliation: ${report.outcome} autoCorrected=${report.autoCorrected}`);
  console.log(`  compute rawRows: ${compute.rawRows} receipt=${compute.receiptId}`);
  console.log(`  agent place refused: ${!agentPlace.ok}`);
  console.log(`  evidence records: ${evidence.list().length}`);
  console.log(`  events: ${events.list().length}`);
}

await main();
