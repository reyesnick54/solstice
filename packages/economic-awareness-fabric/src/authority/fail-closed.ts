/**
 * Fail-closed trust boundaries for external information.
 *
 * Untrusted external data must never silently become VerifiedEconomicFact.
 */

import type { ExternalObservation } from '../../../provider-sdk/src/types.ts';
import type {
  CanonicalEconomicClaim,
  EconomicObservation,
  VerifiedEconomicFact,
} from '../../../sunrey-chain/src/economic-proof/types.ts';

export type TrustBoundaryViolation =
  | 'UNKNOWN_PROVIDER'
  | 'CONFIGURED_NOT_TRUSTED'
  | 'API_RESPONSE_NOT_VERIFIED_FACT'
  | 'MULTIPLE_RESPONSES_NOT_CONSENSUS'
  | 'RAW_OBSERVATION_NOT_CLAIM'
  | 'CLAIM_NOT_MONETARY_AUTHORIZATION'
  | 'MISSING_PROVENANCE'
  | 'MISSING_LICENSE';

export type TrustBoundaryResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly violation: TrustBoundaryViolation; readonly detail: string };

export type ProviderTrustState = 'unknown' | 'catalog_registered' | 'certified' | 'trusted';

export function unknownProviderIsUntrusted(providerId: string, trust: ProviderTrustState): TrustBoundaryResult {
  if (trust === 'unknown' || providerId.trim().length === 0) {
    return { ok: false, violation: 'UNKNOWN_PROVIDER', detail: `provider ${providerId || '(empty)'} is untrusted` };
  }
  return { ok: true };
}

export function configuredProviderIsNotTrusted(trust: ProviderTrustState): TrustBoundaryResult {
  if (trust === 'catalog_registered') {
    return {
      ok: false,
      violation: 'CONFIGURED_NOT_TRUSTED',
      detail: 'catalog registration does not imply trust; certification required for promotion',
    };
  }
  return { ok: true };
}

export function apiResponseIsNotVerifiedFact(observation: ExternalObservation<unknown>): TrustBoundaryResult {
  if (observation.quality.validationStatus === 'provider_validated') {
    return { ok: true };
  }
  return {
    ok: false,
    violation: 'API_RESPONSE_NOT_VERIFIED_FACT',
    detail: `successful API response from ${observation.providerId} is not a verified economic fact`,
  };
}

export function multipleResponsesAreNotConsensus(corroborationCount: number, quorumRequired: number): TrustBoundaryResult {
  if (corroborationCount < quorumRequired) {
    return {
      ok: false,
      violation: 'MULTIPLE_RESPONSES_NOT_CONSENSUS',
      detail: `corroborationCount ${corroborationCount} < quorum ${quorumRequired}`,
    };
  }
  return { ok: true };
}

export function rawObservationIsNotClaim(_observation: EconomicObservation): TrustBoundaryResult {
  return {
    ok: false,
    violation: 'RAW_OBSERVATION_NOT_CLAIM',
    detail: 'raw observation must pass corroboration and claim promotion pipeline',
  };
}

export function claimIsNotMonetaryAuthorization(_claim: CanonicalEconomicClaim): TrustBoundaryResult {
  return {
    ok: false,
    violation: 'CLAIM_NOT_MONETARY_AUTHORIZATION',
    detail: 'canonical economic claim requires Chunk 71 gate and governance for monetary authorization',
  };
}

export function verifiedFactRequiresPromotionPipeline(fact: VerifiedEconomicFact | null): TrustBoundaryResult {
  if (!fact) {
    return { ok: false, violation: 'API_RESPONSE_NOT_VERIFIED_FACT', detail: 'no verified fact produced' };
  }
  if (fact.verificationStatus !== 'VERIFIED') {
    return {
      ok: false,
      violation: 'API_RESPONSE_NOT_VERIFIED_FACT',
      detail: `fact ${fact.verifiedFactId} status ${fact.verificationStatus}`,
    };
  }
  return { ok: true };
}

export const FAIL_CLOSED_RULES = Object.freeze({
  unknownProviderUntrusted: true,
  configuredNotTrusted: true,
  apiResponseNotVerifiedFact: true,
  multipleResponsesNotConsensus: true,
  rawObservationNotClaim: true,
  claimNotMonetaryAuthorization: true,
});
