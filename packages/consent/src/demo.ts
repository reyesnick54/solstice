import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import {
  SimulatedPayrollConnector,
  SimulatedTransactionConnector,
  UserDeclaredConnector,
  UserUploadConnector,
} from '../../personal-data-vault/src/connectors.ts';
import { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { PurposeScopedVaultTool } from './agent-tool.ts';
import { ConsentDataUseAuthorization } from './authorization.ts';
import {
  RECIPIENT_EXTERNAL_RESEARCH,
  RECIPIENT_PERSONAL_AGENT,
  RECIPIENT_PRODUCT_RESEARCH,
} from './recipients.ts';
import { ConsentService } from './service.ts';
import { CONSENT_LEGAL_STATUS } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-15T12:00:00.000Z');
const CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'VAULT_EXPORT_OWN',
  'VAULT_DELETE_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
] as const;

function provision(
  identity: SimulatedIdentityAdapter,
  actorId: string,
  identityId: string,
  customerId: string,
) {
  const result = identity.provisionSimulatedActor({
    actorId,
    jurisdiction: asJurisdiction('GB'),
    identityId,
    customerId: asCustomerId(customerId),
    capabilities: [...CAPS],
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  const actor = identity.service.resolveActorContext(actorId);
  if (!actor.ok) {
    throw new Error(actor.error.message);
  }
  return actor.value;
}

async function main(): Promise<void> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const alice = provision(identity, 'actor_pdv_alice', 'idn_pdv_alice', 'cust_pdv_alice');
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  const graph = new EconomicGraphService({ clock, events });
  const tool = new PurposeScopedVaultTool(consent, vault);

  const opened = vault.openVault(alice, alice.subjectId, 'cust_pdv_alice');
  if (!opened.ok) {
    throw new Error(opened.error.message);
  }
  const payroll = new SimulatedPayrollConnector().fetch('payroll_july');
  const pay = vault.ingest(alice, {
    subjectId: alice.subjectId,
    sourceId: payroll.sourceId,
    sourceRecordRef: payroll.sourceRecordRef,
    idempotencyKey: 'payroll_july',
    schemaId: 'pdsch_payroll',
    schemaVersion: '1',
    contentType: payroll.contentType,
    payload: payroll.body,
    provenanceKind: payroll.provenanceKind,
    purposeRef: 'demo.ingest.payroll',
  });
  const tx = new SimulatedTransactionConnector().fetch('tx_summer');
  const purchases = vault.ingest(alice, {
    subjectId: alice.subjectId,
    sourceId: tx.sourceId,
    sourceRecordRef: tx.sourceRecordRef,
    idempotencyKey: 'tx_summer',
    schemaId: 'pdsch_transactions',
    schemaVersion: '1',
    contentType: tx.contentType,
    payload: tx.body,
    provenanceKind: tx.provenanceKind,
    purposeRef: 'demo.ingest.transactions',
  });
  const receipt = new UserUploadConnector().fetch('receipt_corner');
  const uploaded = vault.ingest(alice, {
    subjectId: alice.subjectId,
    sourceId: receipt.sourceId,
    sourceRecordRef: receipt.sourceRecordRef,
    idempotencyKey: 'receipt_corner',
    schemaId: 'pdsch_receipt',
    schemaVersion: '1',
    contentType: receipt.contentType,
    payload: receipt.body,
    provenanceKind: receipt.provenanceKind,
    purposeRef: 'demo.ingest.receipt',
  });
  const pref = new UserDeclaredConnector().fetch('pref_currency');
  const declared = vault.ingest(alice, {
    subjectId: alice.subjectId,
    sourceId: pref.sourceId,
    sourceRecordRef: pref.sourceRecordRef,
    idempotencyKey: 'pref_currency',
    schemaId: 'pdsch_preference',
    schemaVersion: '1',
    contentType: pref.contentType,
    payload: pref.body,
    provenanceKind: pref.provenanceKind,
    purposeRef: 'demo.ingest.preference',
  });
  if (!pay.ok || !purchases.ok || !uploaded.ok || !declared.ok) {
    throw new Error('ingestion failed');
  }

  const selfAccess = vault.readPayload(alice, alice.subjectId, pay.value.assetId, 'demo.view.own');
  const agentDenied = tool.readDerivedMonthlyIncome(alice, {
    subjectId: alice.subjectId,
    assetId: pay.value.assetId,
  });
  const draft = consent.draftConsent(alice, {
    subjectId: alice.subjectId,
    recipientId: RECIPIENT_PERSONAL_AGENT,
    purposeRef: 'PERSONAL_AGENT_ANALYSIS',
    categories: ['PAYROLL_DATA'],
    assetIds: [pay.value.assetId],
    fields: ['netMinor', 'currency', 'periodStart', 'periodEnd'],
    operations: ['READ', 'DERIVE', 'AGGREGATE'],
    derivationTypes: ['DERIVED_ONLY'],
    effectiveFrom: NOW,
    expiresAt: EXPIRES,
    requestedRetentionDays: 30,
    idempotencyKey: 'demo.agent.payroll.derived',
  });
  if (!draft.ok) {
    throw new Error(draft.error.message);
  }
  const granted = consent.confirmConsent(alice, draft.value.consentId, 'demo.agent.confirm');
  if (!granted.ok) {
    throw new Error(granted.error.message);
  }
  const derived = tool.readDerivedMonthlyIncome(alice, {
    subjectId: alice.subjectId,
    assetId: pay.value.assetId,
  });
  const rawReceipt = tool.readRawReceipt(alice, {
    subjectId: alice.subjectId,
    assetId: uploaded.value.assetId,
  });
  const product = consent.issuePermit(alice, {
    subjectId: alice.subjectId,
    recipientId: RECIPIENT_PRODUCT_RESEARCH,
    purposeRef: 'PRODUCT_IMPROVEMENT_RESEARCH',
    resourceId: pay.value.assetId,
    category: 'PAYROLL_DATA',
    operation: 'READ',
    derivationType: 'RAW',
  });
  const revoked = consent.revokeConsent(alice, granted.value.consentId, 'demo revoke', 'demo.revoke');
  const afterRevoke = consent.issuePermit(alice, {
    subjectId: alice.subjectId,
    recipientId: RECIPIENT_PERSONAL_AGENT,
    purposeRef: 'PERSONAL_AGENT_ANALYSIS',
    resourceId: pay.value.assetId,
    category: 'PAYROLL_DATA',
    operation: 'DERIVE',
    derivationType: 'DERIVED_ONLY',
  });
  const audit = vault.accessAudit(alice, alice.subjectId, 'demo.audit');
  const contribution = consent.draftConsent(alice, {
    subjectId: alice.subjectId,
    recipientId: RECIPIENT_EXTERNAL_RESEARCH,
    purposeRef: 'DATA_CONTRIBUTION_RESEARCH',
    categories: ['TRANSACTION_DATA'],
    operations: ['CONTRIBUTE', 'AGGREGATE'],
    derivationTypes: ['AGGREGATE_ONLY'],
    effectiveFrom: NOW,
    expiresAt: EXPIRES,
    idempotencyKey: 'demo.contribute',
  });
  if (!contribution.ok) {
    throw new Error(contribution.error.message);
  }
  const contributionActive = consent.confirmConsent(alice, contribution.value.consentId, 'demo.contribute.confirm');
  const cleanRoom = consent.executeExternalContribution(alice, contribution.value.consentId);
  graph.openGraph(alice, alice.subjectId, 'cust_pdv_alice');
  const peg = graph.declareDataAsset(alice, alice.subjectId, {
    ...vault.toPegDataAssetRef(pay.value),
    ...(granted.ok
      ? {
          consentVersion: granted.value.version,
          purposeVersion: granted.value.purposeVersion,
          derivationVersion: 'derived_monthly_income_1',
        }
      : {}),
  });
  const receiptView = consent.getConsentReceipt(alice, granted.value.consentId);
  const uses = consent.listDataUsesForConsent(alice, granted.value.consentId);

  console.log(
    JSON.stringify(
      {
        subjectSelfAccess: selfAccess.ok,
        agentWithoutConsentDenied: !agentDenied.ok && agentDenied.error.code === 'NO_ACTIVE_CONSENT',
        consentState: granted.value.state,
        purpose: granted.value.purposeCode,
        derivedIncome: derived.ok
          ? { netMinor: derived.value.netMinor, currency: derived.value.currency, permitId: derived.value.permitId }
          : derived.error,
        rawReceiptDenied: !rawReceipt.ok && rawReceipt.error.code === 'RESOURCE_OUT_OF_SCOPE',
        productImprovementDenied: !product.ok && product.error.code === 'PURPOSE_MISMATCH',
        revoked: revoked.ok,
        newPermitAfterRevokeDenied: !afterRevoke.ok && afterRevoke.error.code === 'CONSENT_REVOKED',
        historicalAuditRemains: audit.ok && audit.value.some((row) => row.decision === 'ALLOWED'),
        contributionConsentActive: contributionActive.ok && contributionActive.value.state === 'ACTIVE',
        cleanRoomBlocked: !cleanRoom.ok && cleanRoom.error.code === 'DEPENDENCY_NOT_IMPLEMENTED',
        pegStoresProvenanceWithoutPayload:
          peg.ok &&
          !JSON.stringify(peg.value).includes('Simulated Employer') &&
          Boolean((peg.value.attributes as { consentVersion?: string }).consentVersion),
        receiptAnswersWhoWhatHowLong: receiptView.ok
          ? {
              recipient: receiptView.value.recipientId,
              purpose: receiptView.value.purposeCode,
              operations: receiptView.value.operations,
              expiresAt: receiptView.value.expiresAt,
              onwardSharing: receiptView.value.onwardSharing,
            }
          : null,
        dataUsesRecorded: uses.ok ? uses.value.map((row) => row.reasonCode) : [],
        evidenceChain: evidence.verifyChain(),
        ledgerVerifies: consent.ledgerVerifies(),
        legalStatus: CONSENT_LEGAL_STATUS,
      },
      null,
      2,
    ),
  );
  console.log('consent demo: ok');
}

await main();
