/**
 * Institutional signing providers.
 *
 * Custody keys use WALLET_SIGNING only. MPC is a port; cryptography
 * is not faked. Offline cold signing never holds an online handle.
 */

import type { PublicKeyDescriptor, SignatureDescriptor } from '../../../security/src/crypto-descriptors.ts';
import type { CryptoSuiteId } from '../../../security/src/crypto-suite.ts';
import type { SecurityResult } from '../../../security/src/errors.ts';
import type { HsmKeyHandle, HsmKmsProvider } from '../../../security/src/hsm-kms.ts';
import { CUSTODY_KEY_PURPOSE } from './taxonomy.ts';
import type { SigningImplementationState, SigningProviderKind } from './taxonomy.ts';

export type InstitutionalSignRequest = {
  readonly handle: HsmKeyHandle;
  readonly digest: Buffer;
  readonly purpose: typeof CUSTODY_KEY_PURPOSE;
  readonly suiteId: CryptoSuiteId;
};

export type InstitutionalSignerCapabilities = {
  readonly realPqSupported: boolean;
  readonly externalHsmPqSupported: boolean;
  readonly flags: readonly string[];
};

export type InstitutionalSigningProvider = {
  readonly kind: SigningProviderKind;
  readonly implementationState: SigningImplementationState;
  readonly simulation: boolean;
  generate(suiteId: CryptoSuiteId, keyId?: string): SecurityResult<HsmKeyHandle>;
  publicDescriptor(handle: HsmKeyHandle): SecurityResult<PublicKeyDescriptor>;
  sign(request: InstitutionalSignRequest): SecurityResult<SignatureDescriptor>;
  rotate(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle>;
  disable(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle>;
  status(): { readonly kind: SigningProviderKind; readonly healthy: boolean; readonly simulation: boolean };
  capabilities?(): InstitutionalSignerCapabilities;
};

export function negotiateInstitutionalPqCapability(
  provider: InstitutionalSigningProvider,
): InstitutionalSignerCapabilities {
  if (typeof provider.capabilities === 'function') {
    return provider.capabilities();
  }
  return Object.freeze({
    realPqSupported: false,
    externalHsmPqSupported: false,
    flags: Object.freeze(['CLASSICAL_SUPPORTED'] as const),
  });
}

export class HsmBackedSigningProvider implements InstitutionalSigningProvider {
  readonly kind: SigningProviderKind;
  readonly implementationState = 'SIMULATION' as const;
  readonly simulation = true;
  private readonly hsm: HsmKmsProvider;

  constructor(kind: 'LOCAL_DEVELOPMENT' | 'REMOTE_SIGNER' | 'HSM' | 'KMS', hsm: HsmKmsProvider) {
    this.kind = kind;
    this.hsm = hsm;
  }

  generate(suiteId: CryptoSuiteId, keyId?: string): SecurityResult<HsmKeyHandle> {
    return this.hsm.generateKey({ purpose: CUSTODY_KEY_PURPOSE, suiteId, ...(keyId ? { keyId } : {}) });
  }

  publicDescriptor(handle: HsmKeyHandle): SecurityResult<PublicKeyDescriptor> {
    return this.hsm.getPublicDescriptor(handle);
  }

  sign(request: InstitutionalSignRequest): SecurityResult<SignatureDescriptor> {
    if (request.purpose !== CUSTODY_KEY_PURPOSE) {
      return {
        ok: false,
        error: { code: 'PURPOSE_MISMATCH', message: 'institutional signer accepts WALLET_SIGNING only' },
      };
    }
    return this.hsm.signCanonicalDigest({
      handle: request.handle,
      digest: request.digest,
      purpose: request.purpose,
      suiteId: request.suiteId,
    });
  }

  rotate(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    return this.hsm.rotateKey(handle);
  }

  disable(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    return this.hsm.disableKey(handle);
  }

  status(): { readonly kind: SigningProviderKind; readonly healthy: boolean; readonly simulation: boolean } {
    const health = this.hsm.healthCheck();
    return { kind: this.kind, healthy: health.ok && health.value.healthy, simulation: true };
  }

  capabilities(): InstitutionalSignerCapabilities {
    if (typeof this.hsm.capabilities === 'function') {
      const caps = this.hsm.capabilities();
      return Object.freeze({
        realPqSupported: caps.realPqSupported === true,
        externalHsmPqSupported: caps.externalHsmPqSupported === true,
        flags: Object.freeze([...caps.flags]),
      });
    }
    return Object.freeze({
      realPqSupported: false,
      externalHsmPqSupported: false,
      flags: Object.freeze(['CLASSICAL_SUPPORTED'] as const),
    });
  }
}

export class MpcSigningPort implements InstitutionalSigningProvider {
  readonly kind = 'MPC' as const;
  readonly implementationState = 'PORT_ONLY' as const;
  readonly simulation = true;

  generate(): SecurityResult<HsmKeyHandle> {
    return {
      ok: false,
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'MPC is a port only; cryptography is not implemented' },
    };
  }

  publicDescriptor(): SecurityResult<PublicKeyDescriptor> {
    return {
      ok: false,
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'MPC is a port only; cryptography is not implemented' },
    };
  }

  sign(): SecurityResult<SignatureDescriptor> {
    return {
      ok: false,
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'MPC is a port only; cryptography is not implemented' },
    };
  }

  rotate(): SecurityResult<HsmKeyHandle> {
    return {
      ok: false,
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'MPC is a port only; cryptography is not implemented' },
    };
  }

  disable(): SecurityResult<HsmKeyHandle> {
    return {
      ok: false,
      error: { code: 'PROVIDER_UNAVAILABLE', message: 'MPC is a port only; cryptography is not implemented' },
    };
  }

  status(): { readonly kind: SigningProviderKind; readonly healthy: boolean; readonly simulation: boolean } {
    return { kind: 'MPC', healthy: false, simulation: true };
  }
}

export class OfflineColdSigningProvider implements InstitutionalSigningProvider {
  readonly kind = 'OFFLINE_COLD' as const;
  readonly implementationState = 'SIMULATION' as const;
  readonly simulation = true;
  private readonly online: InstitutionalSigningProvider;

  constructor(online: InstitutionalSigningProvider) {
    this.online = online;
  }

  generate(suiteId: CryptoSuiteId, keyId?: string): SecurityResult<HsmKeyHandle> {
    return this.online.generate(suiteId, keyId);
  }

  publicDescriptor(handle: HsmKeyHandle): SecurityResult<PublicKeyDescriptor> {
    return this.online.publicDescriptor(handle);
  }

  sign(): SecurityResult<SignatureDescriptor> {
    return {
      ok: false,
      error: {
        code: 'POLICY_REJECTED',
        message: 'OFFLINE_COLD cannot sign online; export a cold package and import the signature',
      },
    };
  }

  signIsolated(request: InstitutionalSignRequest): SecurityResult<SignatureDescriptor> {
    return this.online.sign(request);
  }

  rotate(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    return this.online.rotate(handle);
  }

  disable(handle: HsmKeyHandle): SecurityResult<HsmKeyHandle> {
    return this.online.disable(handle);
  }

  status(): { readonly kind: SigningProviderKind; readonly healthy: boolean; readonly simulation: boolean } {
    return { kind: 'OFFLINE_COLD', healthy: true, simulation: true };
  }
}
