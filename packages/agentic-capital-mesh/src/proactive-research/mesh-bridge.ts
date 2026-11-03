import type { Clock } from '../imports.ts';
import {
  DEFAULT_MESH_BUDGET_LIMITS,
  ResearchMeshBudgetController,
  ResearchMeshStore,
  SpecialistResearchMesh,
  type OpportunityKind,
} from '../research-mesh/index.ts';

export type ProactiveMeshEvidenceRef = {
  readonly evidenceId: string;
  readonly sourceRef: string;
  readonly sourceKind: string;
  readonly contentHash: string;
};

export type ProactiveTriggeredResearchInput = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly opportunityKind: OpportunityKind;
  readonly evidenceBundle: readonly ProactiveMeshEvidenceRef[];
};

export type ProactiveTriggeredResearchAgentSummary = {
  readonly role: string;
  readonly taskId: string;
  readonly modelProvider: string;
  readonly modelId: string;
  readonly sourceRefs: readonly string[];
  readonly costMicros: bigint;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type ProactiveTriggeredResearchCost = {
  readonly totalCostMicros: bigint;
  readonly modelCosts: readonly {
    readonly provider: string;
    readonly modelId: string;
    readonly costMicros: bigint;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly inferenceCalls: number;
  }[];
  readonly providerTotalsMicros: Readonly<Record<string, string>>;
};

export type ProactiveTriggeredResearchResult =
  | {
      readonly ok: true;
      readonly meshRunId: string;
      readonly agents: readonly ProactiveTriggeredResearchAgentSummary[];
      readonly sourcesUsed: readonly string[];
      readonly cost: ProactiveTriggeredResearchCost;
      readonly confidenceAfter: 'CALIBRATED' | 'LOW_CONFIDENCE' | 'UNKNOWN';
    }
  | { readonly ok: false; readonly message: string };

export type ProactiveResearchMeshBridge = {
  readonly runTriggeredResearch: (
    input: ProactiveTriggeredResearchInput,
  ) => ProactiveTriggeredResearchResult;
};

export type ProactiveResearchMeshBridgeOptions = {
  readonly clock: Clock;
  readonly store?: ResearchMeshStore;
  readonly budget?: ResearchMeshBudgetController;
};

function aggregateCost(agents: readonly ProactiveTriggeredResearchAgentSummary[]): ProactiveTriggeredResearchCost {
  const modelCosts = agents.map((agent) =>
    Object.freeze({
      provider: agent.modelProvider,
      modelId: agent.modelId,
      costMicros: agent.costMicros,
      inputTokens: agent.inputTokens,
      outputTokens: agent.outputTokens,
      inferenceCalls: 1,
    }),
  );
  const providerTotalsMicros: Record<string, bigint> = {};
  let totalCostMicros = 0n;
  for (const agent of agents) {
    totalCostMicros += agent.costMicros;
    providerTotalsMicros[agent.modelProvider] =
      (providerTotalsMicros[agent.modelProvider] ?? 0n) + agent.costMicros;
  }
  const providerTotals: Record<string, string> = {};
  for (const [provider, micros] of Object.entries(providerTotalsMicros)) {
    providerTotals[provider] = micros.toString();
  }
  return Object.freeze({
    totalCostMicros,
    modelCosts: Object.freeze(modelCosts),
    providerTotalsMicros: Object.freeze(providerTotals),
  });
}

/**
 * Specialist mesh adapter for proactive monitor triggers (research-only).
 */
export function createProactiveResearchMeshBridge(
  options: ProactiveResearchMeshBridgeOptions,
): ProactiveResearchMeshBridge {
  const store = options.store ?? new ResearchMeshStore();
  const budget = options.budget ?? new ResearchMeshBudgetController(DEFAULT_MESH_BUDGET_LIMITS);
  const mesh = new SpecialistResearchMesh({ clock: options.clock, store, budget });

  return Object.freeze({
    runTriggeredResearch(input) {
      const result = mesh.runResearch({
        workOrderId: input.workOrderId,
        subjectId: input.subjectId,
        objective: input.objective,
        opportunityKind: input.opportunityKind,
        privacyClass: 'PUBLIC_RESEARCH',
        contextRef: `proactive_ctx_${input.workOrderId}`,
        evidenceBundle: input.evidenceBundle.map((row) =>
          Object.freeze({
            ...row,
            sourceKind: row.sourceKind as 'MARKET_OBSERVATION',
          }),
        ),
      });
      if (!result.ok) {
        return { ok: false, message: result.error.message };
      }
      const agents = result.value.outputs.map((row) =>
        Object.freeze({
          role: row.specialistRole,
          taskId: row.taskId,
          modelProvider: row.model.provider,
          modelId: row.model.modelId,
          sourceRefs: Object.freeze(row.evidenceReferences.map((ev) => ev.sourceRef)),
          costMicros: row.usage.costMicros,
          inputTokens: row.usage.inputTokens,
          outputTokens: row.usage.outputTokens,
        }),
      );
      const sourcesUsed = Object.freeze([...new Set(agents.flatMap((row) => row.sourceRefs))]);
      return Object.freeze({
        ok: true,
        meshRunId: result.value.run.runId,
        agents,
        sourcesUsed,
        cost: aggregateCost(agents),
        confidenceAfter: 'CALIBRATED',
      });
    },
  });
}
