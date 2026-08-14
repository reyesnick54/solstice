/**
 * Phase 7 demo: Personal Data Fabric.
 *
 * populate synthetic vault → grant wellness-research consent → buyer
 * clean-room query returns an aggregate → advertising purpose is refused
 * → below-cohort refused → privacy budget depletes → consent revoked →
 * next query fails → every evidence record is shown and the chain verifies.
 *
 * Raw records never leave the vault. LIVE_DATA_MARKET_ENABLED stays false.
 */
import { asActorId, asCustomerId } from '@solstice/domain';
import { ENVIRONMENT, LIVE_FLAGS } from '@solstice/kernel';
import { LIVE_DATA_MARKET_ENABLED } from '@solstice/flags';

import { PersonalDataFabric } from './fabric.ts';
import { ACCESS_REQUEST_FIELDS } from './purpose/access-request.ts';

const NOW = '2026-08-14T12:00:00.000Z';
const LATER = '2026-08-14T13:00:00.000Z';
const EXPIRY = '2026-12-31T00:00:00.000Z';
const SYSTEM = { type: 'SYSTEM' as const, id: asActorId('system') };
const JANE = {
  type: 'CUSTOMER' as const,
  id: asActorId('jane'),
  customerId: asCustomerId('cust_jane'),
};
const BUYER = { type: 'OPERATOR' as const, id: asActorId('buyer_wellness_lab') };

function log(event: string, payload: unknown): void {
  console.log(JSON.stringify({ event, ...asJson(payload) }));
}

function asJson(value: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? `${inner.toString()}n` : inner)),
  ) as Record<string, unknown>;
}

function assertNoRaw(value: unknown, label: string): void {
  const text = JSON.stringify(value, (_key, inner) =>
    typeof inner === 'bigint' ? `${inner.toString()}n` : inner,
  );
  if (text.includes('SYNTH-SUBJECT-') || text.includes('restingHeartBand') || text.includes('Avery')) {
    throw new Error(`${label} leaked raw vault attributes`);
  }
}

console.log('=== Solstice Phase 7 demo — Personal Data Fabric ===');
log('flags', {
  ENVIRONMENT,
  LIVE_DATA_MARKET_ENABLED,
  kernelLiveFlagsFalse: Object.values(LIVE_FLAGS).every((flag) => flag === false),
});

const fabric = new PersonalDataFabric();
const subjects = fabric.subjectRefs(8);

console.log('\n--- 1. Populate synthetic vault (every category) ---');
const receipts = fabric.populateSynthetic({
  subjectCount: 8,
  actor: SYSTEM,
  occurredAt: NOW,
  jurisdiction: 'US',
});
log('vault.populated', {
  receipts: receipts.length,
  categoriesKeyed: fabric.keyRefs(),
  healthRecords: fabric.vault.recordCount('HEALTH'),
  provenance: 'SYNTHETIC',
});
assertNoRaw(receipts, 'write receipts');

console.log('\n--- 2. Grant granular consent for wellness research (HEALTH) ---');
const grants = subjects.map((subjectRef, index) =>
  fabric.grantConsent({
    actor: JANE,
    occurredAt: NOW,
    grant: {
      consentId: `cns_wellness_${String(index + 1).padStart(2, '0')}`,
      subjectRef,
      requesterId: 'buyer_wellness_lab',
      purpose: 'WELLNESS_RESEARCH',
      dataCategories: ['HEALTH'],
      identityExposureLevel: 'anonymous',
      start: NOW,
      expiry: EXPIRY,
      resalePermission: false,
      aiTrainingPermission: false,
      compensation: {
        indicativeMinorUnits: 1200n,
        currency: 'USD',
        presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
      },
      revocability: true,
      jurisdiction: 'US',
      policyVersion: 'privacy-sim-v1',
      legalBasis: 'CONSENT',
    },
  }),
);
log('consent.granted', {
  count: grants.length,
  purpose: 'WELLNESS_RESEARCH',
  category: 'HEALTH',
  versions: grants.map((row) => row.versionNumber),
});

const valuation = fabric.valueIndicative({
  category: 'HEALTH',
  purpose: 'WELLNESS_RESEARCH',
  identityExposureLevel: 'anonymous',
  durationDays: 139n,
  resalePermission: false,
  aiTrainingPermission: false,
});
log('valuation.indicative', valuation);

const wellnessRequest = {
  requester: { id: 'buyer_wellness_lab', kind: 'BUYER' as const, sessionId: 'sess_valid_buyer' },
  dataCategories: ['HEALTH'] as const,
  purpose: 'WELLNESS_RESEARCH' as const,
  jurisdiction: 'US',
  duration: { start: NOW, end: EXPIRY },
  legalBasis: 'CONSENT' as const,
};

console.log('\n--- 3. Buyer clean-room query (authorized aggregate) ---');
const aggregate = fabric.runCleanRoom({
  actor: BUYER,
  occurredAt: NOW,
  request: wellnessRequest,
  query: { queryId: 'q_health_count', metric: 'COUNT' },
  subjectRefs: subjects,
  sessionValid: true,
});
if (!aggregate.ok) {
  throw new Error(`expected authorized aggregate, got ${JSON.stringify(aggregate.error)}`);
}
log('clean_room.aggregate', aggregate.value);
assertNoRaw(aggregate.value, 'aggregate');
if (aggregate.value.rawRecordsReleased !== false) {
  throw new Error('raw records must not leave the vault');
}

console.log('\n--- 4. Same buyer, advertising purpose — Purpose Firewall refuses ---');
const advertising = fabric.runCleanRoom({
  actor: BUYER,
  occurredAt: NOW,
  request: { ...wellnessRequest, purpose: 'ADVERTISING' },
  query: { queryId: 'q_health_ads', metric: 'COUNT' },
  subjectRefs: subjects,
  sessionValid: true,
});
if (advertising.ok) {
  throw new Error('advertising purpose must be refused');
}
log('purpose_firewall.advertising_refused', advertising.error);

console.log('\n--- 5. Below-cohort query refused ---');
const below = fabric.runCleanRoom({
  actor: BUYER,
  occurredAt: NOW,
  request: wellnessRequest,
  query: {
    queryId: 'q_below_cohort',
    metric: 'COUNT',
    filterEquals: { sleepHoursBand: '999n' },
  },
  subjectRefs: subjects,
  sessionValid: true,
});
if (below.ok) {
  throw new Error('below-cohort query must be refused');
}
log('clean_room.below_cohort_refused', below.error);

console.log('\n--- 6. Privacy budget depletes and blocks ---');
const second = fabric.runCleanRoom({
  actor: BUYER,
  occurredAt: NOW,
  request: wellnessRequest,
  query: { queryId: 'q_health_count_2', metric: 'COUNT' },
  subjectRefs: subjects,
  sessionValid: true,
});
if (!second.ok) {
  throw new Error(`expected second aggregate to consume remaining budget: ${JSON.stringify(second.error)}`);
}
log('clean_room.budget_consumed', {
  remaining: second.value.budgetRemaining,
  consumed: second.value.budgetConsumed,
});
const blocked = fabric.runCleanRoom({
  actor: BUYER,
  occurredAt: NOW,
  request: wellnessRequest,
  query: { queryId: 'q_health_count_3', metric: 'COUNT' },
  subjectRefs: subjects,
  sessionValid: true,
});
if (blocked.ok) {
  throw new Error('exhausted privacy budget must block');
}
log('clean_room.budget_blocked', blocked.error);

console.log('\n--- 7. Revoke consent — next query fails immediately ---');
const revoked = fabric.revokeConsent({
  actor: JANE,
  occurredAt: LATER,
  jurisdiction: 'US',
  consentId: grants[0]!.consentId,
});
log('consent.revoked', {
  consentId: revoked.consentId,
  versionNumber: revoked.versionNumber,
  status: revoked.status,
});
const afterRevoke = fabric.runCleanRoom({
  actor: BUYER,
  occurredAt: LATER,
  request: wellnessRequest,
  query: { queryId: 'q_after_revoke', metric: 'COUNT' },
  subjectRefs: subjects,
  sessionValid: true,
});
if (afterRevoke.ok) {
  throw new Error('revoked consent must block the next access');
}
log('consent.revoke_blocks_access', afterRevoke.error);

console.log('\n--- 8. Evidence records (hashes and references only) ---');
const evidence = fabric.kernel.vault.list();
for (const record of evidence) {
  assertNoRaw(record.payload, `evidence ${record.id}`);
  log('evidence.record', {
    seq: record.seq,
    id: record.id,
    kind: record.payload.kind,
    payloadSha256: record.payloadSha256,
    recordSha256: record.recordSha256,
  });
}
const chain = fabric.kernel.vault.verifyChain();
log('evidence.chain', chain);
log('access_request.fields_never_defaulted', ACCESS_REQUEST_FIELDS);
log('jobs', fabric.cleanRoom.jobs());

if (chain.ok !== true) {
  throw new Error('evidence chain failed');
}

console.log('phase-7 demo: ok');
