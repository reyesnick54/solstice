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
import { SolsticeSystem } from '@solstice/payments';
import { LIVE_CRYPTO_ENABLED, LIVE_DATA_MARKET_ENABLED } from '@solstice/flags';
import { PyramidEconomy } from '@solstice/data-exchange';
import { PyrAmount, customerAccountId } from '@solstice/pyr-ledger';
import { GrowthAttributionLedger } from '@solstice/platform';
import { asEventId, Money as AttributionMoney } from '@solstice/contracts';

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

console.log('\n=== Solstice Phase 8 — Pyramid Economy (simulation) ===');
log('phase8.flags', {
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  note: 'unchanged; both false',
});

const pyramid = new PyramidEconomy();
const janeId = asCustomerId('cust_jane');
const mayaId = asCustomerId('cust_maya');
pyramid.openCorporateBooks();
pyramid.openCustomerWallet(janeId, 'US');
pyramid.openCustomerWallet(mayaId, 'US');
pyramid.vault.put({
  customerId: janeId,
  jurisdiction: 'US',
  eligibleCategories: ['WELLNESS'],
  cohortTokens: ['adult'],
});
pyramid.vault.put({
  customerId: mayaId,
  jurisdiction: 'US',
  eligibleCategories: ['WELLNESS'],
  cohortTokens: ['adult'],
});

const sponsor = pyramid.registerVerifiedSponsor();
log('phase8.sponsor', {
  id: sponsor.id,
  verified: sponsor.verified,
  note: 'in-process simulation fixture; not a fabricated market participant',
});

const request = pyramid.publishRequest(sponsor);
log('phase8.request', {
  id: request.id,
  categories: request.dataCategories,
  purpose: request.purpose,
  jurisdiction: request.jurisdiction,
  compensationMinorUnits: request.compensationMinorUnits.toString(),
  identityExposureLevel: request.identityExposureLevel,
});

const buyerView = pyramid.match(request);
log('phase8.match.buyer_view', {
  ...buyerView,
  eligibleCount: buyerView.eligibleCount.toString(),
  identitiesRevealed: false,
});
log('phase8.opportunities', {
  jane: pyramid.opportunitiesForCustomer(janeId).length,
  maya: pyramid.opportunitiesForCustomer(mayaId).length,
});

const janeConsent = pyramid.offerConsent(janeId, request);
const mayaConsent = pyramid.offerConsent(mayaId, request);
const granted = pyramid.grant(janeConsent.id, janeId);
const declined = pyramid.decline(mayaConsent.id, mayaId);
log('phase8.consent', {
  jane: granted.status,
  maya: declined.status,
  mayaDataAccess: pyramid.consents.isActive(mayaConsent.id),
});

const job = pyramid.runCleanRoom(request, [janeConsent.id]);
log('phase8.clean_room', {
  jobId: job.jobId,
  status: job.status,
  recordsConsidered: job.recordsConsidered.toString(),
  resultHash: job.resultHash,
});

const settlementRef = 'settle_jane_wellness';
const settlement = pyramid.settle(request, janeId, settlementRef);
log('phase8.settlement', {
  customerJournalBalanced: true,
  corporateJournalBalanced: true,
  customerJournalId: settlement.customer.id,
  corporateJournalId: settlement.corporate.id,
  janePyr: pyramid.pyr.customerTotal(janeId).minorUnits.toString(),
  mayaPyr: pyramid.pyr.customerTotal(mayaId).minorUnits.toString(),
  corporateTreasury: pyramid.pyr.corporateTreasuryTotal().minorUnits.toString(),
  commingled: false,
});

const proof = pyramid.issueProof({
  contributionId: 'contrib_jane_wellness',
  consentReference: janeConsent.id,
  buyer: sponsor.id,
  purpose: request.purpose,
  dataCategories: request.dataCategories,
  computeJobReference: job.jobId,
  settlementRef,
  compensationMinorUnits: request.compensationMinorUnits,
});
const evidenceIds = new Set(pyramid.kernel.vault.list().map((row) => row.id));
const proofCheck = pyramid.proofs.verify(proof, pyramid.chain, evidenceIds);
const chainTx = pyramid.chain.query(proof.chainTxId);
log('phase8.proof', {
  contributionId: proof.contributionId,
  consentReference: proof.consentReference,
  buyer: proof.buyer,
  purpose: proof.purpose,
  dataCategories: proof.dataCategories,
  computeJobReference: proof.computeJobReference,
  completionState: proof.completionState,
  compensationMinorUnits: proof.compensationMinorUnits.toString(),
  compensationAsset: proof.compensationAsset,
  pyrSettlementReference: proof.pyrSettlementReference,
  cryptographicHash: proof.cryptographicHash,
  independentlyVerified: proofCheck.ok,
  chainKind: chainTx?.reference.kind,
  chainValue: chainTx?.reference.value,
  chainIsHashOnly: chainTx?.reference.kind === 'HASH',
});

const pdi = pyramid.index();
log('phase8.pdi', {
  kind: pdi.kind,
  buyerDemandRequestCount: pdi.buyerDemandRequestCount.toString(),
  availableContributorCount: pdi.availableContributorCount.toString(),
  averageCompensationMinorUnits: pdi.averageCompensationMinorUnits.toString(),
  averageCompensationNote: pdi.averageCompensationNote,
  geographicDemand: pdi.geographicDemand.map((row) => ({
    ...row,
    requestCount: row.requestCount.toString(),
  })),
  categoryDemand: pdi.categoryDemand.map((row) => ({
    ...row,
    requestCount: row.requestCount.toString(),
  })),
  historicalClearingPrices: pdi.historicalClearingPrices.map((row) => ({
    ...row,
    compensationMinorUnits: row.compensationMinorUnits.toString(),
  })),
});

const gal = new GrowthAttributionLedger();
gal.record({
  customerId: janeId,
  source: 'PYR_REWARD',
  amount: AttributionMoney.fromMinorUnits(0n, 'PYR'),
  originatingEventId: asEventId('evt_pyr_reward'),
  recordedAt: pyramid.now,
});
gal.record({
  customerId: janeId,
  source: 'DATA_EARNINGS',
  amount: AttributionMoney.fromMinorUnits(5000n, 'PYR'),
  originatingEventId: asEventId('evt_data_earnings'),
  recordedAt: pyramid.now,
});
const delta = gal.summarize({
  customerId: janeId,
  period: 'LIFETIME',
  from: pyramid.now,
  to: pyramid.now,
  currency: 'PYR',
});
log('phase8.growth', {
  PYR_REWARD: delta.bySource.PYR_REWARD.minorUnits.toString(),
  DATA_EARNINGS: delta.bySource.DATA_EARNINGS.minorUnits.toString(),
  distinctSources: true,
});

const refused = pyramid.attemptTransfer(
  customerAccountId(janeId, 'wallet'),
  customerAccountId(mayaId, 'wallet'),
  PyrAmount.fromMinorUnits(10n),
  'SA',
);
log('phase8.transfer_refused', {
  jurisdiction: 'SA',
  outcome: refused.outcome,
  reasons: refused.outcome === 'REFUSED' ? refused.reasons : [],
});

log('phase8.evidence', {
  records: pyramid.kernel.vault.size,
  verified: pyramid.kernel.vault.verifyChain(),
});
log('phase8.flags_unchanged', {
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
});

console.log('demo: ok');
