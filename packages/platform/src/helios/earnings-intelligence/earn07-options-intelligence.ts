import { HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED } from './options/qualification.ts';

export const EARN07_OPTIONS_INTELLIGENCE_MODULE =
  'packages/platform/src/helios/earnings-intelligence/options/index.ts' as const;

/** Pipeline-compatible stub; full chain analytics live under `./options/`. */
export function inferOptionsImpliedMoveBps(input: {
  readonly straddlePremiumBps: number;
  readonly knowableBeforeEvent: boolean;
}): { readonly impliedMoveBps: number; readonly usable: boolean } {
  if (!input.knowableBeforeEvent) {
    return Object.freeze({ impliedMoveBps: 0, usable: false });
  }
  return Object.freeze({ impliedMoveBps: input.straddlePremiumBps, usable: true });
}

export { HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED };
