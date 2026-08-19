import { err, ok, type Result } from '../../domain/src/result.ts';
import { createHumanContributionEvent, refuseExecution, refuseMint } from './event.ts';
import type { ContributionId, PolicyDecisionRef, SubjectRef } from './ids.ts';
import type { SettlementEligibilityState } from './taxonomy.ts';
import type {
  ContributionFailure,
  ExecutionRefusal,
  HumanContributionEvent,
  MintRefusal,
  RecordContributionInput,
} from './types.ts';

export type HumanContributionRegistrySnapshot = {
  readonly events: readonly HumanContributionEvent[];
  readonly taxonomyDoesNotGrantEligibility: true;
  readonly valuationImplemented: false;
  readonly mintingImplemented: false;
};

/**
 * Canonical in-memory Human Economic Contribution registry.
 *
 * Later chunks may persist or settle against these records. This owner
 * defines the ontology only: no valuation formula, no SunRey quantity,
 * no Execution Authority, and no ledger posting.
 */
export class HumanContributionRegistry {
  private readonly events = new Map<ContributionId, HumanContributionEvent>();

  record(input: RecordContributionInput): Result<HumanContributionEvent, ContributionFailure> {
    const created = createHumanContributionEvent(input);
    if (!created.ok) {
      return created;
    }
    if (this.events.has(created.value.contributionId)) {
      return err({
        code: 'INVALID_LIFECYCLE',
        message: `contribution ${created.value.contributionId} already exists; corrections are new superseding events`,
      });
    }
    this.events.set(created.value.contributionId, created.value);
    return created;
  }

  get(contributionId: ContributionId): HumanContributionEvent | undefined {
    return this.events.get(contributionId);
  }

  listBySubject(subjectRef: SubjectRef): readonly HumanContributionEvent[] {
    return Object.freeze(
      [...this.events.values()]
        .filter((event) => event.subjectRef === subjectRef)
        .sort((left, right) => (left.createdAt < right.createdAt ? -1 : 1)),
    );
  }

  history(contributionId: ContributionId): readonly HumanContributionEvent[] {
    const chain: HumanContributionEvent[] = [];
    const seen = new Set<ContributionId>();
    let current = this.events.get(contributionId);
    while (current && !seen.has(current.contributionId)) {
      seen.add(current.contributionId);
      chain.push(current);
      current = current.supersedes ? this.events.get(current.supersedes) : undefined;
    }
    return Object.freeze(chain);
  }

  supersede(
    priorId: ContributionId,
    input: RecordContributionInput,
  ): Result<HumanContributionEvent, ContributionFailure> {
    const prior = this.events.get(priorId);
    if (!prior) {
      return err({ code: 'CONTRIBUTION_NOT_FOUND', message: `contribution ${priorId} was not recorded` });
    }
    if (prior.status === 'SUPERSEDED' || prior.supersededBy) {
      return err({ code: 'ALREADY_SUPERSEDED', message: `contribution ${priorId} is already superseded and remains historically traceable` });
    }
    const next = this.record({
      ...input,
      subjectRef: input.subjectRef ?? prior.subjectRef,
      supersedes: priorId,
    });
    if (!next.ok) {
      return next;
    }
    const retired: HumanContributionEvent = Object.freeze({
      ...prior,
      status: 'SUPERSEDED',
      dataQuality: 'SUPERSEDED',
      supersededBy: next.value.contributionId,
    });
    this.events.set(priorId, retired);
    return next;
  }

  applySettlementEligibility(
    contributionId: ContributionId,
    eligibilityState: SettlementEligibilityState,
    policyDecisionRef: PolicyDecisionRef,
  ): Result<HumanContributionEvent, ContributionFailure> {
    const current = this.events.get(contributionId);
    if (!current) {
      return err({ code: 'CONTRIBUTION_NOT_FOUND', message: `contribution ${contributionId} was not recorded` });
    }
    if (eligibilityState === 'SETTLEMENT_ELIGIBLE_BY_POLICY' && !policyDecisionRef) {
      return err({ code: 'POLICY_REF_REQUIRED', message: 'settlement eligibility is policy-controlled' });
    }
    const updated: HumanContributionEvent = Object.freeze({
      ...current,
      eligibilityState,
      policyDecisionRef,
      issuanceEligible: false,
      sunReyQuantity: null,
    });
    this.events.set(contributionId, updated);
    return ok(updated);
  }

  authorizeExecution(event: HumanContributionEvent): ExecutionRefusal {
    return refuseExecution(event);
  }

  authorizeMint(event: HumanContributionEvent): MintRefusal {
    return refuseMint(event);
  }

  snapshot(): HumanContributionRegistrySnapshot {
    return Object.freeze({
      events: Object.freeze([...this.events.values()]),
      taxonomyDoesNotGrantEligibility: true,
      valuationImplemented: false,
      mintingImplemented: false,
    });
  }
}
