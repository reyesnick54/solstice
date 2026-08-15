import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import type { VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { ConsentDataUseAuthorization } from '../../consent/src/authorization.ts';
import { RECIPIENT_EXTERNAL_RESEARCH } from '../../consent/src/recipients.ts';
import { ConsentService } from '../../consent/src/service.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { SimulatedPayrollConnector } from '../../personal-data-vault/src/connectors.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SubjectScopedCleanRoomTool } from './agent-tool.ts';
import { REQUESTER_RESEARCH_ALPHA, REQUESTER_RESEARCH_BETA } from './requesters.ts';
import { CleanRoomService } from './service.ts';
import { CLEAN_ROOM_LEGAL_STATUS, DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED, EPHEMERAL_PLAINTEXT_GUARANTEE } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T16:00:00.000Z');
const SUBJECT_CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
  'DECLARE_ECONOMIC_FACT',
  'VIEW_ECONOMIC_GRAPH',
] as const;

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

async function main(): Promise<void> {
  const clock = new FrozenClock(NOW);
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
  const graph = new EconomicGraphService({ clock, events });
  const cleanRoom = new CleanRoomService({ clock, keys, evidence, events, consent, vault });
  const tool = new SubjectScopedCleanRoomTool(cleanRoom);

  const subjects: VerifiedActorContext[] = [];
  for (let i = 0; i < 20; i += 1) {
    const actor = provision(identity, `actor_demo_${i}`, `idn_demo_${i}`, `cust_demo_${i}`, SUBJECT_CAPS);
    vault.openVault(actor, actor.subjectId, `cust_demo_${i}`);
    const grocery = vault.ingest(actor, {
      subjectId: actor.subjectId,
      sourceId: 'pds_sim_transactions',
      sourceRecordRef: `grocery_${i}`,
      idempotencyKey: `grocery_${i}`,
      schemaId: 'pdsch_transactions',
      schemaVersion: '1',
      contentType: 'application/json',
      payload: {
        transactions: [
          {
            id: `g_${i}`,
            bookedAt: '2026-07-08T10:00:00.000Z',
            merchant: 'Green Market',
            category: 'grocery',
            amountMinor: String(1200 + i * 80),
            currency: 'USD',
          },
        ],
      },
      provenanceKind: 'EXTERNAL_CONNECTOR',
      purposeRef: 'demo.ingest.transactions',
    });
    if (!grocery.ok) {
      throw new Error(grocery.error.message);
    }
    if (i === 0) {
      const payroll = new SimulatedPayrollConnector().fetch('payroll_july');
      vault.ingest(actor, {
        subjectId: actor.subjectId,
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
    }
    if (i < 15) {
      const draft = consent.draftConsent(actor, {
        subjectId: actor.subjectId,
        recipientId: RECIPIENT_EXTERNAL_RESEARCH,
        purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
        categories: ['TRANSACTION_DATA'],
        operations: ['AGGREGATE'],
        derivationTypes: ['AGGREGATE_ONLY'],
        effectiveFrom: NOW,
        expiresAt: EXPIRES,
        idempotencyKey: `demo.grant.${i}`,
      });
      if (!draft.ok) {
        throw new Error(draft.error.message);
      }
      const confirmed = consent.confirmConsent(actor, draft.value.consentId, `demo.confirm.${i}`);
      if (!confirmed.ok) {
        throw new Error(confirmed.error.message);
      }
    }
    subjects.push(actor);
  }

  const alpha = provision(identity, 'actor_demo_alpha', 'idn_demo_alpha', 'cust_demo_alpha', [
    'CLEAN_ROOM_REQUEST',
    'CONSENT_VIEW_OWN',
  ]);
  const beta = provision(identity, 'actor_demo_beta', 'idn_demo_beta', 'cust_demo_beta', [
    'CLEAN_ROOM_REQUEST',
    'CONSENT_VIEW_OWN',
  ]);
  cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, alpha.subjectId);
  cleanRoom.bindRequester(REQUESTER_RESEARCH_BETA, beta.subjectId);

  const session = cleanRoom.createSession(alpha, {
    requesterId: REQUESTER_RESEARCH_ALPHA,
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    proposedSubjectIds: subjects.map((row) => row.subjectId),
    expiresAt: EXPIRES,
    idempotencyKey: 'demo.session.grocery',
  });
  if (!session.ok) {
    throw new Error(session.error.message);
  }
  const authorized = cleanRoom.authorizeSession(alpha, session.value.sessionId);
  if (!authorized.ok) {
    throw new Error(authorized.error.message);
  }
  const released = cleanRoom.submitAndExecute(alpha, session.value.sessionId, 'grocery_average');
  if (!released.ok) {
    throw new Error(released.error.message);
  }
  const raw = cleanRoom.requestRawRows(alpha, session.value.sessionId);
  const listed = consent.listActiveConsents(subjects[0], subjects[0]!.subjectId);
  if (listed.ok && listed.value[0]) {
    consent.revokeConsent(subjects[0], listed.value[0].consentId, 'demo revoke', 'demo.revoke');
  }
  const afterRevoke = cleanRoom.submitAndExecute(alpha, session.value.sessionId, 'grocery_sum');
  const purpose = consent.getPurposeDescription('DATA_CONTRIBUTION_RESEARCH');
  if (!purpose.ok) {
    throw new Error(purpose.error.message);
  }
  const tokenA = cleanRoom.joinToken(alpha, subjects[1]!.subjectId, purpose.value.purposeId, REQUESTER_RESEARCH_ALPHA);
  const tokenB = cleanRoom.joinToken(beta, subjects[1]!.subjectId, purpose.value.purposeId, REQUESTER_RESEARCH_BETA);
  const peg = released.value.receipt ? cleanRoom.pegReference(released.value.receipt) : null;
  if (released.value.receipt) {
    graph.openGraph(subjects[1], subjects[1]!.subjectId, 'cust_demo_1');
    graph.declareDataAsset(subjects[1], subjects[1]!.subjectId, {
      label: peg?.label ?? 'clean_room.computation',
      vaultAssetId: released.value.receipt.receiptId,
      contentHash: released.value.receipt.resultHash,
      category: 'TRANSACTION_DATA',
      consentVersion: released.value.receipt.consentRefs[0]?.version,
      purposeVersion: released.value.receipt.purposeVersion,
      derivationVersion: released.value.receipt.computationVersion,
    });
  }
  const agentDenied = tool.requestMultiUserResearch();
  const policy = cleanRoom.simulatePolicy({ minCohortSize: 20, purposeRef: 'DATA_CONTRIBUTION_RESEARCH' });

  console.log(
    JSON.stringify(
      {
        proposedSubjects: 20,
        authorizedSubjects: authorized.value.permitIds.length,
        firstRunReleased: released.value.egress.decision === 'RELEASE',
        aggregateOnly: released.value.result?.shape === 'AGGREGATE',
        researcherReceived: released.value.result?.values ?? null,
        rawRowsDenied: raw.ok && raw.value.egress.reasonCode === 'RAW_ROW_EXPORT_DENIED',
        afterRevokeCohort: afterRevoke.ok ? afterRevoke.value.receipt?.authorizedCohortCount : afterRevoke.error,
        joinTokensDiffer: tokenA.ok && tokenB.ok && tokenA.value !== tokenB.value,
        contributions: cleanRoom.listContributions().length,
        coinIssued: cleanRoom.listContributions().some((row) => row.coinIssued),
        settledEarnings: cleanRoom.listContributions().some((row) => row.settledEarnings),
        pegHasNoPayrollPlaintext: peg !== null && !JSON.stringify(peg).includes('Simulated Employer'),
        agentMultiUserDenied: !agentDenied.ok,
        rdtDidNotActivateLivePolicy: policy.livePolicyActivated === false,
        evidenceChain: evidence.verifyChain(),
        differentialPrivacy: DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED,
        ephemeralGuarantee: EPHEMERAL_PLAINTEXT_GUARANTEE,
        legalStatus: CLEAN_ROOM_LEGAL_STATUS,
      },
      null,
      2,
    ),
  );
  console.log('clean-room demo: ok');
}

await main();
