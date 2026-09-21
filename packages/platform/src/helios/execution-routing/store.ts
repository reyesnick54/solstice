import type { ExecutionRoutingDecisionId } from './ids.ts';
import type {
  ExecutionRoutingResult,
  ExecutionRoutingStorePort,
  ExecutionRoutingStoreSnapshot,
} from './types.ts';

export class InMemoryExecutionRoutingStore implements ExecutionRoutingStorePort {
  private decisions = new Map<ExecutionRoutingDecisionId, ExecutionRoutingResult>();
  private byRequest = new Map<string, ExecutionRoutingDecisionId>();
  private lastEvidenceRef: string | null = null;

  putDecision(decision: ExecutionRoutingResult): void {
    this.decisions.set(decision.decisionId, decision);
    this.byRequest.set(decision.evidence.requestId, decision.decisionId);
    this.lastEvidenceRef = decision.evidence.evidenceRef;
  }

  getDecision(decisionId: ExecutionRoutingDecisionId): ExecutionRoutingResult | null {
    return this.decisions.get(decisionId) ?? null;
  }

  getLatestForRequest(requestId: string): ExecutionRoutingResult | null {
    const decisionId = this.byRequest.get(requestId);
    return decisionId ? this.getDecision(decisionId) : null;
  }

  snapshot(): ExecutionRoutingStoreSnapshot {
    return Object.freeze({
      decisions: Object.freeze([...this.decisions.values()]),
      lastEvidenceRef: this.lastEvidenceRef,
    });
  }

  restore(snapshot: ExecutionRoutingStoreSnapshot): void {
    this.decisions.clear();
    this.byRequest.clear();
    for (const decision of snapshot.decisions) {
      this.decisions.set(decision.decisionId, decision);
      this.byRequest.set(decision.evidence.requestId, decision.decisionId);
    }
    this.lastEvidenceRef = snapshot.lastEvidenceRef;
  }
}
