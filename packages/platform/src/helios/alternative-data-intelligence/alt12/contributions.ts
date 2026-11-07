/**
 * HELIOS ALT12 — per-source contribution diagnostics (non-causal).
 */

import type { FusionRouteDecision, ModalityState, SourceContribution } from './types.ts';

export function computeSourceContributions(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
  fusedSignal: number,
): readonly SourceContribution[] {
  const active = modalities.filter((m) => m.availability === 'PRESENT' && m.featureValue !== null);
  const totalRouteWeight = active.reduce(
    (acc, m) => acc + (route.modalityRouteWeights[m.modality] ?? 0) * m.reliability.effectiveTrust,
    0,
  );

  return Object.freeze(
    active.map((state) => {
      const routeWeight = (route.modalityRouteWeights[state.modality] ?? 0) * state.reliability.effectiveTrust;
      const weightShare = totalRouteWeight > 0 ? routeWeight / totalRouteWeight : 0;
      const without = fusedSignal - weightShare * (state.featureValue ?? 0);
      return Object.freeze({
        modality: state.modality,
        diagnosticMethod: 'leave_one_out' as const,
        fusedSignalDelta: without - fusedSignal,
        weightShare,
        nonCausalDisclaimer: 'NOT_A_CAUSAL_ATTRIBUTION' as const,
      });
    }),
  );
}
