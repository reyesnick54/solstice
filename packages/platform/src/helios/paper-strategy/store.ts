import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { HeliosPaperGrowProposal, HeliosPaperGrowResult, HeliosPaperPosition, PaperStrategyStoreSnapshot } from './types.ts';
import type { HeliosPaperPositionId, HeliosPaperProposalId } from './ids.ts';

export class InMemoryHeliosPaperStrategyStore {
  private readonly proposals = new Map<HeliosPaperProposalId, HeliosPaperGrowProposal>();
  private readonly positions = new Map<HeliosPaperPositionId, HeliosPaperPosition>();
  private readonly cycles: HeliosPaperGrowResult[] = [];
  private readonly completedTaskIds = new Set<string>();

  putProposal(proposal: HeliosPaperGrowProposal): void {
    this.proposals.set(proposal.proposalId, proposal);
  }

  getProposal(id: HeliosPaperProposalId): HeliosPaperGrowProposal | undefined {
    return this.proposals.get(id);
  }

  putPosition(position: HeliosPaperPosition): void {
    this.positions.set(position.positionId, position);
  }

  getPosition(id: HeliosPaperPositionId): HeliosPaperPosition | undefined {
    return this.positions.get(id);
  }

  listPositionsForCustomer(customerId: CustomerId): readonly HeliosPaperPosition[] {
    return [...this.positions.values()].filter((row) => row.customerId === customerId);
  }

  listCyclesForCustomer(customerId: CustomerId): readonly HeliosPaperGrowResult[] {
    const customerProposalIds = new Set(
      [...this.proposals.values()].filter((row) => row.customerId === customerId).map((row) => row.proposalId),
    );
    return this.cycles.filter((row) => row.proposalId && customerProposalIds.has(row.proposalId));
  }

  putCycle(cycle: HeliosPaperGrowResult): void {
    this.cycles.push(cycle);
  }

  markTaskCompleted(taskId: string): void {
    this.completedTaskIds.add(taskId);
  }

  isTaskCompleted(taskId: string): boolean {
    return this.completedTaskIds.has(taskId);
  }

  snapshot(): PaperStrategyStoreSnapshot {
    return Object.freeze({
      proposals: Object.freeze([...this.proposals.values()]),
      positions: Object.freeze([...this.positions.values()]),
      cycles: Object.freeze([...this.cycles]),
      completedTaskIds: Object.freeze([...this.completedTaskIds]),
    });
  }

  restore(snapshot: PaperStrategyStoreSnapshot): void {
    this.proposals.clear();
    this.positions.clear();
    this.cycles.length = 0;
    this.completedTaskIds.clear();
    for (const proposal of snapshot.proposals) {
      this.proposals.set(proposal.proposalId, proposal);
    }
    for (const position of snapshot.positions) {
      this.positions.set(position.positionId, position);
    }
    this.cycles.push(...snapshot.cycles);
    for (const taskId of snapshot.completedTaskIds) {
      this.completedTaskIds.add(taskId);
    }
  }
}
