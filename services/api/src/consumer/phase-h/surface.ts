/**
 * Phase H consumer product surface.
 * Orchestrates Personal Data Vault, Consent, HIN, Human Contribution,
 * Information Rights, and MoonRey productive observations.
 * Does not mint. Does not activate live data monetization.
 */

import { FrozenClock } from '../../../../../packages/config/src/clock.ts';
import {
  LIVE_DATA_MARKET_ENABLED,
  LIVE_DATA_MONETIZATION_ENABLED,
  LIVE_HIN_BASED_ISSUANCE_ENABLED,
  LIVE_INFORMATION_RIGHTS_MARKETPLACE,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
} from '../../../../../packages/config/src/flags.ts';
import { asCustomerId, type Customer } from '../../../../../packages/domain/src/customer.ts';
import { asJurisdiction, asResidency } from '../../../../../packages/domain/src/jurisdiction.ts';
import { asUtcInstant, type UtcInstant } from '../../../../../packages/domain/src/time.ts';
import { EvidenceVault } from '../../../../../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../../../../../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../../../packages/identity/src/simulation.ts';
import type { VerifiedActorContext } from '../../../../../packages/identity/src/actor-context.ts';
import { ComplianceKernel } from '../../../../../packages/kernel/src/kernel.ts';
import { Ledger } from '../../../../../packages/ledger/src/journal.ts';
import { Money } from '../../../../../packages/money/src/money.ts';
import { AuthorityIssuer } from '../../../../../packages/permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../../../../packages/security/src/simulation.ts';
import { PersonalDataVault } from '../../../../../packages/personal-data-vault/src/service.ts';
import {
  SimulatedPayrollConnector,
  SimulatedTransactionConnector,
  UserDeclaredConnector,
  UserUploadConnector,
} from '../../../../../packages/personal-data-vault/src/connectors.ts';
import { DATA_CATEGORIES } from '../../../../../packages/personal-data-vault/src/taxonomy.ts';
import type { DataAsset, DataAssetId } from '../../../../../packages/personal-data-vault/src/index.ts';
import { ConsentDataUseAuthorization } from '../../../../../packages/consent/src/authorization.ts';
import { ConsentService } from '../../../../../packages/consent/src/service.ts';
import { PurposeScopedVaultTool } from '../../../../../packages/consent/src/agent-tool.ts';
import {
  RECIPIENT_EXTERNAL_RESEARCH,
  RECIPIENT_PERSONAL_AGENT,
} from '../../../../../packages/consent/src/recipients.ts';
import { HumanInformationNetworkEngine } from '../../../../../packages/information-market/src/network/engine.ts';
import type {
  ApprovedComputationId,
  HumanInformationAssetDescriptorId,
  HumanInformationRequestId,
  HumanInformationSubjectId,
} from '../../../../../packages/information-market/src/network/ids.ts';
import { HinContributionAdapter } from '../../../../../packages/information-market/src/network/contribution/adapter.ts';
import { createInProcessHumanContributionRegistry } from '../../../../../packages/information-market/src/network/contribution/registry.ts';
import { InformationMarketService } from '../../../../../packages/information-market/src/service.ts';
import { createSimulationFiatPort } from '../../../../../packages/information-market/src/fiat.ts';
import { CleanRoomService } from '../../../../../packages/clean-room/src/service.ts';
import { SunReyCoinService } from '../../../../../packages/sunrey-coin/src/service.ts';
import { SIMULATION_DIGITAL_CUSTODY_GB, SIMULATION_SOLSTICE_UK } from '../../../../../packages/sunrey-coin/src/simulation-catalog.ts';
import { HumanContributionRegistry } from '../../../../../packages/human-economic-contribution/src/registry.ts';
import { fixtureContribution } from '../../../../../packages/human-economic-contribution/src/fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from '../../../../../packages/human-economic-contribution/src/fingerprint.ts';
import { subjectRefFor } from '../../../../../packages/human-economic-contribution/src/ids.ts';
import { valueVerifiedContribution } from '../../../../../packages/human-economic-contribution/src/valuation/engine.ts';
import { simulationValuationPolicy } from '../../../../../packages/human-economic-contribution/src/valuation/policy.ts';
import {
  EnergyObservationStore,
  ingestEnergyObservation,
} from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/energy/adapter.ts';
import {
  staleReadingFixture,
  validGeneratorIntervalFeed,
} from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/energy/fixtures.ts';
import { ENERGY_NOW_UNIX } from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/energy/fixtures.ts';
import { ingestComputeObservation } from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/compute/adapter.ts';
import { gpuExecutionFixture } from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/compute/fixtures.ts';
import { ManufacturingDataFabric } from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/manufacturing/adapter.ts';
import { validMesUnitOutput } from '../../../../../packages/sunrey-chain/src/oracle/production/provider-families/manufacturing/fixtures.ts';
import { ProtocolNativeSupplyAuthority, lovableNativeEconomyContract } from '../../../../../packages/sunrey-chain/src/native-assets/index.ts';
import type { BffPrincipal } from '../ports.ts';
import { evaluateInformationRightsMarketplaceGate, evaluateProductionDataGates } from './gates.ts';
import {
  DATA_SOURCE_STATUSES,
  PHASE_H_POSTURE,
  RIGHTS_REQUEST_KINDS,
  type PhaseHResult,
  type RightsRequestKind,
} from './types.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-23T12:00:00.000Z');
const CAPS = [
  'VAULT_VIEW_OWN',
  'VAULT_INGEST_OWN',
  'VAULT_EXPORT_OWN',
  'VAULT_DELETE_OWN',
  'CONSENT_GRANT_OWN',
  'CONSENT_REVOKE_OWN',
  'CONSENT_VIEW_OWN',
  'ACCOUNT_OPEN_REQUEST',
  'POST_DEPOSIT_REQUEST',
  'INFORMATION_MARKET_OPERATE',
  'CLEAN_ROOM_REQUEST',
] as const;

const SCHEMA_FOR_KIND: Record<string, { schemaId: string; schemaVersion: string }> = {
  USER_DECLARED: { schemaId: 'pdsch_preference', schemaVersion: '1' },
  PAYROLL: { schemaId: 'pdsch_payroll', schemaVersion: '1' },
  TRANSACTIONS: { schemaId: 'pdsch_transactions', schemaVersion: '1' },
  RECEIPT: { schemaId: 'pdsch_receipt', schemaVersion: '1' },
};

function fail(code: string, message: string): PhaseHResult<never> {
  return { ok: false, code, message };
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function clientAsset(asset: DataAsset) {
  return Object.freeze({
    recordId: asset.assetId,
    category: asset.category,
    sourceId: asset.sourceId,
    provenance: {
      kind: asset.provenance.kind,
      confidence: asset.provenance.confidence,
      ingestedAt: asset.provenance.ingestedAt,
      observedAt: asset.provenance.observedAt,
      schemaId: asset.provenance.schemaId,
    },
    sensitivity: asset.sensitivity,
    lifecycle: asset.lifecycle,
    contributionMark: asset.contributionMark,
    authoritativeForFinancialState: false,
    payloadIncluded: false,
  });
}

type RightsRequest = {
  readonly requestId: string;
  readonly kind: RightsRequestKind;
  readonly state: 'SUBMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DENIED' | 'HELD';
  readonly subjectId: string;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant | null;
  readonly audit: readonly string[];
};

type DisputeRecord = {
  readonly disputeId: string;
  readonly recordId: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly createdAt: UtcInstant;
  readonly sourceMutated: false;
};

type CustomerBound = {
  readonly principal: BffPrincipal;
  readonly actor: VerifiedActorContext;
  readonly customerId: string;
  readonly subjectId: string;
  vault: PersonalDataVault;
  consent: ConsentService;
  hinSubjectId: HumanInformationSubjectId | null;
  hinDescriptorId: HumanInformationAssetDescriptorId | null;
  hinParticipation: boolean;
  pendingHinStop: { readonly requestId: string; readonly confirmed: false } | null;
  rights: RightsRequest[];
  disputes: DisputeRecord[];
  retentionHold: boolean;
  lastExportId: string | null;
  licenseGrants: Map<string, string>;
};

export class PhaseHProductSurface {
  readonly clock = new FrozenClock(NOW);
  readonly posture = PHASE_H_POSTURE;
  private readonly keys = createSimulationKeyProvider({ clock: { now: () => this.clock.now() } });
  private readonly events = new DomainEventLog();
  private readonly evidence = new EvidenceVault(this.clock);
  readonly identity = new SimulatedIdentityAdapter({
    clock: this.clock,
    keys: this.keys,
    events: this.events,
  });
  readonly hin = new HumanInformationNetworkEngine({ clock: this.clock });
  readonly hinRegistry = createInProcessHumanContributionRegistry();
  readonly hinAdapter = new HinContributionAdapter({ engine: this.hin, registry: this.hinRegistry });
  readonly contributions = new HumanContributionRegistry();
  readonly manufacturing = new ManufacturingDataFabric();
  readonly energyStore = new EnergyObservationStore();
  readonly nativeAuthority = new ProtocolNativeSupplyAuthority();
  readonly issuer = new AuthorityIssuer('phase-h-qualification');
  readonly kernel = new ComplianceKernel(this.issuer, this.evidence, this.clock);
  readonly ledger = new Ledger(this.issuer, this.clock);
  readonly customers = new Map<string, Customer>();
  private readonly coin: SunReyCoinService;
  readonly market: InformationMarketService;
  readonly fiat: ReturnType<typeof createSimulationFiatPort>;
  private readonly bound = new Map<string, CustomerBound>();
  private readonly licenseeRequesterId = 'req_sandbox_licensee';
  private hinComputationId: ApprovedComputationId | null = null;
  private usageCount = 0;
  private compensationJournalIds: string[] = [];
  readonly productive = {
    energy: [] as Array<{ readonly status: 'SANDBOX'; readonly category: 'ENERGY'; readonly accepted: boolean; readonly mints: false }>,
    compute: [] as Array<{ readonly status: 'SANDBOX'; readonly category: 'COMPUTE'; readonly accepted: boolean; readonly mints: false }>,
    manufacturing: [] as Array<{ readonly status: 'SANDBOX'; readonly category: 'MANUFACTURING'; readonly accepted: boolean; readonly mints: false }>,
    rejected: [] as Array<{ readonly code: string; readonly reason: string }>,
  };

  constructor() {
    const consent = new ConsentService({
      clock: this.clock,
      keys: this.keys,
      evidence: this.evidence,
      events: this.events,
    });
    const vault = new PersonalDataVault({
      clock: this.clock,
      keys: this.keys,
      evidence: this.evidence,
      events: this.events,
      authorization: new ConsentDataUseAuthorization(consent),
    });
    const cleanRoom = new CleanRoomService({
      clock: this.clock,
      keys: this.keys,
      evidence: this.evidence,
      events: this.events,
      consent,
      vault,
    });
    this.coin = new SunReyCoinService({
      kernel: this.kernel,
      issuer: this.issuer,
      evidence: this.evidence,
      events: this.events,
      clock: this.clock,
      identity: this.identity.service,
      ledger: this.ledger,
      consent,
      catalog: {
        customers: { get: (id) => this.customers.get(id) },
        products: {
          get: (id) => (id === SIMULATION_DIGITAL_CUSTODY_GB.id ? SIMULATION_DIGITAL_CUSTODY_GB : undefined),
        },
        legalEntities: { get: (id) => (id === SIMULATION_SOLSTICE_UK.id ? SIMULATION_SOLSTICE_UK : undefined) },
      },
    });
    this.fiat = createSimulationFiatPort({
      kernel: this.kernel,
      issuer: this.issuer,
      ledger: this.ledger,
      identity: this.identity.service,
      clock: this.clock,
      customers: this.customers,
    });
    this.market = new InformationMarketService({
      clock: this.clock,
      keys: this.keys,
      evidence: this.evidence,
      events: this.events,
      consent,
      cleanRoom,
      coin: this.coin,
      fiat: this.fiat,
    });
    unwrap(
      this.hin.registerRequester({
        requesterId: this.licenseeRequesterId,
        organization: 'Sandbox Licensee Lab',
        requesterClass: 'RESEARCH_INSTITUTION',
        jurisdiction: 'GB',
      }),
    );
    const computation = unwrap(
      this.hin.registerApprovedComputation({
        codeVersion: 'agg-v1',
        queryDefinition: 'AGGREGATE_MEAN',
        artifactDigest: 'sha256:phase-h-agg',
        allowedOutputClasses: ['AGGREGATE_STATISTIC', 'BOOLEAN_ATTESTATION'],
      }),
    );
    this.hinComputationId = computation.computationId;
    void LIVE_DATA_MARKET_ENABLED;
    void LIVE_INFORMATION_RIGHTS_MARKETPLACE;
    void LIVE_DATA_MONETIZATION_ENABLED;
    void LIVE_HIN_BASED_ISSUANCE_ENABLED;
    void LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED;
  }

  bindPrincipal(principal: BffPrincipal): CustomerBound {
    const existing = this.bound.get(principal.customerId);
    if (existing) {
      return existing;
    }
    const provisioned = this.identity.provisionSimulatedActor({
      actorId: principal.actorId,
      jurisdiction: asJurisdiction(principal.jurisdiction === 'GB' ? 'GB' : 'GB'),
      identityId: principal.identityId,
      customerId: asCustomerId(principal.customerId),
      capabilities: [...CAPS],
    });
    if (!provisioned.ok) {
      throw new Error(provisioned.error.message);
    }
    const consent = new ConsentService({
      clock: this.clock,
      keys: this.keys,
      evidence: this.evidence,
      events: this.events,
    });
    const vault = new PersonalDataVault({
      clock: this.clock,
      keys: this.keys,
      evidence: this.evidence,
      events: this.events,
      authorization: new ConsentDataUseAuthorization(consent),
    });
    unwrap(vault.openVault(provisioned.value, provisioned.value.subjectId, principal.customerId));
    const customer = Object.freeze({
      id: asCustomerId(principal.customerId),
      legalEntityId: SIMULATION_SOLSTICE_UK.id,
      jurisdiction: asJurisdiction('GB'),
      residency: asResidency('GB'),
      status: 'ACTIVE' as const,
      verification: {
        kycState: 'VERIFIED' as const,
        kycRecordVersion: 1,
        refreshBy: asUtcInstant('2027-08-23T12:00:00.000Z'),
      },
      createdAt: NOW,
      version: 1,
    });
    this.customers.set(principal.customerId, customer);
    const bound: CustomerBound = {
      principal,
      actor: provisioned.value,
      customerId: principal.customerId,
      subjectId: provisioned.value.subjectId,
      vault,
      consent,
      hinSubjectId: null,
      hinDescriptorId: null,
      hinParticipation: false,
      pendingHinStop: null,
      rights: [],
      disputes: [],
      retentionHold: false,
      lastExportId: null,
      licenseGrants: new Map(),
    };
    this.bound.set(principal.customerId, bound);
    return bound;
  }

  vaultHome(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const assets = unwrap(bound.vault.listAssets(bound.actor, bound.subjectId, 'view.own'));
    return {
      ...PHASE_H_POSTURE,
      schema: 'sunrey.consumer.vault.home.v1',
      vaultId: `vault:${bound.subjectId}`,
      categories: DATA_CATEGORIES,
      recordCount: assets.length,
      hinParticipation: bound.hinParticipation,
      encryption: {
        atRest: 'subject-bound envelope',
        plaintextInMetadata: false,
        persistence: 'packages/persistence personal-data-vault + in-process snapshot',
      },
      sourceStatus: 'SANDBOX' as const,
      sandboxDataIsNotReal: true,
    };
  }

  categories() {
    return {
      schema: 'sunrey.consumer.vault.categories.v1',
      items: DATA_CATEGORIES,
      classification: 'DATA_CATEGORIES',
      sourceStatus: 'SANDBOX' as const,
    };
  }

  sources() {
    return {
      schema: 'sunrey.consumer.vault.sources.v1',
      items: [
        { sourceId: 'pds_user_declared', kind: 'USER_DECLARED', liveConnection: false, status: 'SANDBOX' },
        { sourceId: 'pds_sim_payroll', kind: 'SIMULATED_PAYROLL', liveConnection: false, status: 'SANDBOX' },
        { sourceId: 'pds_sim_transactions', kind: 'SIMULATED_TRANSACTIONS', liveConnection: false, status: 'SANDBOX' },
        { sourceId: 'pds_user_upload', kind: 'USER_UPLOAD', liveConnection: false, status: 'SANDBOX' },
      ],
      sandboxDataIsNotReal: true,
    };
  }

  listRecords(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const assets = unwrap(bound.vault.listAssets(bound.actor, bound.subjectId, 'view.own'));
    return {
      schema: 'sunrey.consumer.vault.records.v1',
      items: assets.map(clientAsset),
      payloadsIncluded: false,
    };
  }

  createUserDeclared(principal: BffPrincipal, input: { readonly key?: string; readonly value?: string; readonly idempotencyKey?: string }): PhaseHResult<ReturnType<typeof clientAsset>> {
    const bound = this.bindPrincipal(principal);
    const connector = new UserDeclaredConnector();
    const fetched = connector.fetch(input.idempotencyKey ?? 'pref_1');
    const declaredSchema = SCHEMA_FOR_KIND.USER_DECLARED;
    if (!declaredSchema) {
      return fail('SCHEMA_MISSING', 'user-declared schema is not configured');
    }
    const ingested = bound.vault.ingest(bound.actor, {
      subjectId: bound.subjectId,
      sourceId: fetched.sourceId,
      sourceRecordRef: fetched.sourceRecordRef,
      idempotencyKey: input.idempotencyKey ?? fetched.sourceRecordRef,
      schemaId: declaredSchema.schemaId,
      schemaVersion: declaredSchema.schemaVersion,
      contentType: fetched.contentType,
      payload: {
        key: input.key ?? (fetched.body as { key: string }).key,
        value: input.value ?? (fetched.body as { value: string }).value,
      },
      provenanceKind: fetched.provenanceKind,
      purposeRef: 'ingest.own',
    });
    if (!ingested.ok) {
      return fail(ingested.error.code, ingested.error.message);
    }
    return { ok: true, value: clientAsset(ingested.value) };
  }

  ingestSourceBacked(
    principal: BffPrincipal,
    input: { readonly kind?: 'PAYROLL' | 'TRANSACTIONS' | 'RECEIPT'; readonly idempotencyKey?: string },
  ): PhaseHResult<ReturnType<typeof clientAsset>> {
    const bound = this.bindPrincipal(principal);
    const kind = input.kind ?? 'PAYROLL';
    const connector =
      kind === 'TRANSACTIONS'
        ? new SimulatedTransactionConnector()
        : kind === 'RECEIPT'
          ? new UserUploadConnector()
          : new SimulatedPayrollConnector();
    const fetched = connector.fetch(input.idempotencyKey ?? `${kind.toLowerCase()}_1`);
    const schema = SCHEMA_FOR_KIND[kind];
    if (!schema) {
      return fail('SCHEMA_MISSING', 'source schema is not configured');
    }
    const ingested = bound.vault.ingest(bound.actor, {
      subjectId: bound.subjectId,
      sourceId: fetched.sourceId,
      sourceRecordRef: fetched.sourceRecordRef,
      idempotencyKey: input.idempotencyKey ?? fetched.sourceRecordRef,
      schemaId: schema.schemaId,
      schemaVersion: schema.schemaVersion,
      contentType: fetched.contentType,
      payload: fetched.body,
      provenanceKind: fetched.provenanceKind,
      purposeRef: 'ingest.own',
    });
    if (!ingested.ok) {
      return fail(ingested.error.code, ingested.error.message);
    }
    return { ok: true, value: clientAsset(ingested.value) };
  }

  getRecord(principal: BffPrincipal, recordId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const meta = bound.vault.readMetadata(bound.actor, bound.subjectId, recordId as DataAssetId, 'view.own');
    if (!meta.ok) {
      return fail(meta.error.code, meta.error.message);
    }
    return { ok: true, value: { ...clientAsset(meta.value), provenanceVerified: true } };
  }

  deriveRecord(principal: BffPrincipal, recordId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const derived = bound.vault.deriveSpendingSummary(bound.actor, {
      subjectId: bound.subjectId,
      sourceAssetId: recordId as DataAssetId,
      purposeRef: 'derive.own',
    });
    if (!derived.ok) {
      return fail(derived.error.code, derived.error.message);
    }
    return { ok: true, value: { record: clientAsset(derived.value.asset), derivationId: derived.value.derivation.derivationId } };
  }

  recordHistory(principal: BffPrincipal, recordId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const snap = bound.vault.snapshot();
    const versions = snap.versions.filter((row) => row.assetId === recordId);
    if (versions.length === 0) {
      return fail('NOT_FOUND', 'record history not found');
    }
    return {
      ok: true,
      value: {
        schema: 'sunrey.consumer.vault.history.v1',
        recordId,
        items: versions.map((row) =>
          Object.freeze({
            versionId: row.versionId,
            sequence: row.sequence,
            state: row.state,
            createdAt: row.createdAt,
            payloadIncluded: false,
          }),
        ),
      },
    };
  }

  correctRecord(
    principal: BffPrincipal,
    recordId: string,
    input: { readonly key?: string; readonly value?: string },
  ): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const meta = bound.vault.readMetadata(bound.actor, bound.subjectId, recordId as DataAssetId, 'view.own');
    if (!meta.ok) {
      return fail(meta.error.code, meta.error.message);
    }
    if (meta.value.provenance.kind !== 'USER_DECLARED' && meta.value.provenance.kind !== 'USER_UPLOADED') {
      return fail('CORRECTION_NOT_ELIGIBLE', 'source-backed records must be disputed, not silently corrected');
    }
    const updated = bound.vault.updateAsset(bound.actor, {
      assetId: recordId as DataAssetId,
      subjectId: bound.subjectId,
      sourceId: meta.value.sourceId,
      sourceRecordRef: `${meta.value.provenance.sourceRecordRef}:correction`,
      idempotencyKey: `correct:${recordId}:${this.clock.now()}`,
      schemaId: meta.value.schemaId,
      schemaVersion: meta.value.schemaVersion,
      contentType: 'application/json',
      payload: { key: input.key ?? 'preferred_currency', value: input.value ?? 'EUR' },
      provenanceKind: 'USER_DECLARED',
      purposeRef: 'correct.own',
      ...(meta.value.currentVersionId ? { expectedCurrentVersionId: meta.value.currentVersionId } : {}),
    });
    if (!updated.ok) {
      return fail(updated.error.code, updated.error.message);
    }
    return { ok: true, value: clientAsset(updated.value) };
  }

  disputeRecord(principal: BffPrincipal, recordId: string, reason: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const meta = bound.vault.readMetadata(bound.actor, bound.subjectId, recordId as DataAssetId, 'view.own');
    if (!meta.ok) {
      return fail(meta.error.code, meta.error.message);
    }
    if (meta.value.provenance.kind === 'USER_DECLARED') {
      return fail('DISPUTE_NOT_ELIGIBLE', 'user-declared records are corrected, not disputed');
    }
    const dispute: DisputeRecord = {
      disputeId: `dsp_${bound.disputes.length + 1}`,
      recordId,
      subjectId: bound.subjectId,
      reason,
      createdAt: this.clock.now(),
      sourceMutated: false,
    };
    bound.disputes.push(dispute);
    return { ok: true, value: dispute };
  }

  accessHistory(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const audit = unwrap(bound.vault.accessAudit(bound.actor, bound.subjectId, 'view.own'));
    return {
      schema: 'sunrey.consumer.vault.access-history.v1',
      items: audit.map((row) =>
        Object.freeze({
          accessId: row.accessId,
          operation: row.operation,
          decision: row.decision,
          purposeRef: row.purposeRef,
          occurredAt: row.occurredAt,
          payloadIncluded: false,
        }),
      ),
    };
  }

  permissions(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const consents = unwrap(bound.consent.listMyConsents(bound.actor, bound.subjectId));
    return {
      schema: 'sunrey.consumer.vault.permissions.v1',
      items: consents.map((row) =>
        Object.freeze({
          permissionId: row.consentId,
          state: row.state,
          purposeRef: row.purposeCode,
          recipientId: row.recipientId,
          categories: row.scope.categories,
        }),
      ),
    };
  }

  grantPermission(
    principal: BffPrincipal,
    input: {
      readonly purpose: 'PERSONAL_AGENT_ANALYSIS' | 'DATA_CONTRIBUTION_RESEARCH';
      readonly categories: readonly string[];
      readonly idempotencyKey?: string;
    },
  ): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const recipientId =
      input.purpose === 'PERSONAL_AGENT_ANALYSIS' ? RECIPIENT_PERSONAL_AGENT : RECIPIENT_EXTERNAL_RESEARCH;
    const draft = bound.consent.draftConsent(bound.actor, {
      subjectId: bound.subjectId,
      recipientId,
      purposeRef: input.purpose,
      categories: input.categories as never,
      operations: input.purpose === 'DATA_CONTRIBUTION_RESEARCH' ? ['CONTRIBUTE', 'AGGREGATE'] : ['READ', 'DERIVE', 'AGGREGATE'],
      derivationTypes: input.purpose === 'PERSONAL_AGENT_ANALYSIS' ? ['DERIVED_ONLY'] : ['AGGREGATE_ONLY'],
      ...(input.purpose === 'PERSONAL_AGENT_ANALYSIS'
        ? { fields: ['netMinor', 'currency', 'periodStart', 'periodEnd'] }
        : {}),
      effectiveFrom: NOW,
      expiresAt: EXPIRES,
      requestedRetentionDays: 30,
      idempotencyKey: input.idempotencyKey ?? `grant:${bound.subjectId}:${input.purpose}:${input.categories.join(',')}`,
    });
    if (!draft.ok) {
      return fail(draft.error.code, draft.error.message);
    }
    const confirmed = bound.consent.confirmConsent(
      bound.actor,
      draft.value.consentId,
      `confirm:${draft.value.consentId}`,
    );
    if (!confirmed.ok) {
      return fail(confirmed.error.code, confirmed.error.message);
    }
    return {
      ok: true,
      value: {
        permissionId: confirmed.value.consentId,
        state: confirmed.value.state,
        purposeRef: input.purpose,
        categories: input.categories,
      },
    };
  }

  revokePermission(principal: BffPrincipal, permissionId: string, reason = 'user_revoked'): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const revoked = bound.consent.revokeConsent(bound.actor, permissionId, reason, `revoke:${permissionId}`);
    if (!revoked.ok) {
      return fail(revoked.error.code, revoked.error.message);
    }
    return { ok: true, value: { permissionId, revoked: true, historicalAuditRetained: true } };
  }

  consentReceipt(principal: BffPrincipal, consentId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const receipt = bound.consent.getConsentReceipt(bound.actor, consentId);
    if (!receipt.ok) {
      return fail(receipt.error.code, receipt.error.message);
    }
    return {
      ok: true,
      value: {
        consentId,
        receiptId: receipt.value.receiptId,
        issuedAt: receipt.value.confirmedAt,
        payloadIncluded: false,
      },
    };
  }

  agentAccess(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const consents = unwrap(bound.consent.listActiveConsents(bound.actor, bound.subjectId));
    const agent = consents.filter((row) => row.purposeCode === 'PERSONAL_AGENT_ANALYSIS' || row.recipientId === RECIPIENT_PERSONAL_AGENT);
    return {
      schema: 'sunrey.consumer.vault.agent-access.v1',
      granted: agent.length > 0,
      items: agent.map((row) => ({ permissionId: row.consentId, categories: row.scope.categories, state: row.state })),
      wildcardForbidden: true,
      rawSensitiveRecords: false,
    };
  }

  agentRead(principal: BffPrincipal, input: { readonly recordId?: string; readonly category?: string }): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    if (!input.recordId) {
      return fail('WILDCARD_FORBIDDEN', 'Agent may not request the entire Vault without purpose and asset ids');
    }
    const tool = new PurposeScopedVaultTool(bound.consent, bound.vault);
    if (input.category === 'RECEIPT') {
      const raw = tool.readRawReceipt(bound.actor, { subjectId: bound.subjectId, assetId: input.recordId as DataAssetId });
      if (!raw.ok) {
        return fail(raw.error.code, raw.error.message);
      }
    }
    const derived = tool.readDerivedMonthlyIncome(bound.actor, {
      subjectId: bound.subjectId,
      assetId: input.recordId as DataAssetId,
    });
    if (!derived.ok) {
      return fail(derived.error.code, derived.error.message);
    }
    return {
      ok: true,
      value: {
        category: 'PAYROLL_DATA',
        derivedOnly: true,
        rawPayrollExcluded: true,
        summary: derived.value,
      },
    };
  }

  vaultSummaryForAgent(principal: BffPrincipal) {
    const home = this.vaultHome(principal);
    const records = this.listRecords(principal);
    return {
      schema: 'sunrey.agent.vault-summary.v1',
      categories: home.categories,
      sources: this.sources().items.map((row) => ({ sourceId: row.sourceId, kind: row.kind, status: row.status })),
      recordCount: home.recordCount,
      items: records.items.map((row) => ({ recordId: row.recordId, category: row.category, provenance: row.provenance.kind })),
      unauthorizedSensitiveRecords: false,
      payloadsIncluded: false,
    };
  }

  hinHome(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const rights = bound.hinSubjectId ? this.hin.getInformationRights(bound.hinSubjectId) : [];
    const compensation = bound.hinSubjectId ? this.hin.getInformationCompensation(bound.hinSubjectId) : [];
    const usage = bound.hinSubjectId ? this.hin.getInformationUsage(bound.hinSubjectId) : [];
    return {
      schema: 'sunrey.consumer.hin.v1',
      participating: bound.hinParticipation,
      pendingStop: bound.pendingHinStop,
      rights: rights.map((row) => ({ rightId: row.rightId, status: row.status, purpose: row.purpose })),
      usageCount: usage.length,
      compensationCount: compensation.length,
      liveMarketplace: false,
      mintRequested: false,
      sourceStatus: 'SANDBOX' as const,
    };
  }

  participateHin(principal: BffPrincipal): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const granted = this.grantPermission(principal, {
      purpose: 'DATA_CONTRIBUTION_RESEARCH',
      categories: ['TRANSACTION_DATA', 'PREFERENCE_DATA', 'DATA_CONTRIBUTION_CANDIDATE'],
      idempotencyKey: `hin-participate:${bound.subjectId}`,
    });
    if (!granted.ok) {
      return granted;
    }
    if (!bound.hinSubjectId) {
      const subject = unwrap(this.hin.registerSubject({ internalRef: bound.customerId }));
      const descriptor = unwrap(
        this.hin.registerDescriptor({
          subjectId: subject.subjectId,
          category: 'FINANCIAL_ACTIVITY_METADATA',
          schema: 'activity-metadata-v1',
          sourceClass: 'PERSONAL_DATA_VAULT',
          freshness: 'P30D',
          sensitivityClass: 'SENSITIVE',
          permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
        }),
      );
      bound.hinSubjectId = subject.subjectId;
      bound.hinDescriptorId = descriptor.descriptorId;
    }
    bound.hinParticipation = true;
    return {
      ok: true,
      value: {
        participating: true,
        hinSubjectId: bound.hinSubjectId,
        permission: granted.value,
      },
    };
  }

  requestHinStop(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    bound.pendingHinStop = { requestId: `hin_stop_${bound.customerId}`, confirmed: false };
    return {
      schema: 'sunrey.consumer.hin.stop-request.v1',
      requestId: bound.pendingHinStop.requestId,
      revoked: false,
      confirmed: false,
      requiresExplicitUserAction: true,
      explanation: 'Sharing is not stopped until you confirm and the server returns the revoked state.',
    };
  }

  confirmHinStop(principal: BffPrincipal): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const consents = unwrap(bound.consent.listActiveConsents(bound.actor, bound.subjectId));
    for (const row of consents) {
      if (row.purposeCode === 'DATA_CONTRIBUTION_RESEARCH' || row.recipientId === RECIPIENT_EXTERNAL_RESEARCH) {
        bound.consent.revokeConsent(bound.actor, row.consentId, 'hin_stop', `revoke:${row.consentId}`);
      }
    }
    if (bound.hinSubjectId) {
      for (const grant of this.hin.store.grants.values()) {
        if (grant.subjectId === bound.hinSubjectId && grant.status === 'ACTIVE') {
          this.hin.revokeInformationConsent({ grantId: grant.grantId });
        }
      }
    }
    bound.hinParticipation = false;
    bound.pendingHinStop = null;
    return {
      ok: true,
      value: {
        participating: false,
        revoked: true,
        confirmed: true,
        historicalAuditRetained: true,
      },
    };
  }

  createContribution(principal: BffPrincipal, seed?: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    if (!bound.hinParticipation) {
      return fail('HIN_PARTICIPATION_REQUIRED', 'HIN participation consent is required before a contribution event');
    }
    const input = {
      ...fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', seed ?? `hin-${bound.customerId}`),
      subjectRef: subjectRefFor(bound.customerId),
    };
    const submitted = this.contributions.submit(input);
    if (!submitted.ok) {
      return fail(submitted.error.code, submitted.error.message);
    }
    const verified = this.contributions.verify({
      contributionId: submitted.value.contributionId,
      verificationTimestamp: NOW,
      verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
    });
    if (!verified.ok) {
      return fail(verified.error.code, verified.error.message);
    }
    const minted = this.contributions.authorizeMint(verified.value.event);
    const policy = simulationValuationPolicy({ jurisdictionPolicyRef: 'policy.sim.jurisdiction.unconfigured' });
    const valued = valueVerifiedContribution({
      contribution: {
        contributionId: verified.value.contributionId,
        fingerprint: verified.value.fingerprint,
        status: 'VERIFIED',
        verificationPolicyVersion: verified.value.verificationPolicyVersion ?? DEFAULT_VERIFICATION_POLICY_VERSION,
        measurementQuantity: verified.value.verifiedMeasurement?.quantity ?? 1n,
        measurementUnit: String(verified.value.verifiedMeasurement?.unit ?? 'CONSENT_SCOPED_INFORMATION_USE'),
        jurisdictionPolicyRef: policy.jurisdictionPolicyRef,
        containsRawPersonalData: false,
        peveScoreUsedAsValue: false,
        humanWorthScore: false,
      },
      policy,
      actor: 'DEVELOPMENT_FIXTURE',
    });
    return {
      ok: true,
      value: {
        contributionId: verified.value.contributionId,
        status: verified.value.status,
        verified: verified.value.status === 'VERIFIED',
        mintRefused: minted.authorized === false,
        sunReyQuantity: verified.value.sunReyQuantity,
        valuation:
          valued.ok === true
            ? {
                valuationId: valued.result.valuationId,
                methodology: valued.result.valuationMethod,
                referenceValue: valued.result.finalReferenceValue.toString(),
                sunReyQuantity: valued.result.sunReyQuantity,
                isNotMarketPrice: true,
                isNotAutomaticMint: true,
              }
            : { error: valued.ok === false ? valued.code : 'UNAVAILABLE' },
        issuanceBasisProposal: {
          schema: 'sunrey.hin.issuance-basis-proposal.v1',
          status: 'DRAFT_STOP_BEFORE_ISSUANCE',
          mintRequested: false,
          mainnetIssuance: false,
          hinCannotModifySupply: true,
        },
      },
    };
  }

  duplicateContribution(principal: BffPrincipal, seed: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const again = this.contributions.submit({
      ...fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', seed),
      subjectRef: subjectRefFor(bound.customerId),
      createdAt: asUtcInstant('2026-08-23T12:10:00.000Z'),
    });
    if (again.ok) {
      return { ok: true, value: { duplicateBlocked: false, contributionId: again.value.contributionId } };
    }
    return { ok: true, value: { duplicateBlocked: true, code: again.error.code } };
  }

  contributionsFor(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const items = this.contributions.listBySubject(subjectRefFor(bound.customerId));
    return {
      schema: 'sunrey.consumer.hin.contributions.v1',
      items: items.map((row) => ({
        contributionId: row.contributionId,
        contributionClass: row.contributionClass,
        sunReyQuantity: row.sunReyQuantity,
      })),
      nativeAssetMinted: false,
    };
  }

  requestLicense(principal: BffPrincipal, input: { readonly purpose?: string }): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    if (!bound.hinSubjectId || !bound.hinDescriptorId || !bound.hinParticipation) {
      return fail('HIN_PARTICIPATION_REQUIRED', 'subject must grant HIN participation before licensing');
    }
    if (input.purpose === 'ANY_FUTURE_PURPOSE' || input.purpose === 'MODEL_TRAINING') {
      return fail('PURPOSE_REFUSED', 'license purpose is not permitted');
    }
    const request = this.hin.submitInformationRequest({
      requesterId: this.licenseeRequesterId,
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'AGGREGATED_RESEARCH',
      ...(this.hinComputationId ? { computationId: this.hinComputationId } : {}),
      duration: 'P30D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 1000n,
      jurisdiction: 'GB',
    });
    if (!request.ok) {
      return fail(request.error.code, request.error.message);
    }
    const preview = this.hin.previewInformationConsent({
      requestId: request.value.requestId,
      subjectId: bound.hinSubjectId,
      descriptorId: bound.hinDescriptorId,
    });
    if (!preview.ok) {
      return fail(preview.error.code, preview.error.message);
    }
    return {
      ok: true,
      value: {
        licenseId: request.value.requestId,
        status: request.value.status,
        purpose: 'AGGREGATED_RESEARCH',
        rightsChecked: true,
        consentPreviewed: true,
        liveMarketplace: false,
      },
    };
  }

  approveLicense(principal: BffPrincipal, licenseId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    if (!bound.hinSubjectId || !bound.hinDescriptorId) {
      return fail('HIN_PARTICIPATION_REQUIRED', 'HIN subject is required');
    }
    const approved = this.hin.approveInformationConsent({
      requestId: licenseId as HumanInformationRequestId,
      subjectId: bound.hinSubjectId,
      descriptorId: bound.hinDescriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    });
    if (!approved.ok) {
      return fail(approved.error.code, approved.error.message);
    }
    bound.licenseGrants.set(licenseId, approved.value.grant.grantId);
    return {
      ok: true,
      value: {
        licenseId,
        grantId: approved.value.grant.grantId,
        rightId: approved.value.right.rightId,
        status: approved.value.right.status,
        accessActive: approved.value.right.status === 'ACTIVE',
      },
    };
  }

  payAndMeterLicense(principal: BffPrincipal, licenseId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const request = this.hin.getInformationRequests(this.licenseeRequesterId).find((row) => row.requestId === licenseId);
    if (!request) {
      return fail('NOT_FOUND', 'license request not found');
    }
    const right = bound.hinSubjectId
      ? this.hin.getInformationRights(bound.hinSubjectId).find((row) => row.status === 'ACTIVE')
      : undefined;
    if (!right) {
      return fail('LICENSE_NOT_ACTIVE', 'license is not active');
    }
    const usage = this.hin.recordUsage({
      rightId: right.rightId,
      requesterId: this.licenseeRequesterId,
      computationId: (this.hinComputationId ?? 'cmp_missing') as ApprovedComputationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: `settle:${licenseId}:${this.usageCount + 1}`,
    });
    if (!usage.ok) {
      return fail(usage.error.code, usage.error.message);
    }
    this.usageCount += 1;
    const compensation = this.hin.authorizeCompensation({
      subjectId: (bound.hinSubjectId ?? '') as HumanInformationSubjectId,
      requesterId: this.licenseeRequesterId,
      asset: 'APPROVED_FIAT',
      amountMinor: 1000n,
    });
    if (!compensation.ok) {
      return fail(compensation.error.code, compensation.error.message);
    }
    const realized = this.hinAdapter.submitRealizedUse({ receiptId: usage.value.receiptId });
    const ledger = this.fiat.creditParticipant({
      actorId: bound.actor.actorId,
      customerId: bound.customerId,
      participantAccountId: `acct_hin_${bound.customerId}`,
      amount: Money.fromMinorUnits(1000n, 'USD'),
      contributionId: realized.ok ? realized.value.contributionId : usage.value.receiptId,
    });
    if (ledger.outcome === 'OK' && ledger.journalId) {
      this.compensationJournalIds.push(ledger.journalId);
    }
    return {
      ok: true,
      value: {
        usageReceiptId: usage.value.receiptId,
        compensationInstructionId: compensation.value.instructionId,
        mintRequested: compensation.value.mintRequested,
        ledgerJournalId: ledger.outcome === 'OK' ? ledger.journalId : null,
        ledgerRecorded: ledger.outcome === 'OK',
        contributionId: realized.ok ? realized.value.contributionId : null,
        marketplaceCannotMint: this.market.mintFromMarketplace().ok === false,
      },
    };
  }

  revokeLicense(principal: BffPrincipal, licenseId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    const grantId = bound.licenseGrants.get(licenseId);
    const grant = grantId ? this.hin.store.grants.get(grantId as never) : undefined;
    if (!grant || !grantId) {
      return fail('NOT_FOUND', 'license grant not found');
    }
    const right = (bound.hinSubjectId ? this.hin.getInformationRights(bound.hinSubjectId) : []).find(
      (row) => row.consentGrantId === grant.grantId,
    );
    const revoked = this.hin.revokeInformationConsent({ grantId: grant.grantId });
    if (!revoked.ok) {
      return fail(revoked.error.code, revoked.error.message);
    }
    const future = this.hin.recordUsage({
      rightId: right?.rightId ?? (grantId as never),
      requesterId: this.licenseeRequesterId,
      computationId: (this.hinComputationId ?? 'cmp_missing') as ApprovedComputationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: `settle:revoked:${licenseId}`,
    });
    return {
      ok: true,
      value: {
        revoked: true,
        futureAccessBlocked: !future.ok,
        historicalSettlementErased: revoked.value.historicalSettlementErased,
      },
    };
  }

  licenses(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const rights = bound.hinSubjectId ? this.hin.getInformationRights(bound.hinSubjectId) : [];
    return {
      schema: 'sunrey.consumer.hin.licenses.v1',
      items: rights.map((row) => ({ rightId: row.rightId, status: row.status, purpose: row.purpose })),
      liveMarketplace: false,
    };
  }

  earnings(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    const compensation = bound.hinSubjectId ? this.hin.getInformationCompensation(bound.hinSubjectId) : [];
    return {
      schema: 'sunrey.consumer.hin.earnings.v1',
      items: compensation.map((row) => ({
        instructionId: row.instructionId,
        amountMinor: row.amountMinor.toString(),
        asset: row.asset,
        mintRequested: row.mintRequested,
        status: row.status,
      })),
      ledgerJournalIds: this.compensationJournalIds,
      nativeSupplyUnchanged: true,
    };
  }

  rightsRequests(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    return { schema: 'sunrey.consumer.vault.rights.v1', items: bound.rights };
  }

  createRightsRequest(principal: BffPrincipal, kind: RightsRequestKind, recordId?: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    if (!RIGHTS_REQUEST_KINDS.includes(kind)) {
      return fail('VALIDATION', 'unknown rights request kind');
    }
    let state: RightsRequest['state'] = 'COMPLETED';
    const audit = [`submitted:${kind}`];
    if (kind === 'ACCESS') {
      bound.vault.listAssets(bound.actor, bound.subjectId, 'rights.access');
      audit.push('access_fulfilled');
    } else if (kind === 'EXPORT') {
      const exported = bound.vault.exportOwn(bound.actor, bound.subjectId, 'rights.export');
      if (exported.ok) {
        bound.lastExportId = exported.value.manifest.exportId;
        audit.push('export_fulfilled');
      } else {
        state = 'DENIED';
        audit.push(exported.error.code);
      }
    } else if (kind === 'CORRECTION' && recordId) {
      const corrected = this.correctRecord(principal, recordId, { value: 'GBP' });
      state = corrected.ok ? 'COMPLETED' : 'DENIED';
      audit.push(corrected.ok ? 'correction_applied' : corrected.code);
    } else if (kind === 'DELETION' && recordId) {
      if (bound.retentionHold) {
        state = 'HELD';
        audit.push('legal_operational_hold');
      } else {
        const deleted = bound.vault.requestDeletion(bound.actor, bound.subjectId, recordId as DataAssetId, 'rights.delete');
        state = deleted.ok ? 'COMPLETED' : 'DENIED';
        audit.push(deleted.ok ? 'technical_deletion' : deleted.error.code);
      }
    } else if (kind === 'RESTRICTION') {
      const consents = unwrap(bound.consent.listActiveConsents(bound.actor, bound.subjectId));
      for (const row of consents) {
        bound.consent.revokeConsent(bound.actor, row.consentId, 'restriction', `restrict:${row.consentId}`);
      }
      audit.push('restriction_revoked_active_grants');
    } else if (kind === 'CONSENT_WITHDRAWAL') {
      const stopped = this.confirmHinStop(principal);
      audit.push(stopped.ok ? 'consent_withdrawn' : 'withdrawal_failed');
    }
    const request: RightsRequest = {
      requestId: `drr_${bound.rights.length + 1}`,
      kind,
      state,
      subjectId: bound.subjectId,
      createdAt: this.clock.now(),
      completedAt: state === 'COMPLETED' || state === 'DENIED' ? this.clock.now() : null,
      audit,
    };
    bound.rights.push(request);
    return { ok: true, value: request };
  }

  exportOwn(principal: BffPrincipal): PhaseHResult<unknown> {
    return this.createRightsRequest(principal, 'EXPORT');
  }

  retention(principal: BffPrincipal) {
    const bound = this.bindPrincipal(principal);
    return {
      schema: 'sunrey.consumer.vault.retention.v1',
      hold: bound.retentionHold,
      technicalDeletionGuarantee:
        'Technical deletion removes ciphertext and the asset-specific wrapped DEK, tombstones metadata, and retains access-audit identifiers. This is not a legal erasure guarantee across backups.',
      backupsNotClaimedErased: true,
    };
  }

  setRetentionHold(principal: BffPrincipal, hold: boolean) {
    const bound = this.bindPrincipal(principal);
    bound.retentionHold = hold;
    return this.retention(principal);
  }

  expireEligible(principal: BffPrincipal, recordId: string): PhaseHResult<unknown> {
    const bound = this.bindPrincipal(principal);
    if (bound.retentionHold) {
      return fail('HOLD_ACTIVE', 'legal or operational hold blocks expiry deletion');
    }
    const deleted = bound.vault.requestDeletion(bound.actor, bound.subjectId, recordId as DataAssetId, 'retention.expire');
    if (!deleted.ok) {
      return fail(deleted.error.code, deleted.error.message);
    }
    return {
      ok: true,
      value: {
        tombstone: true,
        readable: bound.vault.payloadReadable(recordId as DataAssetId),
        backupsNotClaimedErased: true,
      },
    };
  }

  sunreyEconomy() {
    const native = lovableNativeEconomyContract({ authority: this.nativeAuthority });
    const aggregate = this.aggregateHin();
    return {
      schema: 'sunrey.consumer.economy.sunrey.v1',
      ...native.sunrey,
      hinParticipationMetrics: aggregate,
      economicInput: {
        available: aggregate.verifiedContributions > 0,
        isNotMarketPrice: true,
        isNotAutomaticMint: true,
        status: 'SANDBOX' as const,
      },
      methodologySummary: 'ENGINEERING_SIMULATION_MEASUREMENT_SCALE',
      sourceStatus: 'SANDBOX' as const,
      freshness: NOW,
      marketPrice: native.sunrey.marketPrice,
      hinValueSeparatedFromMarketPrice: true,
      hinCannotModifySupply: true,
      sandboxDataIsNotReal: true,
    };
  }

  moonreyEconomy() {
    const native = lovableNativeEconomyContract({ authority: this.nativeAuthority });
    const productive = this.productiveOverview();
    return {
      schema: 'sunrey.consumer.economy.moonrey.v1',
      ...native.moonrey,
      productiveMetrics: productive,
      economicInput: {
        available: productive.acceptedCount > 0,
        isNotMarketPrice: true,
        isNotAutomaticMint: true,
        status: 'SANDBOX' as const,
      },
      marketPrice: native.moonrey.marketPrice,
      productiveValueSeparatedFromMarketPrice: true,
      productiveDataCannotMint: true,
      sandboxDataIsNotReal: true,
    };
  }

  aggregateHin() {
    let verified = 0;
    for (const bound of this.bound.values()) {
      verified += this.contributions.listBySubject(subjectRefFor(bound.customerId)).length;
    }
    return {
      schema: 'sunrey.consumer.economy.hin-aggregate.v1',
      participatingSubjects: [...this.bound.values()].filter((row) => row.hinParticipation).length,
      verifiedContributions: verified,
      usageEvents: this.usageCount,
      individualRecordsExposed: false,
      sourceStatus: 'SANDBOX' as const,
      sandboxDataIsNotReal: true,
    };
  }

  productiveOverview() {
    return {
      schema: 'sunrey.consumer.economy.productive.v1',
      categories: [
        { id: 'ENERGY', accepted: this.productive.energy.filter((row) => row.accepted).length, unit: 'kWh', status: 'SANDBOX' },
        { id: 'COMPUTE', accepted: this.productive.compute.filter((row) => row.accepted).length, unit: 'gpu_s', status: 'SANDBOX' },
        { id: 'MANUFACTURING', accepted: this.productive.manufacturing.filter((row) => row.accepted).length, unit: 'units_produced', status: 'SANDBOX' },
      ],
      acceptedCount:
        this.productive.energy.filter((row) => row.accepted).length +
        this.productive.compute.filter((row) => row.accepted).length +
        this.productive.manufacturing.filter((row) => row.accepted).length,
      rejected: this.productive.rejected,
      automaticMainnetIssuance: false,
      sourceStatus: 'SANDBOX' as const,
      sandboxDataIsNotReal: true,
    };
  }

  observeProductive(kind: 'energy' | 'compute' | 'manufacturing' | 'stale'): PhaseHResult<unknown> {
    if (kind === 'energy') {
      const ingested = ingestEnergyObservation(validGeneratorIntervalFeed({ sourceObservationId: `obs_energy_${this.productive.energy.length + 1}` }), ENERGY_NOW_UNIX, this.energyStore);
      const accepted = ingested.ok === true;
      this.productive.energy.push({ status: 'SANDBOX', category: 'ENERGY', accepted, mints: false });
      if (!accepted) {
        this.productive.rejected.push({ code: ingested.ok === false ? ingested.error.code : 'REJECTED', reason: 'energy observation rejected' });
        return fail(ingested.ok === false ? ingested.error.code : 'REJECTED', 'energy observation rejected');
      }
      return { ok: true, value: { category: 'ENERGY', accepted: true, mintsMoonRey: false, provenance: true, status: 'SANDBOX' } };
    }
    if (kind === 'compute') {
      const ingested = ingestComputeObservation(gpuExecutionFixture(8n, 10n), ENERGY_NOW_UNIX);
      const accepted = ingested.ok === true;
      this.productive.compute.push({ status: 'SANDBOX', category: 'COMPUTE', accepted, mints: false });
      if (!accepted) {
        this.productive.rejected.push({ code: ingested.ok === false ? ingested.error.code : 'REJECTED', reason: 'compute observation rejected' });
        return fail(ingested.ok === false ? ingested.error.code : 'REJECTED', 'compute observation rejected');
      }
      return { ok: true, value: { category: 'COMPUTE', accepted: true, mintsMoonRey: false, provenance: true, status: 'SANDBOX' } };
    }
    if (kind === 'manufacturing') {
      const ingested = this.manufacturing.ingest(validMesUnitOutput());
      const accepted = ingested.ok === true;
      this.productive.manufacturing.push({ status: 'SANDBOX', category: 'MANUFACTURING', accepted, mints: false });
      if (!accepted) {
        this.productive.rejected.push({ code: ingested.ok === false ? ingested.error.code : 'REJECTED', reason: 'manufacturing observation rejected' });
        return fail(ingested.ok === false ? ingested.error.code : 'REJECTED', 'manufacturing observation rejected');
      }
      return { ok: true, value: { category: 'MANUFACTURING', accepted: true, mintsMoonRey: ingested.value.mintsMoonRey, provenance: true, status: 'SANDBOX' } };
    }
    const stale = ingestEnergyObservation(staleReadingFixture(), ENERGY_NOW_UNIX, this.energyStore);
    this.productive.rejected.push({ code: stale.ok === false ? stale.error.code : 'STALE', reason: 'stale observation rejected' });
    return fail(stale.ok === false ? stale.error.code : 'STALE', 'stale or invalid observation rejected');
  }

  issuanceBasisProposal(kind: 'HIN' | 'MOONREY') {
    return {
      schema: 'sunrey.consumer.issuance-basis-proposal.v1',
      kind,
      status: 'DRAFT_STOP_BEFORE_ISSUANCE',
      mintRequested: false,
      mainnetIssuance: false,
      testnetGovernanceFixtureOnly: true,
      hinCannotModifySupply: true,
      productiveDataCannotMint: true,
      supplyAuthority: 'Phase G Chain / governance',
    };
  }

  leakScan(): { readonly leaked: boolean; readonly scanned: readonly string[]; readonly matches: readonly string[] } {
    const haystacks = [
      JSON.stringify(this.events.list()),
      JSON.stringify([...this.bound.values()].map((row) => this.vaultHome(row.principal))),
      JSON.stringify(this.aggregateHin()),
      JSON.stringify(this.sunreyEconomy()),
      JSON.stringify(this.moonreyEconomy()),
    ];
    const needles = ['password', 'private_key', 'begin rsa', 'cvv', 'pan:', 'sk_live', 'provider_secret'];
    const matches: string[] = [];
    for (const hay of haystacks) {
      const lower = hay.toLowerCase();
      for (const needle of needles) {
        if (lower.includes(needle)) {
          matches.push(needle);
        }
      }
    }
    return { leaked: matches.length > 0, scanned: needles, matches };
  }

  gates() {
    return {
      productionData: evaluateProductionDataGates(),
      marketplace: evaluateInformationRightsMarketplaceGate(),
      flags: {
        LIVE_INFORMATION_RIGHTS_MARKETPLACE,
        LIVE_DATA_MONETIZATION_ENABLED,
        LIVE_HIN_BASED_ISSUANCE_ENABLED,
        LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
        LIVE_DATA_MARKET_ENABLED,
      },
    };
  }

  dataStatuses() {
    return { items: DATA_SOURCE_STATUSES, sandboxDataIsNotReal: true };
  }
}
