import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../sunrey-coin/src/simulation-catalog.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import {
  InMemoryCleanRoomPort,
  InMemoryCoinPort,
  InMemoryConsentPort,
  InMemoryFiatPort,
  InMemoryMachineCapabilityPort,
  InMemoryOraclePort,
  InMemoryProductiveGraphPort,
} from './adapters.ts';
import { runExchangeCommand } from './cli.ts';
import {
  GPU_COMPUTE_MARKET_ID,
  INFORMATION_RIGHT_MARKET_ID,
  MANUFACTURING_CAPACITY_MARKET_ID,
  MOONREY_COIN_ASSET_ID,
  SUNREY_COIN_USD_MARKET_ID,
  asExchangeAccountId,
} from './ids.ts';
import { SimulationNativeDvpAdapter } from './native-settlement.ts';
import { exchangePrice } from './price.ts';
import { SunReyExchangeService } from './service.ts';
import type { ExchangeAccount } from './types.ts';
import { moonreyPrice } from './universal.ts';

const NOW = asUtcInstant('2026-08-16T16:30:00.000Z');
const GB = asJurisdiction('GB');

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
      refreshBy: asUtcInstant('2027-08-16T16:30:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
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
  const issuer = new AuthorityIssuer('universal-exchange-demo');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
  const consent = new InMemoryConsentPort();
  const machines = new InMemoryMachineCapabilityPort();
  const productive = new InMemoryProductiveGraphPort();
  const exchange = new SunReyExchangeService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: { get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined) },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
    coin,
    fiat,
    consent,
    cleanRoom: new InMemoryCleanRoomPort(),
    oracle: new InMemoryOraclePort(),
    productive,
    machines,
  });

  const sellerCust = customer('cust_demo_seller');
  const buyerCust = customer('cust_demo_buyer');
  customers.set(sellerCust.id, sellerCust);
  customers.set(buyerCust.id, buyerCust);
  for (const [actorId, identityId, cust] of [
    ['actor_demo_seller', 'idn_demo_seller', sellerCust],
    ['actor_demo_buyer', 'idn_demo_buyer', buyerCust],
  ] as const) {
    const provisioned = identity.provisionSimulatedActor({
      actorId,
      jurisdiction: GB,
      identityId,
      customerId: cust.id,
      capabilities: ['EXCHANGE_VIEW', 'EXCHANGE_OPERATE_REQUEST', 'SUNREY_COIN_VIEW'] as never,
    });
    if (!provisioned.ok) {
      throw new Error(provisioned.error.message);
    }
  }

  coin.seed(sellerCust.id, AssetQuantity.fromScaledUnits(10_000_000n, SUNREY_COIN_ASSET_ID), 'custody_demo_s');
  fiat.seed('cash_demo_b', Money.fromMinorUnits(50_00n, 'USD'));
  const sellerAccount = requireOk<ExchangeAccount>(
    exchange.openExchangeAccount({
      actorId: 'actor_demo_seller',
      customerId: sellerCust.id,
      identityId: 'idn_demo_seller',
      jurisdiction: GB,
      custodyAccountId: 'custody_demo_s',
      cashAccountId: 'cash_demo_s',
    }),
    'open seller',
  );
  const buyerAccount = requireOk<ExchangeAccount>(
    exchange.openExchangeAccount({
      actorId: 'actor_demo_buyer',
      customerId: buyerCust.id,
      identityId: 'idn_demo_buyer',
      jurisdiction: GB,
      custodyAccountId: 'custody_demo_b',
      cashAccountId: 'cash_demo_b',
    }),
    'open buyer',
  );

  requireOk(
    exchange.placeDigitalOrder({
      actorId: 'actor_demo_seller',
      customerId: sellerCust.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: AssetQuantity.fromScaledUnits(4_000_000n, SUNREY_COIN_ASSET_ID),
      limitPrice: exchangePrice({
        baseAssetId: SUNREY_COIN_ASSET_ID,
        quoteAssetId: 'USD',
        quoteKind: 'FIAT_MONEY',
        priceUnits: 200n,
        basePrecision: 6,
      }),
      clientIdempotencyKey: 'demo-digital-sell',
    }),
    'digital sell',
  );
  requireOk(
    exchange.placeDigitalOrder({
      actorId: 'actor_demo_buyer',
      customerId: buyerCust.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: AssetQuantity.fromScaledUnits(4_000_000n, SUNREY_COIN_ASSET_ID),
      limitPrice: exchangePrice({
        baseAssetId: SUNREY_COIN_ASSET_ID,
        quoteAssetId: 'USD',
        quoteKind: 'FIAT_MONEY',
        priceUnits: 200n,
        basePrecision: 6,
      }),
      clientIdempotencyKey: 'demo-digital-buy',
    }),
    'digital buy',
  );
  const native = new SimulationNativeDvpAdapter();
  native.seed('sunrey-seller', AssetQuantity.fromScaledUnits(5_000_000n, SUNREY_COIN_ASSET_ID));
  native.seed('moonrey-buyer', AssetQuantity.fromScaledUnits(1_000n, MOONREY_COIN_ASSET_ID));
  const dvp = native.atomicDeliveryVersusPayment({
    assetSender: 'sunrey-seller',
    assetRecipient: 'moonrey-buyer',
    assetAmount: AssetQuantity.fromScaledUnits(2_000_000n, SUNREY_COIN_ASSET_ID),
    contraSender: 'moonrey-buyer',
    contraRecipient: 'sunrey-seller',
    contraAmount: AssetQuantity.fromScaledUnits(400n, MOONREY_COIN_ASSET_ID),
  });
  if (!dvp.ok) {
    throw new Error(dvp.error.message);
  }

  machines.grant('ai-buyer', 'PURCHASE_COMPUTE');
  requireOk(
    exchange.universal.listComputeCapacity({
      providerAccountId: asExchangeAccountId('xacct_gpu_demo'),
      quantity: 1_000n,
      unitPrice: moonreyPrice(2n, 'GPU_SECOND'),
      jurisdiction: GB,
    }),
    'list gpu',
  );
  requireOk(
    exchange.universal.buyCompute({
      buyerAccountId: asExchangeAccountId('xacct_ai_demo'),
      quantity: 300n,
      unitPrice: moonreyPrice(2n, 'GPU_SECOND'),
      jurisdiction: GB,
      machineId: 'ai-buyer',
    }),
    'buy gpu',
  );
  const compute = exchange.universal.latestComputeContract();
  if (!compute) {
    throw new Error('compute contract missing');
  }
  requireOk(
    exchange.universal.settleComputeDelivery({ contractId: compute.contractId, delivered: 270n }),
    'compute partial',
  );

  exchange.universal.setHeight(150n);
  requireOk(
    exchange.universal.offerCapacity({
      providerAccountId: asExchangeAccountId('xacct_factory_demo'),
      quantity: 1_000n,
      limitPrice: moonreyPrice(5n, 'MANUFACTURED_UNIT'),
      jurisdiction: GB,
    }),
    'capacity offer',
  );
  requireOk(
    exchange.universal.bidCapacity({
      buyerAccountId: asExchangeAccountId('xacct_capacity_demo'),
      quantity: 400n,
      limitPrice: moonreyPrice(6n, 'MANUFACTURED_UNIT'),
      jurisdiction: GB,
    }),
    'capacity bid',
  );
  const cleared = requireOk(
    exchange.universal.clearCapacityAuction(),
    'capacity auction',
  ) as { contract: { contractId: string } };
  requireOk(
    exchange.universal.settleCapacityDelivery({ contractId: cleared.contract.contractId, delivered: 400n }),
    'capacity settle',
  );
  if (!productive.hasReference('object:factory-line-1', cleared.contract.contractId)) {
    throw new Error('productive graph missing capacity reference');
  }

  consent.grant({
    consentRef: 'consent:cohort-aggregate-v1',
    subjectOrCohortRef: 'cohort:consent-qualified-sim',
    purpose: 'AGGREGATED_RESEARCH',
    recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
  });
  requireOk(
    exchange.universal.listInformationRight({
      sellerAccountId: asExchangeAccountId('xacct_steward_demo'),
      consentRef: 'consent:cohort-aggregate-v1',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    }),
    'list right',
  );
  requireOk(
    exchange.universal.buyInformationRight({
      buyerAccountId: asExchangeAccountId('xacct_research_demo'),
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    }),
    'buy right',
  );
  const right = exchange.universal.latestInformationContract();
  if (!right) {
    throw new Error('information-right contract missing');
  }
  const output = requireOk(
    exchange.universal.deliverInformationRight({
      contractId: right.contractId,
      requesterId: 'research-demo',
    }),
    'deliver right',
  ) as { rawRows: false; rawPayload: null };
  if (output.rawRows !== false || output.rawPayload !== null) {
    throw new Error('raw rows leaked');
  }

  const cli = runExchangeCommand(exchange, ['markets']);
  if (!cli.ok) {
    throw new Error('cli markets failed');
  }

  console.log(
    JSON.stringify(
      {
        families: ['DIGITAL_ASSET', 'HUMAN_INFORMATION_RIGHT', 'INTELLIGENCE_COMPUTE', 'PRODUCTIVE_CAPACITY'],
        digital: {
          marketId: SUNREY_COIN_USD_MARKET_ID,
          trades: exchange.trades(SUNREY_COIN_USD_MARKET_ID).length,
          last: exchange.marketData(SUNREY_COIN_USD_MARKET_ID).lastPriceLabel,
          nativeDvp: true,
        },
        compute: {
          marketId: GPU_COMPUTE_MARKET_ID,
          ordered: 300,
          delivered: 270,
          paid: 540,
        },
        capacity: {
          marketId: MANUFACTURING_CAPACITY_MARKET_ID,
          cleared: 400,
          graphReferenced: true,
          doubleCounted: false,
        },
        information: {
          marketId: INFORMATION_RIGHT_MARKET_ID,
          rawRows: false,
          purpose: 'AGGREGATED_RESEARCH',
        },
      },
      null,
      2,
    ),
  );
}

await main();
