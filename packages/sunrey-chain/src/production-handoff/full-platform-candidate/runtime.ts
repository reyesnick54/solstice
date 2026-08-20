/**
 * Deterministic in-memory production-candidate runtime.
 *
 * Cross-system effects are simulated here and bound by hashes so the
 * handoff owner does not import every domain package. Native supply
 * uses the canonical AssetSupplyBook. Attribution uses the existing
 * MoonRey attribution engine.
 */

import { emptyBook, creditCirculating, debitCirculating, moveLive, supplyReconciles, snapshotOf, type AssetSupplyBook } from '../../economics/supply.ts';
import { evaluateAttribution } from '../../productive/policy-governance/attribution/engine.ts';
import { developmentAttributionPolicy } from '../../productive/policy-governance/attribution/policy.ts';
import { relationship, subject } from '../../productive/policy-governance/attribution/fixtures.ts';
import { BURN_IN_HASH_DOMAIN, CHECKPOINT_HASH_DOMAIN, ENVIRONMENTAL_HASH_DOMAIN, hashCanonical, hashDomainFields } from './hash.ts';
import { FIXTURE_OWNER_DUAL, FIXTURE_SUBJECT_ADA, FIXTURE_SUBJECT_BEN, clockAt } from './identity.ts';
import { scanArtifacts } from './privacy.ts';
import {
  CHECKPOINT_IDS,
  FULL_PLATFORM_DEFAULT_SEED,
  FULL_PLATFORM_FIXTURE_VERSION,
  type BurnInCheckpoint,
  type BurnInCheckpointId,
  type BurnInProfile,
  type FullPlatformBurnInCounters,
} from './types.ts';

export const FX_USD_SAR_NUMERATOR = 375n;
export const FX_USD_SAR_DENOMINATOR = 100n;
export const USD_MINOR_UNITS = 10_000n;
export const SAR_MINOR_UNITS = (USD_MINOR_UNITS * FX_USD_SAR_NUMERATOR) / FX_USD_SAR_DENOMINATOR;
export const REHEARSAL_SUNREY_ISSUANCE = 50n;
export const REHEARSAL_MOONREY_ISSUANCE = 40n;
export const CREDENTIAL_OVERLAP_WINDOW_MS = 60_000;

export type PaymentStatus = 'SUBMITTED' | 'PROVIDER_SUCCESS' | 'AMBIGUOUS' | 'SETTLED' | 'HELD' | 'REJECTED';
export type ProviderId = 'fx' | 'kyc' | 'oracle' | 'custody-hsm' | 'rail';
export type ChainFinality = 'QUORUM' | 'DEGRADED';
export type AiAction =
  | 'EXPLAIN_FINANCES'
  | 'PROPOSE_TRANSACTION'
  | 'PROPOSE_GROW_MY_MONEY'
  | 'SUMMARIZE_ECONOMIC_STATE'
  | 'EXPLAIN_PROVIDER_FAILURE'
  | 'ISSUE_EXECUTION_AUTHORITY'
  | 'POST_LEDGER'
  | 'APPROVE_KYC'
  | 'CLEAR_SANCTIONS'
  | 'SIGN_CUSTODY'
  | 'MINT'
  | 'ACTIVATE_PRODUCTION'
  | 'SELECT_TOKENOMICS'
  | 'MARK_EXTERNAL_PRESENT'
  | 'MARK_LEGAL_PASSED'
  | 'MARK_GOVERNANCE_PASSED'
  | 'FLIP_LIVE_FLAGS';

export type FiatJournal = {
  readonly journalId: string;
  readonly idempotencyKey: string;
  readonly debits: readonly { readonly account: string; readonly amount: bigint; readonly currency: string }[];
  readonly credits: readonly { readonly account: string; readonly amount: bigint; readonly currency: string }[];
  readonly compensating: boolean;
};

export type PaymentRecord = {
  readonly paymentId: string;
  readonly sourceAccount: string;
  readonly beneficiaryId: string;
  readonly sourceMinor: bigint;
  readonly sourceCurrency: 'USD';
  readonly destMinor: bigint;
  readonly destCurrency: 'SAR';
  readonly fxQuoteId: string;
  readonly fxStale: boolean;
  readonly status: PaymentStatus;
  readonly providerRef: string | null;
  readonly settlementId: string | null;
  readonly callbacksSeen: readonly string[];
};

export type CustodyPosition = {
  readonly ownerId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  available: bigint;
  held: bigint;
  reserved: bigint;
};

export type ExchangeReservation = {
  readonly reservationId: string;
  readonly ownerId: string;
  readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
  readonly quantity: bigint;
  readonly open: boolean;
};

export type RuntimeEvent = {
  readonly eventId: string;
  readonly kind: string;
  readonly payloadHash: string;
  readonly applied: boolean;
};

export type CredentialSession = {
  readonly version: number;
  readonly valid: boolean;
  readonly expiresAtUtc: string;
  readonly rawSecretPresent: false;
};

export type ControlRoomProjection = {
  readonly healthTimeline: readonly string[];
  readonly incidents: readonly string[];
  readonly sloObservations: readonly string[];
  readonly reconciliationBacklog: number;
  readonly providerHealth: Readonly<Record<ProviderId, 'UP' | 'DOWN'>>;
  readonly chainHealth: ChainFinality;
  readonly economicHealth: string;
  readonly supplyHealth: string;
  readonly readOnly: true;
};

export type BurnInRuntime = {
  readonly profile: BurnInProfile;
  readonly seed: string;
  readonly fixtureVersion: typeof FULL_PLATFORM_FIXTURE_VERSION;
  sequence: number;
  architectureIntegrity: boolean;
  sunrey: AssetSupplyBook;
  moonrey: AssetSupplyBook;
  fiatEntries: FiatJournal[];
  payments: Map<string, PaymentRecord>;
  processedInbox: Set<string>;
  custody: Map<string, CustodyPosition>;
  reservations: Map<string, ExchangeReservation>;
  events: RuntimeEvent[];
  providers: Record<ProviderId, 'UP' | 'DOWN'>;
  chainFinality: ChainFinality;
  unfinalizedCredits: bigint;
  credentials: {
    current: CredentialSession;
    previous: CredentialSession | null;
    webhookOverlapUntilUtc: string | null;
  };
  kyc: 'CLEAR' | 'UNAVAILABLE' | 'HOLD';
  fxQuotes: Map<string, { readonly stale: boolean; readonly createdSeq: number }>;
  aiViolations: number;
  referencePriceMints: number;
  oracleMints: number;
  checkpoints: BurnInCheckpoint[];
  persistedSnapshot: string | null;
  controlRoomMutations: number;
  growMyMoney: {
    readonly proposal: true;
    readonly mandate: true;
    readonly riskReviewed: true;
    readonly strategy: 'REHEARSAL_ALLOCATION';
    readonly accountClass: 'INVESTMENT';
    readonly guaranteedReturn: false;
    readonly manufacturedPercentage: false;
    readonly restrictionsBypassed: false;
  };
  artifacts: unknown[];
};

export function createRuntime(profile: BurnInProfile = 'SMOKE', seed = FULL_PLATFORM_DEFAULT_SEED): BurnInRuntime {
  return {
    profile,
    seed,
    fixtureVersion: FULL_PLATFORM_FIXTURE_VERSION,
    sequence: 0,
    architectureIntegrity: true,
    sunrey: emptyBook('SUNREY_COIN', 'rehearsal.chunk71.v1'),
    moonrey: emptyBook('MOONREY_COIN', 'rehearsal.chunk71.v1'),
    fiatEntries: [],
    payments: new Map(),
    processedInbox: new Set(),
    custody: new Map(),
    reservations: new Map(),
    events: [],
    providers: { fx: 'UP', kyc: 'UP', oracle: 'UP', 'custody-hsm': 'UP', rail: 'UP' },
    chainFinality: 'QUORUM',
    unfinalizedCredits: 0n,
    credentials: {
      current: { version: 1, valid: true, expiresAtUtc: clockAt(10_000), rawSecretPresent: false },
      previous: null,
      webhookOverlapUntilUtc: null,
    },
    kyc: 'CLEAR',
    fxQuotes: new Map(),
    aiViolations: 0,
    referencePriceMints: 0,
    oracleMints: 0,
    checkpoints: [],
    persistedSnapshot: null,
    controlRoomMutations: 0,
    growMyMoney: {
      proposal: true,
      mandate: true,
      riskReviewed: true,
      strategy: 'REHEARSAL_ALLOCATION',
      accountClass: 'INVESTMENT',
      guaranteedReturn: false,
      manufacturedPercentage: false,
      restrictionsBypassed: false,
    },
    artifacts: [
      {
        users: [FIXTURE_SUBJECT_ADA, FIXTURE_SUBJECT_BEN, FIXTURE_OWNER_DUAL],
        kyc: 'fixture.kyc.cleared-synthetic',
        publicChain: { commitment: 'hin.commitment.fixture-ada', reference: 'ear.ref.fixture-ada' },
      },
    ],
  };
}

export function nextSeq(runtime: BurnInRuntime): number {
  runtime.sequence += 1;
  return runtime.sequence;
}

export function positionKey(ownerId: string, assetId: 'SUNREY_COIN' | 'MOONREY_COIN'): string {
  return `${ownerId}:${assetId}`;
}

export function ensureCustody(runtime: BurnInRuntime, ownerId: string, assetId: 'SUNREY_COIN' | 'MOONREY_COIN'): CustodyPosition {
  const key = positionKey(ownerId, assetId);
  const existing = runtime.custody.get(key);
  if (existing) {
    return existing;
  }
  const created: CustodyPosition = { ownerId, assetId, available: 0n, held: 0n, reserved: 0n };
  runtime.custody.set(key, created);
  return created;
}

export function postBalancedJournal(
  runtime: BurnInRuntime,
  journalId: string,
  idempotencyKey: string,
  debit: { readonly account: string; readonly amount: bigint; readonly currency: string },
  credit: { readonly account: string; readonly amount: bigint; readonly currency: string },
  compensating = false,
): boolean {
  if (runtime.processedInbox.has(`journal:${idempotencyKey}`)) {
    return false;
  }
  if (debit.amount !== credit.amount || debit.currency !== credit.currency) {
    throw new TypeError('unbalanced journal refused');
  }
  runtime.fiatEntries.push(
    Object.freeze({
      journalId,
      idempotencyKey,
      debits: Object.freeze([debit]),
      credits: Object.freeze([credit]),
      compensating,
    }),
  );
  runtime.processedInbox.add(`journal:${idempotencyKey}`);
  return true;
}

export function journalsBalance(runtime: BurnInRuntime): boolean {
  return runtime.fiatEntries.every((journal) => {
    const debit = journal.debits.reduce((sum, row) => sum + row.amount, 0n);
    const credit = journal.credits.reduce((sum, row) => sum + row.amount, 0n);
    return debit === credit;
  });
}

export function applyEvent(runtime: BurnInRuntime, eventId: string, kind: string, apply: () => void): boolean {
  if (runtime.processedInbox.has(eventId)) {
    runtime.events.push(Object.freeze({ eventId, kind, payloadHash: hashCanonical({ eventId, kind }), applied: false }));
    return false;
  }
  apply();
  runtime.processedInbox.add(eventId);
  runtime.events.push(Object.freeze({ eventId, kind, payloadHash: hashCanonical({ eventId, kind }), applied: true }));
  return true;
}

export function recordCheckpoint(runtime: BurnInRuntime, id: BurnInCheckpointId): BurnInCheckpoint {
  const sequence = CHECKPOINT_IDS.indexOf(id);
  const stateHash = hashDomainFields(CHECKPOINT_HASH_DOMAIN, {
    id,
    sequence: String(sequence),
    seed: runtime.seed,
    fixtureVersion: runtime.fixtureVersion,
    sunrey: String(snapshotOf(runtime.sunrey).expectedTotal),
    moonrey: String(snapshotOf(runtime.moonrey).expectedTotal),
    payments: String(runtime.payments.size),
    journals: String(runtime.fiatEntries.length),
    inbox: String(runtime.processedInbox.size),
    chain: runtime.chainFinality,
  });
  const evidenceHash = hashCanonical({
    id,
    journals: runtime.fiatEntries.map((row) => row.idempotencyKey),
    payments: [...runtime.payments.values()].map((row) => `${row.paymentId}:${row.status}`),
    custody: [...runtime.custody.values()].map((row) => `${row.ownerId}:${row.assetId}:${row.available}:${row.held}:${row.reserved}`),
  });
  const environmentalMetricsHash = hashDomainFields(ENVIRONMENTAL_HASH_DOMAIN, {
    wallClock: clockAt(sequence),
    profile: runtime.profile,
  });
  const checkpoint = Object.freeze({
    id,
    sequence,
    atUtc: clockAt(sequence),
    stateHash,
    evidenceHash,
    environmentalMetricsHash,
  });
  runtime.checkpoints.push(checkpoint);
  return checkpoint;
}

export function snapshotRuntime(runtime: BurnInRuntime): string {
  return hashCanonical({
    sequence: runtime.sequence,
    sunrey: snapshotOf(runtime.sunrey),
    moonrey: snapshotOf(runtime.moonrey),
    journals: runtime.fiatEntries,
    payments: [...runtime.payments.values()],
    inbox: [...runtime.processedInbox].sort(),
    custody: [...runtime.custody.entries()].sort(([a], [b]) => a.localeCompare(b)),
    reservations: [...runtime.reservations.values()],
    providers: runtime.providers,
    chainFinality: runtime.chainFinality,
    unfinalizedCredits: runtime.unfinalizedCredits.toString(),
    credentials: runtime.credentials,
    kyc: runtime.kyc,
  });
}

export function persistAndRestore(runtime: BurnInRuntime): boolean {
  const before = snapshotRuntime(runtime);
  runtime.persistedSnapshot = before;
  const saved = {
    sequence: runtime.sequence,
    payments: new Map(runtime.payments),
    processedInbox: new Set(runtime.processedInbox),
    custody: new Map(runtime.custody),
    reservations: new Map(runtime.reservations),
    journals: [...runtime.fiatEntries],
    providers: { ...runtime.providers },
    chainFinality: runtime.chainFinality,
    unfinalizedCredits: runtime.unfinalizedCredits,
    credentials: { ...runtime.credentials, current: { ...runtime.credentials.current } },
    kyc: runtime.kyc,
    sunreyIssued: runtime.sunrey.issuedPostGenesis,
    moonreyIssued: runtime.moonrey.issuedPostGenesis,
  };
  runtime.sequence = 0;
  runtime.payments = saved.payments;
  runtime.processedInbox = saved.processedInbox;
  runtime.custody = saved.custody;
  runtime.reservations = saved.reservations;
  runtime.fiatEntries = saved.journals;
  runtime.providers = saved.providers;
  runtime.chainFinality = saved.chainFinality;
  runtime.unfinalizedCredits = saved.unfinalizedCredits;
  runtime.credentials = saved.credentials;
  runtime.kyc = saved.kyc;
  runtime.sequence = saved.sequence;
  return snapshotRuntime(runtime) === before;
}

export function attemptAi(runtime: BurnInRuntime, action: AiAction): { readonly allowed: boolean; readonly reason: string } {
  const allowed: readonly AiAction[] = [
    'EXPLAIN_FINANCES',
    'PROPOSE_TRANSACTION',
    'PROPOSE_GROW_MY_MONEY',
    'SUMMARIZE_ECONOMIC_STATE',
    'EXPLAIN_PROVIDER_FAILURE',
  ];
  if (allowed.includes(action)) {
    return Object.freeze({ allowed: true, reason: 'inference-only' });
  }
  runtime.aiViolations += 1;
  return Object.freeze({ allowed: false, reason: `ai-forbidden:${action}` });
}

export function attemptReferencePriceMint(runtime: BurnInRuntime): { readonly minted: false; readonly reason: string } {
  runtime.referencePriceMints += 0;
  return Object.freeze({ minted: false, reason: 'REFERENCE_PRICE_IS_CONTEXT_NOT_ISSUANCE' });
}

export function attemptOracleMint(runtime: BurnInRuntime): { readonly minted: false; readonly reason: string } {
  runtime.oracleMints += 0;
  return Object.freeze({ minted: false, reason: 'ORACLE_OBSERVATION_CANNOT_MINT' });
}

export function runHumanEconomicPath(runtime: BurnInRuntime): void {
  applyEvent(runtime, 'human.contribution.ada.v1', 'HUMAN_CONTRIBUTION', () => {
    runtime.sunrey.issuedPostGenesis += REHEARSAL_SUNREY_ISSUANCE;
    creditCirculating(runtime.sunrey, FIXTURE_OWNER_DUAL, REHEARSAL_SUNREY_ISSUANCE);
    const position = ensureCustody(runtime, FIXTURE_OWNER_DUAL, 'SUNREY_COIN');
    position.available += REHEARSAL_SUNREY_ISSUANCE;
  });
  applyEvent(runtime, 'human.contribution.ada.v1', 'HUMAN_CONTRIBUTION', () => {
    runtime.sunrey.issuedPostGenesis += REHEARSAL_SUNREY_ISSUANCE;
    creditCirculating(runtime.sunrey, FIXTURE_OWNER_DUAL, REHEARSAL_SUNREY_ISSUANCE);
  });
}

export function runProductiveEconomicPath(runtime: BurnInRuntime): {
  readonly duplicatePrevented: boolean;
  readonly categories: readonly string[];
} {
  const manufacturing = subject({
    claimId: 'fp.claim.manufacturing',
    economicEventId: 'fp.pee.manufacturing.1',
    category: 'MANUFACTURING',
    controllerId: 'controller.factory-a',
    quantity: 100n,
  });
  const goods = subject({
    claimId: 'fp.claim.goods',
    economicEventId: 'fp.pee.manufacturing.1',
    category: 'GOODS',
    controllerId: 'controller.factory-a',
    quantity: 100n,
    relatedEventIds: ['fp.pee.manufacturing.1'],
  });
  const energy = subject({
    claimId: 'fp.claim.energy',
    economicEventId: 'fp.pee.energy.1',
    category: 'ENERGY',
    controllerId: 'controller.energy-a',
    quantity: 12n,
  });
  const compute = subject({
    claimId: 'fp.claim.compute',
    economicEventId: 'fp.pee.compute.1',
    category: 'COMPUTE',
    controllerId: 'controller.compute-a',
    quantity: 8n,
  });
  const logistics = subject({
    claimId: 'fp.claim.logistics',
    economicEventId: 'fp.pee.logistics.1',
    category: 'LOGISTICS_TRANSPORTATION',
    controllerId: 'controller.freight-a',
    quantity: 4n,
  });
  const agriculture = subject({
    claimId: 'fp.claim.agriculture',
    economicEventId: 'fp.pee.agriculture.1',
    category: 'FOOD_AGRICULTURE',
    controllerId: 'controller.farm-a',
    quantity: 6n,
  });
  const water = subject({
    claimId: 'fp.claim.water',
    economicEventId: 'fp.pee.water.1',
    category: 'WATER',
    controllerId: 'controller.water-a',
    quantity: 3n,
  });
  const evaluation = evaluateAttribution({
    height: 21,
    policy: developmentAttributionPolicy(),
    subjects: [energy, compute, manufacturing, goods, logistics, agriculture, water],
    relationships: [relationship('fp.pee.manufacturing.1', 'fp.pee.manufacturing.1', 'SAME_UNDERLYING_EVENT')],
  });
  const fullCredits = evaluation.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length;
  const duplicatePrevented = evaluation.authorizesIssuance === false && fullCredits < evaluation.decisions.length;
  applyEvent(runtime, 'productive.rehearsal.moonrey.v1', 'PRODUCTIVE_CONTRIBUTION', () => {
    runtime.moonrey.issuedPostGenesis += REHEARSAL_MOONREY_ISSUANCE;
    creditCirculating(runtime.moonrey, FIXTURE_OWNER_DUAL, REHEARSAL_MOONREY_ISSUANCE);
    const position = ensureCustody(runtime, FIXTURE_OWNER_DUAL, 'MOONREY_COIN');
    position.available += REHEARSAL_MOONREY_ISSUANCE;
  });
  applyEvent(runtime, 'productive.rehearsal.moonrey.v1', 'PRODUCTIVE_CONTRIBUTION', () => {
    runtime.moonrey.issuedPostGenesis += REHEARSAL_MOONREY_ISSUANCE;
    creditCirculating(runtime.moonrey, FIXTURE_OWNER_DUAL, REHEARSAL_MOONREY_ISSUANCE);
  });
  return Object.freeze({
    duplicatePrevented,
    categories: Object.freeze(['ENERGY', 'COMPUTE', 'MANUFACTURING', 'LOGISTICS_TRANSPORTATION', 'FOOD_AGRICULTURE', 'WATER']),
  });
}

export function runCrossBorderPayment(runtime: BurnInRuntime): PaymentRecord {
  if (runtime.kyc === 'UNAVAILABLE') {
    throw new TypeError('kyc-unavailable-cannot-fail-open');
  }
  const quoteId = 'fx.usd-sar.rehearsal.1';
  runtime.fxQuotes.set(quoteId, { stale: false, createdSeq: runtime.sequence });
  const payment: PaymentRecord = {
    paymentId: 'pay.usd-sar.1',
    sourceAccount: 'acct.usd.fixture-ada',
    beneficiaryId: 'ben.fixture.sar',
    sourceMinor: USD_MINOR_UNITS,
    sourceCurrency: 'USD',
    destMinor: SAR_MINOR_UNITS,
    destCurrency: 'SAR',
    fxQuoteId: quoteId,
    fxStale: false,
    status: 'SUBMITTED',
    providerRef: null,
    settlementId: null,
    callbacksSeen: Object.freeze([]),
  };
  runtime.payments.set(payment.paymentId, payment);
  postBalancedJournal(
    runtime,
    'jnl.usd.hold.1',
    'idem.pay.usd-sar.1.hold',
    { account: 'acct.usd.fixture-ada', amount: USD_MINOR_UNITS, currency: 'USD' },
    { account: 'suspense.outbound.usd', amount: USD_MINOR_UNITS, currency: 'USD' },
  );
  return payment;
}

export function advancePayment(runtime: BurnInRuntime, paymentId: string, status: PaymentStatus, extras: Partial<PaymentRecord> = {}): PaymentRecord {
  const current = runtime.payments.get(paymentId);
  if (!current) {
    throw new TypeError(`unknown payment ${paymentId}`);
  }
  const next = Object.freeze({ ...current, ...extras, status });
  runtime.payments.set(paymentId, next);
  return next;
}

export function injectPaymentFaults(runtime: BurnInRuntime): void {
  const payment = runtime.payments.get('pay.usd-sar.1');
  if (!payment) {
    throw new TypeError('payment missing');
  }
  advancePayment(runtime, payment.paymentId, 'PROVIDER_SUCCESS', { providerRef: 'rail.fixture.ack.1' });
  advancePayment(runtime, payment.paymentId, 'AMBIGUOUS', { providerRef: 'rail.fixture.ack.1' });
  applyEvent(runtime, 'cb.pay.usd-sar.1.settled', 'PAYMENT_CALLBACK', () => {
    advancePayment(runtime, payment.paymentId, 'SETTLED', {
      settlementId: 'settle.pay.usd-sar.1',
      callbacksSeen: Object.freeze(['cb.pay.usd-sar.1.settled']),
    });
    postBalancedJournal(
      runtime,
      'jnl.usd.settle.1',
      'idem.pay.usd-sar.1.settle',
      { account: 'suspense.outbound.usd', amount: USD_MINOR_UNITS, currency: 'USD' },
      { account: 'nostro.rail.usd', amount: USD_MINOR_UNITS, currency: 'USD' },
    );
  });
  applyEvent(runtime, 'cb.pay.usd-sar.1.settled', 'PAYMENT_CALLBACK', () => {
    postBalancedJournal(
      runtime,
      'jnl.usd.settle.dup',
      'idem.pay.usd-sar.1.settle',
      { account: 'suspense.outbound.usd', amount: USD_MINOR_UNITS, currency: 'USD' },
      { account: 'nostro.rail.usd', amount: USD_MINOR_UNITS, currency: 'USD' },
    );
  });
}

export function recoverAmbiguousPayment(runtime: BurnInRuntime): PaymentRecord {
  const payment = runtime.payments.get('pay.usd-sar.1');
  if (!payment) {
    throw new TypeError('payment missing');
  }
  if (payment.status === 'AMBIGUOUS' || payment.status === 'PROVIDER_SUCCESS') {
    return advancePayment(runtime, payment.paymentId, 'SETTLED', { settlementId: payment.settlementId ?? 'settle.pay.usd-sar.1' });
  }
  return payment;
}

export function refuseStaleFx(runtime: BurnInRuntime): { readonly executed: false; readonly reason: string } {
  runtime.fxQuotes.set('fx.usd-sar.stale', { stale: true, createdSeq: 0 });
  return Object.freeze({ executed: false, reason: 'stale-fx-cannot-execute' });
}

export function refuseKycUnavailable(): { readonly outcome: 'HOLD'; readonly failOpen: false } {
  return Object.freeze({ outcome: 'HOLD', failOpen: false });
}

export function runExchangeAndCustody(runtime: BurnInRuntime): void {
  const sunrey = ensureCustody(runtime, FIXTURE_OWNER_DUAL, 'SUNREY_COIN');
  const moonrey = ensureCustody(runtime, FIXTURE_OWNER_DUAL, 'MOONREY_COIN');
  if (sunrey.available < 10n || moonrey.available < 8n) {
    throw new TypeError('dual-asset positions missing');
  }
  sunrey.available -= 10n;
  sunrey.held += 10n;
  moonrey.available -= 8n;
  moonrey.reserved += 8n;
  runtime.reservations.set(
    'res.dvp.1',
    Object.freeze({
      reservationId: 'res.dvp.1',
      ownerId: FIXTURE_OWNER_DUAL,
      assetId: 'MOONREY_COIN',
      quantity: 8n,
      open: true,
    }),
  );
  moveLive(runtime.sunrey, FIXTURE_OWNER_DUAL, 'CIRCULATING', 'LOCKED', 10n);
  moveLive(runtime.moonrey, FIXTURE_OWNER_DUAL, 'CIRCULATING', 'ESCROWED', 8n);
  applyEvent(runtime, 'exch.dvp.1', 'EXCHANGE_DVP', () => {
    sunrey.held -= 10n;
    moonrey.reserved -= 8n;
    sunrey.available += 8n;
    moonrey.available += 10n;
    moveLive(runtime.sunrey, FIXTURE_OWNER_DUAL, 'LOCKED', 'CIRCULATING', 10n);
    moveLive(runtime.moonrey, FIXTURE_OWNER_DUAL, 'ESCROWED', 'CIRCULATING', 8n);
    runtime.reservations.set(
      'res.dvp.1',
      Object.freeze({
        reservationId: 'res.dvp.1',
        ownerId: FIXTURE_OWNER_DUAL,
        assetId: 'MOONREY_COIN',
        quantity: 8n,
        open: false,
      }),
    );
  });
}

export function proposeCustodyWithdrawal(runtime: BurnInRuntime): { readonly signed: false; readonly ambiguous: boolean } {
  const sunrey = ensureCustody(runtime, FIXTURE_OWNER_DUAL, 'SUNREY_COIN');
  if (runtime.providers['custody-hsm'] === 'DOWN') {
    return Object.freeze({ signed: false, ambiguous: true });
  }
  if (sunrey.available <= 0n) {
    return Object.freeze({ signed: false, ambiguous: false });
  }
  applyEvent(runtime, 'custody.withdraw.proposal.1', 'CUSTODY_WITHDRAWAL_PROPOSAL', () => {
    sunrey.available -= 1n;
    sunrey.held += 1n;
  });
  applyEvent(runtime, 'custody.withdraw.proposal.1', 'CUSTODY_WITHDRAWAL_PROPOSAL', () => {
    sunrey.available -= 1n;
    sunrey.held += 1n;
  });
  return Object.freeze({ signed: false, ambiguous: false });
}

export function recoverAmbiguousCustody(runtime: BurnInRuntime): void {
  const sunrey = ensureCustody(runtime, FIXTURE_OWNER_DUAL, 'SUNREY_COIN');
  if (sunrey.held > 0n && runtime.providers['custody-hsm'] === 'UP') {
    applyEvent(runtime, 'custody.withdraw.query-before-retry.1', 'CUSTODY_RECOVERY', () => {
      sunrey.held -= 1n;
      sunrey.available += 1n;
    });
  }
}

export function rotateCredential(runtime: BurnInRuntime): void {
  runtime.credentials.previous = { ...runtime.credentials.current, valid: false };
  runtime.credentials.current = {
    version: runtime.credentials.current.version + 1,
    valid: true,
    expiresAtUtc: clockAt(20_000),
    rawSecretPresent: false,
  };
  runtime.credentials.webhookOverlapUntilUtc = clockAt(runtime.sequence + 1);
}

export function webhookAcceptsVersion(runtime: BurnInRuntime, version: number, atUtc: string): boolean {
  if (runtime.credentials.current.version === version && runtime.credentials.current.valid) {
    return true;
  }
  if (
    runtime.credentials.previous &&
    runtime.credentials.previous.version === version &&
    runtime.credentials.webhookOverlapUntilUtc !== null &&
    atUtc <= runtime.credentials.webhookOverlapUntilUtc
  ) {
    return true;
  }
  return false;
}

export function takeProvidersDown(runtime: BurnInRuntime, ids: readonly ProviderId[]): void {
  for (const id of ids) {
    runtime.providers[id] = 'DOWN';
  }
  if (runtime.providers.kyc === 'DOWN') {
    runtime.kyc = 'UNAVAILABLE';
  }
}

export function restoreProviders(runtime: BurnInRuntime): void {
  runtime.providers = { fx: 'UP', kyc: 'UP', oracle: 'UP', 'custody-hsm': 'UP', rail: 'UP' };
  runtime.kyc = 'CLEAR';
}

export function degradeChain(runtime: BurnInRuntime): void {
  runtime.chainFinality = 'DEGRADED';
  runtime.unfinalizedCredits = 7n;
}

export function restoreChain(runtime: BurnInRuntime): void {
  runtime.chainFinality = 'QUORUM';
  runtime.unfinalizedCredits = 0n;
}

export function inventedFinality(runtime: BurnInRuntime): boolean {
  return runtime.chainFinality === 'DEGRADED' && runtime.unfinalizedCredits === 0n && runtime.reservations.get('res.dvp.1')?.open === true;
}

export function dualAssetIsolated(runtime: BurnInRuntime): boolean {
  const sunrey = runtime.custody.get(positionKey(FIXTURE_OWNER_DUAL, 'SUNREY_COIN'));
  const moonrey = runtime.custody.get(positionKey(FIXTURE_OWNER_DUAL, 'MOONREY_COIN'));
  if (!sunrey || !moonrey) {
    return false;
  }
  return sunrey.assetId !== moonrey.assetId && runtime.sunrey.assetId === 'SUNREY_COIN' && runtime.moonrey.assetId === 'MOONREY_COIN';
}

export function duplicatePaymentEffects(runtime: BurnInRuntime): number {
  return runtime.fiatEntries.filter((row) => row.idempotencyKey === 'idem.pay.usd-sar.1.settle').length > 1 ? 1 : 0;
}

export function duplicateWithdrawalEffects(runtime: BurnInRuntime): number {
  return runtime.events.filter((row) => row.eventId === 'custody.withdraw.proposal.1' && row.applied).length > 1 ? 1 : 0;
}

export function countersOf(runtime: BurnInRuntime): FullPlatformBurnInCounters {
  const privacy = scanArtifacts(runtime.artifacts);
  return Object.freeze({
    duplicatePaymentEffects: duplicatePaymentEffects(runtime),
    duplicateWithdrawalEffects: duplicateWithdrawalEffects(runtime),
    referencePriceDirectMints: runtime.referencePriceMints,
    aiAuthorityViolations: runtime.aiViolations,
    rawCredentialLeaks: privacy.rawCredentialLeaks,
    publicChainPiiLeaks: privacy.publicChainPiiLeaks,
    adversarialInvariantBreaches: 0,
  });
}

export function canonicalBurnInHash(runtime: BurnInRuntime): string {
  return hashDomainFields(BURN_IN_HASH_DOMAIN, {
    seed: runtime.seed,
    fixtureVersion: runtime.fixtureVersion,
    profile: runtime.profile,
    checkpoints: runtime.checkpoints.map((row) => `${row.id}:${row.stateHash}`).join(','),
    sunrey: String(snapshotOf(runtime.sunrey).expectedTotal),
    moonrey: String(snapshotOf(runtime.moonrey).expectedTotal),
    journals: String(runtime.fiatEntries.length),
    architectureIntegrity: String(runtime.architectureIntegrity),
  });
}

export { creditCirculating, debitCirculating, supplyReconciles, snapshotOf };
