import type { Clock } from '../../../../config/src/clock.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { MetaAllocatorRecommendation } from '../meta-allocator/types.ts';
import { envelopeIdForWorkOrder } from './ids.ts';
import { sealDecisionValidityEnvelope } from './evidence.ts';
import { evaluateAllComponents } from './validators.ts';
import {
  aggregateEnvelopeStatus,
  envelopeExpired,
  shortestMaterialValidUntil,
} from './validity-window.ts';
import { InMemoryDecisionValidityStore } from './store.ts';
import {
  DECISION_VALIDITY_POLICY_VERSION,
  type EnvelopeFailureAction,
  type EnvelopeReasonCode,
} from './taxonomy.ts';
import type {
  DecisionValidityEnvelope,
  DecisionValidityEnvelopeId,
  EnvelopeEvaluationContext,
  EnvelopeEvaluationPorts,
  EnvelopeEvaluationResult,
  ProposalEligibilityResult,
} from './types.ts';

export type DecisionValidityFailure = {
  readonly code: 'ENVELOPE_NOT_FOUND' | 'CUSTOMER_MISMATCH' | 'ENVELOPE_ALREADY_EXISTS';
  readonly message: string;
};

export const HELIOS_H21_DECISION_VALIDITY_ENVELOPE = 'HELIOS_H21_DECISION_VALIDITY_ENVELOPE' as const;

function failureActionForReasons(reasonCodes: readonly EnvelopeReasonCode[]): EnvelopeFailureAction {
  if (reasonCodes.some((c) => c === 'EVIDENCE_STALE' || c === 'RESEARCH_EXPIRED')) {
    return 'RESEARCH_AGAIN';
  }
  if (
    reasonCodes.some((c) =>
      c.startsWith('STRATEGY_CAPSULE') || c === 'MODEL_VERSION_UNQUALIFIED',
    )
  ) {
    return 'REQUALIFY';
  }
  if (
    reasonCodes.some((c) =>
      c === 'VENUE_CLOSED' || c === 'PROVIDER_ROUTE_UNAVAILABLE' || c === 'CAPITAL_UNAVAILABLE',
    )
  ) {
    return 'WAIT';
  }
  if (reasonCodes.some((c) => c === 'RISK_REFUSED' || c === 'MANDATE_REVOKED')) {
    return 'ABANDON';
  }
  if (reasonCodes.some((c) => c === 'TRANSACTION_COST_DESTROYS_EDGE')) {
    return 'NO_ACTION';
  }
  return 'REQUALIFY';
}

function collectReasonCodes(checks: readonly DecisionValidityEnvelope['componentChecks']): readonly EnvelopeReasonCode[] {
  const codes = new Set<EnvelopeReasonCode>();
  for (const check of checks) {
    for (const code of check.reasonCodes) {
      if (code !== 'OK') {
        codes.add(code);
      }
    }
  }
  return Object.freeze([...codes]);
}

/**
 * Deterministic Decision-Validity Envelope coordinator.
 * Validates current eligibility across existing authorities without granting financial effect.
 */
export class DecisionValidityEnvelopeService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly ports: EnvelopeEvaluationPorts;
  readonly store: InMemoryDecisionValidityStore;
  private revisionCounter = new Map<string, number>();

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly ports: EnvelopeEvaluationPorts;
    readonly store?: InMemoryDecisionValidityStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.ports = input.ports;
    this.store = input.store ?? new InMemoryDecisionValidityStore();
  }

  createEnvelope(
    ctx: EnvelopeEvaluationContext,
    baselineTerms: QualificationTermsSnapshot | null = null,
  ): EnvelopeEvaluationResult {
    const now = ctx.now;
    const revision = this.nextRevision(ctx.candidate.candidateId);
    const checks = evaluateAllComponents(ctx, this.ports, baselineTerms);
    const validUntil = shortestMaterialValidUntil(checks);
    const overallStatus = aggregateEnvelopeStatus(checks, validUntil, now);
    const reasonCodes = collectReasonCodes(checks);
    const failureAction =
      overallStatus === 'VALID' || overallStatus === 'DEGRADED'
        ? null
        : failureActionForReasons(reasonCodes);

    const envelope = this.buildEnvelope({
      ctx,
      checks,
      validUntil,
      overallStatus,
      reasonCodes,
      failureAction,
      revision,
      supersedesEnvelopeId: null,
    });

    this.store.put(envelope);
    sealDecisionValidityEnvelope(this.evidence, envelope);

    return Object.freeze({
      envelope,
      proposalEligible: overallStatus === 'VALID',
      failureAction,
      grantsFinancialEffect: false as const,
    });
  }

  revalidateEnvelope(
    envelopeId: DecisionValidityEnvelopeId,
    ctx: EnvelopeEvaluationContext,
    baselineTerms: QualificationTermsSnapshot | null = null,
  ): Result<EnvelopeEvaluationResult, DecisionValidityFailure> {
    const existing = this.store.get(envelopeId);
    if (!existing) {
      return err({ code: 'ENVELOPE_NOT_FOUND', message: `envelope ${envelopeId} not found` });
    }
    if (existing.customerId !== ctx.candidate.customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'envelope customer mismatch' });
    }

    const revalidationCtx: EnvelopeEvaluationContext = Object.freeze({
      ...ctx,
      afterRestart: ctx.afterRestart ?? false,
    });
    const checks = evaluateAllComponents(revalidationCtx, this.ports, baselineTerms);
    const validUntil = shortestMaterialValidUntil(checks);
    let overallStatus = aggregateEnvelopeStatus(checks, validUntil, ctx.now);
    const reasonCodes = new Set<EnvelopeReasonCode>(collectReasonCodes(checks));

    if (revalidationCtx.afterRestart) {
      reasonCodes.add('RESTART_REVALIDATION');
      if (overallStatus === 'VALID') {
        overallStatus = aggregateEnvelopeStatus(checks, validUntil, ctx.now);
      }
    }

    const failureAction =
      overallStatus === 'VALID' ? null : failureActionForReasons([...reasonCodes]);

    const revision = this.nextRevision(ctx.candidate.candidateId);
    const envelope = this.buildEnvelope({
      ctx: revalidationCtx,
      checks,
      validUntil,
      overallStatus,
      reasonCodes: Object.freeze([...reasonCodes]),
      failureAction,
      revision,
      supersedesEnvelopeId: existing.envelopeId,
    });

    this.store.put(envelope);
    sealDecisionValidityEnvelope(this.evidence, envelope);

    return ok(
      Object.freeze({
        envelope,
        proposalEligible: overallStatus === 'VALID',
        failureAction,
        grantsFinancialEffect: false as const,
      }),
    );
  }

  /**
   * Synchronous current-state validation immediately before proposal/action authorization.
   * Catches race conditions such as competing reservations consuming cash.
   */
  assertProposalEligibility(
    envelopeId: DecisionValidityEnvelopeId,
    ctx: EnvelopeEvaluationContext,
    baselineTerms: QualificationTermsSnapshot | null = null,
  ): ProposalEligibilityResult {
    const existing = this.store.get(envelopeId);
    if (!existing) {
      const failed = this.createEnvelope(ctx, baselineTerms);
      return Object.freeze({
        eligible: false,
        envelope: failed.envelope,
        failureAction: failed.failureAction ?? 'REQUALIFY',
        reasonCodes: failed.envelope.reasonCodes,
      });
    }

    if (existing.customerId !== ctx.candidate.customerId) {
      return Object.freeze({
        eligible: false,
        envelope: existing,
        failureAction: 'ABANDON',
        reasonCodes: Object.freeze(['CUSTOMER_MISMATCH']),
      });
    }

    if (envelopeExpired(existing.validUntil, ctx.now)) {
      const revalidated = this.revalidateEnvelope(envelopeId, ctx, baselineTerms);
      if (!revalidated.ok) {
        return Object.freeze({
          eligible: false,
          envelope: existing,
          failureAction: 'REQUALIFY',
          reasonCodes: Object.freeze(['ENVELOPE_EXPIRED']),
        });
      }
      return this.resultFromEvaluation(revalidated.value);
    }

    const checks = evaluateAllComponents(ctx, this.ports, baselineTerms);
    const validUntil = shortestMaterialValidUntil(checks);
    const overallStatus = aggregateEnvelopeStatus(checks, validUntil, ctx.now);
    const reasonCodes = collectReasonCodes(checks);

    const envelope = Object.freeze({
      ...existing,
      evaluatedAt: ctx.now,
      validUntil,
      componentChecks: checks,
      overallStatus,
      reasonCodes,
      failureAction:
        overallStatus === 'VALID' ? null : failureActionForReasons(reasonCodes),
      latencyMarkers: Object.freeze({
        ...existing.latencyMarkers,
        proposalReadyAt: overallStatus === 'VALID' ? ctx.now : null,
      }),
    });

    return this.resultFromEvaluation({
      envelope,
      proposalEligible: overallStatus === 'VALID',
      failureAction: envelope.failureAction,
      grantsFinancialEffect: false,
    });
  }

  afterRestart(envelopeId: DecisionValidityEnvelopeId, ctx: EnvelopeEvaluationContext): Result<
    EnvelopeEvaluationResult,
    DecisionValidityFailure
  > {
    return this.revalidateEnvelope(envelopeId, { ...ctx, afterRestart: true });
  }

  snapshot() {
    return this.store.snapshot();
  }

  restore(snapshot: ReturnType<InMemoryDecisionValidityStore['snapshot']>): void {
    this.store.restore(snapshot);
    for (const envelope of snapshot.envelopes) {
      this.revisionCounter.set(envelope.candidateId, envelope.revision);
    }
  }

  private resultFromEvaluation(result: EnvelopeEvaluationResult): ProposalEligibilityResult {
    if (result.proposalEligible) {
      return Object.freeze({ eligible: true, envelope: result.envelope });
    }
    return Object.freeze({
      eligible: false,
      envelope: result.envelope,
      failureAction: result.failureAction ?? 'REQUALIFY',
      reasonCodes: result.envelope.reasonCodes,
    });
  }

  private nextRevision(candidateId: string): number {
    const current = this.revisionCounter.get(candidateId) ?? 0;
    const next = current + 1;
    this.revisionCounter.set(candidateId, next);
    return next;
  }

  private buildEnvelope(input: {
    readonly ctx: EnvelopeEvaluationContext;
    readonly checks: DecisionValidityEnvelope['componentChecks'];
    readonly validUntil: DecisionValidityEnvelope['validUntil'];
    readonly overallStatus: DecisionValidityEnvelope['overallStatus'];
    readonly reasonCodes: readonly EnvelopeReasonCode[];
    readonly failureAction: EnvelopeFailureAction | null;
    readonly revision: number;
    readonly supersedesEnvelopeId: DecisionValidityEnvelopeId | null;
  }): DecisionValidityEnvelope {
    const { ctx } = input;
    const envelopeId = envelopeIdForWorkOrder(
      ctx.candidate.workOrderId,
      ctx.candidate.candidateId,
      input.revision,
    );

    return Object.freeze({
      envelopeId,
      candidateId: ctx.candidate.candidateId,
      executableOpportunityId: ctx.executableOpportunityId ?? null,
      strategyCapsuleRef: ctx.capsule,
      strategyCapsuleHash: ctx.capsule.contentHash,
      workOrderId: ctx.candidate.workOrderId,
      customerId: ctx.candidate.customerId,
      accountId: ctx.accountId,
      proposedActionRef: ctx.proposedActionRef ?? null,
      metaAllocatorRecommendationId: ctx.recommendation.recommendationId,
      createdAt: this.clock.now(),
      evaluatedAt: ctx.now,
      validUntil: input.validUntil,
      policyVersion: DECISION_VALIDITY_POLICY_VERSION,
      componentChecks: input.checks,
      overallStatus: input.overallStatus,
      failureAction: input.failureAction,
      reasonCodes: input.reasonCodes,
      evidenceRefs: Object.freeze([...ctx.candidate.evidenceRefs]),
      latencyMarkers: Object.freeze({
        evidenceArrivedAt: ctx.evidenceArrivedAt ?? null,
        candidateDiscoveredAt: ctx.candidate.discoveredAt,
        researchCompletedAt: ctx.researchCompletedAt ?? null,
        qualificationAt: ctx.qualificationAt ?? null,
        envelopeEvaluatedAt: ctx.now,
        proposalReadyAt: input.overallStatus === 'VALID' ? ctx.now : null,
      }),
      revision: input.revision,
      supersedesEnvelopeId: input.supersedesEnvelopeId,
      grantsFinancialEffect: false as const,
      grantsExecutionAuthority: false as const,
      authorizesFinancialExecution: false as const,
    });
  }
}
