/**
 * Trace-conformance adapter.
 *
 * Maps sanitized implementation traces onto formal-model transitions and
 * checks invariants after each admitted step. Alignment is evidence, not a
 * proof that the implementation and model are equivalent.
 */

import { exploreModel, type FormalModel } from './explore.ts';
import { modelsForProfile } from './models/index.ts';
import { FORMAL_SMOKE_PROFILE } from './profiles.ts';
import type { FormalModelId, LogicalTrace, TraceConformanceResult } from './types.ts';

function modelById(modelId: FormalModelId): FormalModel<unknown> {
  const found = modelsForProfile(FORMAL_SMOKE_PROFILE).find((model) => model.modelId === modelId);
  if (!found) {
    throw new Error(`no formal model ${modelId}`);
  }
  return found as FormalModel<unknown>;
}

export function replayTrace(trace: LogicalTrace): { readonly aligned: boolean; readonly reason: string } {
  const model = modelById(trace.modelId);
  let state = model.init();
  for (const event of trace.events) {
    const step = model.next(state).find((candidate) => candidate.name === event.action && candidate.next);
    if (!step || !step.next) {
      return { aligned: false, reason: `no model transition for ${event.action}` };
    }
    for (const [property, check] of Object.entries(model.invariants)) {
      if (!check(step.next)) {
        return { aligned: false, reason: `invariant ${property} failed after ${event.action}` };
      }
    }
    state = step.next;
  }
  return { aligned: true, reason: 'trace admitted by formal-model transitions' };
}

export function checkTraceConformance(traces: readonly LogicalTrace[]): readonly TraceConformanceResult[] {
  const byDomain = new Map<LogicalTrace['domain'], LogicalTrace[]>();
  for (const trace of traces) {
    const list = byDomain.get(trace.domain) ?? [];
    list.push(trace);
    byDomain.set(trace.domain, list);
  }
  return [...byDomain.entries()].map(([domain, rows]) => {
    const failed = rows.find((trace) => !replayTrace(trace).aligned);
    return {
      domain,
      tracesChecked: rows.length,
      aligned: !failed,
      note: 'trace conformance is evidence of alignment; it is not a mathematical proof that implementation and model are equivalent',
    };
  });
}

export function smokeExploreAll() {
  return modelsForProfile(FORMAL_SMOKE_PROFILE).map((model) =>
    exploreModel(model, 'FORMAL_SMOKE', 'sunrey-formal-explicit-state/1'),
  );
}
