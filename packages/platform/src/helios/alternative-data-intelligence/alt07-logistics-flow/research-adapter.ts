/**
 * Optional research graph adapter — forecasts only; never controls execution.
 */

import type { UtcInstant } from '@solstice/domain';
import type { Alt07ResearchForecastHint, Alt07SpatiotemporalGraphSnapshot, LogisticsDisruptionState } from './types.ts';
import type { ResearchGraphAdapterKind } from './taxonomy.ts';

export type ResearchGraphAdapterInput = {
  readonly graph: Alt07SpatiotemporalGraphSnapshot;
  readonly disruptions: readonly LogisticsDisruptionState[];
  readonly decisionTimeUtc: UtcInstant;
  readonly adapter: ResearchGraphAdapterKind;
};

export function runResearchGraphAdapter(input: ResearchGraphAdapterInput): readonly Alt07ResearchForecastHint[] {
  const hints: Alt07ResearchForecastHint[] = [];
  for (const disruption of input.disruptions) {
    const score = Math.min(0.99, disruption.routeDisruptionIndex + disruption.freightStressIndex * 0.25);
    const forecastKind =
      disruption.scope === 'PORT'
        ? ('PORT_DISRUPTION' as const)
        : disruption.scope === 'ROUTE'
          ? ('FLOW_ANOMALY' as const)
          : ('SUPPLIER_DISRUPTION' as const);
    hints.push(
      Object.freeze({
        forecastKind,
        targetRef: disruption.scopeRef,
        score,
        adapter: input.adapter,
        rationale: `${input.adapter} research hint from graph v${input.graph.graphVersion}; execution disabled.`,
        controlsExecution: false,
        knowableAt: input.decisionTimeUtc,
      }),
    );
  }
  return Object.freeze(hints);
}
