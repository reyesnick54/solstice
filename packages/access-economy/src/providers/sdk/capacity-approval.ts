/**
 * ACCESS Wave 2 — Capacity contribution approval.
 *
 * External contributed capacity must not automatically become trusted
 * AccessCapacity. Reuses AccessCapacityCandidate from domain types.
 */

import type { AccessCapacity, AccessCapacityCandidate } from './domain-types.ts';

export type CapacityApprovalDecision = {
  readonly candidateId: string;
  readonly approved: boolean;
  readonly reason: string;
  readonly decidedAt: string;
  readonly capacity: AccessCapacity | null;
};

export type CapacityApprovalPolicy = {
  evaluate(candidate: AccessCapacityCandidate): CapacityApprovalDecision;
};

export class DefaultCapacityApprovalPolicy implements CapacityApprovalPolicy {
  private readonly nowUtc: () => string;

  constructor(options: { readonly nowUtc?: () => string } = {}) {
    this.nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  evaluate(candidate: AccessCapacityCandidate): CapacityApprovalDecision {
    if (candidate.units <= 0n) {
      return Object.freeze({
        candidateId: candidate.candidateId,
        approved: false,
        reason: 'capacity units must be positive',
        decidedAt: this.nowUtc(),
        capacity: null,
      });
    }
    if (!candidate.evidenceId) {
      return Object.freeze({
        candidateId: candidate.candidateId,
        approved: false,
        reason: 'capacity contribution requires evidence',
        decidedAt: this.nowUtc(),
        capacity: null,
      });
    }
    const capacity: AccessCapacity = Object.freeze({
      capacityId: `cap_${candidate.candidateId}`,
      providerId: candidate.providerId,
      category: candidate.category,
      productId: candidate.productId,
      geography: candidate.geography,
      periodStart: candidate.periodStart,
      periodEnd: candidate.periodEnd,
      units: candidate.units,
      unit: candidate.unit,
      approvedAt: this.nowUtc(),
      evidenceId: candidate.evidenceId,
      simulationOnly: candidate.simulationOnly,
    });
    return Object.freeze({
      candidateId: candidate.candidateId,
      approved: true,
      reason: 'commercial policy validation passed',
      decidedAt: this.nowUtc(),
      capacity,
    });
  }
}

export class AccessCapacityApprovalService {
  private readonly policy: CapacityApprovalPolicy;
  private readonly candidates = new Map<string, AccessCapacityCandidate>();
  private readonly approved = new Map<string, AccessCapacity>();

  constructor(policy: CapacityApprovalPolicy = new DefaultCapacityApprovalPolicy()) {
    this.policy = policy;
  }

  submit(candidate: AccessCapacityCandidate): AccessCapacityCandidate {
    const frozen = Object.freeze({ ...candidate, state: 'PENDING' as const });
    this.candidates.set(candidate.candidateId, frozen);
    return frozen;
  }

  approve(candidateId: string): CapacityApprovalDecision {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      return Object.freeze({
        candidateId,
        approved: false,
        reason: 'candidate not found',
        decidedAt: new Date().toISOString(),
        capacity: null,
      });
    }
    const decision = this.policy.evaluate(candidate);
    if (decision.approved && decision.capacity) {
      this.approved.set(candidateId, decision.capacity);
      this.candidates.set(candidateId, Object.freeze({ ...candidate, state: 'APPROVED' }));
    } else {
      this.candidates.set(candidateId, Object.freeze({ ...candidate, state: 'REJECTED' }));
    }
    return decision;
  }

  getApproved(candidateId: string): AccessCapacity | null {
    return this.approved.get(candidateId) ?? null;
  }

  listCandidates(): readonly AccessCapacityCandidate[] {
    return Object.freeze([...this.candidates.values()]);
  }
}
