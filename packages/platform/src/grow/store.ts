import type {
  ActivatedGrowthPlan,
  FinancialProposal,
  GrowApproval,
  GrowEvidenceTrace,
  GrowExecutionCommand,
  GrowExecutionRecord,
  GrowMonitoringCycle,
  GrowPerformanceReadModel,
  RecurringContributionMandate,
} from './types.ts';

export type GrowStoreSnapshot = {
  readonly proposals: readonly FinancialProposal[];
  readonly approvals: readonly GrowApproval[];
  readonly commands: readonly GrowExecutionCommand[];
  readonly executions: readonly GrowExecutionRecord[];
  readonly activatedPlans: readonly ActivatedGrowthPlan[];
  readonly recurring: readonly RecurringContributionMandate[];
  readonly monitoring: readonly GrowMonitoringCycle[];
  readonly performance: readonly GrowPerformanceReadModel[];
  readonly evidence: readonly GrowEvidenceTrace[];
};

export class InMemoryGrowStore {
  private readonly proposals = new Map<string, FinancialProposal>();
  private readonly approvals = new Map<string, GrowApproval>();
  private readonly commands = new Map<string, GrowExecutionCommand>();
  private readonly executions = new Map<string, GrowExecutionRecord>();
  private readonly activatedPlans = new Map<string, ActivatedGrowthPlan>();
  private readonly recurring = new Map<string, RecurringContributionMandate>();
  private readonly monitoring = new Map<string, GrowMonitoringCycle>();
  private readonly performance = new Map<string, GrowPerformanceReadModel>();
  private readonly evidence = new Map<string, GrowEvidenceTrace>();

  putProposal(proposal: FinancialProposal): FinancialProposal {
    this.proposals.set(`${proposal.proposalId}:${String(proposal.version)}`, proposal);
    return proposal;
  }

  getProposal(proposalId: string, version?: number): FinancialProposal | undefined {
    if (version !== undefined) {
      return this.proposals.get(`${proposalId}:${String(version)}`);
    }
    const matches = [...this.proposals.values()].filter((row) => row.proposalId === proposalId);
    return matches.sort((a, b) => b.version - a.version)[0];
  }

  latestProposalFor(subjectId: string): FinancialProposal | undefined {
    return [...this.proposals.values()]
      .filter((row) => row.subjectId === subjectId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt === b.createdAt ? b.version - a.version : -1))[0];
  }

  listProposals(subjectId: string): readonly FinancialProposal[] {
    return Object.freeze(
      [...this.proposals.values()]
        .filter((row) => row.subjectId === subjectId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  putApproval(approval: GrowApproval): GrowApproval {
    this.approvals.set(approval.approvalId, approval);
    return approval;
  }

  getApproval(approvalId: string): GrowApproval | undefined {
    return this.approvals.get(approvalId);
  }

  approvalFor(proposalId: string, version: number): GrowApproval | undefined {
    return [...this.approvals.values()].find(
      (row) => row.proposalId === proposalId && row.proposalVersion === version,
    );
  }

  putCommand(command: GrowExecutionCommand): GrowExecutionCommand {
    this.commands.set(command.commandId, command);
    return command;
  }

  getCommand(commandId: string): GrowExecutionCommand | undefined {
    return this.commands.get(commandId);
  }

  commandByIdempotency(key: string): GrowExecutionCommand | undefined {
    return [...this.commands.values()].find((row) => row.idempotencyKey === key);
  }

  putExecution(record: GrowExecutionRecord): GrowExecutionRecord {
    this.executions.set(record.executionId, record);
    return record;
  }

  getExecution(executionId: string): GrowExecutionRecord | undefined {
    return this.executions.get(executionId);
  }

  executionForCommand(commandId: string): GrowExecutionRecord | undefined {
    return [...this.executions.values()].find((row) => row.commandId === commandId);
  }

  listExecutions(customerId: string): readonly GrowExecutionRecord[] {
    return Object.freeze([...this.executions.values()].filter((row) => row.customerId === customerId));
  }

  putActivatedPlan(plan: ActivatedGrowthPlan): ActivatedGrowthPlan {
    this.activatedPlans.set(plan.activatedPlanId, plan);
    return plan;
  }

  latestActivatedPlan(subjectId: string): ActivatedGrowthPlan | undefined {
    return [...this.activatedPlans.values()]
      .filter((row) => row.subjectId === subjectId)
      .sort((a, b) => (a.activatedAt < b.activatedAt ? 1 : -1))[0];
  }

  putRecurring(mandate: RecurringContributionMandate): RecurringContributionMandate {
    this.recurring.set(mandate.recurringMandateId, mandate);
    return mandate;
  }

  getRecurring(id: string): RecurringContributionMandate | undefined {
    return this.recurring.get(id);
  }

  listRecurring(subjectId: string): readonly RecurringContributionMandate[] {
    return Object.freeze([...this.recurring.values()].filter((row) => row.subjectId === subjectId));
  }

  putMonitoring(cycle: GrowMonitoringCycle): GrowMonitoringCycle {
    this.monitoring.set(cycle.cycleId, cycle);
    return cycle;
  }

  latestMonitoring(subjectId: string): GrowMonitoringCycle | undefined {
    return [...this.monitoring.values()]
      .filter((row) => row.subjectId === subjectId)
      .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0];
  }

  putPerformance(model: GrowPerformanceReadModel): GrowPerformanceReadModel {
    this.performance.set(`${model.subjectId}:${model.planId}`, model);
    return model;
  }

  getPerformance(subjectId: string, planId: string): GrowPerformanceReadModel | undefined {
    return this.performance.get(`${subjectId}:${planId}`);
  }

  putEvidence(key: string, trace: GrowEvidenceTrace): GrowEvidenceTrace {
    this.evidence.set(key, trace);
    return trace;
  }

  getEvidence(key: string): GrowEvidenceTrace | undefined {
    return this.evidence.get(key);
  }

  snapshot(): GrowStoreSnapshot {
    return Object.freeze({
      proposals: Object.freeze([...this.proposals.values()]),
      approvals: Object.freeze([...this.approvals.values()]),
      commands: Object.freeze([...this.commands.values()]),
      executions: Object.freeze([...this.executions.values()]),
      activatedPlans: Object.freeze([...this.activatedPlans.values()]),
      recurring: Object.freeze([...this.recurring.values()]),
      monitoring: Object.freeze([...this.monitoring.values()]),
      performance: Object.freeze([...this.performance.values()]),
      evidence: Object.freeze([...this.evidence.values()]),
    });
  }
}
