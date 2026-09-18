import type { NoActionEvaluation } from './types.ts';

export function evaluateNoActionValue(input: {
  readonly candidatesRejected: number;
  readonly observedLaterResultMinor: string | null;
}): NoActionEvaluation {
  return Object.freeze({
    candidatesRejected: input.candidatesRejected,
    observedLaterResultMinor: input.observedLaterResultMinor,
    opportunityCostMinor: input.observedLaterResultMinor ?? '0',
    countedAsRealizedProfit: false,
  });
}

export function noActionMustNotInflateNetResult(input: {
  readonly netResultMinor: string;
  readonly noAction: NoActionEvaluation;
}): { readonly adjustedNetMinor: string; readonly avoidedLossNotCountedAsProfit: true } {
  return Object.freeze({
    adjustedNetMinor: input.netResultMinor,
    avoidedLossNotCountedAsProfit: true,
  });
}
