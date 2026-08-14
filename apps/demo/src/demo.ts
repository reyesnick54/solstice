/**
 * Global Money Fabric demo.
 *
 * The customer says "send €5,000 to Ahmed" and never chooses a rail.
 * The backend determines source currency, destination currency, beneficiary,
 * corridor, compliance, FX, liquidity, rail, and settlement.
 *
 * All rails are simulated. No external network calls. LIVE_* stays false.
 */
import {
  asAccountId,
  asActorId,
  asBeneficiaryId,
  asCustomerId,
  asIdempotencyKey,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  formatMoney,
  formatRational,
  Money,
  notStartedVerification,
} from '@solstice/domain';
import { ENVIRONMENT, LIVE_FLAGS } from '@solstice/kernel';
import { LIVE_EXCHANGE_ENABLED } from '@solstice/flags';
import { SolsticeSystem } from '@solstice/payments';
import { PyramidExchangeSystem } from '@solstice/pyramid-exchange';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');
const SYSTEM = { type: 'SYSTEM' as const, id: asActorId('system') };
const JANE = {
  type: 'CUSTOMER' as const,
  id: asActorId('jane'),
  customerId: asCustomerId('cust_jane'),
};

function log(event: string, payload: unknown): void {
  console.log(JSON.stringify({ event, ...asJson(payload) }));
}

function asJson(value: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? `${inner.toString()}n` : inner)),
  ) as Record<string, unknown>;
}

function must<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`${label} failed: ${JSON.stringify(result.error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
  }
  return result.value;
}

console.log('=== Solstice Phase 2/3 demo ===');
console.log(JSON.stringify({ ENVIRONMENT, LIVE_FLAGS }));

const system = new SolsticeSystem();
system.bootstrap();

must(
  system.createCustomer(
    {
      id: asCustomerId('cust_jane'),
      legalEntityId: asLegalEntityId('le_solstice_us'),
      jurisdiction: asJurisdiction('US'),
      residency: asResidency('US'),
      verification: notStartedVerification(asUtcInstant('2027-01-01T00:00:00.000Z')),
      createdAt: NOW,
    },
    SYSTEM,
  ),
  'createCustomer',
);
must(
  system.openAccount({
    accountId: asAccountId('jane_usd'),
    ownerCustomerId: asCustomerId('cust_jane'),
    currency: 'USD',
    accountClass: 'deposits',
    actor: SYSTEM,
  }),
  'open USD',
);
must(
  system.openAccount({
    accountId: asAccountId('jane_eur'),
    ownerCustomerId: asCustomerId('cust_jane'),
    currency: 'EUR',
    accountClass: 'deposits',
    actor: SYSTEM,
  }),
  'open EUR',
);
must(
  system.seedCredit(asAccountId('jane_usd'), Money.fromDecimalString('20000.00', 'USD'), SYSTEM),
  'seed',
);
must(
  system.seedCredit(asAccountId('jane_eur'), Money.fromDecimalString('100.00', 'EUR'), SYSTEM),
  'seed eur',
);
must(
  system.addBeneficiary(
    {
      id: asBeneficiaryId('ben_ahmed'),
      ownerCustomerId: asCustomerId('cust_jane'),
      name: 'Ahmed',
      country: asJurisdiction('DE'),
      institution: {
        iban: 'DE89370400440532013000',
        bic: 'COBADEFFXXX',
        institutionName: 'Commerzbank',
      },
      currency: 'EUR' as never,
    },
    JANE,
  ),
  'add Ahmed',
);
must(
  system.addBeneficiary(
    {
      id: asBeneficiaryId('ben_pat'),
      ownerCustomerId: asCustomerId('cust_jane'),
      name: 'Pat',
      country: asJurisdiction('US'),
      institution: { routingNumber: '021000021', accountNumber: '123456789' },
      currency: 'USD' as never,
    },
    JANE,
  ),
  'add Pat',
);

log('customer.phrase', {
  text: 'send €5,000 to Ahmed',
  note: 'customer never chooses a rail',
});

console.log('\n--- 1. Domestic USD payment ---');
const domestic = must(
  system.sendPayment({
    customerId: asCustomerId('cust_jane'),
    beneficiaryId: asBeneficiaryId('ben_pat'),
    instructedAmount: Money.fromDecimalString('250.00', 'USD'),
    instructedSide: 'DESTINATION',
    purpose: 'rent',
    idempotencyKey: asIdempotencyKey('demo_domestic'),
    actor: JANE,
  }),
  'domestic',
);
log('payment.domestic', {
  state: domestic.payment?.state,
  rail: domestic.routing?.chosen?.railId,
  score: domestic.routing?.chosen?.score.toString(),
});

console.log('\n--- 2. Cross-border USD→EUR to Ahmed ---');
const xb = must(
  system.sendPayment({
    customerId: asCustomerId('cust_jane'),
    beneficiaryId: asBeneficiaryId('ben_ahmed'),
    instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
    instructedSide: 'DESTINATION',
    purpose: 'family support',
    idempotencyKey: asIdempotencyKey('demo_ahmed'),
    actor: JANE,
  }),
  'cross-border',
);
log('payment.cross_border', {
  state: xb.payment?.state,
  chosenRail: xb.routing?.chosen?.railId,
  chosenScore: xb.routing?.chosen?.score.toString(),
  sourceAmount: xb.payment?.sourceAmount ? formatMoney(xb.payment.sourceAmount) : undefined,
  destinationAmount: xb.payment?.destinationAmount
    ? formatMoney(xb.payment.destinationAmount)
    : undefined,
  costAvoided: xb.costAvoided ? formatMoney(xb.costAvoided) : 'none',
});

console.log('\nRanked route table (regulatory filter already applied):');
console.log(
  'rail           score    cost    fx      speed   liq     cpty    rel     fee(source)',
);
for (const row of xb.routing?.ranked ?? []) {
  const b = row.breakdown;
  const line = [
    row.railId.padEnd(14),
    row.score.toString().padStart(8),
    b.cost.toString().padStart(7),
    b.exchangeRate.toString().padStart(7),
    b.speed.toString().padStart(7),
    b.liquidity.toString().padStart(7),
    b.counterparty.toString().padStart(7),
    b.reliability.toString().padStart(7),
    formatMoney(row.totalFeeSource),
  ].join(' ');
  console.log(line);
}
console.log('Excluded (not scored):');
for (const row of xb.routing?.excluded ?? []) {
  console.log(`  ${row.railId}: ${row.exclusionReason}`);
}
console.log('FX quotes:');
for (const quote of xb.quotes ?? []) {
  console.log(
    `  ${quote.source} rate=${formatRational(quote.rate)} fee=${formatMoney(quote.fee)} settlementMs=${quote.settlementMs.toString()}`,
  );
}

console.log('\n--- 3. Sanctions-blocked payment ---');
const blocked = system.sendPayment({
  customerId: asCustomerId('cust_jane'),
  beneficiaryId: asBeneficiaryId('ben_ahmed'),
  instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
  instructedSide: 'DESTINATION',
  purpose: 'family support',
  idempotencyKey: asIdempotencyKey('demo_blocked'),
  actor: JANE,
  screeningOverride: {
    receiverName: 'Blocked Person',
    beneficialOwnerName: 'Blocked Person',
  },
});
if (blocked.ok) {
  throw new Error('expected sanctions block');
}
log('payment.blocked', blocked.error);
const journalsAfterBlock = system.books.journals.list().length;

console.log('\n--- 4. Failed settlement with compensating entries ---');
const failed = must(
  system.sendPayment({
    customerId: asCustomerId('cust_jane'),
    beneficiaryId: asBeneficiaryId('ben_ahmed'),
    instructedAmount: Money.fromDecimalString('50.00', 'EUR'),
    instructedSide: 'DESTINATION',
    purpose: 'family support',
    idempotencyKey: asIdempotencyKey('demo_fail'),
    actor: JANE,
    failSettlement: true,
  }),
  'failed settlement',
);
log('payment.failed_returned', {
  state: failed.payment?.state,
  compensatingMemos: failed.journals.filter((j) => j.memo.startsWith('compensate')).map((j) => j.memo),
  originalsUntouched: failed.journals
    .filter((j) => j.compensatesJournalId === undefined)
    .map((j) => j.id),
});

log('ledger.positions', system.books.positionsByCurrency(asCustomerId('cust_jane')));
log('evidence.chain', {
  records: system.kernel.vault.size,
  verified: system.kernel.vault.verifyChain(),
});
log('growth.cost_avoided', system.books.listCostAvoided().map((row) => ({
  kind: row.kind,
  saved: formatMoney(row.saved),
})));
log('invariants', {
  journalsAfterSanctionsBlockUnchangedCheck: journalsAfterBlock,
  liveFlagsFalse: Object.values(LIVE_FLAGS).every((flag) => flag === false),
});

console.log('\n=== Solstice Phase 9 — Pyramid Exchange simulation ===');

console.log(JSON.stringify({ LIVE_EXCHANGE_ENABLED, note: 'exchange remains simulation-only' }));

const px = new PyramidExchangeSystem('demo-phase9');
px.bootstrapHouse();
const usTrader = px.registerTrader({
  customerId: 'cust_us_trader',
  name: 'Dana US',
  jurisdiction: 'US',
  usd: 500_000n,
  pyr: 0n,
});
const gbSeller = px.registerTrader({
  customerId: 'cust_gb_seller',
  name: 'Eli GB',
  jurisdiction: 'GB',
  usd: 50_000n,
  pyr: 20_000n,
});
const gbBuyer = px.registerTrader({
  customerId: 'cust_gb_buyer',
  name: 'Fay GB',
  jurisdiction: 'GB',
  usd: 400_000n,
  pyr: 0n,
});

const disabledBook = px.place({
  id: 'demo_us_order',
  customerId: usTrader.customerId,
  side: 'BUY',
  type: 'LIMIT',
  quantity: 100n,
  price: 20000n,
  sequence: 1,
});
log('exchange.us_disabled', {
  refused: !disabledBook.ok,
  reasons: disabledBook.ok ? [] : disabledBook.error.reasons,
  bookTouched: px.engine.getOrder('demo_us_order') !== undefined,
});

const listing = px.approveListing({
  jurisdiction: 'GB',
  capabilities: ['SPOT_TRADE', 'CROSS_BORDER_TRANSFER'],
  reason: 'recorded simulation listing approval — not confirmed by counsel',
});
log('exchange.listing_approved', {
  jurisdiction: listing.jurisdiction,
  status: listing.listingStatus,
  legalReviewState: listing.legalReviewState,
  spot: listing.capabilities.SPOT_TRADE,
});

const sell = must(
  px.place({
    id: 'demo_sell',
    customerId: gbSeller.customerId,
    side: 'SELL',
    type: 'LIMIT',
    quantity: 100n,
    price: 20000n,
    sequence: 2,
  }),
  'gb sell',
);
const buy = must(
  px.place({
    id: 'demo_buy',
    customerId: gbBuyer.customerId,
    side: 'BUY',
    type: 'LIMIT',
    quantity: 60n,
    price: 20000n,
    sequence: 3,
  }),
  'gb buy',
);
log('exchange.price_time_partial', {
  fills: buy.fills.map((fill) => ({
    id: fill.id,
    qty: fill.quantity.toString(),
    price: fill.price.toString(),
    maker: fill.makerOrderId,
  })),
  sellerRemaining: px.engine.getOrder('demo_sell')?.remaining.toString(),
  sellerState: px.engine.getOrder('demo_sell')?.state,
  snapshot: px.marketData.snapshot('PYR/USD'),
});

const blockedName = px.registerTrader({
  customerId: 'cust_gb_blocked',
  name: 'Blocked Person',
  jurisdiction: 'GB',
  usd: 10_000n,
});
const complianceRefuse = px.place({
  id: 'demo_blocked',
  customerId: blockedName.customerId,
  side: 'BUY',
  type: 'LIMIT',
  quantity: 10n,
  price: 20000n,
  sequence: 4,
});
log('exchange.compliance_refused_never_on_book', {
  refused: !complianceRefuse.ok,
  onBook: px.engine.getOrder('demo_blocked') !== undefined,
  evidence: !complianceRefuse.ok ? complianceRefuse.error.evidenceId : undefined,
});

const replay = px.replay();
log(
  'exchange.manipulation_replay',
  replay.map((row) => ({
    scenario: row.scenario,
    detected: row.detected,
    type: row.alerts[0]?.type,
    evidence: row.alerts[0]?.evidence,
    explanation: row.alerts[0]?.explanation,
  })),
);

px.custody.injectUncorrectedDivergence(gbBuyer.customerId, 'PYR', 7n);
const divergence = px.reconcile();
log('exchange.reconciliation_halt', divergence);

px.toggleKillSwitch('WITHDRAWALS', true, 'operator halt of withdrawals — no AI involved');
px.toggleKillSwitch('FIAT_GATEWAY', true, 'operator halt of fiat gateway');
log('exchange.kill_switches', px.kills.snapshot());

const travel = px.transfer({
  id: 'demo_travel',
  actor: px.operator,
  occurredAt: NOW,
  assetId: 'PYR',
  quantity: 5n,
  originatorCustomerId: gbSeller.customerId,
  beneficiaryCustomerId: gbBuyer.customerId,
  originatorJurisdiction: 'GB',
  beneficiaryJurisdiction: 'US',
  originatorFields: { legalName: 'Eli GB' },
  beneficiaryFields: { legalName: 'Fay GB' },
});
log('exchange.travel_rule_refused', {
  refused: !travel.ok,
  queued: travel.ok ? undefined : travel.error.queued,
  reasons: travel.ok ? [] : travel.error.reasons,
});

const fiat = px.fiatConvert(gbBuyer.customerId, 'GB', Money.fromDecimalString('10.00', 'USD'));
log('exchange.fiat_gateway_disabled', { refused: !fiat.ok, error: fiat.ok ? undefined : fiat.error });

log('exchange.evidence_chain', px.evidenceVerified());
log('exchange.flags', { LIVE_EXCHANGE_ENABLED, ENVIRONMENT });

console.log('demo: ok');
