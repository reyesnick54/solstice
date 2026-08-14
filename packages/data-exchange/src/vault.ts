import type { CustomerId } from '@solstice/domain';
import type { ContributionDataCategory } from '@solstice/consent';

/**
 * Eligibility vault. Stores category flags and jurisdiction only.
 * No raw wellness readings, names, or reconstructible personal detail.
 */
export type EligibilityProfile = {
  readonly customerId: CustomerId;
  readonly jurisdiction: string;
  readonly eligibleCategories: readonly ContributionDataCategory[];
  readonly cohortTokens: readonly string[];
};

export class EligibilityVault {
  readonly #profiles = new Map<string, EligibilityProfile>();

  put(profile: EligibilityProfile): EligibilityProfile {
    const frozen = Object.freeze({
      ...profile,
      eligibleCategories: Object.freeze(profile.eligibleCategories.slice()),
      cohortTokens: Object.freeze(profile.cohortTokens.slice()),
    });
    this.#profiles.set(String(profile.customerId), frozen);
    return frozen;
  }

  get(customerId: CustomerId): EligibilityProfile | undefined {
    return this.#profiles.get(String(customerId));
  }

  list(): readonly EligibilityProfile[] {
    return [...this.#profiles.values()];
  }
}
