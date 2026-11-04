import {
  toStrategyLabAdaptiveAlphaQualificationRef,
  type StrategyLabAdaptiveAlphaQualificationRef,
} from '../adaptive-alpha-v2/strategy-lab-bridge.ts';
import type { AdaptiveAlphaQualification } from '../adaptive-alpha-v2/types.ts';

/** EARN11 requires Adaptive Alpha Fabric V2 gates on every genome candidate. */
export const EARN11_AAF_V2_MANDATORY = true as const;

export type Earn11AafV2Binding = {
  readonly mandatory: typeof EARN11_AAF_V2_MANDATORY;
  readonly qualification: AdaptiveAlphaQualification;
  readonly strategyLabRef: StrategyLabAdaptiveAlphaQualificationRef;
  readonly grantsExecutionAuthority: false;
};

export function bindEarn11GenomeToAafV2(input: {
  readonly qualification: AdaptiveAlphaQualification;
}): Earn11AafV2Binding {
  return Object.freeze({
    mandatory: EARN11_AAF_V2_MANDATORY,
    qualification: input.qualification,
    strategyLabRef: toStrategyLabAdaptiveAlphaQualificationRef(input.qualification),
    grantsExecutionAuthority: false,
  });
}

export function assertEarn11AafV2Mandatory(qualification: AdaptiveAlphaQualification | null): boolean {
  if (!EARN11_AAF_V2_MANDATORY) {
    return false;
  }
  if (!qualification) {
    return false;
  }
  return qualification.qualified && qualification.promotionPermitted;
}
