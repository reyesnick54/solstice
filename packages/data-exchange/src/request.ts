import { err, ok, type Result, type UtcInstant } from '@solstice/domain';
import {
  assertKernelAuthorization,
  type KernelAuthorization,
} from '@solstice/kernel';
import type { ContributionDataCategory } from '@solstice/consent';
import type { VerifiedSponsor } from './sponsor.ts';

export type IdentityExposureLevel = 'NONE' | 'COHORT' | 'PSEUDONYMOUS';

export type DataRequest = {
  readonly id: string;
  readonly sponsor: VerifiedSponsor;
  readonly dataCategories: readonly ContributionDataCategory[];
  readonly cohortCriteria: readonly string[];
  readonly purpose: string;
  readonly jurisdiction: string;
  readonly duration: string;
  readonly identityExposureLevel: IdentityExposureLevel;
  readonly compensationMinorUnits: bigint;
  readonly legalTermsRef: string;
  readonly publishedAt: UtcInstant;
};

export type PublishError =
  | { readonly code: 'UNVERIFIED_SPONSOR' }
  | { readonly code: 'INVALID_COMPENSATION' };

/**
 * Buyer requests. An unverified sponsor cannot post.
 * Requests are constructed by callers; this store never fabricates them.
 */
export class DataRequestBook {
  readonly #requests = new Map<string, DataRequest>();

  /** @kernelGated */
  publish(
    authorization: KernelAuthorization,
    input: {
      readonly id: string;
      readonly sponsor: VerifiedSponsor;
      readonly dataCategories: readonly ContributionDataCategory[];
      readonly cohortCriteria: readonly string[];
      readonly purpose: string;
      readonly jurisdiction: string;
      readonly duration: string;
      readonly identityExposureLevel: IdentityExposureLevel;
      readonly compensationMinorUnits: bigint;
      readonly legalTermsRef: string;
      readonly publishedAt: UtcInstant;
    },
  ): Result<DataRequest, PublishError> {
    assertKernelAuthorization(authorization, 'PUBLISH_DATA_REQUEST');
    if (input.sponsor.verified !== true) {
      return err({ code: 'UNVERIFIED_SPONSOR' });
    }
    if (typeof input.compensationMinorUnits !== 'bigint' || input.compensationMinorUnits <= 0n) {
      return err({ code: 'INVALID_COMPENSATION' });
    }
    const request: DataRequest = Object.freeze({
      id: input.id,
      sponsor: input.sponsor,
      dataCategories: Object.freeze(input.dataCategories.slice()),
      cohortCriteria: Object.freeze(input.cohortCriteria.slice()),
      purpose: input.purpose,
      jurisdiction: input.jurisdiction,
      duration: input.duration,
      identityExposureLevel: input.identityExposureLevel,
      compensationMinorUnits: input.compensationMinorUnits,
      legalTermsRef: input.legalTermsRef,
      publishedAt: input.publishedAt,
    });
    this.#requests.set(request.id, request);
    return ok(request);
  }

  get(id: string): DataRequest | undefined {
    return this.#requests.get(id);
  }

  list(): readonly DataRequest[] {
    return [...this.#requests.values()];
  }
}
