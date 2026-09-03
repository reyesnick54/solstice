import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { EconomicActivity } from '../../../personal-economic-graph/src/store.ts';
import { rejectAiDirectExecution } from './ai-boundary.ts';
import { createAuditEvent, SubscriptionAuditLog } from './audit.ts';
import { authorizeAction } from './authorization.ts';
import { detectRecurringObligations } from './detection.ts';
import { detectDuplicateOverlaps } from './duplication.ts';
import { proposeAction } from './execution.ts';
import type { SubscriptionActionId } from './ids.ts';
import type {
  RecurringObligation,
  SavingsOpportunity,
  SubscriptionActionProposal,
  SubscriptionIntelligenceSnapshot,
  UsageSignal,
  VerifiedSavings,
} from './models.ts';
import { applyPriceChanges } from './price-change.ts';
import {
  resolveProvider,
  SimulationSubscriptionActionProvider,
  type SubscriptionActionProvider,
} from './provider.ts';
import { buildSavingsOpportunities } from './savings.ts';
import { SubscriptionIntelligenceStore } from './store.ts';
import { attributeVerifiedSavings } from './attribution.ts';
import { transitionActionState } from './authorization.ts';
import { verifyProviderResult } from './verification.ts';

export type SubscriptionIntelligenceFailure = {
  readonly code:
    | 'OPPORTUNITY_NOT_FOUND'
    | 'ACTION_NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'AI_CANNOT_EXECUTE'
    | 'ADVISORY_ONLY'
    | 'AUTHORIZATION_FAILED'
    | 'EXECUTION_FAILED'
    | 'NOT_AUTHORIZED';
  readonly message: string;
};

export class SubscriptionIntelligenceService {
  private readonly clock: Clock;
  readonly store: SubscriptionIntelligenceStore;
  readonly audit: SubscriptionAuditLog;
  private readonly providers: readonly SubscriptionActionProvider[];

  constructor(input: {
    readonly clock: Clock;
    readonly store?: SubscriptionIntelligenceStore;
    readonly audit?: SubscriptionAuditLog;
    readonly providers?: readonly SubscriptionActionProvider[];
  }) {
    this.clock = input.clock;
    this.store = input.store ?? new SubscriptionIntelligenceStore();
    this.audit = input.audit ?? new SubscriptionAuditLog();
    this.providers = input.providers ?? [new SimulationSubscriptionActionProvider()];
  }

  analyze(input: {
    readonly subjectId: string;
    readonly activities: readonly EconomicActivity[];
    readonly usageSignals?: readonly UsageSignal[];
  }): SubscriptionIntelligenceSnapshot {
    const now = this.clock.now();
    const detected = detectRecurringObligations({
      userId: input.subjectId,
      activities: input.activities,
      now,
    });
    const obligations = applyPriceChanges(detected, input.activities, now);
    const duplicates = detectDuplicateOverlaps(obligations);
    const opportunities = buildSavingsOpportunities({
      obligations,
      duplicates,
      ...(input.usageSignals !== undefined ? { usageSignals: input.usageSignals } : {}),
    });

    this.store.putObligations(input.subjectId, obligations);
    this.store.putOpportunities(input.subjectId, opportunities);

    for (const obligation of obligations) {
      this.audit.append(
        createAuditEvent({
          eventKind: 'recurring_detected',
          subjectId: input.subjectId,
          occurredAt: now,
          refs: Object.freeze([obligation.id]),
          detail: `Detected ${obligation.merchant.normalizedMerchant} ${obligation.frequency}`,
        }),
      );
      this.audit.append(
        createAuditEvent({
          eventKind: 'subscription_classified',
          subjectId: input.subjectId,
          occurredAt: now,
          refs: Object.freeze([obligation.id]),
          detail: `Classified as ${obligation.category}`,
        }),
      );
      if (obligation.priceChange) {
        this.audit.append(
          createAuditEvent({
            eventKind: 'price_change_detected',
            subjectId: input.subjectId,
            occurredAt: now,
            refs: Object.freeze([obligation.id]),
            detail: `Price change ${obligation.priceChange.percentageChangeBps} bps`,
          }),
        );
      }
    }

    for (const opportunity of opportunities) {
      this.audit.append(
        createAuditEvent({
          eventKind: 'savings_opportunity_created',
          subjectId: input.subjectId,
          occurredAt: now,
          refs: Object.freeze([opportunity.opportunityId, opportunity.recurringObligationId]),
          detail: opportunity.opportunityType,
        }),
      );
    }

    const priceIncreases = obligations.filter(
      (item) => item.priceChange && item.priceChange.percentageChangeBps > 0,
    );
    const potential = obligations.filter((item) => item.status === 'POTENTIAL');

    return Object.freeze({
      subjectId: input.subjectId,
      generatedAt: now,
      obligations: Object.freeze(obligations.filter((item) => item.status === 'ACTIVE')),
      potentialSubscriptions: Object.freeze(potential),
      priceIncreases: Object.freeze(priceIncreases),
      duplicates: Object.freeze(duplicates),
      opportunities: Object.freeze(opportunities),
      actions: this.store.getActionsForUser(input.subjectId),
      verifiedSavings: this.store.getVerifiedSavings(input.subjectId),
    });
  }

  proposeAction(input: {
    readonly subjectId: string;
    readonly opportunityId: string;
    readonly idempotencyKey: string;
    readonly actorKind: string;
  }): Result<SubscriptionActionProposal, SubscriptionIntelligenceFailure> {
    const violation = rejectAiDirectExecution(input.actorKind, {
      actionId: 'pending' as SubscriptionActionId,
      state: 'PROPOSED',
    } as SubscriptionActionProposal);
    if (violation && input.actorKind !== 'CUSTOMER') {
      return err({ code: 'AI_CANNOT_EXECUTE', message: violation.message });
    }

    const opportunity = this.store.getOpportunity(input.subjectId, input.opportunityId);
    if (!opportunity) {
      return err({ code: 'OPPORTUNITY_NOT_FOUND', message: 'savings opportunity not found' });
    }

    const obligation = this.store
      .getObligations(input.subjectId)
      .find((item) => item.id === opportunity.recurringObligationId);
    if (!obligation) {
      return err({ code: 'OPPORTUNITY_NOT_FOUND', message: 'linked obligation not found' });
    }

    const existing = this.store
      .getActionsForUser(input.subjectId)
      .find((item) => item.opportunityId === opportunity.opportunityId && item.actionType === opportunity.recommendedAction);

    const proposed = proposeAction({
      opportunity,
      userId: input.subjectId,
      obligationCapabilities: obligation.actionCapabilities,
      idempotencyKey: input.idempotencyKey,
      now: this.clock.now(),
      ...(existing !== undefined ? { existing } : {}),
    });

    if ('code' in proposed) {
      return ok(proposed.action);
    }

    this.store.putAction(proposed);
    this.audit.append(
      createAuditEvent({
        eventKind: 'action_proposed',
        subjectId: input.subjectId,
        occurredAt: this.clock.now(),
        refs: Object.freeze([proposed.actionId, opportunity.opportunityId]),
        detail: proposed.actionType,
      }),
    );
    return ok(proposed);
  }

  authorizeAction(input: {
    readonly subjectId: string;
    readonly actionId: SubscriptionActionId;
    readonly actorId: string;
    readonly actorKind: string;
    readonly stepUpSatisfied: boolean;
  }): Result<SubscriptionActionProposal, SubscriptionIntelligenceFailure> {
    const violation = rejectAiDirectExecution(input.actorKind, {
      actionId: input.actionId,
      state: 'USER_REVIEW',
    } as SubscriptionActionProposal);
    if (violation) {
      return err({ code: 'AI_CANNOT_EXECUTE', message: violation.message });
    }

    const action = this.store.getAction(input.actionId);
    if (!action || action.userId !== input.subjectId) {
      return err({ code: 'ACTION_NOT_FOUND', message: 'action not found' });
    }

    const result = authorizeAction({
      action,
      userId: input.subjectId,
      actorId: input.actorId,
      now: this.clock.now(),
      stepUpSatisfied: input.stepUpSatisfied,
    });

    if ('code' in result) {
      return err({ code: 'AUTHORIZATION_FAILED', message: result.message });
    }

    this.store.putApproval(result.approval);
    this.store.putAction(result.action);
    this.audit.append(
      createAuditEvent({
        eventKind: 'action_authorized',
        subjectId: input.subjectId,
        occurredAt: this.clock.now(),
        refs: Object.freeze([result.action.actionId, result.approval.approvalId]),
        detail: result.action.actionType,
      }),
    );
    return ok(result.action);
  }

  async executeAction(input: {
    readonly subjectId: string;
    readonly actionId: SubscriptionActionId;
    readonly actorKind: string;
    readonly merchantNormalized: string;
  }): Promise<Result<{ readonly action: SubscriptionActionProposal; readonly verifiedSavings: VerifiedSavings | null }, SubscriptionIntelligenceFailure>> {
    const violation = rejectAiDirectExecution(input.actorKind, {
      actionId: input.actionId,
      state: 'AUTHORIZED',
    } as SubscriptionActionProposal);
    if (violation) {
      return err({ code: 'AI_CANNOT_EXECUTE', message: violation.message });
    }

    const action = this.store.getAction(input.actionId);
    if (!action || action.userId !== input.subjectId) {
      return err({ code: 'ACTION_NOT_FOUND', message: 'action not found' });
    }
    if (action.state !== 'AUTHORIZED') {
      return err({ code: 'NOT_AUTHORIZED', message: 'action must be authorized before execution' });
    }

    const executing = transitionActionState(action, 'EXECUTING', this.clock.now());
    if ('code' in executing) {
      return err({ code: 'EXECUTION_FAILED', message: executing.message });
    }
    this.store.putAction(executing);
    this.audit.append(
      createAuditEvent({
        eventKind: 'action_started',
        subjectId: input.subjectId,
        occurredAt: this.clock.now(),
        refs: Object.freeze([action.actionId]),
        detail: action.actionType,
      }),
    );

    const provider = resolveProvider(this.providers, input.merchantNormalized);
    const request = {
      actionId: action.actionId,
      obligationId: action.obligationId,
      merchantNormalized: input.merchantNormalized,
      actionType: action.actionType,
      idempotencyKey: action.idempotencyKey,
    };

    const providerResult =
      action.actionType === 'RENEGOTIATE'
        ? await provider.renegotiateBill(request)
        : action.actionType === 'CANCEL'
          ? await provider.cancelSubscription(request)
          : ({
              outcome: 'FAILED',
              providerId: null,
              code: 'ACTION_NOT_AVAILABLE',
              message: 'Action type not supported by provider',
            } as const);

    const now = this.clock.now();
    const { action: verified, verification } = verifyProviderResult(executing, providerResult, now);
    this.store.putAction(verified);

    if (verification.verified) {
      this.audit.append(
        createAuditEvent({
          eventKind: 'action_completed',
          subjectId: input.subjectId,
          occurredAt: now,
          refs: Object.freeze([verified.actionId, verification.providerEvidenceRef]),
          detail: 'Action confirmed with provider evidence',
        }),
      );
    } else if (verified.state === 'FAILED') {
      this.audit.append(
        createAuditEvent({
          eventKind: 'action_failed',
          subjectId: input.subjectId,
          occurredAt: now,
          refs: Object.freeze([verified.actionId]),
          detail: verification.failureReason,
        }),
      );
      return err({ code: 'EXECUTION_FAILED', message: verification.failureReason });
    }

    const opportunity = this.store
      .getOpportunities(input.subjectId)
      .find((item) => item.opportunityId === action.opportunityId);
    const obligation = this.store
      .getObligations(input.subjectId)
      .find((item) => item.id === action.obligationId);

    let verifiedSavings: VerifiedSavings | null = null;
    if (verification.verified && opportunity && obligation) {
      verifiedSavings = attributeVerifiedSavings({
        obligation,
        opportunity,
        action: verified,
        verifiedAt: now,
      });
      if (verifiedSavings) {
        this.store.putVerifiedSavings(input.subjectId, verifiedSavings);
        this.audit.append(
          createAuditEvent({
            eventKind: 'savings_verified',
            subjectId: input.subjectId,
            occurredAt: now,
            refs: Object.freeze([verifiedSavings.actionId, verifiedSavings.providerEvidenceRef]),
            detail: `Verified monthly savings ${verifiedSavings.monthlyAmount.minorUnits}`,
          }),
        );
      }
    }

    return ok({ action: verified, verifiedSavings });
  }

  getSnapshot(subjectId: string): SubscriptionIntelligenceSnapshot {
    const obligations = this.store.getObligations(subjectId);
    return Object.freeze({
      subjectId,
      generatedAt: this.clock.now(),
      obligations: Object.freeze(obligations.filter((item) => item.status === 'ACTIVE')),
      potentialSubscriptions: Object.freeze(obligations.filter((item) => item.status === 'POTENTIAL')),
      priceIncreases: Object.freeze(obligations.filter((item) => item.priceChange && item.priceChange.percentageChangeBps > 0)),
      duplicates: Object.freeze(detectDuplicateOverlaps(obligations)),
      opportunities: this.store.getOpportunities(subjectId),
      actions: this.store.getActionsForUser(subjectId),
      verifiedSavings: this.store.getVerifiedSavings(subjectId),
    });
  }
}

export type { RecurringObligation, SavingsOpportunity, SubscriptionActionProposal, VerifiedSavings };
