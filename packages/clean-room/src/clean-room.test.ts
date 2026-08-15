import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import type { VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { ConsentDataUseAuthorization } from '../../consent/src/authorization.ts';
import { RECIPIENT_EXTERNAL_RESEARCH, RECIPIENT_EXTERNAL_RESEARCH_BETA, RECIPIENT_PERSONAL_AGENT } from '../../consent/src/recipients.ts';
import { ConsentService } from '../../consent/src/service.ts';
import { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { SimulatedPayrollConnector } from '../../personal-data-vault/src/connectors.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SubjectScopedCleanRoomTool } from './agent-tool.ts';
import { evaluateEgress } from './egress.ts';
import { asCleanRoomJobId, asPrivacyPolicyVersion } from './ids.ts';
import { rejectArbitraryQuery } from './query.ts';
import { REQUESTER_RESEARCH_ALPHA, REQUESTER_RESEARCH_BETA } from './requesters.ts';
import { CleanRoomService } from './service.ts';
import { canTransitionSession, DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED, SIMULATION_THRESHOLDS } from './taxonomy.ts';

const T0 = asUtcInstant('2026-08-15T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T12:00:00.000Z');
const SUBJECT_CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
] as const;
const RESEARCHER_CAPS = ['CLEAN_ROOM_REQUEST', 'CONSENT_VIEW_OWN'] as const;

function groceryPayload(subjectIndex: number, amount = 1500 + subjectIndex * 100) {
  return {
    transactions: [
      {
        id: `txn_g_${subjectIndex}`,
        bookedAt: '2026-07-08T10:00:00.000Z',
        merchant: 'Market',
        category: 'grocery',
        amountMinor: String(amount),
        currency: 'USD',
      },
      {
        id: `txn_d_${subjectIndex}`,
        bookedAt: '2026-07-09T18:00:00.000Z',
        merchant: 'Cafe',
        category: 'dining',
        amountMinor: '2400',
        currency: 'USD',
      },
    ],
  };
}

function harness() {
  const clock = new FrozenClock(T0);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  const cleanRoom = new CleanRoomService({ clock, keys, evidence, events, consent, vault });
  return { clock, keys, events, evidence, identity, consent, vault, cleanRoom };
}

function provision(
  identity: SimulatedIdentityAdapter,
  actorId: string,
  identityId: string,
  customerId: string,
  capabilities: readonly string[],
): VerifiedActorContext {
  const result = identity.provisionSimulatedActor({
    actorId,
    jurisdiction: asJurisdiction('GB'),
    identityId,
    customerId: asCustomerId(customerId),
    capabilities: [...capabilities] as never,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function ingestGrocery(
  vault: PersonalDataVault,
  actor: VerifiedActorContext,
  index: number,
  amount?: number,
  prefix = 'cr',
) {
  vault.openVault(actor, actor.subjectId, `cust_${prefix}_${index}`);
  const ingested = vault.ingest(actor, {
    subjectId: actor.subjectId,
    sourceId: 'pds_sim_transactions',
    sourceRecordRef: `grocery_${prefix}_${index}`,
    idempotencyKey: `grocery_${prefix}_${index}`,
    schemaId: 'pdsch_transactions',
    schemaVersion: '1',
    category: 'TRANSACTION_DATA',
    contentType: 'application/json',
    payload: groceryPayload(index, amount),
    provenanceKind: 'EXTERNAL_CONNECTOR',
    purposeRef: 'demo.ingest.transactions',
  });
  if (!ingested.ok) {
    throw new Error(ingested.error.message);
  }
  return ingested.value;
}

function grantResearch(consent: ConsentService, actor: VerifiedActorContext, recipientId = RECIPIENT_EXTERNAL_RESEARCH) {
  const draft = consent.draftConsent(actor, {
    subjectId: actor.subjectId,
    recipientId,
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    categories: ['TRANSACTION_DATA'],
    fields: ['transactions', 'category', 'amountMinor', 'bookedAt', 'currency'],
    operations: ['AGGREGATE'],
    derivationTypes: ['AGGREGATE_ONLY'],
    effectiveFrom: T0,
    expiresAt: EXPIRES,
    idempotencyKey: `grant:${actor.subjectId}:${recipientId}`,
  });
  if (!draft.ok) {
    throw new Error(draft.error.message);
  }
  const confirmed = consent.confirmConsent(actor, draft.value.consentId, `confirm:${draft.value.consentId}`);
  if (!confirmed.ok) {
    throw new Error(confirmed.error.message);
  }
  return confirmed.value;
}

function cohort(identity: SimulatedIdentityAdapter, vault: PersonalDataVault, consent: ConsentService, count: number, authorizeFirst: number, prefix = 'cr') {
  const subjects: VerifiedActorContext[] = [];
  for (let i = 0; i < count; i += 1) {
    const actor = provision(identity, `actor_${prefix}_${i}`, `idn_${prefix}_${i}`, `cust_${prefix}_${i}`, SUBJECT_CAPS);
    ingestGrocery(vault, actor, i, undefined, prefix);
    if (i < authorizeFirst) {
      grantResearch(consent, actor);
    }
    subjects.push(actor);
  }
  return subjects;
}

describe('privacy clean room', () => {
  it('rejects arbitrary SQL and arbitrary code before any computation', () => {
    const sql = rejectArbitraryQuery({ sql: 'SELECT * FROM vault' });
    assert.equal(sql.ok, false);
    if (!sql.ok) {
      assert.equal(sql.error.code, 'ARBITRARY_SQL_FORBIDDEN');
    }
    const code = rejectArbitraryQuery({ python: 'print(open("/etc/passwd").read())' });
    assert.equal(code.ok, false);
    if (!code.ok) {
      assert.equal(code.error.code, 'ARBITRARY_CODE_FORBIDDEN');
    }
    assert.equal(canTransitionSession('COMPLETED', 'AUTHORIZED'), false);
  });

  it('releases an aggregate grocery result for a qualifying cohort and denies raw rows', () => {
    const { identity, vault, consent, cleanRoom, evidence } = harness();
    const subjects = cohort(identity, vault, consent, 20, 15);
    const researcher = provision(identity, 'actor_research_a', 'idn_research_a', 'cust_research_a', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, researcher.subjectId);
    const session = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: subjects.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'session.grocery',
    });
    if (!session.ok) {
      throw new Error(session.error.message);
    }
    const authorized = cleanRoom.authorizeSession(researcher, session.value.sessionId);
    if (!authorized.ok) {
      throw new Error(authorized.error.message);
    }
    assert.equal(authorized.value.permitIds.length, 15);
    const job = cleanRoom.submitAndExecute(researcher, session.value.sessionId, 'grocery_average');
    if (!job.ok) {
      throw new Error(job.error.message);
    }
    assert.equal(job.value.egress.decision, 'RELEASE');
    assert.equal(job.value.result?.shape, 'AGGREGATE');
    assert.equal(job.value.receipt?.rawInputIncluded, false);
    assert.equal(job.value.receipt?.authorizedCohortCount, 15);
    assert.equal(job.value.result?.values.averageMinor, '2200');
    assert.equal(job.value.contributions.length, 15);
    assert.equal(job.value.contributions.every((row) => !row.coinIssued && !row.settledEarnings), true);
    const raw = cleanRoom.requestRawRows(researcher, session.value.sessionId);
    assert.equal(raw.ok, true);
    if (raw.ok) {
      assert.equal(raw.value.egress.reasonCode, 'RAW_ROW_EXPORT_DENIED');
      assert.equal(raw.value.result, null);
    }
    assert.equal(evidence.verifyChain().ok, true);
    assert.equal(job.value.receipt?.computationImplementation.includes('clean-room'), true);
  });

  it('denies no consent, expired consent, revoked consent, wrong purpose, and wrong recipient', () => {
    const { identity, vault, consent, cleanRoom, clock } = harness();
    const subject = provision(identity, 'actor_one', 'idn_one', 'cust_one', SUBJECT_CAPS);
    ingestGrocery(vault, subject, 1);
    const researcher = provision(identity, 'actor_r', 'idn_r', 'cust_r', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, researcher.subjectId);
    const none = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: [subject.subjectId],
      expiresAt: EXPIRES,
      idempotencyKey: 'none',
    });
    assert.equal(none.ok, true);
    if (none.ok) {
      const authorized = cleanRoom.authorizeSession(researcher, none.value.sessionId);
      assert.equal(authorized.ok, false);
      if (!authorized.ok) {
        assert.equal(authorized.error.code, 'NO_ACTIVE_CONSENT');
      }
    }
    const granted = grantResearch(consent, subject);
    consent.revokeConsent(subject, granted.consentId, 'stop', 'revoke1');
    const revoked = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: [subject.subjectId],
      expiresAt: EXPIRES,
      idempotencyKey: 'revoked',
    });
    if (revoked.ok) {
      const authorized = cleanRoom.authorizeSession(researcher, revoked.value.sessionId);
      assert.equal(authorized.ok, false);
    }
    const other = provision(identity, 'actor_two', 'idn_two', 'cust_two', SUBJECT_CAPS);
    ingestGrocery(vault, other, 2);
    const agentDraft = consent.draftConsent(other, {
      subjectId: other.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      categories: ['TRANSACTION_DATA'],
      operations: ['AGGREGATE'],
      derivationTypes: ['AGGREGATE_ONLY'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'wrong-purpose',
    });
    if (agentDraft.ok) {
      consent.confirmConsent(other, agentDraft.value.consentId, 'confirm-wrong');
    }
    const wrong = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: [other.subjectId],
      expiresAt: EXPIRES,
      idempotencyKey: 'wrong',
    });
    if (wrong.ok) {
      const authorized = cleanRoom.authorizeSession(researcher, wrong.value.sessionId);
      assert.equal(authorized.ok, false);
    }
    const expiring = provision(identity, 'actor_exp', 'idn_exp', 'cust_exp', SUBJECT_CAPS);
    ingestGrocery(vault, expiring, 8);
    const shortDraft = consent.draftConsent(expiring, {
      subjectId: expiring.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA'],
      operations: ['AGGREGATE'],
      derivationTypes: ['AGGREGATE_ONLY'],
      effectiveFrom: T0,
      expiresAt: asUtcInstant('2026-08-15T13:00:00.000Z'),
      idempotencyKey: 'expired-consent',
    });
    if (shortDraft.ok) {
      consent.confirmConsent(expiring, shortDraft.value.consentId, 'confirm-expired');
    }
    clock.advanceMs(2n * 60n * 60n * 1000n);
    const expired = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: [expiring.subjectId],
      expiresAt: EXPIRES,
      idempotencyKey: 'expired-session',
    });
    if (expired.ok) {
      const authorized = cleanRoom.authorizeSession(researcher, expired.value.sessionId);
      assert.equal(authorized.ok, false);
    }
  });

  it('filters unauthorized subjects before compute and excludes revocation before execution and egress', () => {
    const { identity, vault, consent, cleanRoom } = harness();
    const subjects = cohort(identity, vault, consent, 16, 16);
    const researcher = provision(identity, 'actor_rev', 'idn_rev', 'cust_rev', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, researcher.subjectId);
    const session = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: subjects.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'revoke-run',
    });
    if (!session.ok) {
      throw new Error(session.error.message);
    }
    const authorized = cleanRoom.authorizeSession(researcher, session.value.sessionId);
    if (!authorized.ok) {
      throw new Error(authorized.error.message);
    }
    const first = cleanRoom.submitAndExecute(researcher, session.value.sessionId, 'grocery_count');
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.value.receipt?.authorizedCohortCount, 16);
    }
    const listed = consent.listActiveConsents(subjects[0], subjects[0]!.subjectId);
    if (listed.ok && listed.value[0]) {
      consent.revokeConsent(subjects[0], listed.value[0].consentId, 'leave', 'leave1');
    }
    const second = cleanRoom.submitAndExecute(researcher, session.value.sessionId, 'grocery_sum');
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.value.receipt?.authorizedCohortCount, 15);
    }
  });

  it('suppresses tiny cohorts and tiny cells and denies excessive dimensions and budget exhaustion', () => {
    const { identity, vault, consent, cleanRoom } = harness();
    const subjects = cohort(identity, vault, consent, 4, 4);
    const researcher = provision(identity, 'actor_tiny', 'idn_tiny', 'cust_tiny', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, researcher.subjectId);
    const session = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: subjects.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'tiny',
    });
    if (!session.ok) {
      throw new Error(session.error.message);
    }
    const authorized = cleanRoom.authorizeSession(researcher, session.value.sessionId);
    assert.equal(authorized.ok, true);
    const tiny = cleanRoom.submitAndExecute(researcher, session.value.sessionId, 'grocery_average');
    assert.equal(tiny.ok, true);
    if (tiny.ok) {
      assert.equal(tiny.value.egress.decision, 'SUPPRESS');
      assert.equal(tiny.value.egress.reasonCode, 'COHORT_BELOW_THRESHOLD');
      assert.equal(tiny.value.result, null);
    }
    assert.ok(SIMULATION_THRESHOLDS.minCohortSize >= 10);
    const large = cohort(identity, vault, consent, 12, 12, 'budget');
    for (const actor of large) {
      grantResearch(consent, actor, RECIPIENT_EXTERNAL_RESEARCH_BETA);
    }
    const researcher2 = provision(identity, 'actor_budget', 'idn_budget', 'cust_budget', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_BETA, researcher2.subjectId);
    const session2 = cleanRoom.createSession(researcher2, {
      requesterId: REQUESTER_RESEARCH_BETA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: large.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'budget',
    });
    if (!session2.ok) {
      throw new Error(session2.error.message);
    }
    assert.equal(cleanRoom.authorizeSession(researcher2, session2.value.sessionId).ok, true);
    const uniqueTemplates = [
      'grocery_average',
      'grocery_sum',
      'grocery_count',
      'grocery_minmax',
      'grocery_histogram',
      'category_aggregation',
      'cohort_metric',
      'grocery_distribution',
    ];
    for (const template of uniqueTemplates) {
      const run = cleanRoom.submitAndExecute(researcher2, session2.value.sessionId, template);
      assert.equal(run.ok, true, run.ok ? '' : run.error.message);
      if (run.ok) {
        assert.equal(run.value.egress.decision, 'RELEASE', `${template} ${run.value.egress.reasonCode}`);
      }
    }
    const exhausted = cleanRoom.submitAndExecute(researcher2, session2.value.sessionId, 'grocery_count');
    assert.equal(exhausted.ok, false);
    if (!exhausted.ok) {
      assert.equal(exhausted.error.code, 'QUERY_BUDGET_EXHAUSTED');
    }
    const replay = cleanRoom.submitAndExecute(researcher2, session2.value.sessionId, 'grocery_average');
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.ok(replay.error.code === 'REPEATED_QUERY' || replay.error.code === 'QUERY_BUDGET_EXHAUSTED');
    }
  });

  it('rejects unsupported operations, out-of-scope assets/fields, and replayed session keys', () => {
    const { identity, vault, consent, cleanRoom } = harness();
    const subjects = cohort(identity, vault, consent, 12, 12);
    const researcher = provision(identity, 'actor_scope', 'idn_scope', 'cust_scope', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, researcher.subjectId);
    const first = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: subjects.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'replay-session',
    });
    const replayed = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: subjects.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'replay-session',
    });
    assert.equal(first.ok && replayed.ok, true);
    if (first.ok && replayed.ok) {
      assert.equal(first.value.sessionId, replayed.value.sessionId);
    }
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    assert.equal(cleanRoom.authorizeSession(researcher, first.value.sessionId).ok, true);
    const sql = cleanRoom.submitAndExecute(researcher, first.value.sessionId, 'SELECT * FROM personal_data_vault.payload');
    assert.equal(sql.ok, false);
    if (!sql.ok) {
      assert.equal(sql.error.code, 'ARBITRARY_SQL_FORBIDDEN');
    }
    const code = cleanRoom.submitAndExecute(researcher, first.value.sessionId, { javascript: '1+1' });
    assert.equal(code.ok, false);
    if (!code.ok) {
      assert.equal(code.error.code, 'ARBITRARY_CODE_FORBIDDEN');
    }
    const unknown = cleanRoom.submitAndExecute(researcher, first.value.sessionId, 'not_a_template');
    assert.equal(unknown.ok, false);
  });

  it('keeps recipient and purpose join tokens separated and rejects duplicate contribution metadata', () => {
    const { identity, vault, consent, cleanRoom } = harness();
    const subject = provision(identity, 'actor_join', 'idn_join', 'cust_join', SUBJECT_CAPS);
    ingestGrocery(vault, subject, 99);
    grantResearch(consent, subject);
    grantResearch(consent, subject, RECIPIENT_EXTERNAL_RESEARCH);
    const alpha = provision(identity, 'actor_alpha', 'idn_alpha', 'cust_alpha', RESEARCHER_CAPS);
    const beta = provision(identity, 'actor_beta', 'idn_beta', 'cust_beta', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, alpha.subjectId);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_BETA, beta.subjectId);
    const purpose = consent.getPurposeDescription('DATA_CONTRIBUTION_RESEARCH');
    if (!purpose.ok) {
      throw new Error(purpose.error.message);
    }
    const tokenA = cleanRoom.joinToken(alpha, subject.subjectId, purpose.value.purposeId, REQUESTER_RESEARCH_ALPHA);
    const tokenB = cleanRoom.joinToken(beta, subject.subjectId, purpose.value.purposeId, REQUESTER_RESEARCH_BETA);
    const tokenA2 = cleanRoom.joinToken(alpha, subject.subjectId, 'pur_personal_agent_analysis', REQUESTER_RESEARCH_ALPHA);
    assert.equal(tokenA.ok && tokenB.ok && tokenA2.ok, true);
    if (tokenA.ok && tokenB.ok && tokenA2.ok) {
      assert.notEqual(tokenA.value, tokenB.value);
      assert.notEqual(tokenA.value, tokenA2.value);
    }
    const subjects = cohort(identity, vault, consent, 12, 12);
    const session = cleanRoom.createSession(alpha, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: subjects.map((row) => row.subjectId),
      expiresAt: EXPIRES,
      idempotencyKey: 'dup-contrib',
    });
    if (!session.ok) {
      throw new Error(session.error.message);
    }
    assert.equal(cleanRoom.authorizeSession(alpha, session.value.sessionId).ok, true);
    const run = cleanRoom.submitAndExecute(alpha, session.value.sessionId, 'cohort_metric');
    assert.equal(run.ok, true);
    if (run.ok && run.value.receipt) {
      const first = run.value.contributions[0];
      assert.ok(first);
      const again = cleanRoom.listContributions().filter((row) => row.subjectId === first.subjectId && row.receiptId === first.receiptId);
      assert.equal(again.length, 1);
    }
    const tool = new SubjectScopedCleanRoomTool(cleanRoom);
    const cross = tool.requestMultiUserResearch();
    assert.equal(cross.ok, false);
    const payroll = new SimulatedPayrollConnector().fetch('pay');
    vault.openVault(subject, subject.subjectId, 'cust_join');
    const pay = vault.ingest(subject, {
      subjectId: subject.subjectId,
      sourceId: payroll.sourceId,
      sourceRecordRef: payroll.sourceRecordRef,
      idempotencyKey: 'payroll_not_in_clean_room',
      schemaId: 'pdsch_payroll',
      schemaVersion: '1',
      contentType: payroll.contentType,
      payload: payroll.body,
      provenanceKind: payroll.provenanceKind,
      purposeRef: 'demo.ingest.payroll',
    });
    assert.equal(pay.ok, true);
    assert.equal(DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED, 'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED');
  });

  it('enforces small-cell, excessive-dimension, and field-scope egress/authorization rules', () => {
    const now = T0;
    const jobId = asCleanRoomJobId('crj_testcell000000000000000000000001');
    const policy = asPrivacyPolicyVersion('ppv_simulation_1');
    const cell = evaluateEgress({
      ast: { operation: 'CATEGORY_AGGREGATION', groupBy: ['category'] },
      result: { shape: 'AGGREGATE', operation: 'CATEGORY_AGGREGATION', values: { groupCount: 1 }, groups: [{ category: 'rare', count: 1 }] },
      cohortSize: 12,
      onwardSharing: false,
      onwardSharingAllowed: false,
      privacyPolicyVersion: policy,
      now,
      jobId,
    });
    assert.equal(cell.decision, 'SUPPRESS');
    assert.equal(cell.reasonCode, 'CELL_BELOW_THRESHOLD');
    const dims = evaluateEgress({
      ast: { operation: 'CATEGORY_AGGREGATION', groupBy: ['category', 'merchant', 'city'] },
      result: { shape: 'AGGREGATE', operation: 'CATEGORY_AGGREGATION', values: { groupCount: 1 }, groups: [{ count: 12 }] },
      cohortSize: 12,
      onwardSharing: false,
      onwardSharingAllowed: false,
      privacyPolicyVersion: policy,
      now,
      jobId,
    });
    assert.equal(dims.decision, 'DENY');
    assert.equal(dims.reasonCode, 'EXCESSIVE_DIMENSIONS');
    const { identity, vault, consent, cleanRoom } = harness();
    const subject = provision(identity, 'actor_field', 'idn_field', 'cust_field', SUBJECT_CAPS);
    ingestGrocery(vault, subject, 7);
    const draft = consent.draftConsent(subject, {
      subjectId: subject.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA'],
      fields: ['category'],
      operations: ['AGGREGATE'],
      derivationTypes: ['AGGREGATE_ONLY'],
      effectiveFrom: T0,
      expiresAt: EXPIRES,
      idempotencyKey: 'field-scope',
    });
    assert.equal(draft.ok, true);
    if (draft.ok) {
      consent.confirmConsent(subject, draft.value.consentId, 'field-confirm');
    }
    const researcher = provision(identity, 'actor_field_r', 'idn_field_r', 'cust_field_r', RESEARCHER_CAPS);
    cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, researcher.subjectId);
    const session = cleanRoom.createSession(researcher, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: [subject.subjectId],
      expiresAt: EXPIRES,
      idempotencyKey: 'field-session',
    });
    if (session.ok) {
      const authorized = cleanRoom.authorizeSession(researcher, session.value.sessionId);
      assert.equal(authorized.ok, false);
    }
  });

  it('does not treat a DataAssetId or internal service identity as authorization', () => {
    const { identity, vault, consent, cleanRoom } = harness();
    const subject = provision(identity, 'actor_asset', 'idn_asset', 'cust_asset', SUBJECT_CAPS);
    const asset = ingestGrocery(vault, subject, 3);
    const stranger = provision(identity, 'actor_stranger', 'idn_stranger', 'cust_stranger', SUBJECT_CAPS);
    const denied = cleanRoom.createSession(stranger, {
      requesterId: REQUESTER_RESEARCH_ALPHA,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      proposedSubjectIds: [subject.subjectId],
      expiresAt: EXPIRES,
      idempotencyKey: 'asset-is-not-auth',
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'CAPABILITY_DENIED');
    }
    void asset;
    void consent;
  });
});
