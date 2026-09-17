import type { InMemoryGrowStore } from '../../grow/store.ts';
import type { PaperGrowMetricsSnapshot } from './types.ts';

export function collectPaperGrowMetrics(
  growStore: InMemoryGrowStore,
  input: {
    readonly activeWorkOrders: number;
    readonly researchTasks: number;
    readonly qualifiedOpportunities: number;
    readonly degradedStates: number;
    readonly restartRecoveryActions: number;
    readonly totalResearchCostMinorUnits: string;
    readonly netPaperResultMinorUnits: string;
  },
): PaperGrowMetricsSnapshot {
  const snap = growStore.snapshot();
  const allowed = snap.executions.filter((row) => row.state === 'COMPLETED' || row.state === 'PARTIALLY_COMPLETED').length;
  const rejected = snap.proposals.filter((row) => row.state === 'REJECTED' || row.state === 'CANCELLED').length;
  const pending = snap.proposals.filter(
    (row) => row.state === 'AWAITING_APPROVAL' || row.state === 'AWAITING_STEP_UP',
  ).length;
  return Object.freeze({
    activeWorkOrders: input.activeWorkOrders,
    researchTasks: input.researchTasks,
    qualifiedOpportunities: input.qualifiedOpportunities,
    proposals: snap.proposals.length,
    controlOutcomes: Object.freeze({ allowed, rejected, pending }),
    paperPositions: allowed,
    completedCycles: allowed,
    degradedStates: input.degradedStates,
    restartRecoveryActions: input.restartRecoveryActions,
    totalResearchCostMinorUnits: input.totalResearchCostMinorUnits,
    netPaperResultMinorUnits: input.netPaperResultMinorUnits,
  });
}
