/**
 * ALT10 — bind alternative-data features to AAF V2 certification (research only).
 */

import type { AdaptiveAlphaQualification } from '../adaptive-alpha-v2/types.ts';
import {
  toStrategyLabAdaptiveAlphaQualificationRef,
  type StrategyLabAdaptiveAlphaQualificationRef,
} from '../adaptive-alpha-v2/strategy-lab-bridge.ts';

export const ALT10_AAF_V2_MANDATORY = true as const;

export type AltAafV2Binding = {
  readonly mandatory: typeof ALT10_AAF_V2_MANDATORY;
  readonly qualification: AdaptiveAlphaQualification;
  readonly strategyLabRef: StrategyLabAdaptiveAlphaQualificationRef;
  readonly grantsExecutionAuthority: false;
  readonly rawProviderRecordsInGenome: false;
};

export function bindAltIntelligenceToAafV2(input: {
  readonly qualification: AdaptiveAlphaQualification;
}): AltAafV2Binding {
  return Object.freeze({
    mandatory: ALT10_AAF_V2_MANDATORY,
    qualification: input.qualification,
    strategyLabRef: toStrategyLabAdaptiveAlphaQualificationRef(input.qualification),
    grantsExecutionAuthority: false,
    rawProviderRecordsInGenome: false,
  });
}
