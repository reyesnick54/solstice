/**
 * Wave 7 — production HSM/KMS signing boundary.
 *
 * Application requests a signature; private key never enters application
 * memory for high-value keys. Provider-neutral; no cloud vendor lock-in.
 *
 * Status: INTERFACE READY — NOT PRODUCTION CONNECTED.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { HsmKmsProvider, HsmKeyHandle } from '../hsm-kms.ts';
import type { KeyPurpose } from '../purposes.ts';
import {
  EXTERNAL_HSM_KMS_CONNECTED,
  PRODUCTION_HSM_KMS_CONFIGURED,
  requireProductionSigningProvider,
} from './posture.ts';
import type { KeyRole } from './key-classification.ts';
import { KEY_ROLE_POLICIES } from './key-classification.ts';

export const HSM_KMS_CONNECTION_STATUS = 'INTERFACE_READY_NOT_PRODUCTION_CONNECTED' as const;

export type HsmKmsConnectionPosture = {
  readonly status: typeof HSM_KMS_CONNECTION_STATUS;
  readonly interfaceReady: true;
  readonly productionConnected: false;
  readonly productionHsmKmsConfigured: false;
  readonly externalHsmKmsConnected: false;
  readonly privateKeyNeverInApplicationMemory: true;
  readonly vendorSelected: null;
};

export const HSM_KMS_PRODUCTION_POSTURE: HsmKmsConnectionPosture = Object.freeze({
  status: HSM_KMS_CONNECTION_STATUS,
  interfaceReady: true,
  productionConnected: false,
  productionHsmKmsConfigured: PRODUCTION_HSM_KMS_CONFIGURED,
  externalHsmKmsConnected: EXTERNAL_HSM_KMS_CONNECTED,
  privateKeyNeverInApplicationMemory: true,
  vendorSelected: null,
});

const HSM_REQUIRED_ROLES: readonly KeyRole[] = Object.freeze(
  (['USER_WALLET_KEY', 'VALIDATOR_KEY', 'GOVERNANCE_SIGNING_KEY'] as const).filter(
    (role) => KEY_ROLE_POLICIES[role].hsmRequired,
  ),
);

export type RemoteSignRequest = {
  readonly role: KeyRole;
  readonly purpose: KeyPurpose;
  readonly digest: Buffer;
  readonly requesterId: string;
  readonly handle: HsmKeyHandle;
};

export type RemoteSignResult = {
  readonly signatureRef: string;
  readonly keyId: string;
  readonly keyVersion: number;
  readonly providerId: string;
  readonly privateKeyEnteredApplicationMemory: false;
  readonly attestationRef: string | null;
};

export function assertHsmRequiredForRole(role: KeyRole): SecurityResult<true> {
  if (!KEY_ROLE_POLICIES[role].hsmRequired) {
    return securityOk(true);
  }
  if (!PRODUCTION_HSM_KMS_CONFIGURED) {
    return securityErr(
      'PRODUCTION_HSM_REQUIRED',
      `${role} requires HSM/KMS; status=${HSM_KMS_CONNECTION_STATUS}`,
    );
  }
  return securityOk(true);
}

/**
 * Request a remote signature. The application receives only a signature
 * reference and attestation metadata — never private key bytes.
 */
export function requestRemoteSignature(
  provider: HsmKmsProvider,
  input: RemoteSignRequest,
): SecurityResult<RemoteSignResult> {
  const gate = requireProductionSigningProvider(provider, input.purpose);
  if (!gate.ok) {
    return gate;
  }
  const hsmGate = assertHsmRequiredForRole(input.role);
  if (!hsmGate.ok) {
    return hsmGate;
  }
  const signed = provider.signCanonicalDigest({
    handle: input.handle,
    digest: input.digest,
    purpose: input.purpose,
    suiteId: input.handle.suiteId,
  });
  if (!signed.ok) {
    return signed;
  }
  const attestation = provider.getAttestationMetadata(input.handle);
  return securityOk(
    Object.freeze({
      signatureRef: signed.value.signatureHex,
      keyId: input.handle.keyId,
      keyVersion: input.handle.keyVersion,
      providerId: provider.providerId,
      privateKeyEnteredApplicationMemory: false,
      attestationRef: attestation.ok ? attestation.value.environmentLabel : null,
    }),
  );
}

export function hsmRequiredRoles(): readonly KeyRole[] {
  return HSM_REQUIRED_ROLES;
}
