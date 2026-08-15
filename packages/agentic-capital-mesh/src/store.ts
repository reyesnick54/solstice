import type {
  AdversarialReview,
  CapitalAllocationCandidate,
  CapitalArbitration,
  CapitalContext,
  CapitalProposal,
  CapitalThesis,
  MeshRun,
  MeshStoreSnapshot,
  NodeOutput,
} from './types.ts';
import type { CapitalMeshRunId, CapitalProposalId } from './ids.ts';

export class CapitalMeshStore {
  private readonly runs = new Map<string, MeshRun>();
  private readonly contexts = new Map<string, CapitalContext>();
  private readonly theses: CapitalThesis[] = [];
  private readonly candidates: CapitalAllocationCandidate[] = [];
  private readonly reviews: AdversarialReview[] = [];
  private readonly arbitrations: CapitalArbitration[] = [];
  private readonly proposals = new Map<string, CapitalProposal>();
  private readonly nodeOutputs: NodeOutput[] = [];

  putRun(run: MeshRun): MeshRun {
    this.runs.set(run.runId, run);
    return run;
  }

  getRun(runId: CapitalMeshRunId): MeshRun | undefined {
    return this.runs.get(runId);
  }

  putContext(context: CapitalContext): void {
    this.contexts.set(context.contextId, context);
  }

  putThesis(thesis: CapitalThesis): void {
    this.theses.push(thesis);
  }

  putCandidate(candidate: CapitalAllocationCandidate): void {
    this.candidates.push(candidate);
  }

  putReview(review: AdversarialReview): void {
    this.reviews.push(review);
  }

  putArbitration(arbitration: CapitalArbitration): void {
    this.arbitrations.push(arbitration);
  }

  putProposal(proposal: CapitalProposal): void {
    this.proposals.set(proposal.proposalId, proposal);
  }

  getProposal(proposalId: CapitalProposalId): CapitalProposal | undefined {
    return this.proposals.get(proposalId);
  }

  putNodeOutput(output: NodeOutput): void {
    this.nodeOutputs.push(output);
  }

  snapshot(): MeshStoreSnapshot {
    return Object.freeze({
      runs: Object.freeze([...this.runs.values()]),
      contexts: Object.freeze([...this.contexts.values()]),
      theses: Object.freeze([...this.theses]),
      candidates: Object.freeze([...this.candidates]),
      reviews: Object.freeze([...this.reviews]),
      arbitrations: Object.freeze([...this.arbitrations]),
      proposals: Object.freeze([...this.proposals.values()]),
      nodeOutputs: Object.freeze([...this.nodeOutputs]),
    });
  }

  restore(snapshot: MeshStoreSnapshot): void {
    this.runs.clear();
    this.contexts.clear();
    this.theses.length = 0;
    this.candidates.length = 0;
    this.reviews.length = 0;
    this.arbitrations.length = 0;
    this.proposals.clear();
    this.nodeOutputs.length = 0;
    for (const run of snapshot.runs) {
      this.runs.set(run.runId, run);
    }
    for (const context of snapshot.contexts) {
      this.contexts.set(context.contextId, context);
    }
    this.theses.push(...snapshot.theses);
    this.candidates.push(...snapshot.candidates);
    this.reviews.push(...snapshot.reviews);
    this.arbitrations.push(...snapshot.arbitrations);
    for (const proposal of snapshot.proposals) {
      this.proposals.set(proposal.proposalId, proposal);
    }
    this.nodeOutputs.push(...snapshot.nodeOutputs);
  }
}
