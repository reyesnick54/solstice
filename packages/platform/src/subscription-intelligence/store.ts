import type {
  RecurringObligation,
  SavingsOpportunity,
  SubscriptionActionProposal,
  SubscriptionApproval,
  VerifiedSavings,
} from './models.ts';
import type { SubscriptionActionId } from './ids.ts';

export class SubscriptionIntelligenceStore {
  private readonly obligations = new Map<string, RecurringObligation[]>();
  private readonly opportunities = new Map<string, SavingsOpportunity[]>();
  private readonly actions = new Map<string, SubscriptionActionProposal>();
  private readonly approvals = new Map<string, SubscriptionApproval>();
  private readonly verifiedSavings = new Map<string, VerifiedSavings[]>();

  putObligations(subjectId: string, obligations: readonly RecurringObligation[]): void {
    this.obligations.set(subjectId, [...obligations]);
  }

  getObligations(subjectId: string): readonly RecurringObligation[] {
    return Object.freeze(this.obligations.get(subjectId) ?? []);
  }

  putOpportunities(subjectId: string, opportunities: readonly SavingsOpportunity[]): void {
    this.opportunities.set(subjectId, [...opportunities]);
  }

  getOpportunities(subjectId: string): readonly SavingsOpportunity[] {
    return Object.freeze(this.opportunities.get(subjectId) ?? []);
  }

  getOpportunity(subjectId: string, opportunityId: string): SavingsOpportunity | undefined {
    return this.getOpportunities(subjectId).find((item) => item.opportunityId === opportunityId);
  }

  putAction(action: SubscriptionActionProposal): void {
    this.actions.set(action.actionId, action);
  }

  getAction(actionId: SubscriptionActionId): SubscriptionActionProposal | undefined {
    return this.actions.get(actionId);
  }

  getActionsForUser(userId: string): readonly SubscriptionActionProposal[] {
    return Object.freeze([...this.actions.values()].filter((item) => item.userId === userId));
  }

  putApproval(approval: SubscriptionApproval): void {
    this.approvals.set(approval.approvalId, approval);
  }

  getApproval(approvalId: string): SubscriptionApproval | undefined {
    return this.approvals.get(approvalId);
  }

  putVerifiedSavings(subjectId: string, savings: VerifiedSavings): void {
    const list = this.verifiedSavings.get(subjectId) ?? [];
    list.push(savings);
    this.verifiedSavings.set(subjectId, list);
  }

  getVerifiedSavings(subjectId: string): readonly VerifiedSavings[] {
    return Object.freeze(this.verifiedSavings.get(subjectId) ?? []);
  }
}
