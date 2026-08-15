import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId, type Customer } from '../../domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import type { VerifiedActorContext } from '../../identity/src/actor-context.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ComplianceKernel } from '../../kernel/src/kernel.ts';
import { Ledger } from '../../ledger/src/journal.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { ConsentDataUseAuthorization } from '../../consent/src/authorization.ts';
import { RECIPIENT_EXTERNAL_RESEARCH } from '../../consent/src/recipients.ts';
import { ConsentService } from '../../consent/src/service.ts';
import { REQUESTER_RESEARCH_ALPHA } from '../../clean-room/src/requesters.ts';
import { CleanRoomService } from '../../clean-room/src/service.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SubjectScopedSunReyCoinTool } from './agent-tool.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from './simulation-catalog.ts';
import { SUNREY_COIN_DISPLAY_NAME } from './taxonomy.ts';
import { SunReyCoinService } from './service.ts';

const NOW = asUtcInstant('2026-08-15T16:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T16:00:00.000Z');
const GB = asJurisdiction('GB');
const SUBJECT_CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
  'DECLARE_ECONOMIC_FACT',
  'VIEW_ECONOMIC_GRAPH',
  'SUNREY_COIN_VIEW',
  'SUNREY_COIN_OPERATE_REQUEST',
] as const;

function customer(id: string): Customer {
  return Object.freeze({
    id: asCustomerId(id),
    legalEntityId: SIMULATION_SOLSTICE_UK.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    status: 'ACTIVE',
    verification: {
      kycState: 'VERIFIED',
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-15T16:00:00.000Z'),
    },
    createdAt: NOW,
    version: 1,
  });
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
    jurisdiction: GB,
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
  const issuer = new AuthorityIssuer('sunrey-coin-demo');
  const kernel = new ComplianceKernel(issuer, evidence, clock);
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
  const customers = new Map<string, Customer>();
  const coin = new SunReyCoinService({
    kernel,
    issuer,
    evidence,
    events,
    clock,
    identity: identity.service,
    ledger: new Ledger(issuer, clock),
    consent,
    catalog: {
      customers: { get: (id) => customers.get(id) },
      products: {
        get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
      },
      legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
    },
  });
  const tool = new SubjectScopedSunReyCoinTool(coin);

  const subjects: VerifiedActorContext[] = [];
  for (let i = 0; i < 20; i += 1) {
    const cust = customer(`cust_coin_${i}`);
    customers.set(cust.id, cust);
    const actor = provision(identity, `actor_coin_${i}`, `idn_coin_${i}`, cust.id, SUBJECT_CAPS);
    vault.openVault(actor, actor.subjectId, cust.id);
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
    const draft = consent.draftConsent(actor, {
      subjectId: actor.subjectId,
      recipientId: RECIPIENT_EXTERNAL_RESEARCH,
      purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA'],
      operations: ['AGGREGATE'],
      derivationTypes: ['AGGREGATE_ONLY'],
      effectiveFrom: NOW,
      expiresAt: EXPIRES,
      idempotencyKey: `coin.grant.${i}`,
    });
    if (!draft.ok) {
      throw new Error(draft.error.message);
    }
    const confirmed = consent.confirmConsent(actor, draft.value.consentId, `coin.confirm.${i}`);
    if (!confirmed.ok) {
      throw new Error(confirmed.error.message);
    }
    subjects.push(actor);
  }

  const alpha = provision(identity, 'actor_coin_alpha', 'idn_coin_alpha', 'cust_coin_alpha', [
    'CLEAN_ROOM_REQUEST',
    'CONSENT_VIEW_OWN',
  ]);
  cleanRoom.bindRequester(REQUESTER_RESEARCH_ALPHA, alpha.subjectId);
  const session = cleanRoom.createSession(alpha, {
    requesterId: REQUESTER_RESEARCH_ALPHA,
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    proposedSubjectIds: subjects.map((row) => row.subjectId),
    expiresAt: EXPIRES,
    idempotencyKey: 'coin.session.grocery',
  });
  if (!session.ok) {
    throw new Error(session.error.message);
  }
  const authorized = cleanRoom.authorizeSession(alpha, session.value.sessionId);
  if (!authorized.ok) {
    throw new Error(authorized.error.message);
  }
  const released = cleanRoom.submitAndExecute(alpha, session.value.sessionId, 'grocery_average');
  if (!released.ok || !released.value.receipt) {
    throw new Error(released.ok ? 'missing receipt' : released.error.message);
  }

  const userA = subjects[0]!;
  const userB = subjects[1]!;
  const contributionA = released.value.contributions.find((row) => row.subjectId === userA.subjectId);
  const contributionB = released.value.contributions.find((row) => row.subjectId === userB.subjectId);
  if (!contributionA || !contributionB) {
    throw new Error('expected contributions for users A and B');
  }

  const journalsBeforeProposal = coin.listJournals().length;
  const evaluatedA = coin.evaluateContribution({
    actor: userA,
    subjectId: userA.subjectId,
    customerId: asCustomerId('cust_coin_0'),
    receipt: released.value.receipt,
    contribution: contributionA,
    irrelevantIdentityTraits: { race: 'trait-a', religion: 'trait-a', medical_condition: 'none' },
  });
  if (!evaluatedA.ok) {
    throw new Error(evaluatedA.error.message);
  }
  const evaluatedB = coin.evaluateContribution({
    actor: userB,
    subjectId: userB.subjectId,
    customerId: asCustomerId('cust_coin_1'),
    receipt: released.value.receipt,
    contribution: contributionB,
    irrelevantIdentityTraits: { race: 'trait-b', ethnicity: 'trait-b', disability: 'unrelated' },
  });
  if (!evaluatedB.ok) {
    throw new Error(evaluatedB.error.message);
  }
  if (!evaluatedA.value.amount.equals(evaluatedB.value.amount)) {
    throw new Error('protected identity traits must not change reward weight');
  }

  const proposal = coin.proposeIssuance(userA, evaluatedA.value.vectorId);
  if (!proposal.ok) {
    throw new Error(proposal.error.message);
  }
  if (coin.listJournals().length !== journalsBeforeProposal) {
    throw new Error('proposal must have zero financial effect');
  }

  const issued = coin.issue(userA.actorId, proposal.value.proposalId, asCustomerId('cust_coin_0'));
  if (issued.outcome !== 'OK') {
    throw new Error(issued.outcome === 'KERNEL_REFUSED' ? issued.decision.status : issued.message);
  }
  const positionAfterIssue = coin.position(userA.subjectId);
  const supplyAfterIssue = coin.supply();
  const matched = coin.reconcile();

  const duplicate = coin.evaluateContribution({
    actor: userA,
    subjectId: userA.subjectId,
    customerId: asCustomerId('cust_coin_0'),
    receipt: released.value.receipt,
    contribution: contributionA,
  });

  const transferred = coin.transfer(
    userA.actorId,
    asCustomerId('cust_coin_0'),
    userA.subjectId,
    userB.subjectId,
    evaluatedA.value.amount,
  );
  if (transferred.outcome !== 'OK') {
    throw new Error(transferred.outcome === 'KERNEL_REFUSED' ? transferred.decision.status : transferred.message);
  }
  const supplyAfterTransfer = coin.supply();
  graph.openGraph(userA, userA.subjectId, 'cust_coin_0');
  graph.recordSunReyCoinRefs(userA, userA.subjectId, {
    positionRef: issued.value.journalId,
    contributionId: contributionA.contributionId,
  });

  const listed = consent.listActiveConsents(userA, userA.subjectId);
  if (!listed.ok || !listed.value[0]) {
    throw new Error('expected an active consent to revoke');
  }
  const revoked = consent.revokeConsent(userA, listed.value[0].consentId, 'demo revoke', 'coin.revoke');
  if (!revoked.ok) {
    throw new Error(revoked.error.message);
  }
  const historic = coin.position(userB.subjectId);
  const future = coin.evaluateContribution({
    actor: userA,
    subjectId: userA.subjectId,
    customerId: asCustomerId('cust_coin_0'),
    receipt: released.value.receipt,
    contribution: contributionA,
  });
  const agentMint = tool.issue();
  const noPrice = tool.explainNoMarketPrice();

  console.log(
    JSON.stringify(
      {
        asset: SUNREY_COIN_DISPLAY_NAME,
        tickerStatus: coin.asset.tickerStatus,
        liveEnabled: coin.asset.liveEnabled,
        proposalHadNoJournal: journalsBeforeProposal === 0 && proposal.ok,
        issuedJournal: issued.outcome === 'OK',
        positionAfterIssue: positionAfterIssue.settled.scaledUnits.toString(),
        supplyMatched: matched.outcome === 'MATCHED',
        issuedEqualsHoldings: supplyAfterIssue.circulating.equals(supplyAfterIssue.holdings),
        duplicateRejected: !duplicate.ok && duplicate.error.code === 'DUPLICATE',
        identicalWeights: evaluatedA.value.amount.equals(evaluatedB.value.amount),
        transferCompleted: transferred.outcome === 'OK',
        supplyUnchangedByTransfer: supplyAfterTransfer.circulating.equals(supplyAfterIssue.circulating),
        historicIssuanceRemains: historic.settled.scaledUnits === evaluatedA.value.amount.scaledUnits,
        futureRevokedConsentDenied: !future.ok && future.error.code === 'INELIGIBLE',
        agentCannotMint: !agentMint.ok,
        marketPrice: noPrice.ok ? noPrice.value.includes('UNAVAILABLE') : false,
        chainAdapter: coin.chainAdapter,
        evidenceChain: evidence.verifyChain().ok,
      },
      null,
      2,
    ),
  );
  console.log('sunrey-coin demo: ok');
}

await main();
