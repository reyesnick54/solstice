import type { Clock } from '../../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { DomainEventLog } from '../../../../events/src/events.ts';
import type { ChainOperationId, ChainWriteIntentId } from '../../../../sunrey-chain/src/ids.ts';
import type { ChainOperationState, ReconciliationOutcome } from '../../../../sunrey-chain/src/taxonomy.ts';
import type { ChainOperation } from '../../../../sunrey-chain/src/types.ts';
import type { EconomicAssetRegistryPort } from '../../../../economic-asset-registry/src/index.ts';
import {
  newAnchorReconciliationId,
  newHumanInformationAnchorId,
  newUsageAnchorProjectionId,
} from './ids.ts';
import { privacySafeIntentInput, recordTypeForAnchorKind } from './intents.ts';
import {
  CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY,
  HIN_ANCHOR_INVARIANTS,
} from './invariants.ts';
import type { HumanInformationChainAnchorRuntime } from './port.ts';
import {
  isPendingState,
  mapHinReconciliation,
  parseChainHeight,
  privacySafeStatus,
} from './projections.ts';
import { projectFinalizedChainAnchor } from './registry-projection.ts';
import { HumanInformationAnchorStore } from './store.ts';
import type {
  HinAnchorFailure,
  HinAnchorPrepareInput,
  HumanInformationAnchor,
  HumanInformationAnchorHealth,
  HumanInformationAnchorReconciliation,
  HumanInformationConsentAnchorProjection,
  HumanInformationRevocationAnchorProjection,
  HumanInformationRightsAuditV2,
  HumanInformationUsageAnchorProjection,
  PrivacySafeAnchorStatus,
} from './types.ts';

export type HumanInformationAnchorCoordinatorOptions = {
  readonly clock: Clock;
  readonly port: HumanInformationChainAnchorRuntime;
  readonly registry?: EconomicAssetRegistryPort;
  readonly events?: DomainEventLog;
};

function failure(code: HinAnchorFailure['code'], message: string): HinAnchorFailure {
  return Object.freeze({ code, message });
}

/**
 * Completes the HIN → chain lifecycle:
 * prepare → submit → refresh finality → reconcile → project.
 *
 * Uses the existing SunRey Chain lifecycle. Does not invent finality.
 */
export class HumanInformationAnchorCoordinator {
  readonly store = new HumanInformationAnchorStore();
  readonly invariants = HIN_ANCHOR_INVARIANTS;
  private readonly clock: Clock;
  private readonly port: HumanInformationChainAnchorRuntime;
  private readonly registry: EconomicAssetRegistryPort | null;
  private readonly events: DomainEventLog | null;

  constructor(options: HumanInformationAnchorCoordinatorOptions) {
    this.clock = options.clock;
    this.port = options.port;
    this.registry = options.registry ?? null;
    this.events = options.events ?? null;
  }

  get chainFinalityIsNotLegalConsentAuthority(): true {
    return CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY;
  }

  prepare(input: HinAnchorPrepareInput): Result<HumanInformationAnchor, HinAnchorFailure> {
    const existing = this.store.findBySource(input.kind, input.sourceRecordId);
    if (existing) {
      return this.retry(existing.anchorId);
    }
    const now = this.clock.now();
    const created: HumanInformationAnchor = Object.freeze({
      schemaVersion: 1,
      anchorId: newHumanInformationAnchorId(),
      kind: input.kind,
      recordType: recordTypeForAnchorKind(input.kind),
      sourceRecordId: input.sourceRecordId,
      subjectHandle: input.subjectHandle,
      requesterId: input.requesterId ?? null,
      intentId: null,
      operationId: null,
      payloadCommitment: null,
      chainState: 'CREATED',
      schedule: 'PENDING_ANCHOR',
      transactionId: null,
      receiptId: null,
      blockReference: null,
      confirmations: 0,
      finalized: false,
      unknownAfterBroadcast: false,
      reorgObserved: false,
      priorConsentCommitment: input.priorConsentCommitment ?? null,
      revocationCommitment: null,
      projectedActive: input.kind === 'CONSENT_RECEIPT',
      createdAt: now,
      updatedAt: now,
      rawPersonalData: false,
      mintsAsset: false,
      altersLedger: false,
    });
    this.store.put(created);
    const intent = this.port.createIntent(privacySafeIntentInput(input));
    if (!intent.ok) {
      return err(failure(intent.error.code, intent.error.message));
    }
    const withIntent = this.patch(created, {
      intentId: intent.value.intentId,
      operationId: intent.value.operationId,
      payloadCommitment: intent.value.payloadCommitment,
      chainState: 'CREATED',
      schedule: 'PENDING_ANCHOR',
    });
    this.emit('HumanInformationAnchorCreated', {
      anchorId: withIntent.anchorId,
      kind: withIntent.kind,
      sourceRecordId: withIntent.sourceRecordId,
    });
    return ok(withIntent);
  }

  submit(anchorId: HumanInformationAnchor['anchorId']): Result<HumanInformationAnchor, HinAnchorFailure> {
    return this.retry(anchorId);
  }

  retry(anchorId: HumanInformationAnchor['anchorId']): Result<HumanInformationAnchor, HinAnchorFailure> {
    const anchor = this.store.anchors.get(anchorId);
    if (!anchor) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (anchor.finalized && anchor.chainState === 'FINALIZED') {
      return ok(anchor);
    }
    if (anchor.reorgObserved || anchor.chainState === 'REORG_OBSERVED') {
      return err(failure('HIN_ANCHOR_REORG_OBSERVED', 'REANCHOR_REVIEW_REQUIRED; HIN history is preserved'));
    }
    if (anchor.unknownAfterBroadcast || anchor.chainState === 'UNKNOWN') {
      return err(
        failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', 'UNKNOWN requires reconcile before any resubmit'),
      );
    }
    if (anchor.chainState === 'REJECTED') {
      return err(failure('HIN_ANCHOR_REJECTED', 'rejected anchors are not retried as duplicate submissions'));
    }
    if (anchor.operationId && isPendingState(anchor.chainState) && anchor.chainState !== 'CREATED') {
      return this.refreshFinality(anchorId);
    }
    if (!anchor.intentId) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'anchor has no chain intent'));
    }
    const submitted = this.port.submit(anchor.intentId);
    if (!submitted.ok) {
      if (submitted.error.code === 'CHAIN_UNAVAILABLE' || submitted.error.code === 'CHAIN_HEALTH_DENIED') {
        return err(failure('HIN_ANCHOR_FINALITY_UNAVAILABLE', submitted.error.message));
      }
      if (submitted.error.code === 'CHAIN_SUBMISSION_UNKNOWN') {
        return err(failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', submitted.error.message));
      }
      return err(failure(submitted.error.code, submitted.error.message));
    }
    return ok(this.applyOperation(anchor, submitted.value));
  }

  refreshFinality(anchorId: HumanInformationAnchor['anchorId']): Result<HumanInformationAnchor, HinAnchorFailure> {
    const anchor = this.store.anchors.get(anchorId);
    if (!anchor) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (!anchor.operationId) {
      return err(failure('HIN_ANCHOR_FINALITY_PENDING', 'anchor has not been submitted'));
    }
    const finality = this.port.getFinality(anchor.operationId);
    if (!finality) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'chain operation was not found'));
    }
    if (finality.state === 'UNKNOWN' || finality.unknownAfterBroadcast) {
      const next = this.patch(anchor, {
        chainState: 'UNKNOWN',
        unknownAfterBroadcast: true,
        schedule: 'REVIEW',
        transactionId: finality.transactionId,
        receiptId: finality.receiptId,
        blockReference: finality.blockReference,
        confirmations: finality.confirmations,
        payloadCommitment: finality.payloadCommitment,
      });
      return err(failure('HIN_ANCHOR_SUBMISSION_UNKNOWN', 'query or reconcile before any resubmit'));
    }
    if (finality.state === 'REORG_OBSERVED') {
      const next = this.patch(anchor, {
        chainState: 'REORG_OBSERVED',
        reorgObserved: true,
        finalized: false,
        schedule: 'REVIEW',
        confirmations: finality.confirmations,
        blockReference: finality.blockReference,
        transactionId: finality.transactionId,
        receiptId: finality.receiptId,
      });
      return err(failure('HIN_ANCHOR_REORG_OBSERVED', 'REANCHOR_REVIEW_REQUIRED; legal and financial state unchanged'));
    }
    if (finality.state === 'REJECTED' || finality.state === 'FAILED') {
      return ok(
        this.patch(anchor, {
          chainState: finality.state,
          schedule: 'REVIEW',
          finalized: false,
        }),
      );
    }
    if (finality.state !== 'FINALIZED') {
      return ok(
        this.patch(anchor, {
          chainState: finality.state,
          schedule: 'SUBMITTED',
          transactionId: finality.transactionId,
          receiptId: finality.receiptId,
          blockReference: finality.blockReference,
          confirmations: finality.confirmations,
          payloadCommitment: finality.payloadCommitment,
          finalized: false,
        }),
      );
    }
    const finalized = this.patch(anchor, {
      chainState: 'FINALIZED',
      schedule: 'SETTLED',
      transactionId: finality.transactionId,
      receiptId: finality.receiptId,
      blockReference: finality.blockReference,
      confirmations: finality.confirmations,
      payloadCommitment: finality.payloadCommitment,
      finalized: true,
      revocationCommitment: anchor.kind === 'CONSENT_REVOCATION' ? finality.payloadCommitment : anchor.revocationCommitment,
      projectedActive: anchor.kind === 'CONSENT_RECEIPT',
    });
    this.project(finalized.anchorId);
    return ok(finalized);
  }

  reconcile(anchorId: HumanInformationAnchor['anchorId']): Result<HumanInformationAnchorReconciliation, HinAnchorFailure> {
    const anchor = this.store.anchors.get(anchorId);
    if (!anchor) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (!anchor.operationId) {
      return err(failure('HIN_ANCHOR_RECONCILIATION_REQUIRED', 'anchor has no chain operation to reconcile'));
    }
    return this.reconcileOperation(anchor.operationId);
  }

  reconcileOperation(operationId: ChainOperationId): Result<HumanInformationAnchorReconciliation, HinAnchorFailure> {
    const hin = this.store.findByOperation(operationId);
    const reconciled = this.port.reconcile(operationId);
    if (!reconciled.ok) {
      if (reconciled.error.code === 'OPERATION_NOT_FOUND' && !hin) {
        const record = this.recordReconciliation({
          anchorId: null,
          sourceRecordId: '',
          operationId,
          expectedCommitment: null,
          observedCommitment: null,
          chainOutcome: 'MISSING_INTERNAL_RECORD',
        });
        return ok(record);
      }
      return err(failure(reconciled.error.code, reconciled.error.message));
    }
    const chain = reconciled.value;
    if (!hin) {
      const record = this.recordReconciliation({
        anchorId: null,
        sourceRecordId: chain.sourceRecordReference,
        operationId,
        expectedCommitment: chain.intentCommitment,
        observedCommitment: chain.chainCommitment,
        chainOutcome: 'MISSING_INTERNAL_RECORD',
      });
      return ok(record);
    }
    if (chain.outcome === 'HASH_MISMATCH') {
      this.patch(hin, { schedule: 'REVIEW' });
      const record = this.recordReconciliation({
        anchorId: hin.anchorId,
        sourceRecordId: hin.sourceRecordId,
        operationId,
        expectedCommitment: chain.intentCommitment,
        observedCommitment: chain.chainCommitment,
        chainOutcome: 'HASH_MISMATCH',
      });
      return ok(record);
    }
    if (chain.outcome === 'REORG_OBSERVED') {
      this.patch(hin, { chainState: 'REORG_OBSERVED', reorgObserved: true, schedule: 'REVIEW', finalized: false });
    }
    if (chain.outcome === 'SUBMISSION_UNKNOWN') {
      this.patch(hin, { chainState: 'UNKNOWN', unknownAfterBroadcast: true, schedule: 'REVIEW' });
    }
    const record = this.recordReconciliation({
      anchorId: hin.anchorId,
      sourceRecordId: hin.sourceRecordId,
      operationId,
      expectedCommitment: chain.intentCommitment,
      observedCommitment: chain.chainCommitment,
      chainOutcome: chain.outcome,
    });
    return ok(record);
  }

  project(anchorId: HumanInformationAnchor['anchorId']): Result<HumanInformationAnchor, HinAnchorFailure> {
    const anchor = this.store.anchors.get(anchorId);
    if (!anchor) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'HIN anchor does not exist'));
    }
    if (anchor.kind === 'USAGE_RECEIPT' || anchor.kind === 'COMPUTATION_RECEIPT') {
      const projection: HumanInformationUsageAnchorProjection = Object.freeze({
        schemaVersion: 2,
        projectionId: newUsageAnchorProjectionId(),
        receiptId: anchor.sourceRecordId as HumanInformationUsageAnchorProjection['receiptId'],
        rightId: (anchor.requesterId ?? '') as HumanInformationUsageAnchorProjection['rightId'],
        anchorId: anchor.anchorId,
        chainHeight: parseChainHeight(anchor.blockReference),
        transactionId: anchor.transactionId,
        blockReference: anchor.blockReference,
        finalized: anchor.finalized,
        createdAt: this.clock.now(),
      });
      this.store.usageProjections.set(anchor.sourceRecordId, projection);
    }
    if (anchor.kind === 'CONSENT_RECEIPT') {
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
      const prior = [...this.store.anchors.values()].find(
        (row) => row.kind === 'CONSENT_RECEIPT' && row.sourceRecordId === this.grantIdFromRevocation(anchor),
      );
      const projection: HumanInformationRevocationAnchorProjection = Object.freeze({
        revocationId: anchor.sourceRecordId as HumanInformationRevocationAnchorProjection['revocationId'],
        grantId: this.grantIdFromRevocation(anchor) as HumanInformationRevocationAnchorProjection['grantId'],
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
      projectFinalizedChainAnchor(this.registry, anchor, this.clock.now());
    }
    return ok(anchor);
  }

  observeReorg(anchorId: HumanInformationAnchor['anchorId']): Result<HumanInformationAnchor, HinAnchorFailure> {
    const anchor = this.store.anchors.get(anchorId);
    if (!anchor?.operationId) {
      return err(failure('HIN_ANCHOR_OPERATION_NOT_FOUND', 'cannot observe reorg without a chain operation'));
    }
    if (!this.port.observeReorg) {
      return err(failure('HIN_ANCHOR_FINALITY_UNAVAILABLE', 'reorg observation is a chain responsibility'));
    }
    const observed = this.port.observeReorg(anchor.operationId);
    if (!observed.ok) {
      return err(failure(observed.error.code, observed.error.message));
    }
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
    this.port.advanceFinality?.(blocks);
    for (const anchor of this.store.anchors.values()) {
      if (anchor.operationId && !anchor.unknownAfterBroadcast) {
        this.refreshFinality(anchor.anchorId);
      }
    }
  }

  setChainUnavailable(unavailable: boolean): void {
    this.port.setUnavailable?.(unavailable);
  }

  setUnknownNext(unknownNext: boolean): void {
    this.port.setUnknownNext?.(unknownNext);
  }

  health(): HumanInformationAnchorHealth {
    const anchors = [...this.store.anchors.values()];
    const pending = anchors.filter((row) => row.schedule === 'PENDING_ANCHOR' || isPendingState(row.chainState));
    const oldest = pending
      .map((row) => Date.parse(row.createdAt) )
      .sort((a, b) => a - b)[0];
    const now = Date.parse(this.clock.now());
    return Object.freeze({
      chainAvailable: this.port.getHealth().status !== 'UNAVAILABLE',
      pendingAnchors: pending.length,
      unknownSubmissions: anchors.filter((row) => row.unknownAfterBroadcast || row.chainState === 'UNKNOWN').length,
      reconciliationFailures: this.store.reconciliations.filter((row) => row.hinOutcome !== 'MATCHED' && row.hinOutcome !== 'PENDING').length,
      reorgCount: anchors.filter((row) => row.reorgObserved).length,
      oldestPendingAge: oldest === undefined ? null : now - oldest,
      isHumanScore: false,
    });
  }

  auditCounters(): HumanInformationRightsAuditV2 {
    const anchors = [...this.store.anchors.values()];
    return Object.freeze({
      schemaVersion: 2,
      onChainAnchors: anchors.length,
      anchorsCreated: anchors.length,
      anchorsSubmitted: anchors.filter((row) => row.intentId !== null && row.chainState !== 'CREATED').length,
      anchorsFinalized: anchors.filter((row) => row.finalized).length,
      anchorsPending: anchors.filter((row) => row.schedule === 'PENDING_ANCHOR' || isPendingState(row.chainState)).length,
      anchorsReconciliationRequired: anchors.filter(
        (row) => row.unknownAfterBroadcast || row.schedule === 'REVIEW',
      ).length,
      anchorsReorgObserved: anchors.filter((row) => row.reorgObserved).length,
    });
  }

  consentStatus(sourceRecordId: string): PrivacySafeAnchorStatus | null {
    return privacySafeStatus(this.store.findBySource('CONSENT_RECEIPT', sourceRecordId));
  }

  revocationStatus(sourceRecordId: string): PrivacySafeAnchorStatus | null {
    return privacySafeStatus(this.store.findBySource('CONSENT_REVOCATION', sourceRecordId));
  }

  usageStatus(sourceRecordId: string): PrivacySafeAnchorStatus | null {
    return (
      privacySafeStatus(this.store.findBySource('USAGE_RECEIPT', sourceRecordId)) ??
      privacySafeStatus(this.store.findBySource('COMPUTATION_RECEIPT', sourceRecordId))
    );
  }

  anchorsForRequester(requesterId: string): readonly HumanInformationAnchor[] {
    return Object.freeze([...this.store.anchors.values()].filter((row) => row.requesterId === requesterId));
  }

  anchorsForSubjectHandle(subjectHandle: string): readonly HumanInformationAnchor[] {
    return Object.freeze([...this.store.anchors.values()].filter((row) => row.subjectHandle === subjectHandle));
  }

  private applyOperation(anchor: HumanInformationAnchor, operation: ChainOperation): HumanInformationAnchor {
    if (operation.state === 'UNKNOWN' || operation.unknownAfterBroadcast) {
      return this.patch(anchor, {
        intentId: operation.intentId as ChainWriteIntentId,
        operationId: operation.operationId,
        payloadCommitment: operation.payloadCommitment,
        chainState: 'UNKNOWN',
        unknownAfterBroadcast: true,
        schedule: 'REVIEW',
        transactionId: operation.transactionId,
        receiptId: operation.receiptId,
        blockReference: operation.blockReference,
        confirmations: operation.confirmations,
      });
    }
    const next = this.patch(anchor, {
      intentId: operation.intentId as ChainWriteIntentId,
      operationId: operation.operationId,
      payloadCommitment: operation.payloadCommitment,
      chainState: operation.state,
      schedule: operation.state === 'FINALIZED' ? 'SETTLED' : 'SUBMITTED',
      transactionId: operation.transactionId,
      receiptId: operation.receiptId,
      blockReference: operation.blockReference,
      confirmations: operation.confirmations,
      unknownAfterBroadcast: false,
      finalized: operation.state === 'FINALIZED',
    });
    this.emit('HumanInformationAnchorSubmitted', {
      anchorId: next.anchorId,
      operationId: next.operationId,
      chainState: next.chainState,
    });
    if (next.finalized) {
      this.project(next.anchorId);
    }
    return next;
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
      updatedAt: this.clock.now(),
    });
    this.store.put(next);
    return next;
  }

  private recordReconciliation(input: {
    readonly anchorId: HumanInformationAnchor['anchorId'] | null;
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
      createdAt: this.clock.now(),
      autoFixed: false,
    });
    this.store.rememberReconciliation(record);
    return record;
  }

  private hasFinalizedRevocation(grantId: string): boolean {
    return [...this.store.anchors.values()].some(
      (row) =>
        row.kind === 'CONSENT_REVOCATION' &&
        (row.sourceRecordId === grantId || row.priorConsentCommitment !== null) &&
        this.grantIdFromRevocation(row) === grantId,
    );
  }

  private grantIdFromRevocation(anchor: HumanInformationAnchor): string {
    const intent = anchor.intentId ? this.port.getIntent(anchor.intentId) : undefined;
    const consentId = intent?.schema.fields.consentId;
    return typeof consentId === 'string' ? consentId : anchor.sourceRecordId;
  }

  private emit(eventType: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now() as UtcInstant,
      payload,
    });
  }
}

export function createHumanInformationAnchorCoordinator(
  options: HumanInformationAnchorCoordinatorOptions,
): HumanInformationAnchorCoordinator {
  return new HumanInformationAnchorCoordinator(options);
}

export type { ChainOperationState };
