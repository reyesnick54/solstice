/**
 * Differential privacy port.
 *
 * FLAG FOR SPECIALIST REVIEW: the default mechanism is a documented simple
 * integer noise function. It does NOT claim a formal (ε, δ)-DP guarantee.
 * Parameters below are placeholders for a privacy specialist.
 *
 * Specialist-review parameters (not proven):
 * - epsilonMilli: 1000  (would mean ε = 1 if this were Laplace DP — it is not)
 * - delta: not used; no δ is claimed
 * - sensitivity: 1 count
 * - mechanism: hash-derived integer noise in {-1, 0, 1}
 * - composition: each query consumes 1 budget unit; no advanced composition
 */

export type PrivacyBudget = {
  readonly remainingUnits: number;
  readonly consumedUnits: number;
  readonly unitCostPerQuery: number;
};

export type NoiseResult = {
  readonly noisedValue: bigint;
  readonly noiseApplied: bigint;
  readonly formalGuaranteeClaimed: false;
  readonly specialistReviewRequired: true;
  readonly mechanismName: string;
};

export interface DifferentialPrivacyMechanism {
  readonly name: string;
  readonly formalGuaranteeClaimed: false;
  readonly specialistReviewRequired: true;
  readonly epsilonMilli: number;
  readonly sensitivity: number;
  addIntegerNoise(trueValue: bigint, salt: string): NoiseResult;
}

/**
 * Hash-derived integer noise. Deterministic for a given salt so tests are
 * stable. NOT Laplace, NOT geometric DP, NOT a formal privacy guarantee.
 */
export class HashIntegerNoiseMechanism implements DifferentialPrivacyMechanism {
  readonly name = 'HASH_INTEGER_NOISE_V1_NOT_FORMAL_DP';
  readonly formalGuaranteeClaimed = false as const;
  readonly specialistReviewRequired = true as const;
  readonly epsilonMilli = 1000;
  readonly sensitivity = 1;

  addIntegerNoise(trueValue: bigint, salt: string): NoiseResult {
    let hash = 0;
    for (let i = 0; i < salt.length; i += 1) {
      hash = (hash * 31 + salt.charCodeAt(i)) | 0;
    }
    const noise = BigInt((Math.abs(hash) % 3) - 1);
    return Object.freeze({
      noisedValue: trueValue + noise,
      noiseApplied: noise,
      formalGuaranteeClaimed: false,
      specialistReviewRequired: true,
      mechanismName: this.name,
    });
  }
}
