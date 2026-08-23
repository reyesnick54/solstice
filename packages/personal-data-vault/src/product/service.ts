import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import type { DataAssetId } from '../ids.ts';
import { asDataAssetId, newDataExportId } from '../ids.ts';
import { PersonalDataVault, type IngestInput, type VaultServiceFailure } from '../service.ts';
import type { DataAsset, DataExportBundle, PersonalDataVaultStoreSnapshot } from '../types.ts';
import { VaultCategoryRegistry, DEFAULT_CATEGORY_REGISTRY, type VaultPurpose } from './category-registry.ts';
import {
  correctionKindFor,
  userMayOverwrite,
  type VaultCorrectionRequest,
} from './correction.ts';
import { newVaultCorrectionId, newVaultExportJobId } from './ids.ts';
import { findForbiddenPayloadField } from './minimization.ts';
import { ownershipForSubject } from './ownership.ts';
import { VAULT_PERSONA_SEEDS, type VaultPersonaId, vaultPersonaSeed } from './personas.ts';
import {
  defaultRecordMetadata,
  projectVaultDataRecord,
  type VaultDataRecord,
  type VaultRecordMetadata,
} from './record.ts';
import { CANONICAL_PERSONAL_DATA_FABRIC } from './fabric.ts';
import type { DataKind } from './kinds.ts';
import { assertNotVerifiedInference, verificationFromKind } from './kinds.ts';

export type ProductVaultFailure = VaultServiceFailure | {
  readonly code:
    | 'CATEGORY_NOT_INGESTIBLE'
    | 'CATEGORY_UNKNOWN'
    | 'PURPOSE_DENIED'
    | 'FORBIDDEN_PAYLOAD_FIELD'
    | 'CORRECTION_NOT_OVERWRITABLE'
    | 'EXPORT_NOT_FOUND'
    | 'AGENT_CATEGORY_DENIED'
    | 'GET_ALL_FORBIDDEN';
  readonly message: string;
};

export type VaultExportJob = {
  readonly exportId: string;
  readonly subjectId: string;
  readonly status: 'REQUESTED' | 'COMPLETED' | 'FAILED';
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly manifestSha256: string | null;
  readonly recordCount: number;
  readonly legalPortabilityClaim: false;
};

export type ProductVaultSnapshot = PersonalDataVaultStoreSnapshot & {
  readonly recordMetadata: readonly VaultRecordMetadata[];
  readonly corrections: readonly VaultCorrectionRequest[];
  readonly exportJobs: readonly VaultExportJob[];
  readonly agentCategories: readonly { readonly subjectId: string; readonly categories: readonly string[] }[];
};

export type ClientVaultHome = {
  readonly schema: 'sunrey.consumer.vault.home.v1';
  readonly fabric: typeof CANONICAL_PERSONAL_DATA_FABRIC.id;
  readonly ownerSubjectId: string;
  readonly recordCount: number;
  readonly categoryCount: number;
  readonly sourceCount: number;
  readonly disputedCount: number;
  readonly productionActive: false;
  readonly liveMonetizationEnabled: false;
  readonly sunreyOwnsUserData: false;
};

export type ClientVaultRecord = VaultDataRecord & {
  readonly payload: unknown | null;
  readonly payloadRedacted: boolean;
};

export type PersonalDataVaultProductOptions = {
  readonly clock: Clock;
  readonly events: DomainEventLog;
  readonly vault: PersonalDataVault;
  readonly categories?: VaultCategoryRegistry;
};

export class PersonalDataVaultProduct {
  private readonly clock: Clock;
  private readonly events: DomainEventLog;
  private readonly vault: PersonalDataVault;
  private readonly categories: VaultCategoryRegistry;
  private readonly metadata = new Map<string, VaultRecordMetadata>();
  private readonly corrections = new Map<string, VaultCorrectionRequest>();
  private readonly exportJobs = new Map<string, VaultExportJob>();
  private readonly agentCategories = new Map<string, readonly string[]>();

  constructor(options: PersonalDataVaultProductOptions) {
    this.clock = options.clock;
    this.events = options.events;
    this.vault = options.vault;
    this.categories = options.categories ?? DEFAULT_CATEGORY_REGISTRY;
  }

  fabric() {
    return CANONICAL_PERSONAL_DATA_FABRIC;
  }

  listCategories() {
    return this.categories.list();
  }

  underlying(): PersonalDataVault {
    return this.vault;
  }

  open(actor: unknown, subjectId: string, customerId?: string | null) {
    return this.vault.openVault(actor, subjectId, customerId);
  }

  ingestRecord(
    actor: unknown,
    input: IngestInput & {
      readonly categoryId?: string;
      readonly dataKind?: DataKind;
      readonly consentReference?: string;
      readonly parentRecordIds?: readonly string[];
      readonly changeReason?: string;
      readonly objectRef?: string;
    },
  ): Result<VaultDataRecord, ProductVaultFailure> {
    const forbidden = findForbiddenPayloadField(input.payload);
    if (forbidden) {
      return err({ code: 'FORBIDDEN_PAYLOAD_FIELD', message: forbidden.message });
    }
    const category = input.categoryId
      ? this.categories.get(input.categoryId)
      : undefined;
    if (input.categoryId && !category) {
      return err({ code: 'CATEGORY_UNKNOWN', message: `unknown category ${input.categoryId}` });
    }
    if (category && !category.ingestEnabled) {
      return err({
        code: 'CATEGORY_NOT_INGESTIBLE',
        message: `${category.categoryId} is ${category.availability} and is not ingested by default`,
      });
    }
    const opened = this.open(actor, input.subjectId);
    if (!opened.ok) {
      return opened;
    }
    const ingested = this.vault.ingest(actor, input);
    if (!ingested.ok) {
      return ingested;
    }
    const dataKind = input.dataKind ?? (input.provenanceKind === 'DERIVED' ? 'DERIVED_DATA' : input.provenanceKind === 'USER_DECLARED' ? 'USER_DECLARATION' : 'NORMALIZED_DATA');
    const verificationState = verificationFromKind(dataKind, input.provenanceKind);
    assertNotVerifiedInference(dataKind, verificationState);
    const meta: VaultRecordMetadata = Object.freeze({
      assetId: ingested.value.assetId,
      registryCategory: category?.categoryId ?? this.categories.fromAssetCategory(ingested.value.category).categoryId,
      dataKind,
      verificationState,
      consentReference: input.consentReference ?? null,
      purposeRestrictions: category?.allowedPurposes ?? this.categories.fromAssetCategory(ingested.value.category).allowedPurposes,
      parentRecordIds: Object.freeze([...(input.parentRecordIds ?? [])]),
      changeReason: input.changeReason ?? null,
      licenseRef: null,
      disputed: false,
      objectRef: input.objectRef ?? null,
    });
    this.metadata.set(ingested.value.assetId, meta);
    this.emit('VaultRecordCreated', ingested.value.assetId, {
      dataRecordId: ingested.value.assetId,
      subjectId: input.subjectId,
      categoryId: meta.registryCategory,
      dataKind,
      integrityHash: ingested.value.contentSha256,
    });
    return ok(this.project(ingested.value));
  }

  home(actor: unknown, subjectId: string, purpose: VaultPurpose = 'VAULT_SELF_VIEW'): Result<ClientVaultHome, ProductVaultFailure> {
    const records = this.listRecords(actor, subjectId, purpose);
    if (!records.ok) {
      return records;
    }
    const sources = new Set(records.value.map((row) => row.source));
    return ok({
      schema: 'sunrey.consumer.vault.home.v1',
      fabric: CANONICAL_PERSONAL_DATA_FABRIC.id,
      ownerSubjectId: subjectId,
      recordCount: records.value.filter((row) => row.status === 'ACTIVE' || row.status === 'DISPUTED').length,
      categoryCount: new Set(records.value.map((row) => row.dataCategory)).size,
      sourceCount: sources.size,
      disputedCount: records.value.filter((row) => row.disputed).length,
      productionActive: false,
      liveMonetizationEnabled: false,
      sunreyOwnsUserData: false,
    });
  }

  listRecords(
    actor: unknown,
    subjectId: string,
    purpose: VaultPurpose,
    filter?: { readonly categoryId?: string; readonly kind?: DataKind; readonly status?: string },
  ): Result<readonly VaultDataRecord[], ProductVaultFailure> {
    const listed = this.vault.listAssets(actor, subjectId, purpose);
    if (!listed.ok) {
      return listed;
    }
    const projected = listed.value
      .map((asset) => this.project(asset))
      .filter((row) => {
        if (filter?.categoryId && row.dataCategory !== filter.categoryId) {
          return false;
        }
        if (filter?.kind && row.dataKind !== filter.kind) {
          return false;
        }
        if (filter?.status && row.status !== filter.status) {
          return false;
        }
        if (row.status === 'DELETED') {
          return false;
        }
        return this.categories.purposeAllowed(row.dataCategory, purpose);
      });
    return ok(Object.freeze(projected));
  }

  getRecord(
    actor: unknown,
    subjectId: string,
    recordId: string,
    purpose: VaultPurpose,
    includePayload = false,
  ): Result<ClientVaultRecord, ProductVaultFailure> {
    const meta = this.vault.readMetadata(actor, subjectId, asDataAssetId(recordId), purpose);
    if (!meta.ok) {
      return meta;
    }
    const record = this.project(meta.value);
    if (!this.categories.purposeAllowed(record.dataCategory, purpose)) {
      return err({ code: 'PURPOSE_DENIED', message: `${purpose} is not allowed for ${record.dataCategory}` });
    }
    let payload: unknown | null = null;
    let payloadRedacted = true;
    if (includePayload && record.status !== 'DELETED') {
      const read = this.vault.readPayload(actor, subjectId, asDataAssetId(recordId), purpose);
      if (!read.ok) {
        return read;
      }
      payload = read.value;
      payloadRedacted = false;
    }
    return ok(Object.freeze({ ...record, payload, payloadRedacted }));
  }

  listHistory(
    actor: unknown,
    subjectId: string,
    recordId: string,
    purpose: VaultPurpose,
  ): Result<readonly { readonly versionId: string; readonly sequence: number; readonly state: string; readonly createdAt: string; readonly changeReason: string | null }[], ProductVaultFailure> {
    const meta = this.vault.readMetadata(actor, subjectId, asDataAssetId(recordId), purpose);
    if (!meta.ok) {
      return meta;
    }
    const versions = this.vault.snapshot().versions.filter((row) => row.assetId === recordId);
    const changeReason = this.metadata.get(recordId)?.changeReason ?? null;
    return ok(
      Object.freeze(
        versions.map((row) =>
          Object.freeze({
            versionId: row.versionId,
            sequence: row.sequence,
            state: row.state,
            createdAt: row.createdAt,
            changeReason,
          }),
        ),
      ),
    );
  }

  listSources(actor: unknown, subjectId: string, purpose: VaultPurpose) {
    const records = this.listRecords(actor, subjectId, purpose);
    if (!records.ok) {
      return records;
    }
    const grouped = new Map<string, number>();
    for (const row of records.value) {
      grouped.set(row.source, (grouped.get(row.source) ?? 0) + 1);
    }
    return ok(
      Object.freeze(
        [...grouped.entries()].map(([sourceId, count]) =>
          Object.freeze({ sourceId, count, ownership: ownershipForSubject({ subjectId, sourceId }) }),
        ),
      ),
    );
  }

  listAccess(actor: unknown, subjectId: string, purpose: VaultPurpose) {
    return this.vault.accessAudit(actor, subjectId, purpose);
  }

  listCorrections(actor: unknown, subjectId: string, purpose: VaultPurpose) {
    const allowed = this.vault.listAssets(actor, subjectId, purpose);
    if (!allowed.ok) {
      return allowed;
    }
    return ok(Object.freeze([...this.corrections.values()].filter((row) => row.subjectId === subjectId)));
  }

  clientCategories() {
    return Object.freeze(
      this.categories.list().map((row) =>
        Object.freeze({
          categoryId: row.categoryId,
          label: row.label,
          classification: row.classification,
          availability: row.availability,
          ingestEnabled: row.ingestEnabled,
          agentAccessEligible: row.agentAccessEligible,
          shareability: row.shareability,
          legalReviewRequirement: row.legalReviewRequirement,
          retentionMode: row.retention.mode,
          liveMonetizationEnabled: false as const,
        }),
      ),
    );
  }

  toPegReference(recordId: string) {
    const asset = this.vault.snapshot().assets.find((row) => row.assetId === recordId);
    if (!asset) {
      return undefined;
    }
    return this.vault.toPegDataAssetRef(asset);
  }

  correctOrDispute(
    actor: unknown,
    input: {
      readonly subjectId: string;
      readonly recordId: string;
      readonly purpose: VaultPurpose;
      readonly reason: string;
      readonly proposedPayload?: unknown;
    },
  ): Result<{ readonly correction: VaultCorrectionRequest; readonly record: VaultDataRecord }, ProductVaultFailure> {
    const current = this.getRecord(actor, input.subjectId, input.recordId, input.purpose, false);
    if (!current.ok) {
      return current;
    }
    if (input.proposedPayload) {
      const forbidden = findForbiddenPayloadField(input.proposedPayload);
      if (forbidden) {
        return err({ code: 'FORBIDDEN_PAYLOAD_FIELD', message: forbidden.message });
      }
    }
    const kind = correctionKindFor(current.value.dataKind);
    const now = this.clock.now();
    const correction: VaultCorrectionRequest = Object.freeze({
      correctionId: newVaultCorrectionId(),
      dataRecordId: input.recordId,
      subjectId: input.subjectId,
      kind,
      status: userMayOverwrite(current.value.dataKind) ? 'APPLIED' : 'REVIEW_PENDING',
      reason: input.reason,
      proposedPayload: input.proposedPayload ?? null,
      requestedAt: now,
      resolvedAt: userMayOverwrite(current.value.dataKind) ? now : null,
      outcome: userMayOverwrite(current.value.dataKind) ? 'user_declared_version_written' : 'review_required',
    });
    this.corrections.set(correction.correctionId, correction);
    this.emit('VaultCorrectionRequested', input.recordId, {
      correctionId: correction.correctionId,
      dataRecordId: input.recordId,
      subjectId: input.subjectId,
      kind,
      status: correction.status,
    });
    if (!userMayOverwrite(current.value.dataKind)) {
      const meta = this.metaFor(input.recordId, current.value);
      this.metadata.set(input.recordId, { ...meta, disputed: true, changeReason: input.reason });
      const asset = this.vault.snapshot().assets.find((row) => row.assetId === input.recordId);
      return ok({ correction, record: asset ? this.project(asset) : current.value });
    }
    if (!input.proposedPayload) {
      return err({ code: 'CORRECTION_NOT_OVERWRITABLE', message: 'user-declared correction requires a proposed payload' });
    }
    const updated = this.vault.updateAsset(actor, {
      assetId: asDataAssetId(input.recordId),
      subjectId: input.subjectId,
      sourceId: current.value.source,
      sourceRecordRef: `${current.value.sourceReference}:correction`,
      idempotencyKey: correction.correctionId,
      schemaId: current.value.dataType,
      schemaVersion: current.value.schemaVersion,
      contentType: 'application/json',
      payload: input.proposedPayload,
      provenanceKind: 'USER_DECLARED',
      purposeRef: input.purpose,
    });
    if (!updated.ok) {
      return updated;
    }
    const meta = this.metaFor(input.recordId, current.value);
    this.metadata.set(input.recordId, {
      ...meta,
      changeReason: input.reason,
      disputed: false,
    });
    this.emit('VaultRecordUpdated', input.recordId, {
      dataRecordId: input.recordId,
      subjectId: input.subjectId,
      reason: input.reason,
    });
    this.emit('VaultRecordSuperseded', input.recordId, {
      dataRecordId: input.recordId,
      subjectId: input.subjectId,
      previousVersionId: current.value.currentVersionId,
    });
    return ok({ correction, record: this.project(updated.value) });
  }

  requestExport(actor: unknown, subjectId: string, purpose: VaultPurpose): Result<VaultExportJob, ProductVaultFailure> {
    const job: VaultExportJob = Object.freeze({
      exportId: newVaultExportJobId(),
      subjectId,
      status: 'REQUESTED',
      requestedAt: this.clock.now(),
      completedAt: null,
      manifestSha256: null,
      recordCount: 0,
      legalPortabilityClaim: false,
    });
    this.exportJobs.set(job.exportId, job);
    this.emit('VaultExportRequested', job.exportId, { exportId: job.exportId, subjectId });
    const exported = this.vault.exportOwn(actor, subjectId, purpose);
    if (!exported.ok) {
      const failed = Object.freeze({ ...job, status: 'FAILED' as const });
      this.exportJobs.set(job.exportId, failed);
      return exported;
    }
    const completed = Object.freeze({
      ...job,
      status: 'COMPLETED' as const,
      completedAt: this.clock.now(),
      manifestSha256: exported.value.manifest.manifestSha256,
      recordCount: exported.value.manifest.assetIds.length,
    });
    this.exportJobs.set(job.exportId, completed);
    return ok(completed);
  }

  exportStatus(actor: unknown, subjectId: string, purpose: VaultPurpose): Result<readonly VaultExportJob[], ProductVaultFailure> {
    const allowed = this.vault.listAssets(actor, subjectId, purpose);
    if (!allowed.ok) {
      return allowed;
    }
    return ok(Object.freeze([...this.exportJobs.values()].filter((row) => row.subjectId === subjectId)));
  }

  getExport(
    actor: unknown,
    subjectId: string,
    exportId: string,
    purpose: VaultPurpose,
  ): Result<{ readonly job: VaultExportJob; readonly bundle: DataExportBundle | null }, ProductVaultFailure> {
    const job = this.exportJobs.get(exportId);
    if (!job || job.subjectId !== subjectId) {
      return err({ code: 'EXPORT_NOT_FOUND', message: 'export job not found' });
    }
    const allowed = this.vault.listAssets(actor, subjectId, purpose);
    if (!allowed.ok) {
      return allowed;
    }
    if (job.status !== 'COMPLETED') {
      return ok({ job, bundle: null });
    }
    const exported = this.vault.exportOwn(actor, subjectId, purpose);
    if (!exported.ok) {
      return exported;
    }
    const portable = {
      ...exported.value,
      assets: exported.value.assets.map((row) => ({
        metadata: this.project(row.metadata),
        versions: row.versions.map((version) => ({
          versionId: version.versionId,
          sequence: version.sequence,
          state: version.state,
          createdAt: version.createdAt,
        })),
        payloadJson: row.payloadJson,
      })),
    };
    return ok({ job, bundle: portable as unknown as DataExportBundle });
  }

  deleteRecord(actor: unknown, subjectId: string, recordId: string, purpose: VaultPurpose) {
    const deleted = this.vault.requestDeletion(actor, subjectId, asDataAssetId(recordId), purpose);
    if (!deleted.ok) {
      return deleted;
    }
    this.emit('VaultRecordDeleted', recordId, { dataRecordId: recordId, subjectId, deletionRequestId: deleted.value.requestId });
    return deleted;
  }

  agentRecords(
    actor: unknown,
    input: {
      readonly subjectId: string;
      readonly purpose: VaultPurpose;
      readonly categoryIds?: readonly string[];
      readonly recordIds?: readonly string[];
    },
  ): Result<readonly { readonly dataRecordId: string; readonly categoryId: string; readonly label: string }[], ProductVaultFailure> {
    if ((!input.categoryIds || input.categoryIds.length === 0) && (!input.recordIds || input.recordIds.length === 0)) {
      return err({ code: 'GET_ALL_FORBIDDEN', message: 'agent wildcard vault access is forbidden' });
    }
    const allowed = this.agentCategories.get(input.subjectId) ?? [];
    const requested = input.categoryIds ?? [];
    for (const categoryId of requested) {
      const category = this.categories.get(categoryId);
      if (!category?.agentAccessEligible || !allowed.includes(categoryId)) {
        return err({ code: 'AGENT_CATEGORY_DENIED', message: `agent is not eligible for ${categoryId}` });
      }
    }
    const listed = this.listRecords(actor, input.subjectId, input.purpose);
    if (!listed.ok) {
      return listed;
    }
    const filtered = listed.value.filter((row) => {
      if (input.recordIds && input.recordIds.length > 0 && !input.recordIds.includes(row.dataRecordId)) {
        return false;
      }
      if (requested.length > 0 && !requested.includes(row.dataCategory)) {
        return false;
      }
      return row.accessPolicy.agentEligible;
    });
    if (filtered.length === 0) {
      return ok(Object.freeze([]));
    }
    const read = this.vault.readForAgent(actor, {
      subjectId: input.subjectId,
      purposeRef: input.purpose,
      assetIds: filtered.map((row) => asDataAssetId(row.dataRecordId)),
    });
    if (!read.ok) {
      return read;
    }
    return ok(
      Object.freeze(
        read.value.map((row) => {
          const record = filtered.find((item) => item.dataRecordId === row.assetId);
          return Object.freeze({
            dataRecordId: row.assetId,
            categoryId: record?.dataCategory ?? 'goals_preferences',
            label: row.label,
          });
        }),
      ),
    );
  }

  setAgentCategories(subjectId: string, categories: readonly string[]): void {
    this.agentCategories.set(subjectId, Object.freeze([...categories]));
  }

  seedPersona(actor: unknown, subjectId: string, personaId: VaultPersonaId): Result<readonly VaultDataRecord[], ProductVaultFailure> {
    const seed = vaultPersonaSeed(personaId);
    const opened = this.open(actor, subjectId);
    if (!opened.ok) {
      return opened;
    }
    this.setAgentCategories(subjectId, seed.agentCategories);
    const created: VaultDataRecord[] = [];
    const byKey = new Map<string, string>();
    for (const record of seed.records) {
      const ingested = this.ingestRecord(actor, {
        subjectId,
        sourceId: record.sourceId,
        sourceRecordRef: `${subjectId}:${personaId}:${record.key}`,
        idempotencyKey: `${subjectId}:${personaId}:${record.key}`,
        schemaId: record.schemaId,
        schemaVersion: record.schemaVersion,
        categoryId: record.categoryId,
        contentType: 'application/json',
        payload: record.payload,
        provenanceKind: record.provenanceKind,
        purposeRef: 'VAULT_SELF_MANAGE',
        ...(record.deriveFrom && byKey.has(record.deriveFrom)
          ? { parentRecordIds: [byKey.get(record.deriveFrom)!] }
          : {}),
      });
      if (!ingested.ok) {
        return ingested;
      }
      byKey.set(record.key, ingested.value.dataRecordId);
      if (record.dispute) {
        const disputed = this.correctOrDispute(actor, {
          subjectId,
          recordId: ingested.value.dataRecordId,
          purpose: 'VAULT_CORRECTION',
          reason: 'sandbox disputed derived total',
        });
        if (!disputed.ok) {
          return disputed;
        }
        created.push(disputed.value.record);
        continue;
      }
      if (record.revoke) {
        const deleted = this.deleteRecord(actor, subjectId, ingested.value.dataRecordId, 'VAULT_SELF_MANAGE');
        if (!deleted.ok) {
          return deleted;
        }
        continue;
      }
      created.push(ingested.value);
    }
    return ok(Object.freeze(created));
  }

  seedAllPersonas(
    resolveActor: (suffix: string) => { readonly actor: unknown; readonly subjectId: string } | undefined,
  ): void {
    for (const seed of VAULT_PERSONA_SEEDS) {
      const resolved = resolveActor(seed.subjectSuffix);
      if (!resolved) {
        continue;
      }
      this.seedPersona(resolved.actor, resolved.subjectId, seed.personaId);
    }
  }

  snapshot(): ProductVaultSnapshot {
    return Object.freeze({
      ...this.vault.snapshot(),
      recordMetadata: Object.freeze([...this.metadata.values()]),
      corrections: Object.freeze([...this.corrections.values()]),
      exportJobs: Object.freeze([...this.exportJobs.values()]),
      agentCategories: Object.freeze(
        [...this.agentCategories.entries()].map(([subjectId, categories]) =>
          Object.freeze({ subjectId, categories }),
        ),
      ),
    });
  }

  restore(state: ProductVaultSnapshot): void {
    this.vault.restore(state);
    this.metadata.clear();
    this.corrections.clear();
    this.exportJobs.clear();
    this.agentCategories.clear();
    for (const row of state.recordMetadata ?? []) {
      this.metadata.set(row.assetId, row);
    }
    for (const row of state.corrections ?? []) {
      this.corrections.set(row.correctionId, row);
    }
    for (const row of state.exportJobs ?? []) {
      this.exportJobs.set(row.exportId, row);
    }
    for (const row of state.agentCategories ?? []) {
      this.agentCategories.set(row.subjectId, row.categories);
    }
  }

  private project(asset: DataAsset): VaultDataRecord {
    return projectVaultDataRecord({
      asset,
      versions: this.vault.snapshot().versions.filter((row) => row.assetId === asset.assetId),
      derivations: this.vault.snapshot().derivations.filter(
        (row) => row.outputAssetId === asset.assetId || row.sourceAssetIds.includes(asset.assetId as DataAssetId),
      ),
      metadata: this.metadata.get(asset.assetId),
      ...(this.metadata.get(asset.assetId)
        ? { category: this.categories.get(this.metadata.get(asset.assetId)!.registryCategory) }
        : {}),
    });
  }

  private metaFor(recordId: string, record: VaultDataRecord): VaultRecordMetadata {
    return (
      this.metadata.get(recordId) ??
      Object.freeze({
        assetId: recordId,
        registryCategory: record.dataCategory,
        dataKind: record.dataKind,
        verificationState: record.verificationState,
        consentReference: record.consentReference,
        purposeRestrictions: record.purposeRestrictions,
        parentRecordIds: record.parentRecordIds,
        changeReason: record.changeReason,
        licenseRef: null,
        disputed: record.disputed,
        objectRef: null,
      })
    );
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
}
