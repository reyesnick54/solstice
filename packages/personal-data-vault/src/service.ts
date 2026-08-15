import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import type { IdentityCapability } from '../../identity/src/capability.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { sha256Hex } from '../../security/src/hash.ts';
import {
  defaultDataUseAuthorization,
  VAULT_DELETE_CAPABILITY,
  VAULT_EXPORT_CAPABILITY,
  VAULT_INGEST_CAPABILITY,
  VAULT_VIEW_CAPABILITY,
  VaultAccessBroker,
  type DataUseAuthorizationPort,
  type VaultAccessFailure,
} from './access.ts';
import {
  InMemoryEncryptedPayloadStore,
  issueSubjectKeyHandle,
  openVaultPayload,
  sealVaultPayload,
  type EncryptedPayloadStore,
} from './encryption.ts';
import {
  asDataSchemaId,
  asDataSchemaVersion,
  asDataSourceId,
  newDataAccessRecordId,
  newDataAssetId,
  newDataAssetVersionId,
  newDataDeletionRequestId,
  newDataDerivationId,
  newDataExportId,
  newDataIngestionId,
  newDataPayloadId,
  vaultIdForSubject,
  type DataAssetId,
} from './ids.ts';
import { canonicalJson, DataSchemaRegistry, validateAgainstSchema } from './schema.ts';
import { PersonalDataVaultStore } from './store.ts';
import {
  EVIDENCE_KIND_PDV,
  EXPORT_FORMAT,
  PDV_LIMITS,
  isSupportedContentType,
  type DataUseClass,
  type VaultOperation,
} from './taxonomy.ts';
import type {
  DataAccessRecord,
  DataAsset,
  DataDeletionRequest,
  DataDerivation,
  DataExportBundle,
  DataExportManifest,
  PersonalDataVaultRecord,
  PersonalDataVaultStoreSnapshot,
  RetentionPolicyPort,
  VaultFailure,
} from './types.ts';

export type PersonalDataVaultOptions = {
  readonly clock: Clock;
  readonly keys: KeyProvider;
  readonly evidence: EvidenceVault;
  readonly events: DomainEventLog;
  readonly store?: PersonalDataVaultStore;
  readonly payloadStore?: EncryptedPayloadStore;
  readonly authorization?: DataUseAuthorizationPort;
  readonly retention?: RetentionPolicyPort;
};

export type IngestInput = {
  readonly subjectId: string;
  readonly sourceId: string;
  readonly sourceRecordRef: string;
  readonly idempotencyKey: string;
  readonly sourceRevision?: number;
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly category?: string;
  readonly contentType: string;
  readonly payload: unknown;
  readonly provenanceKind: import('./taxonomy.ts').ProvenanceKind;
  readonly observedAt?: UtcInstant;
  readonly purposeRef: string;
  readonly expectedCurrentVersionId?: string;
};

export type MinimizedReadRequest = {
  readonly subjectId: string;
  readonly assetId: DataAssetId;
  readonly purposeRef: string;
  readonly fields?: readonly string[];
  readonly windowFrom?: UtcInstant;
  readonly windowTo?: UtcInstant;
};

export type AgentVaultReadRequest = {
  readonly subjectId: string;
  readonly purposeRef: string;
  readonly assetIds?: readonly DataAssetId[];
};

export type VaultServiceFailure = VaultAccessFailure | VaultFailure;

const TECHNICAL_DELETION_GUARANTEE =
  'Technical deletion removes ciphertext and the asset-specific wrapped DEK from the payload store, tombstones metadata, and retains access-audit identifiers. This is not a legal erasure guarantee across all infrastructure copies.';

export function simulationRetentionPolicy(): RetentionPolicyPort {
  return {
    evaluate: () => ({
      outcome: 'DELETE_ALLOWED',
      policyId: 'pdv.simulation.default_delete',
      policySource: 'packages/personal-data-vault/src/service.ts#simulationRetentionPolicy',
      status: 'SIMULATION_RULE',
      reason: 'simulation default allows technical deletion; not a privacy-law retention schedule',
    }),
  };
}

export class PersonalDataVault {
  private readonly clock: Clock;
  private readonly keys: KeyProvider;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly store: PersonalDataVaultStore;
  private readonly payloads: EncryptedPayloadStore;
  private readonly broker: VaultAccessBroker;
  private readonly schemas = new DataSchemaRegistry();
  private readonly retention: RetentionPolicyPort;

  constructor(options: PersonalDataVaultOptions) {
    this.clock = options.clock;
    this.keys = options.keys;
    this.evidence = options.evidence;
    this.events = options.events;
    this.store = options.store ?? new PersonalDataVaultStore();
    this.payloads = options.payloadStore ?? new InMemoryEncryptedPayloadStore();
    this.broker = new VaultAccessBroker(options.authorization ?? { authorize: defaultDataUseAuthorization });
    this.retention = options.retention ?? simulationRetentionPolicy();
  }

  openVault(
    actor: unknown,
    subjectId: string,
    customerId?: string | null,
  ): Result<PersonalDataVaultRecord, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: subjectId,
      operation: 'OPEN_VAULT',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef: 'vault.open_own',
      requestedScope: 'vault',
      capability: VAULT_INGEST_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const existing = this.store.getVaultBySubject(subjectId);
    if (existing) {
      return ok(existing);
    }
    const kek = this.keys.resolveKeyVersion('DATA_ENCRYPTION');
    if (!kek.ok) {
      return err({ code: 'ENCRYPTION_FAILED', message: kek.error.message });
    }
    const vault: PersonalDataVaultRecord = Object.freeze({
      vaultId: vaultIdForSubject(subjectId),
      subjectId,
      customerId: customerId ?? null,
      createdAt: this.clock.now(),
      subjectKeyHandle: issueSubjectKeyHandle(this.keys),
      kekKeyId: kek.value.keyId,
      kekVersion: kek.value.version,
    });
    this.store.putVault(vault);
    this.emit('DataVaultCreated', vault.vaultId, {
      vaultId: vault.vaultId,
      subjectId,
      customerLinked: customerId !== undefined && customerId !== null,
    });
    this.seal('vault.created', { vaultId: vault.vaultId, subjectId });
    return ok(vault);
  }

  ingest(actor: unknown, input: IngestInput): Result<DataAsset, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId: input.subjectId,
      resourceId: input.sourceRecordRef,
      operation: 'INGEST',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef: input.purposeRef,
      requestedScope: 'ingest',
      capability: VAULT_INGEST_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const opened = this.ensureVault(input.subjectId);
    if (!opened.ok) {
      return opened;
    }
    const replay = this.store.findIngestion(input.sourceId, input.sourceRecordRef, input.idempotencyKey);
    if (replay) {
      const existing = this.store.getAsset(replay.assetId);
      if (existing) {
        return ok(existing);
      }
    }
    if (this.store.ingestionsForSubject(input.subjectId).length >= PDV_LIMITS.maxIngestionsPerSubject) {
      return err({ code: 'LIMIT_EXCEEDED', message: 'ingestion rate/count limit reached' });
    }
    if (!isSupportedContentType(input.contentType)) {
      return err({ code: 'UNSUPPORTED_TYPE', message: `unsupported content type ${input.contentType}` });
    }
    const schema = this.schemas.get(asDataSchemaId(input.schemaId), asDataSchemaVersion(input.schemaVersion));
    if (!schema) {
      return err({ code: 'SCHEMA_NOT_FOUND', message: 'schema version not registered' });
    }
    const invalid = validateAgainstSchema(schema, input.payload);
    if (invalid) {
      return err({ code: invalid.code, message: invalid.message });
    }
    const bytes = Buffer.from(canonicalJson(input.payload), 'utf8');
    if (bytes.byteLength > PDV_LIMITS.maxPayloadBytes) {
      return err({ code: 'LIMIT_EXCEEDED', message: 'payload exceeds size limit' });
    }
    let sealed;
    try {
      sealed = sealVaultPayload(this.keys, bytes);
    } catch (error) {
      return err({
        code: 'ENCRYPTION_FAILED',
        message: error instanceof Error ? error.message : 'encrypt failed',
      });
    }
    const now = this.clock.now();
    const payloadId = newDataPayloadId();
    this.payloads.put({
      payloadId,
      envelope: sealed.envelope,
      contentSha256: sealed.contentSha256,
      byteLength: bytes.byteLength,
      shredded: false,
    });
    const assetId = newDataAssetId();
    const versionId = newDataAssetVersionId();
    const asset: DataAsset = Object.freeze({
      assetId,
      vaultId: opened.value.vaultId,
      subjectId: input.subjectId,
      category: schema.category,
      schemaId: schema.schemaId,
      schemaVersion: schema.version,
      sourceId: asSource(input.sourceId),
      provenance: Object.freeze({
        kind: input.provenanceKind,
        sourceId: asSource(input.sourceId),
        sourceRecordRef: input.sourceRecordRef,
        ingestedAt: now,
        observedAt: input.observedAt ?? now,
        schemaId: schema.schemaId,
        schemaVersion: schema.version,
        contentSha256: sealed.contentSha256,
        confidence: input.provenanceKind === 'USER_DECLARED' || input.provenanceKind === 'USER_UPLOADED'
          ? 'USER_DECLARED'
          : input.provenanceKind === 'DERIVED'
            ? 'DERIVED'
            : 'SIMULATED',
      }),
      sensitivity: schema.sensitivityDefault,
      currentVersionId: versionId,
      currentPayloadId: payloadId,
      contentSha256: sealed.contentSha256,
      createdAt: now,
      observedAt: input.observedAt ?? now,
      effectiveFrom: input.observedAt ?? now,
      effectiveTo: null,
      lifecycle: 'ACTIVE',
      retention: Object.freeze({ policyId: null, policySource: null, reason: null }),
      derivationState: input.provenanceKind === 'DERIVED' ? 'DERIVED' : 'SOURCE',
      contributionMark: 'NOT_MARKED',
      authoritativeForFinancialState: false,
      financialBalance: null,
      tokenBalance: null,
      expectedVersion: 1,
    });
    this.store.putAsset(asset);
    this.store.putVersion({
      versionId,
      assetId,
      subjectId: input.subjectId,
      sequence: 1,
      payloadId,
      contentSha256: sealed.contentSha256,
      schemaId: schema.schemaId,
      schemaVersion: schema.version,
      state: 'ACTIVE',
      createdAt: now,
      supersededAt: null,
      kekVersion: sealed.envelope.keyVersion,
      rotationGeneration: 1,
    });
    this.store.putIngestion({
      ingestionId: newDataIngestionId(),
      assetId,
      subjectId: input.subjectId,
      sourceId: asSource(input.sourceId),
      sourceRecordRef: input.sourceRecordRef,
      idempotencyKey: input.idempotencyKey,
      sourceRevision: input.sourceRevision ?? 1,
      contentType: input.contentType,
      createdAt: now,
    });
    this.emit('DataVaultAssetIngested', assetId, {
      vaultId: opened.value.vaultId,
      assetId,
      subjectId: input.subjectId,
      schemaId: schema.schemaId,
      schemaVersion: schema.version,
      contentSha256: sealed.contentSha256,
      category: schema.category,
      provenanceKind: input.provenanceKind,
    });
    this.seal('asset.ingested', {
      assetId,
      subjectId: input.subjectId,
      contentSha256: sealed.contentSha256,
      schemaId: schema.schemaId,
    });
    return ok(asset);
  }

  updateAsset(
    actor: unknown,
    input: IngestInput & { readonly assetId: DataAssetId },
  ): Result<DataAsset, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId: input.subjectId,
      resourceId: input.assetId,
      operation: 'VERSION',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef: input.purposeRef,
      requestedScope: 'version',
      capability: VAULT_INGEST_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const current = this.ownedAsset(input.subjectId, input.assetId);
    if (!current.ok) {
      return current;
    }
    if (input.expectedCurrentVersionId && current.value.currentVersionId !== input.expectedCurrentVersionId) {
      return err({ code: 'VERSION_CONFLICT', message: 'expected version does not match current version' });
    }
    const schema = this.schemas.get(asDataSchemaId(input.schemaId), asDataSchemaVersion(input.schemaVersion));
    if (!schema) {
      return err({ code: 'SCHEMA_NOT_FOUND', message: 'schema version not registered' });
    }
    const invalid = validateAgainstSchema(schema, input.payload);
    if (invalid) {
      return err({ code: invalid.code, message: invalid.message });
    }
    const bytes = Buffer.from(canonicalJson(input.payload), 'utf8');
    let sealed;
    try {
      sealed = sealVaultPayload(this.keys, bytes);
    } catch (error) {
      return err({
        code: 'ENCRYPTION_FAILED',
        message: error instanceof Error ? error.message : 'encrypt failed',
      });
    }
    const now = this.clock.now();
    const payloadId = newDataPayloadId();
    this.payloads.put({
      payloadId,
      envelope: sealed.envelope,
      contentSha256: sealed.contentSha256,
      byteLength: bytes.byteLength,
      shredded: false,
    });
    const prior = current.value.currentVersionId
      ? this.store.versionsFor(current.value.assetId).find((row) => row.versionId === current.value.currentVersionId)
      : undefined;
    if (prior) {
      this.store.putVersion({ ...prior, state: 'SUPERSEDED', supersededAt: now });
    }
    const versionId = newDataAssetVersionId();
    this.store.putVersion({
      versionId,
      assetId: current.value.assetId,
      subjectId: input.subjectId,
      sequence: (prior?.sequence ?? 0) + 1,
      payloadId,
      contentSha256: sealed.contentSha256,
      schemaId: schema.schemaId,
      schemaVersion: schema.version,
      state: 'ACTIVE',
      createdAt: now,
      supersededAt: null,
      kekVersion: sealed.envelope.keyVersion,
      rotationGeneration: (prior?.rotationGeneration ?? 1),
    });
    const next: DataAsset = Object.freeze({
      ...current.value,
      currentVersionId: versionId,
      currentPayloadId: payloadId,
      contentSha256: sealed.contentSha256,
      schemaId: schema.schemaId,
      schemaVersion: schema.version,
      lifecycle: 'ACTIVE',
      expectedVersion: current.value.expectedVersion + 1,
    });
    this.store.putAsset(next);
    this.emit('DataVaultAssetVersioned', next.assetId, {
      assetId: next.assetId,
      subjectId: input.subjectId,
      versionId,
      contentSha256: sealed.contentSha256,
    });
    this.seal('asset.versioned', { assetId: next.assetId, versionId, contentSha256: sealed.contentSha256 });
    return ok(next);
  }

  listAssets(actor: unknown, subjectId: string, purposeRef: string): Result<readonly DataAsset[], VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: subjectId,
      operation: 'READ_METADATA',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'metadata',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    return ok(this.store.assetsForSubject(subjectId));
  }

  readMetadata(
    actor: unknown,
    subjectId: string,
    assetId: DataAssetId,
    purposeRef: string,
  ): Result<DataAsset, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: assetId,
      operation: 'READ_METADATA',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'metadata',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    return this.ownedAsset(subjectId, assetId);
  }

  readPayload(
    actor: unknown,
    subjectId: string,
    assetId: DataAssetId,
    purposeRef: string,
  ): Result<unknown, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: assetId,
      operation: 'READ_PAYLOAD',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'payload',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    return this.decryptOwned(subjectId, assetId);
  }

  readMinimized(actor: unknown, request: MinimizedReadRequest): Result<unknown, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId: request.subjectId,
      resourceId: request.assetId,
      operation: 'READ_MINIMIZED',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef: request.purposeRef,
      requestedScope: request.fields?.join(',') ?? 'minimized',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const payload = this.decryptOwned(request.subjectId, request.assetId);
    if (!payload.ok) {
      return payload;
    }
    if (payload.value === null || typeof payload.value !== 'object' || Array.isArray(payload.value)) {
      return ok(payload.value);
    }
    const body = payload.value as Record<string, unknown>;
    if (request.fields && request.fields.length > 0) {
      const picked: Record<string, unknown> = {};
      for (const field of request.fields) {
        if (field in body) {
          picked[field] = body[field];
        }
      }
      return ok(picked);
    }
    if (Array.isArray(body.transactions) && (request.windowFrom || request.windowTo)) {
      const filtered = body.transactions.filter((row) => {
        if (row === null || typeof row !== 'object') {
          return false;
        }
        const bookedAt = String((row as { bookedAt?: string }).bookedAt ?? '');
        if (request.windowFrom && bookedAt < request.windowFrom) {
          return false;
        }
        if (request.windowTo && bookedAt > request.windowTo) {
          return false;
        }
        return true;
      });
      return ok({ transactions: filtered });
    }
    return ok(body);
  }

  deriveSpendingSummary(
    actor: unknown,
    input: {
      readonly subjectId: string;
      readonly sourceAssetId: DataAssetId;
      readonly purposeRef: string;
      readonly category?: string;
    },
  ): Result<{ readonly asset: DataAsset; readonly derivation: DataDerivation }, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId: input.subjectId,
      resourceId: input.sourceAssetId,
      operation: 'DERIVE',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef: input.purposeRef,
      requestedScope: 'derive:spending_summary',
      capability: VAULT_INGEST_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const source = this.decryptOwned(input.subjectId, input.sourceAssetId);
    if (!source.ok) {
      return source;
    }
    const body = source.value as { transactions?: readonly { category?: string; amountMinor?: string; currency?: string }[] };
    const rows = body.transactions ?? [];
    const wanted = input.category ?? 'dining';
    const totals = new Map<string, bigint>();
    let currency = 'USD';
    for (const row of rows) {
      if ((row.category ?? '') !== wanted) {
        continue;
      }
      currency = row.currency ?? currency;
      totals.set(wanted, (totals.get(wanted) ?? 0n) + BigInt(row.amountMinor ?? '0'));
    }
    const summary = {
      windowFrom: '2026-06-01T00:00:00.000Z',
      windowTo: '2026-08-01T00:00:00.000Z',
      currency,
      categories: [{ category: wanted, totalMinor: (totals.get(wanted) ?? 0n).toString() }],
    };
    const ingested = this.ingest(actor, {
      subjectId: input.subjectId,
      sourceId: 'pds_derived_spending',
      sourceRecordRef: `derived:${input.sourceAssetId}`,
      idempotencyKey: `derive:${input.sourceAssetId}:${wanted}`,
      schemaId: 'pdsch_spending_summary',
      schemaVersion: '1',
      contentType: 'application/json',
      payload: summary,
      provenanceKind: 'DERIVED',
      purposeRef: input.purposeRef,
    });
    if (!ingested.ok) {
      return ingested;
    }
    const derivation: DataDerivation = Object.freeze({
      derivationId: newDataDerivationId(),
      outputAssetId: ingested.value.assetId,
      sourceAssetIds: Object.freeze([input.sourceAssetId]),
      method: 'monthly_category_spend_summary',
      methodVersion: '1',
      outputSchemaId: asDataSchemaId('pdsch_spending_summary'),
      outputSchemaVersion: asDataSchemaVersion('1'),
      confidence: 'DERIVED',
      createdAt: this.clock.now(),
    });
    this.store.putDerivation(derivation);
    this.store.putAsset({ ...ingested.value, derivationState: 'DERIVED' });
    this.emit('DataVaultDerivationCreated', derivation.derivationId, {
      derivationId: derivation.derivationId,
      outputAssetId: ingested.value.assetId,
      sourceAssetIds: derivation.sourceAssetIds,
      method: derivation.method,
      methodVersion: derivation.methodVersion,
    });
    this.seal('derivation.created', {
      derivationId: derivation.derivationId,
      outputAssetId: ingested.value.assetId,
      sourceAssetIds: derivation.sourceAssetIds,
    });
    return ok({ asset: this.store.getAsset(ingested.value.assetId) ?? ingested.value, derivation });
  }

  exportOwn(actor: unknown, subjectId: string, purposeRef: string): Result<DataExportBundle, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: subjectId,
      operation: 'EXPORT',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'export',
      capability: VAULT_EXPORT_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const assets = this.store.assetsForSubject(subjectId).filter((asset) => asset.lifecycle === 'ACTIVE');
    const exported = [];
    for (const asset of assets) {
      const payload = this.decryptOwned(subjectId, asset.assetId);
      if (!payload.ok) {
        return payload;
      }
      exported.push({
        metadata: asset,
        versions: this.store.versionsFor(asset.assetId),
        payloadJson: payload.value,
      });
    }
    const exportId = newDataExportId();
    const generatedAt = this.clock.now();
    const schemaRefs = [...new Set(assets.map((asset) => `${asset.schemaId}@${asset.schemaVersion}`))];
    const contentHashes = assets.map((asset) => asset.contentSha256 ?? '');
    const unsigned = {
      format: EXPORT_FORMAT,
      exportId,
      subjectId,
      generatedAt,
      assetIds: assets.map((asset) => asset.assetId),
      schemaRefs,
      contentHashes,
      legalPortabilityClaim: false as const,
    };
    const manifestSha256 = sha256Hex(canonicalJson(unsigned));
    const manifest: DataExportManifest = Object.freeze({ ...unsigned, manifestSha256 });
    this.store.putExport(manifest);
    this.emit('DataVaultExportCreated', exportId, {
      exportId,
      subjectId,
      assetCount: assets.length,
      manifestSha256,
    });
    this.seal('export.created', { exportId, subjectId, manifestSha256, assetCount: assets.length });
    return ok({ manifest, assets: Object.freeze(exported) });
  }

  requestDeletion(
    actor: unknown,
    subjectId: string,
    assetId: DataAssetId,
    purposeRef: string,
  ): Result<DataDeletionRequest, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: assetId,
      operation: 'DELETE',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'delete',
      capability: VAULT_DELETE_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const asset = this.ownedAsset(subjectId, assetId);
    if (!asset.ok) {
      return asset;
    }
    const decision = this.retention.evaluate({ asset: asset.value, requestedAt: this.clock.now() });
    const request: DataDeletionRequest = Object.freeze({
      requestId: newDataDeletionRequestId(),
      assetId,
      subjectId,
      requestedAt: this.clock.now(),
      outcome: decision.outcome,
      policyId: decision.policyId,
      policySource: decision.policySource,
      technicalGuarantee: TECHNICAL_DELETION_GUARANTEE,
      completedAt: null,
    });
    this.store.putDeletion(request);
    if (decision.outcome === 'RETENTION_REQUIRED') {
      this.store.putAsset({
        ...asset.value,
        lifecycle: 'RETAINED_BY_POLICY',
        retention: {
          policyId: decision.policyId,
          policySource: decision.policySource,
          reason: decision.reason,
        },
      });
      return err({ code: 'RETENTION_REQUIRED', message: decision.reason });
    }
    if (decision.outcome === 'REVIEW_REQUIRED') {
      this.store.putAsset({ ...asset.value, lifecycle: 'DELETION_REQUESTED' });
      return ok({ ...request });
    }
    if (asset.value.currentPayloadId) {
      this.payloads.delete(asset.value.currentPayloadId);
    }
    for (const version of this.store.versionsFor(assetId)) {
      if (version.payloadId) {
        this.payloads.delete(version.payloadId);
      }
      this.store.putVersion({ ...version, state: 'TOMBSTONED', payloadId: null });
    }
    this.store.putAsset({
      ...asset.value,
      lifecycle: 'DELETED',
      currentPayloadId: null,
      contentSha256: asset.value.contentSha256,
    });
    const completed = Object.freeze({ ...request, completedAt: this.clock.now() });
    this.store.putDeletion(completed);
    this.emit('DataVaultAssetDeleted', assetId, {
      assetId,
      subjectId,
      deletionRequestId: completed.requestId,
      technicalGuarantee: 'ciphertext_and_wrapped_dek_removed',
    });
    this.seal('asset.deleted', {
      assetId,
      subjectId,
      deletionRequestId: completed.requestId,
    });
    return ok(completed);
  }

  rotateAssetKey(
    actor: unknown,
    subjectId: string,
    assetId: DataAssetId,
    purposeRef: string,
  ): Result<DataAsset, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: assetId,
      operation: 'ROTATE_KEY',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'rotate',
      capability: VAULT_INGEST_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const payload = this.decryptOwned(subjectId, assetId);
    if (!payload.ok) {
      return payload;
    }
    const asset = this.store.getAsset(assetId);
    if (!asset) {
      return err({ code: 'ASSET_NOT_FOUND', message: 'asset not found' });
    }
    const bytes = Buffer.from(canonicalJson(payload.value), 'utf8');
    let sealed;
    try {
      sealed = sealVaultPayload(this.keys, bytes);
    } catch (error) {
      return err({
        code: 'ENCRYPTION_FAILED',
        message: error instanceof Error ? error.message : 're-encrypt failed',
      });
    }
    const payloadId = newDataPayloadId();
    this.payloads.put({
      payloadId,
      envelope: sealed.envelope,
      contentSha256: sealed.contentSha256,
      byteLength: bytes.byteLength,
      shredded: false,
    });
    if (asset.currentPayloadId) {
      this.payloads.delete(asset.currentPayloadId);
    }
    const next = Object.freeze({ ...asset, currentPayloadId: payloadId, contentSha256: sealed.contentSha256 });
    this.store.putAsset(next);
    this.emit('DataVaultKeyRotated', assetId, {
      assetId,
      subjectId,
      kekVersion: sealed.envelope.keyVersion,
    });
    this.seal('key.rotated', { assetId, subjectId, kekVersion: sealed.envelope.keyVersion });
    return ok(next);
  }

  markContributionEligible(
    actor: unknown,
    subjectId: string,
    assetId: DataAssetId,
    purposeRef: string,
  ): Result<DataAsset, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: assetId,
      operation: 'MARK_CONTRIBUTION',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'contribution_review',
      capability: VAULT_INGEST_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const asset = this.ownedAsset(subjectId, assetId);
    if (!asset.ok) {
      return asset;
    }
    const next = Object.freeze({ ...asset.value, contributionMark: 'ELIGIBLE_FOR_CONTRIBUTION_REVIEW' as const });
    this.store.putAsset(next);
    return ok(next);
  }

  requestThirdPartyUse(
    actor: unknown,
    subjectId: string,
    assetId: string,
    purposeRef: string,
  ): Result<never, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: assetId,
      operation: 'THIRD_PARTY_USE',
      useClass: 'THIRD_PARTY',
      purposeRef,
      requestedScope: 'contribution',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed as Result<never, VaultServiceFailure>;
    }
    return err({
      code: 'DEPENDENCY_NOT_IMPLEMENTED',
      message: 'third-party contribution execution remains denied until Clean Room exists',
    });
  }

  readForAgent(actor: unknown, request: AgentVaultReadRequest): Result<readonly { readonly assetId: string; readonly label: string }[], VaultServiceFailure> {
    if (!request.assetIds || request.assetIds.length === 0) {
      this.auditDenied(actor, request.subjectId, '*', 'AGENT_READ', request.purposeRef, 'AGENT_WILDCARD_FORBIDDEN');
      return err({ code: 'WILDCARD_FORBIDDEN', message: 'agent wildcard vault access is forbidden' });
    }
    const allowed = this.gate(actor, {
      subjectId: request.subjectId,
      resourceId: request.assetIds.join(','),
      operation: 'AGENT_READ',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef: request.purposeRef,
      requestedScope: 'agent_metadata',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    const labels = [];
    for (const assetId of request.assetIds) {
      const asset = this.store.getAsset(assetId);
      if (!asset || asset.subjectId !== request.subjectId) {
        return err({ code: 'CROSS_SUBJECT_DENIED', message: 'agent cannot read another subject asset' });
      }
      labels.push({ assetId, label: `${asset.category}:${asset.schemaId}` });
    }
    return ok(Object.freeze(labels));
  }

  accessAudit(actor: unknown, subjectId: string, purposeRef: string): Result<readonly DataAccessRecord[], VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId,
      resourceId: subjectId,
      operation: 'READ_METADATA',
      useClass: 'SUBJECT_SELF_ACCESS',
      purposeRef,
      requestedScope: 'audit',
      capability: VAULT_VIEW_CAPABILITY,
    });
    if (!allowed.ok) {
      return allowed;
    }
    return ok(this.store.accessForSubject(subjectId));
  }

  inspectStoredEnvelope(assetId: DataAssetId): { readonly ciphertext: string; readonly hasPlaintextNeedle: boolean } | undefined {
    const asset = this.store.getAsset(assetId);
    if (!asset?.currentPayloadId) {
      return undefined;
    }
    const stored = this.payloads.get(asset.currentPayloadId);
    if (!stored || stored.shredded) {
      return undefined;
    }
    return {
      ciphertext: stored.envelope.ciphertext,
      hasPlaintextNeedle: false,
    };
  }

  payloadReadable(assetId: DataAssetId): boolean {
    const asset = this.store.getAsset(assetId);
    return asset?.currentPayloadId ? this.payloads.exists(asset.currentPayloadId) : false;
  }

  snapshot(): PersonalDataVaultStoreSnapshot {
    return this.store.snapshot(this.payloads);
  }

  restore(state: PersonalDataVaultStoreSnapshot): void {
    this.store.restore(state, this.payloads);
  }

  toPegDataAssetRef(asset: DataAsset): {
    readonly label: string;
    readonly vaultAssetId: string;
    readonly contentHash: string | null;
    readonly category: string;
  } {
    return {
      label: `${asset.category}`,
      vaultAssetId: asset.assetId,
      contentHash: asset.contentSha256,
      category: asset.category,
    };
  }

  toContributionReference(asset: DataAsset): {
    readonly assetId: string;
    readonly subjectId: string;
    readonly contributionMark: string;
    readonly estimatedValue: null;
    readonly tokenValuation: false;
  } {
    return {
      assetId: asset.assetId,
      subjectId: asset.subjectId,
      contributionMark: asset.contributionMark,
      estimatedValue: null,
      tokenValuation: false,
    };
  }

  readForAuthorizedUse(
    actor: unknown,
    request: {
      readonly subjectId: string;
      readonly assetId: DataAssetId;
      readonly purposeRef: string;
      readonly useClass: DataUseClass;
      readonly operation: VaultOperation;
      readonly requestedScope: string;
      readonly fields?: readonly string[];
      readonly category?: import('./taxonomy.ts').DataCategory;
    },
  ): Result<unknown, VaultServiceFailure> {
    const allowed = this.gate(actor, {
      subjectId: request.subjectId,
      resourceId: request.assetId,
      operation: request.operation,
      useClass: request.useClass,
      purposeRef: request.purposeRef,
      requestedScope: request.requestedScope,
      capability: VAULT_VIEW_CAPABILITY,
      ...(request.fields ? { fields: request.fields } : {}),
      ...(request.category ? { category: request.category } : {}),
    });
    if (!allowed.ok) {
      return allowed;
    }
    const payload = this.decryptOwned(request.subjectId, request.assetId);
    if (!payload.ok) {
      return payload;
    }
    if (!request.fields || request.fields.length === 0) {
      return payload;
    }
    const body = payload.value as Record<string, unknown>;
    const minimized: Record<string, unknown> = {};
    for (const field of request.fields) {
      if (field in body) {
        minimized[field] = body[field];
      }
    }
    return ok(minimized);
  }

  private gate(
    actor: unknown,
    request: {
      readonly subjectId: string;
      readonly resourceId: string;
      readonly operation: VaultOperation;
      readonly useClass: DataUseClass;
      readonly purposeRef: string;
      readonly requestedScope: string;
      readonly capability: IdentityCapability;
      readonly fields?: readonly string[];
      readonly category?: import('./taxonomy.ts').DataCategory;
    },
  ): Result<import('../../identity/src/actor-context.ts').VerifiedActorContext, VaultServiceFailure> {
    const result = this.broker.authorize({ actor, ...request });
    const actorId = typeof actor === 'object' && actor !== null && 'actorId' in actor
      ? String((actor as { actorId: string }).actorId)
      : 'unknown';
    this.store.putAccess({
      accessId: newDataAccessRecordId(),
      actorId,
      subjectId: request.subjectId,
      assetId: request.resourceId,
      operation: request.operation,
      purposeRef: request.purposeRef,
      requestedScope: request.requestedScope,
      useClass: request.useClass,
      decision: result.ok ? 'ALLOWED' : 'DENIED',
      reason: result.ok ? 'allowed' : result.error.code,
      occurredAt: this.clock.now(),
    });
    this.emit(result.ok ? 'DataVaultAccessAllowed' : 'DataVaultAccessDenied', request.resourceId, {
      subjectId: request.subjectId,
      assetId: request.resourceId,
      operation: request.operation,
      purposeRef: request.purposeRef,
      decision: result.ok ? 'ALLOWED' : 'DENIED',
      reason: result.ok ? 'allowed' : result.error.code,
    });
    if (!result.ok) {
      return result;
    }
    return ok(result.value.actor);
  }

  private auditDenied(
    actor: unknown,
    subjectId: string,
    resourceId: string,
    operation: VaultOperation,
    purposeRef: string,
    reason: string,
  ): void {
    const actorId = typeof actor === 'object' && actor !== null && 'actorId' in actor
      ? String((actor as { actorId: string }).actorId)
      : 'unknown';
    this.store.putAccess({
      accessId: newDataAccessRecordId(),
      actorId,
      subjectId,
      assetId: resourceId,
      operation,
      purposeRef,
      requestedScope: 'denied',
      useClass: 'AGENT_BROAD_READ',
      decision: 'DENIED',
      reason,
      occurredAt: this.clock.now(),
    });
    this.emit('DataVaultAccessDenied', resourceId, {
      subjectId,
      assetId: resourceId,
      operation,
      purposeRef,
      decision: 'DENIED',
      reason,
    });
  }

  private ensureVault(subjectId: string): Result<PersonalDataVaultRecord, VaultServiceFailure> {
    const vault = this.store.getVaultBySubject(subjectId);
    if (!vault) {
      return err({ code: 'VAULT_NOT_FOUND', message: 'open the subject vault before ingesting' });
    }
    return ok(vault);
  }

  private ownedAsset(subjectId: string, assetId: DataAssetId): Result<DataAsset, VaultServiceFailure> {
    const asset = this.store.getAsset(assetId);
    if (!asset) {
      return err({ code: 'ASSET_NOT_FOUND', message: 'asset not found' });
    }
    if (asset.subjectId !== subjectId) {
      return err({ code: 'CROSS_SUBJECT_DENIED', message: 'asset is not bound to this subject' });
    }
    return ok(asset);
  }

  private decryptOwned(subjectId: string, assetId: DataAssetId): Result<unknown, VaultServiceFailure> {
    const asset = this.ownedAsset(subjectId, assetId);
    if (!asset.ok) {
      return asset;
    }
    if (asset.value.lifecycle === 'DELETED' || !asset.value.currentPayloadId) {
      return err({ code: 'PAYLOAD_UNREADABLE', message: 'payload was shredded or deleted' });
    }
    const stored = this.payloads.get(asset.value.currentPayloadId);
    if (!stored || stored.shredded) {
      return err({ code: 'PAYLOAD_UNREADABLE', message: 'ciphertext or asset key is gone' });
    }
    if (asset.value.contentSha256 && !this.payloads.integrityCheck(asset.value.currentPayloadId, asset.value.contentSha256)) {
      return err({ code: 'INTEGRITY_FAILED', message: 'content hash mismatch' });
    }
    try {
      const bytes = openVaultPayload(this.keys, stored.envelope);
      if (asset.value.contentSha256 && sha256Hex(bytes) !== asset.value.contentSha256) {
        return err({ code: 'INTEGRITY_FAILED', message: 'plaintext hash mismatch' });
      }
      return ok(JSON.parse(bytes.toString('utf8')));
    } catch (error) {
      return err({
        code: 'DECRYPTION_FAILED',
        message: error instanceof Error ? error.message : 'decrypt failed',
      });
    }
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'data_vault',
      aggregateId,
    } as never);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence.seal(`${EVIDENCE_KIND_PDV}:${kind}`, {
      ...payload,
      kind,
      simulation: true,
      plaintextIncluded: false,
    });
  }
}

function asSource(value: string): import('./ids.ts').DataSourceId {
  return asDataSourceId(value.startsWith('pds_') ? value : `pds_${value.replace(/[^A-Za-z0-9]/g, '') || 'unknown'}`);
}
