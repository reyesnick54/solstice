import type { SerializedMoney } from '../../mandate/types.ts';

export type OutcomeAttribution = {
  readonly metric: string;
  readonly projected: SerializedMoney | null;
  readonly realized: SerializedMoney | null;
  readonly projectedNotRealized: true;
  readonly depositsAreNotPerformance: true;
  readonly note: string;
};

export function projectedVsRealized(input: {
  readonly metric: string;
  readonly projectedMinorUnits: string | null;
  readonly realizedMinorUnits: string | null;
  readonly currency: string;
}): OutcomeAttribution {
  return Object.freeze({
    metric: input.metric,
    projected:
      input.projectedMinorUnits === null
        ? null
        : { minorUnits: input.projectedMinorUnits, currency: input.currency },
    realized:
      input.realizedMinorUnits === null
        ? null
        : { minorUnits: input.realizedMinorUnits, currency: input.currency },
    projectedNotRealized: true,
    depositsAreNotPerformance: true,
    note: 'Projected values are not realized outcomes.',
  });
}

export function presentOutcomeToUser(attribution: OutcomeAttribution): {
  readonly displayProjected: boolean;
  readonly displayRealized: boolean;
  readonly warning?: string;
} {
  const displayRealized = attribution.realized !== null;
  const displayProjected = attribution.projected !== null && !displayRealized;
  return Object.freeze({
    displayProjected,
    displayRealized,
    ...(displayProjected ? { warning: 'Projection only; not realized performance.' } : {}),
  });
}
