export const EARN07_OPTIONS_INTELLIGENCE_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn07-options-intelligence.ts' as const;

export function inferOptionsImpliedMoveBps(input: {
  readonly straddlePremiumBps: number;
  readonly knowableBeforeEvent: boolean;
}): { readonly impliedMoveBps: number; readonly usable: boolean } {
  if (!input.knowableBeforeEvent) {
    return Object.freeze({ impliedMoveBps: 0, usable: false });
  }
  return Object.freeze({ impliedMoveBps: input.straddlePremiumBps, usable: true });
}
