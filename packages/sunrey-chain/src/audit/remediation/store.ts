import { approveProductionSecurityPolicy, DEFAULT_PRODUCTION_SECURITY_POLICY } from './policy.ts';
import type {
  ExternalSecurityFinding,
  ExternalSecurityReview,
  FindingEvidenceChainRecord,
  FindingRegressionEvidence,
  FindingRemediationEvidence,
  FindingRemediationPlan,
  FindingRetestRequest,
  FindingRetestResult,
  ProductionSecurityPolicy,
  SecurityRiskAcceptance,
} from './types.ts';

export type RemediationStoreSnapshot = {
  readonly reviews: readonly ExternalSecurityReview[];
  readonly findings: readonly ExternalSecurityFinding[];
  readonly plans: readonly FindingRemediationPlan[];
  readonly remediationEvidence: readonly FindingRemediationEvidence[];
  readonly regressions: readonly FindingRegressionEvidence[];
  readonly retestRequests: readonly FindingRetestRequest[];
  readonly retestResults: readonly FindingRetestResult[];
  readonly acceptedRisks: readonly SecurityRiskAcceptance[];
  readonly chain: readonly FindingEvidenceChainRecord[];
  readonly policy: ProductionSecurityPolicy;
};

export class RemediationStore {
  private reviews: ExternalSecurityReview[] = [];
  private findings: ExternalSecurityFinding[] = [];
  private plans: FindingRemediationPlan[] = [];
  private remediationEvidence: FindingRemediationEvidence[] = [];
  private regressions: FindingRegressionEvidence[] = [];
  private retestRequests: FindingRetestRequest[] = [];
  private retestResults: FindingRetestResult[] = [];
  private acceptedRisks: SecurityRiskAcceptance[] = [];
  private chain: FindingEvidenceChainRecord[] = [];
  private policy: ProductionSecurityPolicy = DEFAULT_PRODUCTION_SECURITY_POLICY;

  putReview(review: ExternalSecurityReview): void {
    this.reviews = [...this.reviews.filter((row) => row.reviewId !== review.reviewId), review];
  }

  putFinding(finding: ExternalSecurityFinding, record?: FindingEvidenceChainRecord): void {
    this.findings = [...this.findings.filter((row) => row.findingId !== finding.findingId), finding];
    if (record) {
      this.chain = [...this.chain, record];
    }
  }

  putPlan(plan: FindingRemediationPlan): void {
    this.plans = [...this.plans.filter((row) => row.planId !== plan.planId), plan];
  }

  putRemediationEvidence(evidence: FindingRemediationEvidence): void {
    this.remediationEvidence = [...this.remediationEvidence.filter((row) => row.evidenceId !== evidence.evidenceId), evidence];
  }

  putRegression(evidence: FindingRegressionEvidence): void {
    this.regressions = [...this.regressions.filter((row) => row.evidenceId !== evidence.evidenceId), evidence];
  }

  putRetestRequest(request: FindingRetestRequest): void {
    this.retestRequests = [...this.retestRequests.filter((row) => row.requestId !== request.requestId), request];
  }

  putRetestResult(result: FindingRetestResult): void {
    this.retestResults = [...this.retestResults.filter((row) => row.resultId !== result.resultId), result];
  }

  putRiskAcceptance(acceptance: SecurityRiskAcceptance): void {
    this.acceptedRisks = [...this.acceptedRisks.filter((row) => row.acceptanceId !== acceptance.acceptanceId), acceptance];
  }

  approvePolicy(policy: Omit<ProductionSecurityPolicy, 'humanApproved' | 'approvedBy'>, approvedBy: string): void {
    this.policy = approveProductionSecurityPolicy(policy, approvedBy);
  }

  snapshot(): RemediationStoreSnapshot {
    return Object.freeze({
      reviews: Object.freeze([...this.reviews]),
      findings: Object.freeze([...this.findings]),
      plans: Object.freeze([...this.plans]),
      remediationEvidence: Object.freeze([...this.remediationEvidence]),
      regressions: Object.freeze([...this.regressions]),
      retestRequests: Object.freeze([...this.retestRequests]),
      retestResults: Object.freeze([...this.retestResults]),
      acceptedRisks: Object.freeze([...this.acceptedRisks]),
      chain: Object.freeze([...this.chain]),
      policy: this.policy,
    });
  }

  finding(findingId: string): ExternalSecurityFinding | undefined {
    return this.findings.find((row) => row.findingId === findingId);
  }

  review(reviewId: string): ExternalSecurityReview | undefined {
    return this.reviews.find((row) => row.reviewId === reviewId);
  }
}

export const defaultRemediationStore = new RemediationStore();
