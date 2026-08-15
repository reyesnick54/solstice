import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import {
  SimulatedPayrollConnector,
  SimulatedTransactionConnector,
  UserDeclaredConnector,
  UserUploadConnector,
} from './connectors.ts';
import { PersonalDataVault } from './service.ts';
import { PDV_LEGAL_STATUS } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const VAULT_CAPS = ['VAULT_VIEW_OWN', 'VAULT_INGEST_OWN', 'VAULT_EXPORT_OWN', 'VAULT_DELETE_OWN'] as const;

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
    capabilities: [...VAULT_CAPS],
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
  const bob = provision(identity, 'actor_pdv_bob', 'idn_pdv_bob', 'cust_pdv_bob');
  const vault = new PersonalDataVault({ clock, keys, evidence, events });
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

  const retrieved = vault.readPayload(alice, alice.subjectId, pay.value.assetId, 'demo.view.own');
  const versioned = vault.updateAsset(alice, {
    assetId: declared.value.assetId,
    subjectId: alice.subjectId,
    sourceId: pref.sourceId,
    sourceRecordRef: 'pref_currency_v2',
    idempotencyKey: 'pref_currency_v2',
    schemaId: 'pdsch_preference',
    schemaVersion: '1',
    contentType: pref.contentType,
    payload: { key: 'preferred_currency', value: 'GBP' },
    provenanceKind: 'USER_DECLARED',
    purposeRef: 'demo.version.own',
    ...(declared.value.currentVersionId ? { expectedCurrentVersionId: declared.value.currentVersionId } : {}),
  });
  const derived = vault.deriveSpendingSummary(alice, {
    subjectId: alice.subjectId,
    sourceAssetId: purchases.value.assetId,
    purposeRef: 'demo.derive.own',
    category: 'dining',
  });
  const graph = new EconomicGraphService({ clock, events });
  graph.openGraph(alice, alice.subjectId, 'cust_pdv_alice');
  graph.declareDataAsset(alice, alice.subjectId, vault.toPegDataAssetRef(purchases.value));
  const pegNode = derived.ok
    ? graph.declareDataAsset(alice, alice.subjectId, {
        ...vault.toPegDataAssetRef(derived.value.asset),
        derivedFromVaultAssetId: purchases.value.assetId,
      })
    : { ok: false as const };
  const exported = vault.exportOwn(alice, alice.subjectId, 'demo.export.own');
  const cross = vault.readPayload(bob, alice.subjectId, pay.value.assetId, 'demo.cross');
  const third = vault.requestThirdPartyUse(alice, alice.subjectId, purchases.value.assetId, 'demo.contribute');
  vault.markContributionEligible(alice, alice.subjectId, purchases.value.assetId, 'demo.mark');
  const deleted = vault.requestDeletion(alice, alice.subjectId, uploaded.value.assetId, 'demo.delete.own');
  const audit = vault.accessAudit(alice, alice.subjectId, 'demo.audit');

  console.log(
    JSON.stringify(
      {
        vaultId: opened.value.vaultId,
        subjectId: alice.subjectId,
        ingested: {
          payroll: pay.value.assetId,
          transactions: purchases.value.assetId,
          receipt: uploaded.value.assetId,
          preference: declared.value.assetId,
        },
        classification: {
          payroll: pay.value.sensitivity,
          receipt: uploaded.value.sensitivity,
        },
        provenance: pay.value.provenance.kind,
        retrievedBySubject: retrieved.ok,
        versioned: versioned.ok,
        derived: derived.ok ? derived.value.derivation.derivationId : null,
        pegReferencesVaultWithoutPayload: pegNode.ok && !JSON.stringify(pegNode.value).includes('Cafe North'),
        exportFormat: exported.ok ? exported.value.manifest.format : null,
        crossSubjectDenied: !cross.ok,
        thirdPartyDenied: !third.ok && third.error.code === 'CONSENT_SYSTEM_NOT_IMPLEMENTED',
        deleted: deleted.ok,
        receiptUnreadable: !vault.payloadReadable(uploaded.value.assetId),
        transactionsStillReadable: vault.payloadReadable(purchases.value.assetId),
        accessDecisions: audit.ok ? [...new Set(audit.value.map((row) => row.decision))] : [],
        evidenceKinds: evidence.list().map((row) => row.kind),
        legalStatus: PDV_LEGAL_STATUS.status,
        legalClaims: {
          gdpr: PDV_LEGAL_STATUS.gdprComplianceClaim,
          ownership: PDV_LEGAL_STATUS.legalOwnershipClaim,
        },
      },
      null,
      2,
    ),
  );
  console.log('personal-data-vault demo: ok');
}

await main();
