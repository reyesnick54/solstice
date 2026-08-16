import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

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
import { observeFamilyMarket } from './family-surveillance.ts';
import {
  InMemoryCleanRoomPort,
  InMemoryCoinPort,
  InMemoryConsentPort,
  InMemoryFiatPort,
  InMemoryMachineCapabilityPort,
  InMemoryOraclePort,
  InMemoryProductiveGraphPort,
} from './adapters.ts';
import { clearAuction, openAuction } from './auction.ts';
import { runExchangeCommand } from './cli.ts';
import { evaluateEligibility } from './eligibility.ts';
import {
  GPU_COMPUTE_MARKET_ID,
  INFORMATION_RIGHT_MARKET_ID,
  MANUFACTURING_CAPACITY_MARKET_ID,
  MOONREY_COIN_ASSET_ID,
  SUNREY_COIN_USD_MARKET_ID,
  SUNREY_MOONREY_MARKET_ID,
  asExchangeAccountId,
} from './ids.ts';
import { evaluateListingGovernance, informationRightInstrument } from './instruments.ts';
import { matchIncoming } from './matching.ts';
import { SimulationNativeDvpAdapter } from './native-settlement.ts';
import { exchangePrice, quoteForQuantity } from './price.ts';
import { DEFAULT_RISK_LIMITS, emptyRiskUsage, evaluateRiskLimits } from './risk-limits.ts';
import { SunReyExchangeService } from './service.ts';
import { settlePartialDelivery, openEscrow } from './settlement-extended.ts';
import { ContractTemplateRegistry } from './templates.ts';
import { CANONICAL_MARKET_FAMILIES, MARKET_ACCESS_POLICIES } from './taxonomy.ts';
import { moonreyPrice, UniversalExchangeEngine } from './universal.ts';
import type { DigitalOrder } from './types.ts';
import type { UniversalOrder } from './types-universal.ts';

const NOW = asUtcInstant('2026-08-16T16:00:00.000Z');
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
      refreshBy: asUtcInstant('2027-08-16T16:00:00.000Z'),
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

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer('sunrey-exchange-universal-test');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const customers = new Map<string, Customer>();
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
  const consent = new InMemoryConsentPort();
  const cleanRoom = new InMemoryCleanRoomPort();
  const oracle = new InMemoryOraclePort();
  const productive = new InMemoryProductiveGraphPort();
  const machines = new InMemoryMachineCapabilityPort();
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
    consent,
    cleanRoom,
    oracle,
    productive,
    machines,
  });
  return { clock, exchange, customers, identity, coin, fiat, consent, cleanRoom, oracle, productive, machines };
}

function provision(h: ReturnType<typeof harness>, actorId: string, identityId: string, customerId: string) {
  const cust = customer(customerId);
  h.customers.set(cust.id, cust);
  const result = h.identity.provisionSimulatedActor({
    actorId,
    jurisdiction: GB,
    identityId,
    customerId: cust.id,
    capabilities: [...CAPS] as never,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return { customer: cust, actor: result.value };
}

function openExchange(
  h: ReturnType<typeof harness>,
  actorId: string,
  customerId: Customer['id'],
  identityId: string,
  custodyAccountId: string,
  cashAccountId: string,
) {
  const opened = h.exchange.openExchangeAccount({
    actorId,
    customerId,
    identityId,
    jurisdiction: GB,
    custodyAccountId,
    cashAccountId,
  });
  if (opened.outcome !== 'OK') {
    throw new Error(opened.outcome === 'REJECTED' ? opened.message : opened.decision.status);
  }
  return opened.value;
}

function digitalOrder(overrides: Partial<DigitalOrder> & Pick<DigitalOrder, 'orderId' | 'side' | 'orderType'>): DigitalOrder {
  return Object.freeze({
    version: 1 as DigitalOrder['version'],
    exchangeAccountId: asExchangeAccountId('xacct_a'),
    beneficialParticipantId: 'cust_a',
    marketId: SUNREY_COIN_USD_MARKET_ID,
    family: 'DIGITAL_ASSET',
    quantity: coins(10n),
    remaining: coins(10n),
    limitPrice: usdPerCoin(200n),
    createdAt: NOW,
    timeInForce: 'GTC',
    status: 'OPEN',
    clientIdempotencyKey: String(overrides.orderId),
    authorizationRef: 'auth',
    holdId: null,
    coinHoldId: null,
    sourceAccountId: 'custody_a',
    sequence: 1,
    ...overrides,
  });
}

describe('Chunk 49 universal economic exchange', () => {
  it('exposes four canonical market families and versioned templates', () => {
    assert.deepEqual([...CANONICAL_MARKET_FAMILIES], [
      'DIGITAL_ASSET',
      'HUMAN_INFORMATION_RIGHT',
      'INTELLIGENCE_COMPUTE',
      'PRODUCTIVE_CAPACITY',
    ]);
    const templates = ContractTemplateRegistry.all();
    assert.equal(templates.length, 5);
    assert.equal(ContractTemplateRegistry.verifyHash('COMPUTE_SPOT_V1', templates[0]!.contentHash), true);
    const h = harness();
    const families = new Set(h.exchange.markets().map((market) => market.family));
    assert.equal(families.has('DIGITAL_ASSET'), true);
    assert.equal(families.has('HUMAN_INFORMATION_RIGHT'), true);
    assert.equal(families.has('INTELLIGENCE_COMPUTE'), true);
    assert.equal(families.has('PRODUCTIVE_CAPACITY'), true);
  });

  it('matches a digital-asset order and settles native SunRey/MoonRey DVP', () => {
    const h = harness();
    const seller = provision(h, 'actor_dvp_s', 'idn_dvp_s', 'cust_dvp_s');
    const buyer = provision(h, 'actor_dvp_b', 'idn_dvp_b', 'cust_dvp_b');
    h.coin.seed(seller.customer.id, coins(10n), 'custody_dvp_s');
    h.fiat.seed('cash_dvp_b', Money.fromMinorUnits(50_00n, 'USD'));
    const sellerAccount = openExchange(h, seller.actor.actorId, seller.customer.id, seller.actor.subjectId, 'custody_dvp_s', 'cash_dvp_s');
    const buyerAccount = openExchange(h, buyer.actor.actorId, buyer.customer.id, buyer.actor.subjectId, 'custody_dvp_b', 'cash_dvp_b');
    const sell = h.exchange.placeDigitalOrder({
      actorId: seller.actor.actorId,
      customerId: seller.customer.id,
      exchangeAccountId: sellerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'SELL',
      orderType: 'LIMIT',
      quantity: coins(4n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'dvp-sell',
    });
    const buy = h.exchange.placeDigitalOrder({
      actorId: buyer.actor.actorId,
      customerId: buyer.customer.id,
      exchangeAccountId: buyerAccount.accountId,
      marketId: SUNREY_COIN_USD_MARKET_ID,
      side: 'BUY',
      orderType: 'LIMIT',
      quantity: coins(4n),
      limitPrice: usdPerCoin(200n),
      clientIdempotencyKey: 'dvp-buy',
    });
    assert.equal(sell.outcome, 'OK');
    assert.equal(buy.outcome, 'OK');
    if (buy.outcome === 'OK') {
      assert.equal(buy.value.status, 'FILLED');
    }
    assert.equal(h.exchange.trades(SUNREY_COIN_USD_MARKET_ID).length, 1);
    assert.equal(h.coin.position(buyer.customer.id).available.scaledUnits, 4_000_000n);

    const native = new SimulationNativeDvpAdapter();
    native.seed('seller', coins(5n));
    native.seed('buyer', AssetQuantity.fromScaledUnits(1_000n, MOONREY_COIN_ASSET_ID));
    const dvp = native.atomicDeliveryVersusPayment({
      assetSender: 'seller',
      assetRecipient: 'buyer',
      assetAmount: coins(2n),
      contraSender: 'buyer',
      contraRecipient: 'seller',
      contraAmount: AssetQuantity.fromScaledUnits(400n, MOONREY_COIN_ASSET_ID),
    });
    assert.equal(dvp.ok, true);
    assert.equal(native.available('buyer', SUNREY_COIN_ASSET_ID), 2_000_000n);
    assert.equal(native.available('seller', MOONREY_COIN_ASSET_ID), 400n);
    assert.ok(h.exchange.getMarket(SUNREY_MOONREY_MARKET_ID));
  });

  it('matches compute, escrows MoonRey, and settles exact partial delivery', () => {
    const h = harness();
    h.machines.grant('ai-buyer', 'PURCHASE_COMPUTE');
    h.machines.grant('gpu-provider-sim', 'SELL_COMPUTE');
    const listed = h.exchange.universal.listComputeCapacity({
      providerAccountId: asExchangeAccountId('xacct_gpu'),
      quantity: 1_000n,
      unitPrice: moonreyPrice(2n, 'GPU_SECOND'),
      jurisdiction: GB,
    });
    assert.equal(listed.outcome, 'OK');
    const bought = h.exchange.universal.buyCompute({
      buyerAccountId: asExchangeAccountId('xacct_ai'),
      quantity: 300n,
      unitPrice: moonreyPrice(2n, 'GPU_SECOND'),
      jurisdiction: GB,
      machineId: 'ai-buyer',
    });
    assert.equal(bought.outcome, 'OK');
    const contract = h.exchange.universal.latestComputeContract();
    assert.ok(contract);
    assert.equal(contract.ordered, 300n);
    const settled = h.exchange.universal.settleComputeDelivery({
      contractId: contract.contractId,
      delivered: 270n,
    });
    assert.equal(settled.outcome, 'OK');
    if (settled.outcome === 'OK') {
      assert.equal(settled.value.delivered, 270n);
      assert.equal(settled.value.paid, 540n);
      assert.equal(settled.value.releasedUnused, 60n);
      assert.equal(settled.value.remainingEscrow, 0n);
      assert.equal(settled.value.exact, true);
    }
    assert.equal(h.exchange.universal.native.available(contract.provider, MOONREY_COIN_ASSET_ID), 540n);
  });

  it('clears a capacity auction deterministically and settles oracle delivery without double-counting', () => {
    const h = harness();
    h.exchange.universal.setHeight(150n);
    const offer = h.exchange.universal.offerCapacity({
      providerAccountId: asExchangeAccountId('xacct_factory'),
      quantity: 1_000n,
      limitPrice: moonreyPrice(5n, 'MANUFACTURED_UNIT'),
      jurisdiction: GB,
    });
    const bid = h.exchange.universal.bidCapacity({
      buyerAccountId: asExchangeAccountId('xacct_buyer_cap'),
      quantity: 400n,
      limitPrice: moonreyPrice(6n, 'MANUFACTURED_UNIT'),
      jurisdiction: GB,
    });
    assert.equal(offer.outcome, 'OK');
    assert.equal(bid.outcome, 'OK');
    const cleared = h.exchange.universal.clearCapacityAuction();
    assert.equal(cleared.outcome, 'OK');
    if (cleared.outcome !== 'OK') {
      return;
    }
    assert.equal(cleared.value.clearing.clearingPrice?.priceUnits, 5n);
    assert.equal(cleared.value.clearing.allocated[0]!.quantity, 400n);
    assert.equal(cleared.value.contract.tokenizesTitle, false);
    const replicaA = h.exchange.universal.replicaSnapshot();
    const settled = h.exchange.universal.settleCapacityDelivery({
      contractId: cleared.value.contract.contractId,
      delivered: 400n,
    });
    assert.equal(settled.outcome, 'OK');
    const again = h.exchange.universal.productive
      ? null
      : h.exchange.contracts().capacity[0];
    void again;
    const second = h.exchange.universal.settleCapacityDelivery({
      contractId: cleared.value.contract.contractId,
      delivered: 400n,
    });
    assert.equal(second.outcome, 'REJECTED');
    if (second.outcome === 'REJECTED') {
      assert.equal(second.code, 'DOUBLE_COUNT_FORBIDDEN');
    }
    void replicaA;
    const book = openAuction({
      auctionId: 'auction:det',
      marketId: MANUFACTURING_CAPACITY_MARKET_ID,
      instrumentId: 'instrument:manufacturing-capacity' as never,
      openHeight: 1n,
      closeHeight: 2n,
    });
    const mk = (id: string, side: 'BUY' | 'SELL', price: bigint, qty: bigint, seq: number): UniversalOrder =>
      Object.freeze({
        orderId: id as UniversalOrder['orderId'],
        exchangeAccountId: asExchangeAccountId('xacct'),
        marketId: MANUFACTURING_CAPACITY_MARKET_ID,
        instrumentId: 'instrument:manufacturing-capacity' as UniversalOrder['instrumentId'],
        family: 'PRODUCTIVE_CAPACITY',
        side,
        orderType: 'LIMIT',
        quantity: qty,
        remaining: qty,
        limitPrice: moonreyPrice(price, 'MANUFACTURED_UNIT'),
        purpose: null,
        recipientClass: null,
        actorClass: 'INSTITUTION',
        capabilities: [],
        jurisdiction: GB,
        geography: 'GB-SIM',
        machineId: null,
        consentRef: null,
        clientIdempotencyKey: id,
        sequence: seq,
        status: 'OPEN',
      });
    const a = { ...book, bids: [mk('b1', 'BUY', 6n, 100n, 1)], offers: [mk('s1', 'SELL', 5n, 100n, 2)] };
    const first = clearAuction(a);
    const secondClear = clearAuction(a);
    assert.deepEqual(first, secondClear);
  });

  it('matches information rights only after consent/purpose eligibility and never returns raw rows', () => {
    const h = harness();
    h.consent.grant({
      consentRef: 'consent:cohort-aggregate-v1',
      subjectOrCohortRef: 'cohort:consent-qualified-sim',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
    });
    const listed = h.exchange.universal.listInformationRight({
      sellerAccountId: asExchangeAccountId('xacct_steward'),
      consentRef: 'consent:cohort-aggregate-v1',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    });
    assert.equal(listed.outcome, 'OK');
    const bought = h.exchange.universal.buyInformationRight({
      buyerAccountId: asExchangeAccountId('xacct_research'),
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    });
    assert.equal(bought.outcome, 'OK');
    const contract = h.exchange.universal.latestInformationContract();
    assert.ok(contract);
    const delivered = h.exchange.universal.deliverInformationRight({
      contractId: contract.contractId,
      requesterId: 'research-buyer',
    });
    assert.equal(delivered.outcome, 'OK');
    if (delivered.outcome === 'OK') {
      assert.equal(delivered.value.rawRows, false);
      assert.equal(delivered.value.rawPayload, null);
      assert.equal(delivered.value.aggregate.count, '12');
    }
    const data = h.exchange.universal.familyData(INFORMATION_RIGHT_MARKET_ID);
    assert.ok(data?.information);
    assert.equal(data.information.subjectLevelData, false);
  });

  it('blocks revoked consent, wrong purpose, and raw information', () => {
    const h = harness();
    h.consent.grant({
      consentRef: 'consent:cohort-aggregate-v1',
      subjectOrCohortRef: 'cohort:consent-qualified-sim',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
    });
    const listed = h.exchange.universal.listInformationRight({
      sellerAccountId: asExchangeAccountId('xacct_steward2'),
      consentRef: 'consent:cohort-aggregate-v1',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    });
    assert.equal(listed.outcome, 'OK');
    const wrong = h.exchange.universal.buyInformationRight({
      buyerAccountId: asExchangeAccountId('xacct_wrong'),
      purpose: 'PERSONAL_BUDGET_ANALYSIS',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    });
    assert.equal(wrong.outcome, 'REJECTED');
    if (wrong.outcome === 'REJECTED') {
      assert.equal(wrong.code, 'PURPOSE_MISMATCH');
    }
    h.consent.revoke('consent:cohort-aggregate-v1');
    const later = h.exchange.universal.buyInformationRight({
      buyerAccountId: asExchangeAccountId('xacct_revoked'),
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      unitPrice: moonreyPrice(25n, 'authorized_computation'),
      jurisdiction: GB,
    });
    assert.equal(later.outcome, 'REJECTED');
    if (later.outcome === 'REJECTED') {
      assert.equal(later.code, 'CONSENT_REVOKED');
    }
    const raw = h.cleanRoom.executeAggregate({
      templateId: 'raw_export',
      purpose: 'RAW_EXPORT',
      cohortRef: 'cohort:consent-qualified-sim',
      requesterId: 'attacker',
    });
    assert.equal(raw.ok, false);
    if (!raw.ok) {
      assert.equal(raw.error.code, 'RAW_INFORMATION_UNAVAILABLE');
    }
  });

  it('enforces machine capability and market access policy', () => {
    const h = harness();
    const denied = h.exchange.universal.buyCompute({
      buyerAccountId: asExchangeAccountId('xacct_nocap'),
      quantity: 10n,
      unitPrice: moonreyPrice(2n, 'GPU_SECOND'),
      jurisdiction: GB,
      machineId: 'unprovisioned',
    });
    assert.equal(denied.outcome, 'REJECTED');
    if (denied.outcome === 'REJECTED') {
      assert.equal(denied.code, 'CAPABILITY_MISSING');
    }
    const instrument = informationRightInstrument({
      instrumentId: 'instrument:human-only',
      issuer: 'steward',
      cohortRef: 'cohort:x',
      templateId: 'grocery_average',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      consentPolicyRef: 'consent:x',
      settlementAsset: MOONREY_COIN_ASSET_ID,
    });
    const machine = evaluateEligibility(instrument, {
      actorClass: 'MACHINE',
      capabilities: [],
      jurisdiction: GB,
      geography: null,
      machineId: 'm1',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      consentActive: true,
      consentRevoked: false,
      verifiedAccount: true,
      access: 'MACHINE_ALLOWED',
    });
    assert.equal(machine.eligible, false);
    assert.equal(machine.reasonCodes.includes('HUMAN_ONLY_MARKET'), true);
    assert.equal(MARKET_ACCESS_POLICIES.includes('INSTITUTIONAL_ONLY'), true);
  });

  it('blocks ordinary settlement on oracle conflict and pays exact partial delivery', () => {
    const h = harness();
    h.machines.grant('ai-buyer', 'PURCHASE_COMPUTE');
    h.exchange.universal.listComputeCapacity({
      providerAccountId: asExchangeAccountId('xacct_gpu2'),
      quantity: 100n,
      unitPrice: moonreyPrice(1n, 'GPU_SECOND'),
      jurisdiction: GB,
    });
    h.exchange.universal.buyCompute({
      buyerAccountId: asExchangeAccountId('xacct_ai2'),
      quantity: 100n,
      unitPrice: moonreyPrice(1n, 'GPU_SECOND'),
      jurisdiction: GB,
      machineId: 'ai-buyer',
    });
    const contract = h.exchange.universal.latestComputeContract();
    assert.ok(contract);
    const conflicted = h.exchange.universal.settleComputeDelivery({
      contractId: contract.contractId,
      delivered: 72n,
      quality: 'CONFLICTED',
    });
    assert.equal(conflicted.outcome, 'REJECTED');
    if (conflicted.outcome === 'REJECTED') {
      assert.equal(conflicted.code, 'ORACLE_CONFLICT');
    }
    assert.equal(h.exchange.universal.disputes().some((row) => row.kind === 'ORACLE_CONFLICT'), true);
    const escrow = openEscrow({
      ownerAccountId: asExchangeAccountId('xacct_ai2'),
      assetId: MOONREY_COIN_ASSET_ID,
      amount: 100n,
    });
    const partial = settlePartialDelivery({
      contractId: contract.contractId,
      ordered: 100n,
      delivered: 72n,
      unitPrice: 1n,
      escrow,
      policy: 'PAY_VERIFIED_RELEASE_UNUSED',
    });
    assert.equal(partial.ok, true);
    if (partial.ok) {
      assert.equal(partial.value.settlement.paid, 72n);
      assert.equal(partial.value.settlement.releasedUnused, 28n);
    }
  });

  it('enforces cross-market risk and listing governance without AI approval', () => {
    const usage = emptyRiskUsage(asExchangeAccountId('xacct_risk'));
    const breach = evaluateRiskLimits(usage, { openOrdersDelta: DEFAULT_RISK_LIMITS.maxOpenOrders + 1n });
    assert.equal(breach.allowed, false);
    assert.equal(breach.code, 'RISK_LIMIT_BREACH');
    const h = harness();
    const instrument = informationRightInstrument({
      instrumentId: 'instrument:unready',
      issuer: 'steward',
      cohortRef: 'cohort:x',
      templateId: 'grocery_average',
      purpose: 'AGGREGATED_RESEARCH',
      recipientClass: 'EXTERNAL_RESEARCH_PARTNER',
      consentPolicyRef: 'consent:x',
      settlementAsset: MOONREY_COIN_ASSET_ID,
    });
    const ai = h.exchange.universal.listInstrument(instrument, 'AI');
    assert.equal(ai.accepted, false);
    assert.equal(ai.aiApproved, false);
    assert.equal(ai.reasonCodes.includes('AI_CANNOT_APPROVE_LISTING'), true);
    const human = evaluateListingGovernance(instrument);
    assert.equal(human.accepted, true);
    assert.equal(human.aiApproved, false);
  });

  it('keeps price arithmetic exact and rejects FOK that cannot fill', () => {
    const price = usdPerCoin(200n);
    assert.equal(quoteForQuantity(price, coins(6n)), 1200n);
    const maker = digitalOrder({ orderId: 'xord_fok_m' as DigitalOrder['orderId'], side: 'SELL', orderType: 'LIMIT' });
    const taker = digitalOrder({
      orderId: 'xord_fok_t' as DigitalOrder['orderId'],
      side: 'BUY',
      orderType: 'FOK',
      quantity: coins(20n),
      remaining: coins(20n),
      limitPrice: usdPerCoin(200n),
      beneficialParticipantId: 'cust_b',
      sequence: 2,
    });
    const result = matchIncoming(taker, [maker], { selfTrade: 'PREVENT' });
    assert.equal(result.rejectIncoming, true);
    assert.equal(result.reason, 'FOK_UNFILLED');
    const post = matchIncoming(
      { ...taker, orderType: 'POST_ONLY', quantity: coins(1n), remaining: coins(1n) },
      [maker],
      { selfTrade: 'PREVENT' },
    );
    assert.equal(post.rejectIncoming, true);
    assert.equal(post.reason, 'POST_ONLY_WOULD_TAKE');
  });

  it('generates family surveillance events without legal conclusions', () => {
    const alerts = observeFamilyMarket(
      {
        marketId: GPU_COMPUTE_MARKET_ID,
        family: 'INTELLIGENCE_COMPUTE',
        selfTrades: ['t1'],
        unauthorizedPurposeAttempts: ['PERSONAL_BUDGET_ANALYSIS'],
        deniedAccessCount: 3,
        nonDeliveryCount: 3,
        oracleProviderShares: { monopolist: 9n, other: 1n },
      },
      NOW,
    );
    assert.equal(alerts.some((alert) => alert.kind === 'SELF_TRADING'), true);
    assert.equal(alerts.some((alert) => alert.kind === 'UNAUTHORIZED_PURPOSE_ATTEMPT'), true);
    assert.equal(alerts.some((alert) => alert.kind === 'REPEATED_DENIED_ACCESS'), true);
    assert.equal(alerts.some((alert) => alert.kind === 'ORACLE_CONCENTRATION_CANDIDATE'), true);
    assert.equal(alerts.every((alert) => alert.legalConclusion === false), true);
  });

  it('derives the same deterministic replica snapshot from identical inputs', () => {
    const run = () => {
      const h = harness();
      h.machines.grant('ai-buyer', 'PURCHASE_COMPUTE');
      h.exchange.universal.listComputeCapacity({
        providerAccountId: asExchangeAccountId('xacct_rep_p'),
        quantity: 50n,
        unitPrice: moonreyPrice(3n, 'GPU_SECOND'),
        jurisdiction: GB,
      });
      h.exchange.universal.buyCompute({
        buyerAccountId: asExchangeAccountId('xacct_rep_b'),
        quantity: 50n,
        unitPrice: moonreyPrice(3n, 'GPU_SECOND'),
        jurisdiction: GB,
        machineId: 'ai-buyer',
      });
      const contract = h.exchange.universal.latestComputeContract();
      if (contract) {
        h.exchange.universal.settleComputeDelivery({ contractId: contract.contractId, delivered: 50n });
      }
      return h.exchange.universal.replicaSnapshot();
    };
    assert.equal(run(), run());
  });

  it('exposes CLI commands for markets, instruments, auctions, and disputes', () => {
    const h = harness();
    const markets = runExchangeCommand(h.exchange, ['markets']);
    assert.equal(markets.ok, true);
    const templates = runExchangeCommand(h.exchange, ['templates']);
    assert.equal(templates.ok, true);
    const unknown = runExchangeCommand(h.exchange, ['not-a-command']);
    assert.equal(unknown.ok, false);
  });
});
