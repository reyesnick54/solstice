import { publicAssuranceView } from './report.ts';
import type { FormalVerificationReport } from './types.ts';

export const FORMAL_DASHBOARD_ID = 'FORMAL_ASSURANCE' as const;

export function formalDashboardPanels(): readonly string[] {
  return Object.freeze([
    'formal_models_verified',
    'formal_counterexamples',
    'formal_trace_alignment',
    'formal_rust_harnesses',
  ]);
}

export function formalDashboardPayload(report: FormalVerificationReport): Record<string, unknown> {
  const view = publicAssuranceView(report);
  return {
    id: FORMAL_DASHBOARD_ID,
    title: 'Formal Assurance',
    schemaVersion: 1,
    label: 'MODEL_CHECKED_WITHIN_STATED_BOUNDS',
    secretsExposed: false,
    panels: formalDashboardPanels(),
    input: view,
  };
}
