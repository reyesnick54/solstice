import type { PegReadView } from './types.ts';

/**
 * Controlled PEG read port. The Agent runtime never copies PEG financial
 * state into long-term memory as if it were a second profile store.
 */
export type PegReadPort = {
  snapshot(subjectId: string): PegReadView | null;
};

export function emptyPegView(subjectId: string): PegReadView {
  return Object.freeze({
    subjectId,
    authoritativeBalance: false,
    ledgerWins: true,
    goalLabels: Object.freeze([]),
    incomeLabels: Object.freeze([]),
    obligationLabels: Object.freeze([]),
    opportunityTitles: Object.freeze([]),
  });
}

export function pegViewFromLabels(input: {
  readonly subjectId: string;
  readonly goalLabels?: readonly string[];
  readonly incomeLabels?: readonly string[];
  readonly obligationLabels?: readonly string[];
  readonly opportunityTitles?: readonly string[];
}): PegReadView {
  return Object.freeze({
    subjectId: input.subjectId,
    authoritativeBalance: false,
    ledgerWins: true,
    goalLabels: Object.freeze([...(input.goalLabels ?? [])]),
    incomeLabels: Object.freeze([...(input.incomeLabels ?? [])]),
    obligationLabels: Object.freeze([...(input.obligationLabels ?? [])]),
    opportunityTitles: Object.freeze([...(input.opportunityTitles ?? [])]),
  });
}
