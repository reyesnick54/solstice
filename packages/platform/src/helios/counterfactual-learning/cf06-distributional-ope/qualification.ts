import {
  HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED,
  HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED,
  type Cf06ValidationStrength,
} from './taxonomy.ts';
import type { Cf06LoggedTrajectorySample, Cf06QualificationResult } from './types.ts';

const MAX_IMPORTANCE_RATIO = 50;
const MIN_SAMPLES_STRONG = 20;

/**
 * CF06 distributional OPE is qualified for the engineering gate only under STRONG declared validation,
 * adequate sample size, and well-behaved importance weights. WEAK or NONE keeps estimators research-only.
 */
export function evaluateCf06DistributionalOpeQualification(input: {
  readonly samples: readonly Cf06LoggedTrajectorySample[];
  readonly declaredValidationStrength: Cf06ValidationStrength;
}): Cf06QualificationResult {
  const blockers: string[] = [];
  const { samples, declaredValidationStrength } = input;

  if (samples.length === 0) {
    blockers.push('no logged trajectory samples');
  }

  if (declaredValidationStrength === 'NONE') {
    blockers.push('declared validation strength NONE — estimators are not eligible for qualification');
  }

  if (declaredValidationStrength === 'WEAK') {
    blockers.push('declared validation is WEAK — distributional OPE remains research-only, not production-candidate');
  }

  if (samples.length > 0 && samples.length < MIN_SAMPLES_STRONG) {
    blockers.push(`need at least ${MIN_SAMPLES_STRONG} samples for STRONG qualification`);
  }

  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    const b = s.behaviorPolicyProbabilityBps;
    const e = s.evalPolicyProbabilityBps;
    if (!(b > 0 && e > 0)) {
      blockers.push(`sample ${i}: behavior and eval policy probabilities must be positive bps`);
      break;
    }
    const ratio = e / b;
    if (ratio > MAX_IMPORTANCE_RATIO || ratio < 1 / MAX_IMPORTANCE_RATIO) {
      blockers.push(
        `sample ${i}: importance ratio πe/πb (${ratio.toFixed(4)}) outside [1/${MAX_IMPORTANCE_RATIO}, ${MAX_IMPORTANCE_RATIO}]`,
      );
      break;
    }
  }

  const qualified = blockers.length === 0 && declaredValidationStrength === 'STRONG';
  return {
    marker: qualified ? HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED : HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED,
    blockers: Object.freeze([...blockers]),
  };
}

export { HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED, HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED };
