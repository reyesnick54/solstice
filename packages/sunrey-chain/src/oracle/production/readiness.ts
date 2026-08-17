/**
 * Chunk 68 readiness slots for the Chunk 65 mainnet readiness plane.
 *
 * Distinguishes technical implementation, provider configuration,
 * agreement evidence, and production eligibility. Software is never
 * sufficient for production feeds.
 */

import type { EvidenceState } from '../../mainnet/types.ts';

export type ProductionOracleReadinessState = {
  readonly technicalImplementation: EvidenceState;
  readonly providerConfigured: EvidenceState;
  readonly providerAgreementEvidence: EvidenceState;
  readonly productionEligible: EvidenceState;
  readonly developmentFixturesAreProductionFeeds: false;
  readonly unsupportedProductionProviderClaim: false;
};

export function productionOracleReadiness(): ProductionOracleReadinessState {
  return Object.freeze({
    technicalImplementation: 'ENGINEERING_VERIFIED',
    providerConfigured: 'ENGINEERING_VERIFIED',
    providerAgreementEvidence: 'NOT_PROVIDED',
    productionEligible: 'NOT_PROVIDED',
    developmentFixturesAreProductionFeeds: false,
    unsupportedProductionProviderClaim: false,
  });
}

export function distinguishReadiness(state: ProductionOracleReadinessState): {
  readonly technical: boolean;
  readonly configured: boolean;
  readonly agreement: boolean;
  readonly production: boolean;
} {
  return Object.freeze({
    technical: state.technicalImplementation === 'ENGINEERING_VERIFIED',
    configured: state.providerConfigured === 'ENGINEERING_VERIFIED',
    agreement: state.providerAgreementEvidence === 'HUMAN_VERIFIED',
    production: state.productionEligible === 'HUMAN_VERIFIED',
  });
}
