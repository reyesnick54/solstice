import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { authorizeConfirmMandate, authorizeViewGrowthPlan } from '../../access.ts';
import type { GrowLifecycleService } from '../../grow/service.ts';
import type { InMemoryGrowStore } from '../../grow/store.ts';
import type { GrowExecutionRecord } from '../../grow/types.ts';
import { evaluateOperationalDegradedStates } from './degraded.ts';
import { createGrowControlNotification } from './notifications.ts';
import { InMemoryGrowControlsStore } from './store.ts';
import type {
  DegradedEvaluationInput,
  GrowCashAvailability,
  GrowCloseRequest,
  GrowControlFailure,
  GrowControlsStatusResponse,
  GrowDegradedStateContract,
  GrowMandateChangeRequest,
  GrowPauseControl,
  GrowWithdrawalRequest,
  ResumeRevalidationInput,
} from './types.ts';
import type { GrowCloseMode } from './taxonomy.ts';

export type GrowControlsPorts = {
  readonly clock: Clock;
  readonly grow: GrowLifecycleService;
  readonly store?: InMemoryGrowControlsStore;
  readonly withdrawCash?: (input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly actorId: string;
    readonly sourceAccountId: string;
    readonly destinationAccountId: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly idempotencyKey: string;
  }) => Result<{ readonly journalId: string }, GrowControlFailure>;
  readonly submitClose?: (input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly actorId: string;
    readonly instrumentIds: readonly string[];
    readonly idempotencyKey: string;
  }) => Result<{ readonly executionIds: readonly string[]; readonly positionIds: readonly string[] }, GrowControlFailure>;
  readonly applyMandateChange?: (input: {
    readonly customerId: string;
    readonly subjectId: string;
    readonly actorId: string;
    readonly sourceText: string;
  }) => Result<{ readonly requiresReview: boolean }, GrowControlFailure>;
  readonly cashAvailability?: (customerId: string, subjectId: string) => GrowCashAvailability;
  readonly degradedInput?: (customerId: string, subjectId: string) => Omit<DegradedEvaluationInput, 'now' | 'deploymentPaused'>;
};

function defaultPause(now: UtcInstant): GrowPauseControl {
  return Object.freeze({
    state: 'ACTIVE',
    deploymentPaused: false,
    inFlightExecutionIds: Object.freeze([]),
    inFlightProposalIds: Object.freeze([]),
    blockedReason: null,
    updatedAt: now,
    evidenceRef: null,
  });
}

function inFlightExecutions(growStore: InMemoryGrowStore, customerId: string): readonly GrowExecutionRecord[] {
  return Object.freeze(
    growStore
      .listExecutions(customerId)
      .filter((row) => row.state === 'SUBMITTED' || row.state === 'PARTIALLY_COMPLETED'),
  );
}

function inFlightProposals(growStore: InMemoryGrowStore, subjectId: string): readonly string[] {
  const latest = growStore.latestProposalFor(subjectId);
  if (!latest) return Object.freeze([]);
  if (latest.state === 'APPROVED' || latest.state === 'AWAITING_APPROVAL' || latest.state === 'AWAITING_STEP_UP') {
    return Object.freeze([latest.proposalId]);
  }
  return Object.freeze([]);
}

export class HeliosGrowControlService {
  private readonly clock: Clock;
  private readonly grow: GrowLifecycleService;
  readonly store: InMemoryGrowControlsStore;
  private readonly withdrawCash: NonNullable<GrowControlsPorts['withdrawCash']>;
  private readonly submitClose: NonNullable<GrowControlsPorts['submitClose']>;
  private readonly applyMandateChange: NonNullable<GrowControlsPorts['applyMandateChange']>;
  private readonly cashAvailability: NonNullable<GrowControlsPorts['cashAvailability']>;
  private readonly degradedInput: NonNullable<GrowControlsPorts['degradedInput']>;

  constructor(ports: GrowControlsPorts) {
    this.clock = ports.clock;
    this.grow = ports.grow;
    this.store = ports.store ?? new InMemoryGrowControlsStore();
    this.withdrawCash =
      ports.withdrawCash ??
      (() => err({ code: 'PROVIDER_UNAVAILABLE', message: 'withdrawal port not configured' }));
    this.submitClose =
      ports.submitClose ??
      (() => err({ code: 'CLOSE_NOT_SUPPORTED', message: 'close port not configured' }));
    this.applyMandateChange =
      ports.applyMandateChange ??
      (() => err({ code: 'MANDATE_INVALID', message: 'mandate change port not configured' }));
    this.cashAvailability =
      ports.cashAvailability ??
      (() =>
        Object.freeze({
          settled: { minorUnits: '0', currency: 'USD' },
          reconciled: { minorUnits: '0', currency: 'USD' },
          available: { minorUnits: '0', currency: 'USD' },
          unreserved: { minorUnits: '0', currency: 'USD' },
          reserved: { minorUnits: '0', currency: 'USD' },
          unsettled: { minorUnits: '0', currency: 'USD' },
          deployed: { minorUnits: '0', currency: 'USD' },
        }));
    this.degradedInput =
      ports.degradedInput ??
      (() =>
        Object.freeze({
          marketDataStale: false,
          researchProviderDown: false,
          s3mUnavailable: false,
          executionProviderDown: false,
          providerActionRequired: false,
          reconciliationPending: false,
          reconciliationMismatch: false,
          settlementDelayed: false,
          valuationStale: false,
          capabilityReviewRequired: false,
          regulatoryRestriction: false,
          strategyReviewRequired: false,
          systemMaintenance: false,
        }));
  }

  now(): UtcInstant {
    return this.clock.now();
  }

  isNewDeploymentBlocked(customerId: string, subjectId: string): boolean {
    const pause = this.store.getPause(customerId, subjectId) ?? defaultPause(this.now());
    if (pause.deploymentPaused) return true;
    const degraded = this.evaluateDegraded(customerId, subjectId);
    return degraded.some((row) => row.newDeploymentPaused);
  }

  requestPause(
    actor: unknown,
    customerId: string,
    subjectId: string,
  ): Result<GrowPauseControl, GrowControlFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const current = this.store.getPause(customerId, subjectId) ?? defaultPause(this.now());
    if (current.deploymentPaused && current.state !== 'PAUSE_REQUESTED') {
      return err({ code: 'ALREADY_PAUSED', message: 'Grow deployment is already paused' });
    }
    const inFlightExec = inFlightExecutions(this.grow.store, customerId);
    const inFlightProp = inFlightProposals(this.grow.store, subjectId);
    const planPaused = this.grow.pausePlan(actor, subjectId);
    if (!planPaused.ok && planPaused.error.code !== 'PLAN_NOT_FOUND') {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: planPaused.error.message });
    }
    const now = this.now();
    const nextState =
      inFlightExec.length > 0 || inFlightProp.length > 0 ? ('PAUSE_PARTIAL' as const) : ('PAUSED' as const);
    const control: GrowPauseControl = Object.freeze({
      state: nextState,
      deploymentPaused: true,
      inFlightExecutionIds: Object.freeze(inFlightExec.map((row) => row.executionId)),
      inFlightProposalIds: inFlightProp,
      blockedReason: null,
      updatedAt: now,
      evidenceRef: `pause_${randomUUID()}`,
    });
    this.store.putPause(control, customerId, subjectId);
    this.store.appendNotification(
      createGrowControlNotification({
        kind: 'PAUSE_CONFIRMED',
        customerId,
        subjectId,
        message:
          nextState === 'PAUSE_PARTIAL'
            ? 'Grow pause confirmed. In-flight operations continue; new deployment is blocked.'
            : 'Grow pause confirmed. New deployment is blocked.',
        now,
        evidenceRef: control.evidenceRef,
      }),
    );
    return ok(control);
  }

  resume(
    actor: unknown,
    customerId: string,
    subjectId: string,
    revalidation: ResumeRevalidationInput,
  ): Result<GrowPauseControl, GrowControlFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const current = this.store.getPause(customerId, subjectId);
    if (!current?.deploymentPaused) {
      return err({ code: 'NOT_PAUSED', message: 'Grow is not paused' });
    }
    const blockers: string[] = [];
    if (!revalidation.mandateActive) blockers.push('mandate inactive');
    if (revalidation.accountStatus !== 'ACTIVE') blockers.push('account restricted');
    if (!revalidation.providerCapable) blockers.push('provider unavailable');
    if (!revalidation.strategyEligible) blockers.push('strategy ineligible');
    if (!revalidation.systemCapable) blockers.push('system capability disabled');
    if (!revalidation.jurisdictionPermitted) blockers.push('jurisdiction blocked');
    if (!revalidation.complianceClear) blockers.push('compliance blocked');
    if (!revalidation.workOrderActive) blockers.push('work order inactive');
    if (blockers.length > 0) {
      const blocked: GrowPauseControl = Object.freeze({
        ...current,
        state: 'BLOCKED',
        blockedReason: blockers.join('; '),
        updatedAt: this.now(),
      });
      this.store.putPause(blocked, customerId, subjectId);
      return err({ code: 'RESUME_BLOCKED', message: blocked.blockedReason ?? 'resume blocked' });
    }
    const resumed = this.grow.resumePlan(actor, subjectId);
    if (!resumed.ok && resumed.error.code !== 'PLAN_NOT_FOUND') {
      return err({ code: 'RESUME_BLOCKED', message: resumed.error.message });
    }
    const now = this.now();
    const control: GrowPauseControl = Object.freeze({
      state: 'ACTIVE',
      deploymentPaused: false,
      inFlightExecutionIds: Object.freeze([]),
      inFlightProposalIds: Object.freeze([]),
      blockedReason: null,
      updatedAt: now,
      evidenceRef: `resume_${randomUUID()}`,
    });
    this.store.putPause(control, customerId, subjectId);
    this.store.appendNotification(
      createGrowControlNotification({
        kind: 'RESUME_CONFIRMED',
        customerId,
        subjectId,
        message: 'Grow resumed after authority revalidation.',
        now,
        evidenceRef: control.evidenceRef,
      }),
    );
    return ok(control);
  }

  finalizePauseIfInflightComplete(customerId: string, subjectId: string): GrowPauseControl | null {
    const current = this.store.getPause(customerId, subjectId);
    if (!current || current.state !== 'PAUSE_PARTIAL') {
      return null;
    }
    const inFlightExec = inFlightExecutions(this.grow.store, customerId);
    const inFlightProp = inFlightProposals(this.grow.store, subjectId);
    if (inFlightExec.length > 0 || inFlightProp.length > 0) {
      return current;
    }
    const next: GrowPauseControl = Object.freeze({
      ...current,
      state: 'PAUSED',
      inFlightExecutionIds: Object.freeze([]),
      inFlightProposalIds: Object.freeze([]),
      updatedAt: this.now(),
    });
    this.store.putPause(next, customerId, subjectId);
    return next;
  }

  requestClose(
    actor: unknown,
    input: {
      readonly customerId: string;
      readonly subjectId: string;
      readonly actorId: string;
      readonly mode: GrowCloseMode;
      readonly instrumentIds?: readonly string[];
      readonly idempotencyKey: string;
    },
  ): Result<GrowCloseRequest, GrowControlFailure> {
    const access = authorizeConfirmMandate(actor, input.subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const existing = this.store.closeByIdempotency(input.customerId, input.idempotencyKey);
    if (existing) {
      if (existing.subjectId !== input.subjectId) {
        return err({ code: 'IDEMPOTENCY_CONFLICT', message: 'idempotency key bound to different subject' });
      }
      return ok(existing);
    }
    const instrumentIds =
      input.mode === 'CLOSE_ALL_ELIGIBLE'
        ? Object.freeze([] as readonly string[])
        : Object.freeze([...(input.instrumentIds ?? [])]);
    if (input.mode === 'CLOSE_SELECTED' && instrumentIds.length === 0) {
      return err({ code: 'POSITION_NOT_FOUND', message: 'no instruments selected for close' });
    }
    const now = this.now();
    const closeRequestId = `gcr_${randomUUID()}`;
    let request: GrowCloseRequest = Object.freeze({
      closeRequestId,
      customerId: input.customerId,
      subjectId: input.subjectId,
      mode: input.mode,
      instrumentIds,
      status: 'REQUESTED',
      positionIds: Object.freeze([]),
      executionIds: Object.freeze([]),
      idempotencyKey: input.idempotencyKey,
      requestedAt: now,
      updatedAt: now,
      failureCode: null,
      evidenceRef: `close_${randomUUID()}`,
    });
    this.store.putCloseRequest(request);
    this.store.appendNotification(
      createGrowControlNotification({
        kind: 'CLOSE_REQUESTED',
        customerId: input.customerId,
        subjectId: input.subjectId,
        message: 'Position close requested. Settlement and reconciliation follow normal controls.',
        now,
        evidenceRef: request.evidenceRef,
      }),
    );
    const submitted = this.submitClose({
      customerId: input.customerId,
      subjectId: input.subjectId,
      actorId: input.actorId,
      instrumentIds,
      idempotencyKey: input.idempotencyKey,
    });
    if (!submitted.ok) {
      request = Object.freeze({
        ...request,
        status: 'FAILED',
        failureCode: submitted.error.code,
        updatedAt: this.now(),
      });
      this.store.putCloseRequest(request);
      return err(submitted.error);
    }
    request = Object.freeze({
      ...request,
      status: 'SUBMITTED',
      positionIds: submitted.value.positionIds,
      executionIds: submitted.value.executionIds,
      updatedAt: this.now(),
    });
    this.store.putCloseRequest(request);
    return ok(request);
  }

  requestWithdrawal(
    actor: unknown,
    input: {
      readonly customerId: string;
      readonly subjectId: string;
      readonly actorId: string;
      readonly amountMinorUnits: string;
      readonly currency: string;
      readonly destinationAccountId: string;
      readonly sourceAccountId: string;
      readonly idempotencyKey: string;
    },
  ): Result<GrowWithdrawalRequest, GrowControlFailure> {
    const access = authorizeConfirmMandate(actor, input.subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const existing = this.store.withdrawalByIdempotency(input.customerId, input.idempotencyKey);
    if (existing) {
      if (existing.subjectId !== input.subjectId) {
        return err({ code: 'IDEMPOTENCY_CONFLICT', message: 'idempotency key bound to different subject' });
      }
      return ok(existing);
    }
    const cash = this.cashAvailability(input.customerId, input.subjectId);
    const requested = BigInt(input.amountMinorUnits);
    const available = BigInt(cash.unreserved.minorUnits);
    const reserved = BigInt(cash.reserved.minorUnits);
    if (requested <= 0n) {
      return err({ code: 'INSUFFICIENT_AVAILABLE_CASH', message: 'amount must be positive' });
    }
    if (requested > available) {
      if (requested <= available + reserved) {
        return err({ code: 'RESERVED_CASH', message: 'requested amount includes reserved cash' });
      }
      return err({ code: 'INSUFFICIENT_AVAILABLE_CASH', message: 'insufficient settled unreserved cash' });
    }
    const pending = this.store
      .listWithdrawals(input.customerId, input.subjectId)
      .filter((row) => row.status === 'SUBMITTED' || row.status === 'VALIDATING' || row.status === 'AUTHORIZED');
    if (pending.some((row) => row.amount.minorUnits === input.amountMinorUnits)) {
      return err({ code: 'WITHDRAWAL_IN_FLIGHT', message: 'duplicate withdrawal in flight' });
    }
    const now = this.now();
    const withdrawalId = `gwd_${randomUUID()}`;
    let request: GrowWithdrawalRequest = Object.freeze({
      withdrawalId,
      customerId: input.customerId,
      subjectId: input.subjectId,
      amount: Object.freeze({ minorUnits: input.amountMinorUnits, currency: input.currency }),
      destinationAccountId: input.destinationAccountId,
      sourceAccountId: input.sourceAccountId,
      status: 'VALIDATING',
      idempotencyKey: input.idempotencyKey,
      requestedAt: now,
      updatedAt: now,
      journalId: null,
      failureCode: null,
      evidenceRef: `withdraw_${randomUUID()}`,
    });
    this.store.putWithdrawal(request);
    this.store.appendNotification(
      createGrowControlNotification({
        kind: 'WITHDRAWAL_SUBMITTED',
        customerId: input.customerId,
        subjectId: input.subjectId,
        message: 'Withdrawal submitted. Completion requires settlement evidence.',
        now,
        evidenceRef: request.evidenceRef,
      }),
    );
    const result = this.withdrawCash({
      customerId: input.customerId,
      subjectId: input.subjectId,
      actorId: input.actorId,
      sourceAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.ok) {
      request = Object.freeze({
        ...request,
        status: 'FAILED',
        failureCode: result.error.code,
        updatedAt: this.now(),
      });
      this.store.putWithdrawal(request);
      return err(result.error);
    }
    request = Object.freeze({
      ...request,
      status: 'COMPLETED',
      journalId: result.value.journalId,
      updatedAt: this.now(),
    });
    this.store.putWithdrawal(request);
    this.store.appendNotification(
      createGrowControlNotification({
        kind: 'WITHDRAWAL_COMPLETED',
        customerId: input.customerId,
        subjectId: input.subjectId,
        message: 'Withdrawal completed with ledger evidence.',
        now,
        evidenceRef: request.evidenceRef,
        material: true,
      }),
    );
    return ok(request);
  }

  changeMandate(
    actor: unknown,
    input: {
      readonly customerId: string;
      readonly subjectId: string;
      readonly actorId: string;
      readonly sourceText: string;
    },
  ): Result<GrowMandateChangeRequest, GrowControlFailure> {
    const access = authorizeConfirmMandate(actor, input.subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    const applied = this.applyMandateChange(input);
    if (!applied.ok) {
      return err(applied.error);
    }
    const now = this.now();
    const requiresReview = applied.value.requiresReview;
    const change: GrowMandateChangeRequest = Object.freeze({
      changeId: `gmc_${randomUUID()}`,
      customerId: input.customerId,
      subjectId: input.subjectId,
      sourceText: input.sourceText,
      appliedAt: now,
      requiresReview,
      autoPauseDeployment: requiresReview,
      evidenceRef: `mandate_${randomUUID()}`,
    });
    this.store.putMandateChange(change);
    if (requiresReview) {
      void this.requestPause(actor, input.customerId, input.subjectId);
    }
    this.store.appendNotification(
      createGrowControlNotification({
        kind: 'MANDATE_CHANGE_APPLIED',
        customerId: input.customerId,
        subjectId: input.subjectId,
        message: requiresReview
          ? 'Mandate updated. Future deployment paused pending review.'
          : 'Mandate updated for future Grow boundaries.',
        now,
        evidenceRef: change.evidenceRef,
      }),
    );
    return ok(change);
  }

  evaluateDegraded(customerId: string, subjectId: string): readonly GrowDegradedStateContract[] {
    const pause = this.store.getPause(customerId, subjectId);
    const input: DegradedEvaluationInput = Object.freeze({
      now: this.now(),
      deploymentPaused: pause?.deploymentPaused ?? false,
      ...this.degradedInput(customerId, subjectId),
    });
    return evaluateOperationalDegradedStates(input);
  }

  status(
    actor: unknown,
    customerId: string,
    subjectId: string,
  ): Result<GrowControlsStatusResponse, GrowControlFailure> {
    const access = authorizeViewGrowthPlan(actor, subjectId);
    if (!access.ok) {
      return err({ code: 'ACTOR_UNAUTHORIZED', message: access.error.message });
    }
    void this.finalizePauseIfInflightComplete(customerId, subjectId);
    const pause = this.store.getPause(customerId, subjectId) ?? defaultPause(this.now());
    const degradedStates = this.evaluateDegraded(customerId, subjectId);
    const pendingCloseRequests = this.store
      .listCloseRequests(customerId, subjectId)
      .filter((row) => row.status !== 'COMPLETED' && row.status !== 'FAILED');
    const pendingWithdrawals = this.store
      .listWithdrawals(customerId, subjectId)
      .filter((row) => row.status !== 'COMPLETED' && row.status !== 'FAILED' && row.status !== 'REJECTED');
    return ok(
      Object.freeze({
        schema: 'sunrey.consumer.grow.controls.status.v1',
        customerId,
        subjectId,
        pause,
        degradedStates,
        pendingCloseRequests,
        pendingWithdrawals,
        recentNotifications: this.store.listNotifications(customerId, subjectId),
        serverOwned: true as const,
      }),
    );
  }

  snapshot(): ReturnType<InMemoryGrowControlsStore['snapshot']> {
    return this.store.snapshot();
  }

  loadSnapshot(snapshot: ReturnType<InMemoryGrowControlsStore['snapshot']>): void {
    this.store.loadState(snapshot);
  }
}
