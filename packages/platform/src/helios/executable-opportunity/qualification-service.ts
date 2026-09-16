import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { Clock } from '../../../../config/src/clock.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { OpportunityDiscoveryContext } from '../../growth/opportunity/types.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { EconomicWorkOrder } from '../types.ts';
import { bindCanonicalInstrument } from './instrument-binding.ts';
import { verifyCandidateEvidence } from './evidence-verification.ts';
import { evaluateCustomerEligibility } from './customer-eligibility.ts';
import { assessExecutionRouteReadiness } from './route-binding.ts';
import {
  captureQualificationTerms,
  qualificationExpiryFromTerms,
  termsRevalidationReason,
  termsStillValid,
} from './terms.ts';
import { transitionExecutableOpportunity } from './lifecycle.ts';
import { sealExecutableOpportunityDecision } from './evidence.ts';
import { candidateIdFor, executableOpportunityIdFor } from './ids.ts';
import { InMemoryExecutableOpportunityStore } from './store.ts';
import type {
  EvidenceRegistryPort,
  ExecutableOpportunity,
  ExecutableOpportunityTransition,
  ExecutionRouteRegistryPort,
  MarketTermsPort,
  OpportunityCandidate,
  QualificationPipelineResult,
} from './types.ts';
import type { CandidateSource, ExecutableOpportunityState, QualificationOutcome, QualificationReasonCode } from './taxonomy.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { OpportunityId } from '../../ids.ts';
import type { OpportunityDetectorKind } from '../../growth/opportunity/taxonomy.ts';

export type DiscoverCandidateInput = {
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly source: CandidateSource;
  readonly hypothesisType: string;
  readonly evidenceRefs: readonly string[];
  readonly instrumentCandidate: OpportunityCandidate['instrumentCandidate'];
  readonly originatingOpportunityId?: OpportunityId;
  readonly key?: string;
};

export type QualifyCandidateInput = {
  readonly candidate: OpportunityCandidate;
  readonly workOrder: EconomicWorkOrder | null;
  readonly mandate: CompiledEconomicMandate | null;
  readonly jurisdiction: Jurisdiction;
  readonly context: OpportunityDiscoveryContext;
  readonly environment?: 'simulation' | 'sandbox' | 'production_candidate';
  readonly venueSession?: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  readonly proposedNotional?: { readonly minorUnits: string; readonly currency: string };
  readonly accountClass?: string;
  readonly detector: OpportunityDetectorKind;
  readonly requireExternalObservation?: boolean;
};

export type ExecutableOpportunityFailure = {
  readonly code:
    | 'CANDIDENT_CUSTOMER_MISMATCH'
    | 'INVALID_EXECUTABLE_OPPORTUNITY_TRANSITION'
    | 'EXECUTABLE_OPPORTUNITY_NOT_FOUND'
    | 'CUSTOMER_MISMATCH';
  readonly message: string;
};

/**
 * Deterministic bridge from research candidates to customer-bound executable
 * opportunities. No stage grants financial authority.
 */
export class ExecutableOpportunityQualificationService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly evidenceRegistry: EvidenceRegistryPort;
  private readonly routeRegistry: ExecutionRouteRegistryPort;
  private readonly marketTerms: MarketTermsPort;
  readonly store: InMemoryExecutableOpportunityStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly evidenceRegistry: EvidenceRegistryPort;
    readonly routeRegistry: ExecutionRouteRegistryPort;
    readonly marketTerms: MarketTermsPort;
    readonly store?: InMemoryExecutableOpportunityStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.evidenceRegistry = input.evidenceRegistry;
    this.routeRegistry = input.routeRegistry;
    this.marketTerms = input.marketTerms;
    this.store = input.store ?? new InMemoryExecutableOpportunityStore();
  }

  discoverCandidate(input: DiscoverCandidateInput): OpportunityCandidate {
    const now = this.clock.now();
    const candidate = Object.freeze({
      candidateId: candidateIdFor(input.workOrderId, input.key ?? input.hypothesisType),
      workOrderId: input.workOrderId,
      customerId: input.customerId,
      subjectId: input.subjectId,
      source: input.source,
      hypothesisType: input.hypothesisType,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      instrumentCandidate: input.instrumentCandidate,
      discoveredAt: now,
      ...(input.originatingOpportunityId ? { originatingOpportunityId: input.originatingOpportunityId } : {}),
    });
    this.store.putCandidate(candidate);
    return candidate;
  }

  qualifyCandidate(input: QualifyCandidateInput): QualificationPipelineResult {
    const now = this.clock.now();
    const executableOpportunityId = executableOpportunityIdFor(input.candidate.candidateId);
    let opportunity = this.bootstrapOpportunity(executableOpportunityId, input.candidate, now);

    const evidenceDecision = verifyCandidateEvidence({
      executableOpportunityId,
      evidenceRefs: input.candidate.evidenceRefs,
      registry: this.evidenceRegistry,
      now,
      customerId: input.candidate.customerId,
      subjectId: input.candidate.subjectId,
      ...(input.requireExternalObservation ? { requireExternalObservation: true } : {}),
    });
    sealExecutableOpportunityDecision(this.evidence, 'HELIOS_EXECUTABLE_OPPORTUNITY_EVIDENCE', opportunity, evidenceDecision);
    if (!evidenceDecision.verified) {
      opportunity = this.applyTransition(opportunity, terminalStateForEvidence(evidenceDecision.reasonCodes), evidenceDecision.reasonCodes, now, evidenceDecision.decisionId);
      return this.result('REJECTED', opportunity);
    }
    opportunity = this.applyTransition(opportunity, 'EVIDENCE_VERIFIED', evidenceDecision.reasonCodes, now, evidenceDecision.decisionId, {
      evidenceDecision,
    });

    const instrumentResult = bindCanonicalInstrument({
      candidate: input.candidate.instrumentCandidate,
      jurisdiction: input.jurisdiction,
    });
    if (!instrumentResult.ok) {
      opportunity = this.applyTransition(opportunity, 'REJECTED', instrumentResult.reasonCodes, now);
      return this.result('REJECTED', opportunity);
    }

    const eligibilityDecision = evaluateCustomerEligibility({
      executableOpportunityId,
      customerId: input.candidate.customerId,
      subjectId: input.candidate.subjectId,
      workOrder: input.workOrder,
      mandate: input.mandate,
      jurisdiction: input.jurisdiction,
      context: input.context,
      detectorSummary: {
        detector: input.detector,
        productId: input.candidate.instrumentCandidate.productId,
        ...(input.proposedNotional ? { estimatedImpact: input.proposedNotional } : {}),
        riskLevel: 'MODERATE',
        liquidityImpact: 'NEUTRAL',
      },
      now,
    });
    sealExecutableOpportunityDecision(this.evidence, 'HELIOS_EXECUTABLE_OPPORTUNITY_ELIGIBILITY', opportunity, eligibilityDecision);
    if (!eligibilityDecision.eligible) {
      opportunity = this.applyTransition(opportunity, 'INELIGIBLE', eligibilityDecision.reasonCodes, now, eligibilityDecision.decisionId, {
        eligibilityDecision,
      });
      return this.result('NO_ACTION', opportunity);
    }
    opportunity = this.applyTransition(opportunity, 'CUSTOMER_ELIGIBLE', eligibilityDecision.reasonCodes, now, eligibilityDecision.decisionId, {
      instrument: instrumentResult.binding,
      eligibilityDecision,
    });

    const routeDecision = assessExecutionRouteReadiness({
      executableOpportunityId,
      instrument: instrumentResult.binding,
      registry: this.routeRegistry,
      jurisdiction: input.jurisdiction,
      environment: input.environment ?? 'simulation',
      venueSession: input.venueSession ?? 'OPEN',
      ...(input.proposedNotional ? { proposedNotional: input.proposedNotional } : {}),
      ...(input.accountClass ? { accountClass: input.accountClass } : {}),
      now,
    });
    sealExecutableOpportunityDecision(this.evidence, 'HELIOS_EXECUTABLE_OPPORTUNITY_ROUTE', opportunity, routeDecision);
    if (!routeDecision.routeReady || !routeDecision.route) {
      opportunity = this.applyTransition(opportunity, 'NO_ROUTE', routeDecision.reasonCodes, now, routeDecision.decisionId, {
        routeDecision,
      });
      return this.result('WAIT', opportunity);
    }
    opportunity = this.applyTransition(opportunity, 'EXECUTION_ROUTE_READY', routeDecision.reasonCodes, now, routeDecision.decisionId, {
      routeDecision,
    });

    const termsResult = this.marketTerms.currentTerms({ route: routeDecision.route, now });
    if ('ok' in termsResult && termsResult.ok === false) {
      opportunity = this.applyTransition(opportunity, 'NO_ROUTE', [termsResult.reason], now);
      return this.result('WAIT', opportunity);
    }
    const terms = termsResult as ReturnType<typeof captureQualificationTerms>;
    opportunity = this.applyTransition(opportunity, 'QUALIFIED_FOR_PROPOSAL', ['OK'], now, undefined, {
      terms,
      qualificationExpiresAt: qualificationExpiryFromTerms(terms),
      qualifiedAt: now,
    });
    sealExecutableOpportunityDecision(this.evidence, 'HELIOS_EXECUTABLE_OPPORTUNITY_QUALIFIED', opportunity, {
      outcome: 'QUALIFIED_FOR_PROPOSAL',
      terms,
    });
    return this.result('QUALIFIED_FOR_PROPOSAL', opportunity);
  }

  revalidate(
    customerId: CustomerId,
    executableOpportunityId: string,
    input: Omit<QualifyCandidateInput, 'candidate'>,
  ): Result<QualificationPipelineResult, ExecutableOpportunityFailure> {
    const existing = this.store.getExecutableOpportunity(executableOpportunityId, customerId);
    if (!existing) {
      return err({ code: 'EXECUTABLE_OPPORTUNITY_NOT_FOUND', message: 'executable opportunity not found' });
    }
    if (existing.state !== 'QUALIFIED_FOR_PROPOSAL' && existing.state !== 'EXECUTION_ROUTE_READY') {
      return ok(this.result('WAIT', existing));
    }
    const now = this.clock.now();
    if (existing.terms && !termsStillValid(existing.terms, now)) {
      const stale = this.applyTransition(existing, 'STALE', ['TERMS_EXPIRED', 'REVALIDATION_REQUIRED'], now);
      return ok(this.result('WAIT', stale));
    }
    if (existing.routeDecision?.route) {
      const currentTerms = this.marketTerms.currentTerms({ route: existing.routeDecision.route, now });
      if ('ok' in currentTerms && currentTerms.ok === false) {
        const stale = this.applyTransition(existing, 'STALE', [currentTerms.reason, 'REVALIDATION_REQUIRED'], now);
        return ok(this.result('WAIT', stale));
      }
      if (existing.terms) {
        const change = termsRevalidationReason(existing.terms, currentTerms as ReturnType<typeof captureQualificationTerms>);
        if (change) {
          const stale = this.applyTransition(existing, 'STALE', [change, 'REVALIDATION_REQUIRED'], now);
          return ok(this.result('WAIT', stale));
        }
      }
    }
    return ok(this.result('QUALIFIED_FOR_PROPOSAL', existing));
  }

  getForCustomer(customerId: CustomerId, executableOpportunityId: string): ExecutableOpportunity | undefined {
    return this.store.getExecutableOpportunity(executableOpportunityId, customerId);
  }

  snapshot() {
    return this.store.snapshot();
  }

  private bootstrapOpportunity(
    executableOpportunityId: ReturnType<typeof executableOpportunityIdFor>,
    candidate: OpportunityCandidate,
    now: ReturnType<Clock['now']>,
  ): ExecutableOpportunity {
    const opportunity: ExecutableOpportunity = Object.freeze({
      executableOpportunityId,
      candidateId: candidate.candidateId,
      workOrderId: candidate.workOrderId,
      customerId: candidate.customerId,
      subjectId: candidate.subjectId,
      state: 'DISCOVERED',
      candidate,
      instrument: null,
      evidenceDecision: null,
      eligibilityDecision: null,
      routeDecision: null,
      terms: null,
      qualificationExpiresAt: null,
      reasonCodes: Object.freeze(['CANDIDATE_CREATED'] as const),
      grantsExecutionAuthority: false,
      authorizesFinancialExecution: false,
      proposalPath: 'GROW_OPPORTUNITY_PROPOSAL',
      transitionHistory: Object.freeze([
        Object.freeze({
          from: 'DISCOVERED',
          to: 'DISCOVERED',
          reasonCodes: Object.freeze(['CANDIDATE_CREATED'] as const),
          occurredAt: now,
        }),
      ]),
      createdAt: now,
      updatedAt: now,
      discoveredAt: candidate.discoveredAt,
      qualifiedAt: null,
      ...(candidate.originatingOpportunityId ? { originatingOpportunityId: candidate.originatingOpportunityId } : {}),
    });
    this.store.putExecutableOpportunity(opportunity);
    return opportunity;
  }

  private applyTransition(
    current: ExecutableOpportunity,
    to: ExecutableOpportunityState,
    reasonCodes: readonly QualificationReasonCode[],
    now: ReturnType<Clock['now']>,
    decisionId?: ExecutableOpportunityTransition['decisionId'],
    patch: Partial<ExecutableOpportunity> = {},
  ): ExecutableOpportunity {
    const transition = transitionExecutableOpportunity(current.state, to);
    if (!transition.ok) {
      return current;
    }
    const next: ExecutableOpportunity = Object.freeze({
      ...current,
      ...patch,
      state: transition.value,
      reasonCodes: Object.freeze([...reasonCodes]),
      updatedAt: now,
      transitionHistory: Object.freeze([
        ...current.transitionHistory,
        Object.freeze({
          from: current.state,
          to: transition.value,
          reasonCodes: Object.freeze([...reasonCodes]),
          occurredAt: now,
          ...(decisionId ? { decisionId } : {}),
        }),
      ]),
    });
    this.store.putExecutableOpportunity(next);
    return next;
  }

  private result(outcome: QualificationOutcome, opportunity: ExecutableOpportunity): QualificationPipelineResult {
    return Object.freeze({
      outcome,
      opportunity,
      reasonCodes: opportunity.reasonCodes,
      grantsExecutionAuthority: false,
      authorizesFinancialExecution: false,
    });
  }
}

function terminalStateForEvidence(reasonCodes: readonly QualificationReasonCode[]): ExecutableOpportunityState {
  if (reasonCodes.includes('EVIDENCE_STALE')) {
    return 'STALE';
  }
  if (reasonCodes.includes('EVIDENCE_DATA_QUALITY_FAILURE')) {
    return 'DATA_DEGRADED';
  }
  return 'REJECTED';
}

export const HELIOS_H09_EXECUTABLE_OPPORTUNITY_BINDING = 'HELIOS_H09_EXECUTABLE_OPPORTUNITY_BINDING' as const;
