/**
 * Strategy Lab promotion gate for AAF V2 dataset certification (portable summary).
 */

export type StrategyLabAdaptiveAlphaGateStatus = 'PASS' | 'WARNING' | 'FAIL';

export type StrategyLabAdaptiveAlphaQualificationRef = {
  readonly qualificationId: string;
  readonly contentHash: string;
  readonly promotionPermitted: boolean;
  readonly failedGates: readonly string[];
  readonly policyHash: string;
};

export function gatePromotionOnAdaptiveAlphaQualification(input: {
  readonly qualification: StrategyLabAdaptiveAlphaQualificationRef | null | undefined;
  readonly requireQualification: boolean;
}): { readonly permitted: boolean; readonly blockers: readonly string[] } {
  const blockers: string[] = [];
  if (!input.requireQualification) {
    return Object.freeze({ permitted: true, blockers: Object.freeze([]) });
  }
  if (!input.qualification) {
    blockers.push('adaptive_alpha_qualification_missing');
  } else {
    if (!input.qualification.promotionPermitted) {
      blockers.push('adaptive_alpha_qualification_blocked');
    }
    if (input.qualification.failedGates.length > 0) {
      blockers.push(...input.qualification.failedGates.map((gate) => `aaf_gate_${gate.toLowerCase()}`));
    }
  }
  return Object.freeze({
    permitted: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
