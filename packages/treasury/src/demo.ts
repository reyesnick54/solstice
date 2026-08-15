import { PaymentsService } from '../../payments/src/service.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { Money } from '../../money/src/money.ts';
import {
  acceptIntent,
  beneficiaryIntent,
  createPaymentWorld,
  payIntent,
  quoteIntent,
} from '../../../tests/payment-world.ts';
import { seedSimulationCatalog } from '../../services/accounts/src/catalog.ts';
import { TREASURY_SEED_IDS } from './seed.ts';
import { TreasuryService } from './service.ts';

function fail(message: string): never {
  throw new Error(message);
}

const world = createPaymentWorld('treasury_demo', 500_000n);
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

function prepare(suffix: string): string {
  const beneficiary = payments.createBeneficiary(beneficiaryIntent(world, suffix, 'SAUDI BENEFICIARY'));
  if (beneficiary.outcome !== 'OK') {
    fail(`beneficiary ${suffix}: ${beneficiary.outcome}`);
  }
  const quote = payments.createQuote(quoteIntent(world, suffix));
  if (quote.outcome !== 'OK') {
    fail(`quote ${suffix}: ${quote.outcome}`);
  }
  const accepted = payments.acceptQuote(acceptIntent(world, suffix, quote.value.quoteId));
  if (accepted.outcome !== 'OK') {
    fail(`accept ${suffix}: ${accepted.outcome}`);
  }
  return quote.value.quoteId;
}

const quote1 = prepare('t1');
const payment1 = payments.initiatePayment(payIntent(world, 't1', 'ben_t1', quote1));
if (payment1.outcome !== 'OK') {
  fail(`payment1 ${payment1.outcome} ${'code' in payment1 ? payment1.code : ''}`);
}
const decision1 = treasury.store.getRouteDecision(payment1.value.paymentId);
if (!decision1) {
  fail('missing route explanation');
}
if (decision1.selectedRouteId !== 'sim-swift-usd-sar') {
  fail(`expected Route B, got ${decision1.selectedRouteId}`);
}
if (!decision1.rejected.some((row) => row.routeId === 'sim-gcc-usd-sar' && row.reason === 'liquidity')) {
  fail('Route A should fail the liquidity hard filter');
}
const reservation1 = treasury.store.getReservationByPayment(payment1.value.paymentId);
if (!reservation1 || reservation1.state !== 'COMMITTED') {
  fail(`expected committed reservation, got ${reservation1?.state}`);
}
const recon1 = treasury.reconcilePayment({
  paymentId: payment1.value.paymentId,
  paymentStatus: payment1.value.status,
  ledgerJournalIds: payment1.value.journalIds,
  providerBalanceMinor: null,
  railReportPresent: true,
});
if (recon1.status !== 'MATCHED') {
  fail(`reconciliation ${recon1.status} ${recon1.mismatches.join(',')}`);
}

treasury.replenish(TREASURY_SEED_IDS.providerASar, Money.fromMinorUnits(10_000_000n, 'SAR'));
const quote2 = prepare('t2');
const payment2 = payments.initiatePayment(payIntent(world, 't2', 'ben_t2', quote2));
if (payment2.outcome !== 'OK') {
  fail(`payment2 ${payment2.outcome} ${'code' in payment2 ? payment2.code : ''}`);
}
const decision2 = treasury.store.getRouteDecision(payment2.value.paymentId);
if (decision2?.selectedRouteId !== 'sim-gcc-usd-sar') {
  fail(`expected Route A after replenish, got ${decision2?.selectedRouteId}`);
}

const kill = treasury.setKillSwitch({
  id: asIntentId('kill_provider_a'),
  actionType: ACTION_TYPES.SET_TREASURY_KILL_SWITCH,
  idempotencyKey: 'kill_provider_a',
  actorId: world.actorId,
  requestedAt: world.clock.now(),
  purpose: 'TREASURY_OPERATIONS',
  payload: {
    accountId: world.account.id,
    killSwitchId: 'ks_provider_a',
    scope: 'PROVIDER',
    target: 'SIMULATED_PROVIDER_GCC',
    enabled: true,
    reason: 'simulated provider outage',
  },
});
if (kill.outcome !== 'OK') {
  fail(`kill switch ${kill.outcome}`);
}

const quote3 = prepare('t3');
const payment3 = payments.initiatePayment(payIntent(world, 't3', 'ben_t3', quote3));
if (payment3.outcome !== 'OK') {
  fail(`payment3 ${payment3.outcome} ${'code' in payment3 ? payment3.code : ''}`);
}
const decision3 = treasury.store.getRouteDecision(payment3.value.paymentId);
if (decision3?.selectedRouteId !== 'sim-swift-usd-sar') {
  fail(`expected Route B after provider A disabled, got ${decision3?.selectedRouteId}`);
}
if (!decision3.rejected.some((row) => row.routeId === 'sim-gcc-usd-sar' && row.reason === 'provider_disabled')) {
  fail('Route A should be excluded by kill switch');
}

for (const pos of treasury.store.listPositions()) {
  if (pos.available.isNegative() || pos.reserved.isNegative() || pos.settled.isNegative()) {
    fail(`negative treasury position ${pos.positionId}`);
  }
}

console.log('Treasury demo: ok');
console.log(`  payment1 route=${decision1.selectedRouteId} reservation=${reservation1.state} recon=${recon1.status}`);
console.log(`  payment2 route=${decision2?.selectedRouteId} (Route A replenished)`);
console.log(`  payment3 route=${decision3.selectedRouteId} (Provider A disabled)`);
console.log(`  routing version=${decision1.routingVersion}`);
console.log(`  Route A first rejection=${decision1.rejected.find((row) => row.routeId === 'sim-gcc-usd-sar')?.reason}`);
