import type { OrderPlanningResult, OrderPlanningStoreSnapshot } from './types.ts';

export type OrderPlanningStore = {
  readonly snapshot: () => OrderPlanningStoreSnapshot;
  readonly record: (result: OrderPlanningResult) => OrderPlanningResult;
  readonly findByRequestId: (requestId: string) => OrderPlanningResult | null;
  readonly findByExecutionPlanId: (executionPlanId: string) => readonly OrderPlanningResult[];
};

export function createOrderPlanningStore(
  seed: OrderPlanningStoreSnapshot = Object.freeze({ tactics: Object.freeze([]), planningResults: Object.freeze([]) }),
): OrderPlanningStore {
  const tactics = [...seed.tactics];
  const planningResults = [...seed.planningResults];

  return Object.freeze({
    snapshot: () =>
      Object.freeze({
        tactics: Object.freeze([...tactics]),
        planningResults: Object.freeze([...planningResults]),
      }),
    record: (result) => {
      planningResults.push(result);
      if (result.tactic != null) {
        tactics.push(result.tactic);
      }
      return result;
    },
    findByRequestId: (requestId) => planningResults.find((row) => row.requestId === requestId) ?? null,
    findByExecutionPlanId: (executionPlanId) =>
      Object.freeze(planningResults.filter((row) => row.tactic?.executionPlanId === executionPlanId)),
  });
}
