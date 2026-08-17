/**
 * Production-candidate cryptographic policy.
 *
 * Reflects actual implementation evidence. Does not require a PQ/HSM
 * combination that current production-class providers do not support.
 */

import {
  CHAIN_KEY_PURPOSES,
  DEVELOPMENT_HSM_PROVIDER_ID,
  PQC_LIBRARY_SELECTION,
  SUITE_SUNREY_ED25519_V1,
} from '../../../security/src/index.ts';
import type { CryptographicPolicyManifest } from './types.ts';

export const PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID = 'sunrey.cryptopolicy.production-candidate.ed25519.v1' as const;
export const PRODUCTION_CANDIDATE_FEE_POLICY = 'sunrey.fees.production-candidate.v1' as const;

export function productionCandidateCryptoPolicy(): CryptographicPolicyManifest {
  return Object.freeze({
    policyId: PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID,
    consensusSuiteId: SUITE_SUNREY_ED25519_V1,
    pqRequiredForConsensus: false,
    hsmRequiredForConsensus: false,
    productionPqProvider: null,
    productionHsmProvider: null,
    supportedRoles: Object.freeze([...CHAIN_KEY_PURPOSES]),
    supportedProviders: Object.freeze([
      'ed25519-development',
      PQC_LIBRARY_SELECTION.selectedProvider.providerId,
      DEVELOPMENT_HSM_PROVIDER_ID,
    ]),
    notes:
      'Consensus uses sunrey-ed25519-v1 because production-class PQ/HSM provider evidence is absent. PQC software is TESTNET_APPROVED only. Simulation HSM is not a real provider.',
  });
}

export function rejectUnsupportedPqHsmRequirement(policy: CryptographicPolicyManifest): void {
  if (policy.pqRequiredForConsensus) {
    throw new TypeError('production consensus must not require PQ without a production PQ provider');
  }
  if (policy.hsmRequiredForConsensus) {
    throw new TypeError('production consensus must not require HSM without a real HSM provider');
  }
  if (policy.productionPqProvider !== null || policy.productionHsmProvider !== null) {
    throw new TypeError('do not record a production PQ/HSM provider that does not exist');
  }
}
