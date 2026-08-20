import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Money } from '../../money/src/money.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { PaymentsService } from '../../payments/src/service.ts';
import { simulationRoutesFor } from '../../payments/src/route.ts';
import {
  acceptIntent,
  beneficiaryIntent,
  createPaymentWorld,
  payIntent,
  quoteIntent,
} from '../../../tests/payment-world.ts';
import { seedSimulationCatalog } from '../../../services/accounts/src/catalog.ts';
import { applyReserve, applyReplenish } from './position.ts';
import { evaluatePrefunding } from './prefunding.ts';
import { scoreRoute, selectTreasuryRoute } from './routing.ts';
import { simulateRoutingScenario } from './simulator.ts';
import { TREASURY_SEED_IDS } from './seed.ts';
import { TreasuryService } from './service.ts';
import { ROUTING_VERSION } from './types.ts';

const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function wiredWorld(suffix: string, deposit = 500_000n) {
  const world = createPaymentWorld(suffix, deposit);
  const seeded = seedSimulationCatalog();
  const treasury = new TreasuryService(
    world.runtime.kernel,
    world.runtime.issuer,
    world.runtime.evidence,
    world.runtime.events,
    world.clock,
    {
      customers: world.runtime.customers,
      accounts: world.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    world.runtime.identity.service,
    { ledger: world.runtime.ledger, seed: true },
  );
  const payments = new PaymentsService(
    world.runtime.kernel,
    world.runtime.issuer,
    world.runtime.ledger,
    world.runtime.evidence,
    world.runtime.events,
    world.clock,
    {
      customers: world.runtime.customers,
      accounts: world.runtime.accounts,
      products: seeded.products.asCatalog(),
      legalEntities: seeded.legalEntities,
    },
    world.runtime.identity.service,
    { treasury },
  );
  return { world, treasury, payments };
}

function ready(payments: PaymentsService, world: ReturnType<typeof createPaymentWorld>, id: string) {
  const beneficiary = payments.createBeneficiary(beneficiaryIntent(world, id, 'SAUDI BENEFICIARY'));
  assert.equal(beneficiary.outcome, 'OK');
  const quote = payments.createQuote(quoteIntent(world, id));
  if (quote.outcome !== 'OK') {
    throw new Error('quote');
  }
  const accepted = payments.acceptQuote(acceptIntent(world, id, quote.value.quoteId));
  assert.equal(accepted.outcome, 'OK');
  return quote.value.quoteId;
}

describe('treasury liquidity and routing', () => {
  it('keeps customer and treasury money distinct and currency-separated', () => {
    const { treasury } = wiredWorld('sep');
    const customerBooks = treasury.store.listAccounts().filter((row) => row.ownership === 'CUSTOMER');
    assert.equal(customerBooks.length, 0);
    const currencies = new Set(treasury.store.listPositions().map((row) => row.currency));
    assert.ok(currencies.has('USD'));
    assert.ok(currencies.has('SAR'));
    assert.throws(() => {
      const usd = treasury.store.getPosition(TREASURY_SEED_IDS.usUsdSettlement)!;
      applyReserve(usd, Money.fromMinorUnits(1n, 'SAR'), NOW);
    });
  });

  it('rejects a route when destination prefunding is insufficient', () => {
    const { treasury } = wiredWorld('pref');
    const book = treasury.store.getAccount(TREASURY_SEED_IDS.providerASar)!;
    const position = treasury.store.getPosition(TREASURY_SEED_IDS.providerASar)!;
    const decision = evaluatePrefunding(
      {
        corridorId: 'US-SA-USD-SAR',
        routeId: 'sim-gcc-usd-sar',
        destinationCurrency: 'SAR',
        destinationCountry: 'SA',
        required: Money.fromMinorUnits(375_000n, 'SAR'),
      },
      book,
      position,
    );
    assert.equal(decision.executable, false);
    if (!decision.executable) {
      assert.equal(decision.reason, 'INSUFFICIENT_DESTINATION_LIQUIDITY');
    }
  });

  it('makes concurrent double reservation impossible', () => {
    const { treasury } = wiredWorld('conc');
    const position = treasury.store.getPosition(TREASURY_SEED_IDS.saSarPrefund)!;
    treasury.store.putPosition({
      ...position,
      settled: Money.fromMinorUnits(500_000n, 'SAR'),
      available: Money.fromMinorUnits(500_000n, 'SAR'),
      reserved: Money.zero('SAR'),
    });
    const first = applyReserve(treasury.store.getPosition(TREASURY_SEED_IDS.saSarPrefund)!, Money.fromMinorUnits(400_000n, 'SAR'), NOW);
    treasury.store.putPosition(first);
    assert.throws(
      () => applyReserve(treasury.store.getPosition(TREASURY_SEED_IDS.saSarPrefund)!, Money.fromMinorUnits(400_000n, 'SAR'), NOW),
      /INSUFFICIENT_TREASURY_LIQUIDITY/,
    );
    assert.equal(treasury.store.getPosition(TREASURY_SEED_IDS.saSarPrefund)!.available.minorUnits, 100_000n);
  });

  it('uses compliance as a hard filter and scores deterministically', () => {
    const { world, treasury, payments } = wiredWorld('score');
    const quoteId = ready(payments, world, 'score');
    const quote = payments.getStore().getQuote(quoteId)!;
    const routes = simulationRoutesFor('US-SA-USD-SAR', quote.fee);
    const constraints = {
      corridor: { corridorId: 'US-SA-USD-SAR', servingLegalEntityId: 'le_solstice_us_inc' } as never,
      beneficiary: payments.getStore().getBeneficiary('ben_score')!,
      sanctionsHit: false,
      amount: quote.sourceAmount,
      maxAmount: Money.fromMinorUnits(100_000_000n, 'USD'),
      providerAvailable: true,
    };
    const facts = {
      requiredLiquidity: Money.fromMinorUnits(1n, 'SAR'),
      destinationCountry: 'SA',
      sourceJurisdiction: 'US',
      destinationJurisdiction: 'SA',
      sourceCurrency: 'USD',
      destinationCurrency: 'SAR',
      acceptedQuoteRequired: true,
      quoteAccepted: true,
      customerAccountActive: true,
      securityHold: false,
    };
    const first = treasury.selectForPayment(routes, constraints, facts);
    const second = treasury.selectForPayment(routes, constraints, facts);
    assert.equal(first.chosen?.routeId, second.chosen?.routeId);
    assert.equal(first.explanation.routingVersion, ROUTING_VERSION);
    assert.ok(first.rejected.some((row) => row.reason === 'sanctions_or_compliance' || row.routeId === 'sim-noncompliant-usd-sar'));
    const blocked = treasury.selectForPayment(routes, { ...constraints, sanctionsHit: true }, facts);
    assert.equal(blocked.chosen, null);
    assert.ok(blocked.rejected.every((row) => row.reason === 'sanctions_or_compliance'));
    const a = first.eligible.find((row) => row.routeId === 'sim-gcc-usd-sar');
    const b = first.eligible.find((row) => row.routeId === 'sim-swift-usd-sar');
    assert.ok(a && b);
    assert.deepEqual(scoreRoute(a, undefined, undefined), scoreRoute(a, undefined, undefined));
  });

  it('selects Route B when Route A fails liquidity, then Route A after replenish, then B when A is disabled', () => {
    const { world, treasury, payments } = wiredWorld('demoish');
    const quote1 = ready(payments, world, 'd1');
    const payment1 = payments.initiatePayment(payIntent(world, 'd1', 'ben_d1', quote1));
    if (payment1.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    const decision1 = treasury.store.getRouteDecision(payment1.value.paymentId);
    assert.equal(decision1?.selectedRouteId, 'sim-swift-usd-sar');
    assert.ok(decision1?.rejected.some((row) => row.routeId === 'sim-gcc-usd-sar' && row.reason === 'liquidity'));
    assert.equal(treasury.store.getReservationByPayment(payment1.value.paymentId)?.state, 'COMMITTED');
    const recon = treasury.reconcilePayment({
      paymentId: payment1.value.paymentId,
      paymentStatus: payment1.value.status,
      ledgerJournalIds: payment1.value.journalIds,
      providerBalanceMinor: null,
      railReportPresent: true,
    });
    assert.equal(recon.status, 'MATCHED');

    treasury.replenish(TREASURY_SEED_IDS.providerASar, Money.fromMinorUnits(10_000_000n, 'SAR'));
    const quote2 = ready(payments, world, 'd2');
    const payment2 = payments.initiatePayment(payIntent(world, 'd2', 'ben_d2', quote2));
    if (payment2.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(treasury.store.getRouteDecision(payment2.value.paymentId)?.selectedRouteId, 'sim-gcc-usd-sar');

    const kill = treasury.setKillSwitch({
      id: asIntentId('ks_d'),
      actionType: ACTION_TYPES.SET_TREASURY_KILL_SWITCH,
      idempotencyKey: 'ks_d',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'TREASURY_OPERATIONS',
      payload: {
        accountId: world.account.id,
        killSwitchId: 'ks_d',
        scope: 'PROVIDER',
        target: 'SIMULATED_PROVIDER_GCC',
        enabled: true,
        reason: 'outage',
      },
    });
    assert.equal(kill.outcome, 'OK');
    const quote3 = ready(payments, world, 'd3');
    const payment3 = payments.initiatePayment(payIntent(world, 'd3', 'ben_d3', quote3));
    if (payment3.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    const decision3 = treasury.store.getRouteDecision(payment3.value.paymentId);
    assert.equal(decision3?.selectedRouteId, 'sim-swift-usd-sar');
    assert.ok(decision3?.rejected.some((row) => row.reason === 'provider_disabled'));
  });

  it('does not release liquidity while submission is UNKNOWN', () => {
    const { treasury } = wiredWorld('unk');
    const book = treasury.store.getAccount(TREASURY_SEED_IDS.providerBSar)!;
    const reserved = applyReserve(
      treasury.store.getPosition(book.treasuryAccountId)!,
      Money.fromMinorUnits(1_000n, 'SAR'),
      NOW,
    );
    treasury.store.putPosition(reserved);
    treasury.store.putReservation({
      reservationId: 'tres_unknown' as never,
      treasuryAccountId: book.treasuryAccountId,
      paymentId: 'pay_unknown',
      amount: Money.fromMinorUnits(1_000n, 'SAR'),
      currency: 'SAR',
      state: 'ACTIVE',
      idempotencyKey: 'unk',
      authorityId: 'auth',
      createdAt: NOW,
      updatedAt: NOW,
      expiresAt: null,
    });
    treasury.onSubmissionUnknown('pay_unknown');
    assert.equal(treasury.store.getReservationByPayment('pay_unknown')?.state, 'ACTIVE');
    assert.equal(treasury.store.getExposure('SUBMISSION_UNKNOWN', 'pay_unknown')?.state, 'ELEVATED');
  });

  it('proposes rebalance and only executes after Kernel authority', () => {
    const { world, treasury } = wiredWorld('reb');
    const proposed = treasury.proposeRebalance({
      id: asIntentId('reb_p'),
      actionType: ACTION_TYPES.PROPOSE_TREASURY_REBALANCE,
      idempotencyKey: 'reb_p',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'TREASURY_OPERATIONS',
      payload: {
        accountId: world.account.id,
        proposalId: 'prop_1',
        sourceTreasuryAccountId: TREASURY_SEED_IDS.providerBSar,
        destinationTreasuryAccountId: TREASURY_SEED_IDS.providerASar,
        amount: Money.fromMinorUnits(250_000n, 'SAR'),
        narrative: 'Move 2,500.00 SAR simulation liquidity from B to A',
      },
    });
    if (proposed.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(proposed.value.state, 'PROPOSED');
    assert.equal(proposed.value.executable, false);
    const executed = treasury.executeRebalance({
      id: asIntentId('reb_x'),
      actionType: ACTION_TYPES.EXECUTE_TREASURY_REBALANCE,
      idempotencyKey: 'reb_x',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'TREASURY_OPERATIONS',
      payload: { accountId: world.account.id, proposalId: 'prop_1' },
    });
    if (executed.outcome !== 'OK') {
      throw new Error('expected OK');
    }
    assert.equal(executed.value.state, 'EXECUTED');
  });

  it('forecasts and simulates without mutating live state', () => {
    const { treasury } = wiredWorld('fc');
    const before = treasury.store.getPosition(TREASURY_SEED_IDS.providerASar)!.available.minorUnits;
    const forecast = treasury.forecast('SAR', 86_400_000n);
    assert.equal(forecast.version, 'treasury-forecast-v1');
    assert.equal(forecast.currency, 'SAR');
    const simulated = treasury.simulate({
      candidates: [],
      constraints: {
        corridor: { corridorId: 'US-SA-USD-SAR', servingLegalEntityId: 'le_solstice_us_inc' } as never,
        beneficiary: { status: 'ACTIVE', currency: 'SAR' } as never,
        sanctionsHit: false,
        amount: Money.fromMinorUnits(1n, 'USD'),
        maxAmount: Money.fromMinorUnits(100n, 'USD'),
        providerAvailable: true,
      },
      facts: {
        requiredLiquidity: Money.fromMinorUnits(1n, 'SAR'),
        destinationCountry: 'SA',
        sourceJurisdiction: 'US',
        destinationJurisdiction: 'SA',
        sourceCurrency: 'USD',
        destinationCurrency: 'SAR',
        acceptedQuoteRequired: false,
        quoteAccepted: true,
        customerAccountActive: true,
        securityHold: false,
      },
      scenario: { kind: 'PROVIDER_UNAVAILABLE', provider: 'SIMULATED_PROVIDER_GCC' },
    });
    assert.equal(simulated.chosen, null);
    assert.equal(treasury.store.getPosition(TREASURY_SEED_IDS.providerASar)!.available.minorUnits, before);
    void applyReplenish;
    void selectTreasuryRoute;
    void simulateRoutingScenario;
  });

  it('models concentration, FX inventory, and kill-switch halt', () => {
    const { world, treasury } = wiredWorld('ctl');
    treasury.snapshotConcentration('SIMULATED_PROVIDER_GCC', Money.fromMinorUnits(9_000n, 'SAR'), 10_000n);
    const snap = treasury.store.getConcentration('provider', 'SIMULATED_PROVIDER_GCC');
    assert.ok(snap);
    assert.match(snap.thresholdNote, /RESEARCH_REQUIRED/);
    assert.ok(treasury.store.getInventory('USD'));
    assert.ok(treasury.store.getInventory('SAR'));
    const halt = treasury.setKillSwitch({
      id: asIntentId('halt'),
      actionType: ACTION_TYPES.SET_TREASURY_KILL_SWITCH,
      idempotencyKey: 'halt',
      actorId: world.actorId,
      requestedAt: world.clock.now(),
      purpose: 'TREASURY_OPERATIONS',
      payload: {
        accountId: world.account.id,
        killSwitchId: 'halt_all',
        scope: 'HALT_RESERVATIONS',
        target: '*',
        enabled: true,
        reason: 'ops halt',
      },
    });
    assert.equal(halt.outcome, 'OK');
    const reserved = treasury.reserveForPayment({
      paymentId: 'pay_halt',
      corridorId: 'US-SA-USD-SAR',
      provider: 'SIMULATED_PROVIDER_CORRESPONDENT',
      requiredLiquidity: Money.fromMinorUnits(1_000n, 'SAR'),
      authority: { authorityId: 'x', actionType: 'INITIATE_PAYMENT' } as never,
      idempotencyKey: 'halt_res',
    });
    assert.equal(reserved.ok, false);
  });
});
