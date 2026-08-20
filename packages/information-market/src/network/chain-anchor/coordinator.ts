import type { Clock } from '../../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { DomainEventLog } from '../../../../events/src/events.ts';
import type { ChainOperationId } from '../../../../sunrey-chain/src/ids.ts';
import type { ReconciliationOutcome } from '../../../../sunrey-chain/src/taxonomy.ts';
import type { EconomicAssetRegistryPort } from '../../../../economic-asset-registry/src/index.ts';
import type { HinChainAnchorAdapter } from './adapter.ts';
import { newAnchorReconciliationId, newUsageAnchorProjectionId } from './ids.ts';
import {
  CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY,
  HIN_ANCHOR_INVARIANTS,
} from './invariants.ts';
import type { HumanInformationChainAnchorPort } from './port.ts';
import {
  isPendingState,
  mapHinReconciliation,
  parseChainHeight,
  privacySafeStatus,
  scheduleFor,
} from './projections.ts';
import { projectFinalizedChainAnchor } from './registry-projection.ts';
import { HumanInformationAnchorStore } from './store.ts';
import type {
  HinAnchorFailure,
  HinAnchorKind,
  HinAnchorRequest,
  HumanInformationAnchor,
  HumanInformationAnchorHealth,
  HumanInformationAnchorId,
  HumanInformationAnchorReconciliation,
  HumanInformationChainAnchorRecord,
  HumanInformationConsentAnchorProjection,
  HumanInformationRevocationAnchorProjection,
  HumanInformationRightsAuditV2,
  HumanInformationUsageAnchorProjection,
  PrivacySafeAnchorStatus,
} from './types.ts';

export type HumanInformationAnchorCoordinatorOptions = {
  readonly clock?: Clock;
  readonly port: HumanInformationChainAnchorPort;
  readonly adapter?: HinChainAnchorAdapter;
  readonly registry?: EconomicAssetRegistryPort;
  readonly events?: DomainEventLog;
};

function failure(code: HinAnchorFailure['code'], message: string): HinAnchorFailure {
  return Object.freeze({ code, message });
}

function asAdapter(port: HumanInformationChainAnchorPort, adapter?: HinChainAnchorAdapter): HinChainAnchorAdapter | null {
  if (adapter) {
    return adapter;
  }
  if ('chain' in port && 'listAnchors' in port) {
    return port as HinChainAnchorAdapter;
  }
  return null;
}

/**
 * Completes the HIN → chain lifecycle:
 * prepare → submit → refresh finality → reconcile → project.
 *
 * Uses the Chunk 139 HumanInformationChainAnchorPort and the existing
 * SunRey Chain lifecycle. Does not invent finality.
 */
export class HumanInformationAnchorCoordinator {
  readonly store = new HumanInformationAnchorStore();
  readonly invariants = HIN_ANCHOR_INVARIANTS;
  readonly port: HumanInformationChainAnchorPort;
  private readonly clock: Clock | null;
  private readonly adapter: HinChainAnchorAdapter | null;
  private readonly registry: EconomicAssetRegistryPort | null;
  private readonly events: DomainEventLog | null;

  constructor(options: HumanInformationAnchorCoordinatorOptions) {
    this.port = options.port;
    this.adapter = asAdapter(options.port, options.adapter);
    this.clock = options.clock ?? this.adapter?.clock ?? null;
    this.registry = options.registry ?? null;
    this.events = options.events ?? null;
  }

  get chainFinalityIsNotLegalConsentAuthority(): true {
    return CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY;
  }

  prepare(request: HinAnchorRequest): Result<HumanInformationAnchor, HinAnchorFailure> {
    const existing = this.store.findBySource(request.kind, request.sourceRecordId);
    if (existing) {
      return this.retry(existing.anchorId);
    }
    const created = this.port.createAnchorIntent(request);
    if (!created.ok) {
      return created;
    }
    this.store.meta.set(created.value.anchorId, {
      requesterId: request.requesterId ?? null,
      subjectHandle: request.subjectHandle ?? '',
      priorConsentCommitment: request.priorConsentCommitment ?? null,
    });
    const view = this.remember(created.value);
    this.emit('HumanInformationAnchorCreated', {
      anchorId: view.anchorId,
      kind: view.kind,
      sourceRecordId: view.sourceRecordId,
    });
    return ok(view);
  }

  submit(anchorId: HumanInformationAnchorId | string): Result<HumanInformationAnchor, HinAnchorFailure> {
    return this.retry(anchorId);
  }

  retry(anchorId: HumanInformationAnchorId | string): Result<HumanInformationAnchor, HinAnchorFailure> {
    const current = this.refreshView(anchorId);
    if (!current) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (current.finalized && current.chainState === 'FINALIZED') {
      return ok(current);
    }
    if (current.reorgObserved || current.chainState === 'REORG_OBSERVED') {
      return err(failure('HIN_ANCHOR_REORG_OBSERVED', 'REANCHOR_REVIEW_REQUIRED; HIN history is preserved'));
    }
    if (current.unknownAfterBroadcast || current.chainState === 'UNKNOWN') {
      return err(
        failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', 'UNKNOWN requires reconcile before any resubmit'),
      );
    }
    if (current.chainState === 'REJECTED') {
      return err(failure('HIN_ANCHOR_REJECTED', 'rejected anchors are not retried as duplicate submissions'));
    }
    if (current.operationId && isPendingState(current.chainState) && current.chainState !== 'CREATED' && current.chainState !== 'INTENT_CREATED') {
      return this.refreshFinality(anchorId);
    }
    const submitted = this.port.submitAnchor(anchorId);
    if (!submitted.ok) {
      if (submitted.error.code === 'HIN_ANCHOR_CHAIN_UNAVAILABLE') {
        return err(failure('HIN_ANCHOR_FINALITY_UNAVAILABLE', submitted.error.message));
      }
      if (submitted.error.code === 'HIN_ANCHOR_RECONCILIATION_REQUIRED' || submitted.error.code === 'HIN_ANCHOR_SUBMISSION_UNKNOWN') {
        this.markUnknown(anchorId);
        return err(failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', submitted.error.message));
      }
      return submitted;
    }
    const view = this.remember(submitted.value);
    if (view.chainState === 'UNKNOWN' || view.unknownAfterBroadcast) {
      return err(failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', 'UNKNOWN requires reconcile before any resubmit'));
    }
    this.emit('HumanInformationAnchorSubmitted', {
      anchorId: view.anchorId,
      operationId: view.operationId,
      chainState: view.chainState,
    });
    if (view.finalized) {
      this.project(view.anchorId);
    }
    return ok(view);
  }

  refreshFinality(anchorId: HumanInformationAnchorId | string): Result<HumanInformationAnchor, HinAnchorFailure> {
    const record = this.port.anchorStatus(anchorId);
    if (!record) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    const view = this.remember(record);
    if (view.chainState === 'UNKNOWN' || view.unknownAfterBroadcast) {
      return err(failure('HIN_ANCHOR_SUBMISSION_UNKNOWN', 'query or reconcile before any resubmit'));
    }
    if (view.chainState === 'REORG_OBSERVED') {
      return err(failure('HIN_ANCHOR_REORG_OBSERVED', 'REANCHOR_REVIEW_REQUIRED; legal and financial state unchanged'));
    }
    if (view.finalized) {
      this.project(view.anchorId);
    }
    if (!view.operationId && view.chainState === 'INTENT_CREATED') {
      return err(failure('HIN_ANCHOR_FINALITY_PENDING', 'anchor has not been submitted'));
    }
    return ok(view);
  }

  reconcile(anchorId: HumanInformationAnchorId | string): Result<HumanInformationAnchorReconciliation, HinAnchorFailure> {
    const current = this.refreshView(anchorId);
    if (!current) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (!current.operationId) {
      return err(failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', 'anchor has no chain operation to reconcile'));
    }
    return this.reconcileOperation(current.operationId);
  }

  reconcileOperation(operationId: ChainOperationId): Result<HumanInformationAnchorReconciliation, HinAnchorFailure> {
    const hin = this.store.findByOperation(operationId);
    const adapter = this.adapter;
    if (!adapter) {
      return err(failure('HIN_ANCHOR_FINALITY_UNAVAILABLE', 'reconciliation requires the existing chain adapter'));
    }
    const reconciled = adapter.chain.reconcile(operationId);
    if (!reconciled.ok) {
      if (reconciled.error.code === 'OPERATION_NOT_FOUND' && !hin) {
        return ok(
          this.recordReconciliation({
            anchorId: null,
            sourceRecordId: '',
            operationId,
            expectedCommitment: null,
            observedCommitment: null,
            chainOutcome: 'MISSING_INTERNAL_RECORD',
          }),
        );
      }
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', reconciled.error.message));
    }
    const chain = reconciled.value;
    if (hin) {
      this.port.reconcileAnchor(hin.anchorId);
      this.refreshView(hin.anchorId);
    }
    if (!hin) {
      return ok(
        this.recordReconciliation({
          anchorId: null,
          sourceRecordId: chain.sourceRecordReference,
          operationId,
          expectedCommitment: chain.intentCommitment,
          observedCommitment: chain.chainCommitment,
          chainOutcome: 'MISSING_INTERNAL_RECORD',
        }),
      );
    }
    if (chain.outcome === 'HASH_MISMATCH') {
      this.patch(hin, { schedule: 'REVIEW' });
      return ok(
        this.recordReconciliation({
          anchorId: hin.anchorId,
          sourceRecordId: hin.sourceRecordId,
          operationId,
          expectedCommitment: chain.intentCommitment,
          observedCommitment: chain.chainCommitment,
          chainOutcome: 'HASH_MISMATCH',
        }),
      );
    }
    if (chain.outcome === 'REORG_OBSERVED') {
      this.patch(hin, { chainState: 'REORG_OBSERVED', reorgObserved: true, schedule: 'REVIEW', finalized: false });
    }
    if (chain.outcome === 'SUBMISSION_UNKNOWN') {
      this.patch(hin, { chainState: 'UNKNOWN', unknownAfterBroadcast: true, schedule: 'REVIEW' });
    }
    if (chain.outcome === 'MISSING_CHAIN_RECORD') {
      this.patch(hin, { schedule: 'REVIEW' });
    }
    return ok(
      this.recordReconciliation({
        anchorId: hin.anchorId,
        sourceRecordId: hin.sourceRecordId,
        operationId,
        expectedCommitment: chain.intentCommitment,
        observedCommitment: chain.chainCommitment,
        chainOutcome: chain.outcome,
      }),
    );
  }

  project(anchorId: HumanInformationAnchorId | string): Result<HumanInformationAnchor, HinAnchorFailure> {
    const anchor = this.refreshView(anchorId);
    if (!anchor) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (anchor.kind === 'USAGE_RECEIPT' || anchor.kind === 'CLEAN_ROOM_COMPUTATION') {
      const rightId = this.usageRightId(anchor);
      const projection: HumanInformationUsageAnchorProjection = Object.freeze({
        schemaVersion: 2,
        projectionId: newUsageAnchorProjectionId(),
        receiptId: anchor.sourceRecordId as HumanInformationUsageAnchorProjection['receiptId'],
        rightId,
        anchorId: anchor.anchorId,
        chainHeight: parseChainHeight(anchor.blockReference),
        transactionId: anchor.transactionId,
        blockReference: anchor.blockReference,
        finalized: anchor.finalized,
        createdAt: this.now(),
      });
      this.store.usageProjections.set(anchor.sourceRecordId, projection);
    }
    if (anchor.kind === 'CONSENT_GRANT') {
      const projection: HumanInformationConsentAnchorProjection = Object.freeze({
        grantId: anchor.sourceRecordId as HumanInformationConsentAnchorProjection['grantId'],
        anchorId: anchor.anchorId,
        payloadCommitment: anchor.payloadCommitment,
        transactionId: anchor.transactionId,
        blockReference: anchor.blockReference,
        chainState: anchor.chainState,
        finalized: anchor.finalized,
        projectedActive: !this.hasFinalizedRevocation(anchor.sourceRecordId) && anchor.finalized,
        legalConsentAuthority: 'HIN',
      });
      this.store.consentProjections.set(anchor.sourceRecordId, projection);
    }
    if (anchor.kind === 'CONSENT_REVOCATION') {
      const grantId = this.grantIdFromRevocation(anchor);
      const prior = this.store.findBySource('CONSENT_GRANT', grantId);
      const projection: HumanInformationRevocationAnchorProjection = Object.freeze({
        revocationId: anchor.sourceRecordId as HumanInformationRevocationAnchorProjection['revocationId'],
        grantId: grantId as HumanInformationRevocationAnchorProjection['grantId'],
        anchorId: anchor.anchorId,
        priorConsentAnchorCommitment: prior?.payloadCommitment ?? anchor.priorConsentCommitment,
        revocationCommitment: anchor.payloadCommitment,
        transactionId: anchor.transactionId,
        blockReference: anchor.blockReference,
        finalized: anchor.finalized,
        historicalConsentAnchorImmutable: true,
        hinFutureUseBlocked: true,
      });
      this.store.revocationProjections.set(anchor.sourceRecordId, projection);
      if (prior) {
        const consent = this.store.consentProjections.get(prior.sourceRecordId);
        if (consent) {
          this.store.consentProjections.set(prior.sourceRecordId, Object.freeze({ ...consent, projectedActive: false }));
        }
        this.patch(prior, { projectedActive: false });
      }
    }
    if (anchor.finalized && this.registry) {
      projectFinalizedChainAnchor(this.registry, anchor, this.now());
    }
    return ok(anchor);
  }

  observeReorg(anchorId: HumanInformationAnchorId | string): Result<HumanInformationAnchor, HinAnchorFailure> {
    const anchor = this.refreshView(anchorId);
    if (!anchor?.operationId) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'cannot observe reorg without a chain operation'));
    }
    if (!this.adapter) {
      return err(failure('HIN_ANCHOR_FINALITY_UNAVAILABLE', 'reorg observation is a chain responsibility'));
    }
    const observed = this.adapter.chain.observeReorg(anchor.operationId);
    if (!observed.ok) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', observed.error.message));
    }
    this.port.anchorStatus(anchor.anchorId);
    const next = this.patch(anchor, {
      chainState: 'REORG_OBSERVED',
      reorgObserved: true,
      finalized: false,
      schedule: 'REVIEW',
    });
    this.emit('HumanInformationAnchorReorgObserved', {
      anchorId: next.anchorId,
      sourceRecordId: next.sourceRecordId,
      hinHistoryErased: false,
    });
    return err(failure('HIN_ANCHOR_REORG_OBSERVED', 'REANCHOR_REVIEW_REQUIRED'));
  }

  advanceSimulatedFinality(blocks?: number): void {
    this.adapter?.chain.advanceFinality(blocks);
    for (const anchor of this.store.views.values()) {
      if (anchor.operationId && !anchor.unknownAfterBroadcast) {
        this.refreshFinality(anchor.anchorId);
      }
    }
  }

  setChainUnavailable(unavailable: boolean): void {
    this.adapter?.chain.simulationAdapter.setControls({ unavailable });
  }

  setUnknownNext(unknownNext: boolean): void {
    this.adapter?.chain.simulationAdapter.setControls({ unknownNext });
  }

  health(): HumanInformationAnchorHealth {
    const anchors = [...this.store.views.values()];
    const pending = anchors.filter((row) => row.schedule === 'PENDING_ANCHOR' || isPendingState(row.chainState));
    const oldest = pending.map((row) => Date.parse(row.createdAt)).sort((a, b) => a - b)[0];
    const now = Date.parse(this.now());
    return Object.freeze({
      chainAvailable: this.adapter?.chain.getHealth().status !== 'UNAVAILABLE',
      pendingAnchors: pending.length,
      unknownSubmissions: anchors.filter((row) => row.unknownAfterBroadcast || row.chainState === 'UNKNOWN').length,
      reconciliationFailures: this.store.reconciliations.filter((row) => row.hinOutcome !== 'MATCHED' && row.hinOutcome !== 'PENDING').length,
      reorgCount: anchors.filter((row) => row.reorgObserved).length,
      oldestPendingAge: oldest === undefined ? null : now - oldest,
      isHumanScore: false,
    });
  }

  auditCounters(): HumanInformationRightsAuditV2 {
    const anchors = [...this.store.views.values()];
    return Object.freeze({
      schemaVersion: 2,
      onChainAnchors: anchors.length,
      anchorsCreated: anchors.length,
      anchorsSubmitted: anchors.filter((row) => row.intentId !== null && row.chainState !== 'CREATED' && row.chainState !== 'INTENT_CREATED').length,
      anchorsFinalized: anchors.filter((row) => row.finalized).length,
      anchorsPending: anchors.filter((row) => row.schedule === 'PENDING_ANCHOR' || isPendingState(row.chainState)).length,
      anchorsReconciliationRequired: anchors.filter(
        (row) => row.unknownAfterBroadcast || row.schedule === 'REVIEW',
      ).length,
      anchorsReorgObserved: anchors.filter((row) => row.reorgObserved).length,
    });
  }

  consentStatus(sourceRecordId: string): PrivacySafeAnchorStatus | null {
    return privacySafeStatus(this.store.findBySource('CONSENT_GRANT', sourceRecordId));
  }

  revocationStatus(sourceRecordId: string): PrivacySafeAnchorStatus | null {
    return privacySafeStatus(this.store.findBySource('CONSENT_REVOCATION', sourceRecordId));
  }

  usageStatus(sourceRecordId: string): PrivacySafeAnchorStatus | null {
    return privacySafeStatus(this.store.findBySource('USAGE_RECEIPT', sourceRecordId));
  }

  anchorsForRequester(requesterId: string): readonly HumanInformationAnchor[] {
    return Object.freeze([...this.store.views.values()].filter((row) => row.requesterId === requesterId));
  }

  anchorsForSubjectHandle(subjectHandle: string): readonly HumanInformationAnchor[] {
    return Object.freeze([...this.store.views.values()].filter((row) => row.subjectHandle === subjectHandle));
  }

  private refreshView(anchorId: HumanInformationAnchorId | string): HumanInformationAnchor | undefined {
    const record = this.port.anchorStatus(anchorId);
    if (!record) {
      return this.store.views.get(anchorId as HumanInformationAnchorId);
    }
    return this.remember(record);
  }

  private remember(record: HumanInformationChainAnchorRecord): HumanInformationAnchor {
    const previous = this.store.views.get(record.anchorId);
    const meta = this.store.meta.get(record.anchorId);
    const view: HumanInformationAnchor = Object.freeze({
      schemaVersion: 1,
      record,
      anchorId: record.anchorId,
      kind: record.anchorKind,
      recordType: record.chainRecordType,
      sourceRecordId: record.sourceRecordId,
      subjectHandle: meta?.subjectHandle ?? previous?.subjectHandle ?? '',
      requesterId: meta?.requesterId ?? previous?.requesterId ?? this.requesterFromSource(record),
      intentId: record.intentId,
      operationId: record.operationId,
      payloadCommitment: record.payloadCommitment,
      chainState: record.state,
      schedule: scheduleFor(record.state),
      transactionId: record.transactionId,
      receiptId: record.receiptId,
      blockReference: record.blockReference,
      confirmations: record.confirmations,
      finalized: record.state === 'FINALIZED',
      unknownAfterBroadcast: record.state === 'UNKNOWN',
      reorgObserved: record.state === 'REORG_OBSERVED' || previous?.reorgObserved === true,
      priorConsentCommitment: meta?.priorConsentCommitment ?? previous?.priorConsentCommitment ?? null,
      revocationCommitment: record.anchorKind === 'CONSENT_REVOCATION' ? record.payloadCommitment : previous?.revocationCommitment ?? null,
      projectedActive: record.anchorKind === 'CONSENT_GRANT' && previous?.projectedActive !== false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      rawPersonalData: false,
      mintsAsset: false,
      altersLedger: false,
    });
    this.store.put(view);
    return view;
  }

  private patch(
    anchor: HumanInformationAnchor,
    patch: Partial<HumanInformationAnchor>,
  ): HumanInformationAnchor {
    const next: HumanInformationAnchor = Object.freeze({
      ...anchor,
      ...patch,
      rawPersonalData: false,
      mintsAsset: false,
      altersLedger: false,
      updatedAt: this.now(),
    });
    this.store.put(next);
    return next;
  }

  private markUnknown(anchorId: HumanInformationAnchorId | string): void {
    const current = this.store.views.get(anchorId as HumanInformationAnchorId);
    if (current) {
      this.patch(current, { chainState: 'UNKNOWN', unknownAfterBroadcast: true, schedule: 'REVIEW' });
    }
  }

  private recordReconciliation(input: {
    readonly anchorId: HumanInformationAnchorId | null;
    readonly sourceRecordId: string;
    readonly operationId: ChainOperationId | null;
    readonly expectedCommitment: string | null;
    readonly observedCommitment: string | null;
    readonly chainOutcome: ReconciliationOutcome;
  }): HumanInformationAnchorReconciliation {
    const record: HumanInformationAnchorReconciliation = Object.freeze({
      reconciliationId: newAnchorReconciliationId(),
      anchorId: input.anchorId,
      sourceRecordId: input.sourceRecordId,
      operationId: input.operationId,
      expectedCommitment: input.expectedCommitment,
      observedCommitment: input.observedCommitment,
      chainOutcome: input.chainOutcome,
      hinOutcome: mapHinReconciliation(input.chainOutcome),
      createdAt: this.now(),
      autoFixed: false,
    });
    this.store.rememberReconciliation(record);
    return record;
  }

  private hasFinalizedRevocation(grantId: string): boolean {
    return [...this.store.views.values()].some(
      (row) => row.kind === 'CONSENT_REVOCATION' && this.grantIdFromRevocation(row) === grantId && row.finalized,
    );
  }

  private grantIdFromRevocation(anchor: HumanInformationAnchor): string {
    const revocation = this.adapter?.engine.store.revocations.get(anchor.sourceRecordId);
    return revocation?.grantId ?? anchor.sourceRecordId;
  }

  private usageRightId(anchor: HumanInformationAnchor): HumanInformationUsageAnchorProjection['rightId'] {
    const receipt = this.adapter?.engine.store.receipts.get(anchor.sourceRecordId);
    return (receipt?.rightId ?? '') as HumanInformationUsageAnchorProjection['rightId'];
  }

  private requesterFromSource(record: HumanInformationChainAnchorRecord): string | null {
    const engine = this.adapter?.engine;
    if (!engine) {
      return null;
    }
    if (record.anchorKind === 'CONSENT_GRANT') {
      return engine.store.grants.get(record.sourceRecordId as never)?.requesterId ?? null;
    }
    if (record.anchorKind === 'USAGE_RECEIPT') {
      return engine.store.receipts.get(record.sourceRecordId)?.requesterId ?? null;
    }
    if (record.anchorKind === 'CONSENT_REVOCATION') {
      const revocation = engine.store.revocations.get(record.sourceRecordId);
      return revocation ? engine.store.grants.get(revocation.grantId)?.requesterId ?? null : null;
    }
    return null;
  }

  private now(): UtcInstant {
    return this.clock?.now() ?? (this.adapter?.clock.now() as UtcInstant);
  }

  private emit(eventType: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.now(),
      payload,
    });
  }
}

export function createHumanInformationAnchorCoordinator(
  options: HumanInformationAnchorCoordinatorOptions,
): HumanInformationAnchorCoordinator {
  return new HumanInformationAnchorCoordinator(options);
}

export type { HinAnchorKind };
