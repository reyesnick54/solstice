import type { ChildOrder, ExecutionAlgorithmState, ExecutionSchedule, ParentOrder } from './types.ts';
import type { ChildOrderId, ParentOrderId } from './ids.ts';

export type ExecutionAlgorithmStore = {
  putParent(parent: ParentOrder): void;
  getParent(parentOrderId: ParentOrderId): ParentOrder | null;
  putSchedule(schedule: ExecutionSchedule): void;
  getScheduleForParent(parentOrderId: ParentOrderId): ExecutionSchedule | null;
  putState(state: ExecutionAlgorithmState): void;
  getState(parentOrderId: ParentOrderId): ExecutionAlgorithmState | null;
  putChild(child: ChildOrder): void;
  getChild(childOrderId: ChildOrderId): ChildOrder | null;
  listChildren(parentOrderId: ParentOrderId): readonly ChildOrder[];
  snapshot(): {
    readonly parents: readonly ParentOrder[];
    readonly children: readonly ChildOrder[];
    readonly schedules: readonly ExecutionSchedule[];
    readonly states: readonly ExecutionAlgorithmState[];
  };
};

export function createExecutionAlgorithmStore(): ExecutionAlgorithmStore {
  const parents = new Map<ParentOrderId, ParentOrder>();
  const schedules = new Map<ParentOrderId, ExecutionSchedule>();
  const states = new Map<ParentOrderId, ExecutionAlgorithmState>();
  const children = new Map<ChildOrderId, ChildOrder>();
  const childrenByParent = new Map<ParentOrderId, ChildOrderId[]>();

  return {
    putParent(parent) {
      parents.set(parent.parentOrderId, parent);
    },
    getParent(parentOrderId) {
      return parents.get(parentOrderId) ?? null;
    },
    putSchedule(schedule) {
      schedules.set(schedule.parentOrderId, schedule);
    },
    getScheduleForParent(parentOrderId) {
      return schedules.get(parentOrderId) ?? null;
    },
    putState(state) {
      states.set(state.parentOrderId, state);
    },
    getState(parentOrderId) {
      return states.get(parentOrderId) ?? null;
    },
    putChild(child) {
      children.set(child.childOrderId, child);
      const bucket = childrenByParent.get(child.parentOrderId) ?? [];
      if (!bucket.includes(child.childOrderId)) {
        bucket.push(child.childOrderId);
        childrenByParent.set(child.parentOrderId, bucket);
      }
    },
    getChild(childOrderId) {
      return children.get(childOrderId) ?? null;
    },
    listChildren(parentOrderId) {
      const ids = childrenByParent.get(parentOrderId) ?? [];
      return Object.freeze(ids.map((id) => children.get(id)!).filter(Boolean));
    },
    snapshot() {
      return Object.freeze({
        parents: Object.freeze([...parents.values()]),
        children: Object.freeze([...children.values()]),
        schedules: Object.freeze([...schedules.values()]),
        states: Object.freeze([...states.values()]),
      });
    },
  };
}
