import type { StrategyCapsule } from './capsule.ts';
import type { DemotionRecord } from './demotion.ts';
import type { EvaluationQualificationResult } from './evaluation-qualification.ts';
import type { ForwardShadowDecision, ForwardShadowRun } from './forward-shadow.ts';
import type { PromotionEvidenceRecord } from './promotion-evidence.ts';
import type { StrategyPromotionState } from './promotion-state.ts';
import type { QualificationPolicy } from './qualification-policy.ts';

export type StrategyPromotionRecord = {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly subjectId: string;
  readonly capsuleId: string;
  readonly capsuleFingerprint: string;
  readonly promotionState: StrategyPromotionState;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly expiresAt: string | null;
  readonly updatedAt: string;
};

export type StrategyPromotionSnapshot = {
  readonly promotions: readonly StrategyPromotionRecord[];
  readonly capsules: readonly StrategyCapsule[];
  readonly qualifications: readonly EvaluationQualificationResult[];
  readonly forwardShadowRuns: readonly ForwardShadowRun[];
  readonly forwardShadowDecisions: readonly ForwardShadowDecision[];
  readonly evidence: readonly PromotionEvidenceRecord[];
  readonly demotions: readonly DemotionRecord[];
  readonly policies: readonly QualificationPolicy[];
};

export function createEmptyPromotionSnapshot(): StrategyPromotionSnapshot {
  return Object.freeze({
    promotions: Object.freeze([]),
    capsules: Object.freeze([]),
    qualifications: Object.freeze([]),
    forwardShadowRuns: Object.freeze([]),
    forwardShadowDecisions: Object.freeze([]),
    evidence: Object.freeze([]),
    demotions: Object.freeze([]),
    policies: Object.freeze([]),
  });
}

export class StrategyPromotionStore {
  private readonly promotions = new Map<string, StrategyPromotionRecord>();
  private readonly capsules = new Map<string, StrategyCapsule>();
  private readonly qualifications: EvaluationQualificationResult[] = [];
  private readonly forwardShadowRuns: ForwardShadowRun[] = [];
  private readonly forwardShadowDecisions: ForwardShadowDecision[] = [];
  private readonly evidence: PromotionEvidenceRecord[] = [];
  private readonly demotions: DemotionRecord[] = [];
  private readonly policies = new Map<string, QualificationPolicy>();

  private key(id: string, version: string): string {
    return `${id}@${version}`;
  }

  putPolicy(policy: QualificationPolicy): void {
    this.policies.set(policy.policyId, policy);
  }

  getPolicy(policyId: string): QualificationPolicy | undefined {
    return this.policies.get(policyId);
  }

  putCapsule(capsule: StrategyCapsule): void {
    this.capsules.set(this.key(capsule.strategyId, capsule.version), capsule);
  }

  getCapsule(id: string, version: string): StrategyCapsule | undefined {
    return this.capsules.get(this.key(id, version));
  }

  putPromotion(record: StrategyPromotionRecord): void {
    this.promotions.set(this.key(record.strategyId, record.strategyVersion), record);
  }

  getPromotion(id: string, version: string): StrategyPromotionRecord | undefined {
    return this.promotions.get(this.key(id, version));
  }

  putQualification(result: EvaluationQualificationResult): void {
    this.qualifications.push(result);
  }

  getLatestQualification(id: string, version: string): EvaluationQualificationResult | undefined {
    return [...this.qualifications]
      .reverse()
      .find((row) => row.strategyId === id && row.strategyVersion === version);
  }

  putForwardShadowRun(run: ForwardShadowRun): void {
    this.forwardShadowRuns.push(run);
  }

  updateForwardShadowRun(run: ForwardShadowRun): void {
    const index = this.forwardShadowRuns.findIndex((row) => row.runId === run.runId);
    if (index >= 0) {
      this.forwardShadowRuns[index] = run;
    }
  }

  putForwardShadowDecision(decision: ForwardShadowDecision): void {
    const existing = this.forwardShadowDecisions.findIndex((row) => row.decisionId === decision.decisionId);
    if (existing >= 0) {
      if (this.forwardShadowDecisions[existing]?.immutableAfterOutcome) {
        throw new Error('forward shadow decision is immutable after outcome');
      }
      this.forwardShadowDecisions[existing] = decision;
      return;
    }
    this.forwardShadowDecisions.push(decision);
  }

  listForwardShadowDecisions(runId: string): readonly ForwardShadowDecision[] {
    return Object.freeze(this.forwardShadowDecisions.filter((row) => row.runId === runId));
  }

  putEvidence(record: PromotionEvidenceRecord): void {
    this.evidence.push(record);
  }

  putDemotion(record: DemotionRecord): void {
    this.demotions.push(record);
  }

  listEvidence(id: string, version: string): readonly PromotionEvidenceRecord[] {
    return Object.freeze(
      this.evidence.filter((row) => row.strategyId === id && row.strategyVersion === version),
    );
  }

  snapshot(): StrategyPromotionSnapshot {
    return Object.freeze({
      promotions: Object.freeze([...this.promotions.values()]),
      capsules: Object.freeze([...this.capsules.values()]),
      qualifications: Object.freeze([...this.qualifications]),
      forwardShadowRuns: Object.freeze([...this.forwardShadowRuns]),
      forwardShadowDecisions: Object.freeze([...this.forwardShadowDecisions]),
      evidence: Object.freeze([...this.evidence]),
      demotions: Object.freeze([...this.demotions]),
      policies: Object.freeze([...this.policies.values()]),
    });
  }

  restore(state: StrategyPromotionSnapshot): void {
    this.promotions.clear();
    this.capsules.clear();
    this.qualifications.length = 0;
    this.forwardShadowRuns.length = 0;
    this.forwardShadowDecisions.length = 0;
    this.evidence.length = 0;
    this.demotions.length = 0;
    this.policies.clear();
    for (const policy of state.policies) this.putPolicy(policy);
    for (const capsule of state.capsules) this.putCapsule(capsule);
    for (const promotion of state.promotions) this.putPromotion(promotion);
    for (const qualification of state.qualifications) this.putQualification(qualification);
    for (const run of state.forwardShadowRuns) this.putForwardShadowRun(run);
    for (const decision of state.forwardShadowDecisions) this.putForwardShadowDecision(decision);
    for (const row of state.evidence) this.putEvidence(row);
    for (const row of state.demotions) this.putDemotion(row);
  }
}
