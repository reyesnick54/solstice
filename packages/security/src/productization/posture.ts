/**
 * Phase I Prompt 2 production HSM/KMS gate.
 *
 * Software KeyProvider / HsmKmsProvider interfaces may be complete.
 * An external commercial HSM or cloud KMS is not connected.
 * Production signing fails closed while this gate is false.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { HsmKmsProvider } from '../hsm-kms.ts';
import type { KeyProvider } from '../provider.ts';
import type { KeyPurpose } from '../purposes.ts';

export const PRODUCTION_HSM_KMS_CONFIGURED = false as const;
export const EXTERNAL_HSM_KMS_CONNECTED = false as const;
export const PRODUCTION_SIGNING_ENABLED = false as const;

export const HSM_KMS_POSTURE = Object.freeze({
  PRODUCTION_HSM_KMS_CONFIGURED,
  EXTERNAL_HSM_KMS_CONNECTED,
  PRODUCTION_SIGNING_ENABLED,
  ENVIRONMENT: 'simulation' as const,
  vendorSelected: null,
  simulationInterfaceComplete: true,
  independentAuditComplete: false,
});

const PRODUCTION_SIGNING_PURPOSES = Object.freeze([
  'EXECUTION_AUTHORITY_SIGNING',
  'ADMINISTRATION_SIGNING',
  'VALIDATOR_CONSENSUS_SIGNING',
  'WALLET_SIGNING',
  'GENESIS_SIGNING',
  'GOVERNANCE_SIGNING',
  'RELEASE_SIGNING',
] as const satisfies readonly KeyPurpose[]);

export type ProductionSigningPurpose = (typeof PRODUCTION_SIGNING_PURPOSES)[number];

export function isProductionSigningPurpose(purpose: KeyPurpose): purpose is ProductionSigningPurpose {
  return (PRODUCTION_SIGNING_PURPOSES as readonly string[]).includes(purpose);
}

export function assertHsmGateClosed(): SecurityResult<true> {
  if (PRODUCTION_HSM_KMS_CONFIGURED !== false) {
    return securityErr(
      'PRODUCTION_CLAIM_FORBIDDEN',
      'PRODUCTION_HSM_KMS_CONFIGURED must remain false until an external HSM/KMS is connected and verified',
    );
  }
  return securityOk(true);
}

/**
 * Production signing functions fail closed when the secure key service
 * is absent. Simulation KeyProvider / DevelopmentHsmSimulator remain
 * available for tests and rehearsal.
 */
export function requireProductionSigningProvider(
  provider: KeyProvider | HsmKmsProvider,
  purpose: KeyPurpose,
): SecurityResult<KeyProvider | HsmKmsProvider> {
  const gate = assertHsmGateClosed();
  if (!gate.ok) {
    return gate;
  }
  if (isProductionSigningPurpose(purpose) && PRODUCTION_HSM_KMS_CONFIGURED !== true) {
    return securityErr(
      'PRODUCTION_HSM_REQUIRED',
      `production signing of ${purpose} fails closed: PRODUCTION_HSM_KMS_CONFIGURED=false and no external HSM/KMS is connected`,
    );
  }
  if ('simulation' in provider && provider.simulation === true && PRODUCTION_HSM_KMS_CONFIGURED !== true) {
    return securityErr(
      'PRODUCTION_HSM_REQUIRED',
      'simulation HSM/KMS cannot satisfy a production signing request',
    );
  }
  if (provider.environmentLabel.toLowerCase().includes('simulation') && isProductionSigningPurpose(purpose)) {
    return securityErr(
      'PRODUCTION_HSM_REQUIRED',
      `provider '${provider.providerId}' is labeled ${provider.environmentLabel}; production signing is refused`,
    );
  }
  return securityOk(provider);
}

export function productionSigningUnavailableReason(): string {
  return 'PRODUCTION_HSM_KMS_CONFIGURED=false; DevelopmentHsmSimulator is not a launch key; external HSM/KMS is not connected';
}
