/**
 * Production WebAuthn / passkey gate.
 *
 * The canonical ceremony interface is `WebAuthnRelyingParty` in auth.ts.
 * `SimulatedWebAuthnRelyingParty` is for tests and simulation only and must
 * not be described as production-ready FIDO2 verification.
 *
 * Exact missing dependency for production attestation/assertion verification:
 *   @simplewebauthn/server  (server ceremony + COSE / CBOR verification)
 *   @simplewebauthn/browser (Lovable / consumer client)
 *
 * Node 22 `node:crypto` can verify ECDSA P-256 signatures, but the repository
 * does not include a CBOR/COSE decoder. Homegrown attestation parsing would
 * fake cryptographic guarantees. This gate refuses production FIDO2 completion
 * until that library is admitted.
 */

import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  WebAuthnAuthenticationRequest,
  WebAuthnAuthenticationResponse,
  WebAuthnChallenge,
  WebAuthnCredential,
  WebAuthnRegistrationRequest,
  WebAuthnRegistrationResponse,
  WebAuthnRelyingParty,
} from './auth.ts';

export const WEBAUTHN_PRODUCTION_DEPENDENCY = '@simplewebauthn/server' as const;
export const WEBAUTHN_BROWSER_DEPENDENCY = '@simplewebauthn/browser' as const;

export const WEBAUTHN_PRODUCTION_BLOCKER = Object.freeze({
  implemented: false,
  reason: 'PRODUCTION_WEBAUTHN_LIBRARY_NOT_ADMITTED',
  missingDependency: WEBAUTHN_PRODUCTION_DEPENDENCY,
  clientDependency: WEBAUTHN_BROWSER_DEPENDENCY,
  message:
    'Production passkey attestation and assertion verification requires @simplewebauthn/server. SimulatedWebAuthnRelyingParty is HMAC-based and is not FIDO2.',
});

export class ProductionWebAuthnRelyingParty implements WebAuthnRelyingParty {
  readonly blocker = WEBAUTHN_PRODUCTION_BLOCKER;

  beginRegistration(_request: WebAuthnRegistrationRequest, _now: UtcInstant): WebAuthnChallenge {
    throw productionBlocked();
  }

  completeRegistration(_response: WebAuthnRegistrationResponse, _now: UtcInstant): WebAuthnCredential {
    throw productionBlocked();
  }

  beginAuthentication(_request: WebAuthnAuthenticationRequest, _now: UtcInstant): WebAuthnChallenge {
    throw productionBlocked();
  }

  completeAuthentication(_response: WebAuthnAuthenticationResponse, _now: UtcInstant): WebAuthnCredential {
    throw productionBlocked();
  }
}

function productionBlocked(): Error {
  const error = new Error(WEBAUTHN_PRODUCTION_BLOCKER.message);
  error.name = WEBAUTHN_PRODUCTION_BLOCKER.reason;
  return error;
}

export function isProductionWebAuthnAvailable(): boolean {
  return false;
}
