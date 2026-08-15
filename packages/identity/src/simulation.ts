import { addMs, isExpired } from '../../config/src/clock.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import { ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { hmacSha256Hex } from '../../security/src/hmac.ts';
import { newSecurityToken, secureRandomHex } from '../../security/src/random.ts';
import { SecretValue } from '../../security/src/redaction.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import type { Clock } from '../../config/src/clock.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import type { Jurisdiction } from '../../domain/src/jurisdiction.ts';
import { CHALLENGE_TTL_MS, IdentityService, type IdentityFailure } from './service.ts';
import type { VerifiedActorContext } from './actor-context.ts';
import type {
  DeviceRiskProvider,
  DeviceRiskSignal,
  RegisteredDevice,
  WebAuthnAuthenticationRequest,
  WebAuthnAuthenticationResponse,
  WebAuthnChallenge,
  WebAuthnCredential,
  WebAuthnRegistrationRequest,
  WebAuthnRegistrationResponse,
  WebAuthnRelyingParty,
} from './auth.ts';
import type { IdentityCapability } from './capability.ts';
import { asChallengeId, asCredentialId, type SolsticeIdentityId } from './ids.ts';
import type {
  BeneficialOwnershipProvider,
  BusinessVerificationProvider,
  DocumentVerificationProvider,
  IdentityProviderPorts,
  IdentityVerificationProvider,
  LivenessVerificationProvider,
} from './ports.ts';

const SIM_RP_ID = 'simulation.solstice.local';
const SIM_ORIGIN = 'https://simulation.solstice.local';

/**
 * In-memory authenticator for tests. Holds simulation secrets only in process.
 * Those secrets are never persisted and are not user passkeys.
 */
export class SimulatedAuthenticator {
  readonly #secrets = new Map<string, SecretValue>();

  register(): { readonly credentialId: string; readonly publicKeyMaterial: string } {
    const credentialId = `cred_${secureRandomHex(16)}`;
    const secret = new SecretValue(secureRandomHex(32));
    this.#secrets.set(credentialId, secret);
    return {
      credentialId,
      publicKeyMaterial: hmacSha256Hex(secret, `public:${credentialId}`),
    };
  }

  assert(
    credentialId: string,
    challenge: string,
    signCount: number,
  ): { readonly signature: string; readonly authenticatorData: string; readonly clientDataJSON: string } {
    const secret = this.#secrets.get(credentialId);
    if (!secret) {
      throw new Error('simulated authenticator does not hold this credential');
    }
    const clientDataJSON = Buffer.from(
      JSON.stringify({ type: 'webauthn.get', challenge, origin: SIM_ORIGIN }),
    ).toString('base64url');
    const authenticatorData = Buffer.from(`sim-auth:${credentialId}:${String(signCount)}`).toString(
      'base64url',
    );
    return {
      signature: hmacSha256Hex(secret, `${challenge}\n${credentialId}\n${String(signCount)}`),
      authenticatorData,
      clientDataJSON,
    };
  }
}

/**
 * Simulation/test WebAuthn adapter. Does not implement WebAuthn cryptography.
 * Exercises registration, assertion, replay, and counter rules only.
 */
export class SimulatedWebAuthnRelyingParty implements WebAuthnRelyingParty {
  readonly #challenges = new Map<string, WebAuthnChallenge>();
  readonly #credentials = new Map<string, WebAuthnCredential>();
  readonly #publicToSecret = new Map<string, SecretValue>();
  readonly #authenticator: SimulatedAuthenticator;

  constructor(authenticator: SimulatedAuthenticator) {
    this.#authenticator = authenticator;
  }

  attachSecret(credentialId: string, publicKeyMaterial: string, secret: SecretValue): void {
    this.#publicToSecret.set(credentialId, secret);
    void publicKeyMaterial;
  }

  rememberAuthenticatorSecret(credentialId: string, secret: SecretValue): void {
    this.#publicToSecret.set(credentialId, secret);
  }

  beginRegistration(request: WebAuthnRegistrationRequest, now: UtcInstant): WebAuthnChallenge {
    return this.issueChallenge(request.identityId, 'REGISTRATION', request.rpId, request.origin, now);
  }

  completeRegistration(response: WebAuthnRegistrationResponse, now: UtcInstant): WebAuthnCredential {
    const challenge = this.consumeChallenge(response.challengeId, 'REGISTRATION', now);
    if (!challenge.identityId) {
      throw new Error('registration challenge is not bound to an identity');
    }
    if (this.#credentials.has(response.credentialId)) {
      throw new Error('credential identifier is already registered');
    }
    const credential: WebAuthnCredential = Object.freeze({
      credentialId: asCredentialId(response.credentialId),
      identityId: challenge.identityId,
      publicKeyMaterial: response.publicKeyMaterial,
      signCount: 0,
      transports: Object.freeze([...response.transports]),
      deviceId: null,
      createdAt: now,
      lastUsedAt: null,
    });
    this.#credentials.set(credential.credentialId, credential);
    return credential;
  }

  beginAuthentication(request: WebAuthnAuthenticationRequest, now: UtcInstant): WebAuthnChallenge {
    return this.issueChallenge(request.identityId, 'AUTHENTICATION', request.rpId, request.origin, now);
  }

  completeAuthentication(response: WebAuthnAuthenticationResponse, now: UtcInstant): WebAuthnCredential {
    const challenge = this.consumeChallenge(response.challengeId, 'AUTHENTICATION', now);
    const credential = this.#credentials.get(response.credentialId);
    if (!credential) {
      throw new Error('unknown WebAuthn credential');
    }
    if (challenge.identityId && challenge.identityId !== credential.identityId) {
      throw new Error('credential does not belong to the challenged identity');
    }
    if (response.signCount <= credential.signCount) {
      throw new Error('WebAuthn sign counter did not advance');
    }
    const produced = this.#authenticator.assert(response.credentialId, challenge.challenge, response.signCount);
    if (produced.signature !== response.signature) {
      throw new Error('WebAuthn assertion signature is invalid');
    }
    const next = Object.freeze({
      ...credential,
      signCount: response.signCount,
      lastUsedAt: now,
    });
    this.#credentials.set(next.credentialId, next);
    return next;
  }

  private issueChallenge(
    identityId: SolsticeIdentityId | null,
    purpose: WebAuthnChallenge['purpose'],
    rpId: string,
    origin: string,
    now: UtcInstant,
  ): WebAuthnChallenge {
    const challenge: WebAuthnChallenge = Object.freeze({
      challengeId: asChallengeId(`chal_${newSecurityToken()}`),
      identityId,
      purpose,
      challenge: secureRandomHex(32),
      rpId,
      origin,
      expiresAt: addMs(now, CHALLENGE_TTL_MS),
      consumedAt: null,
    });
    this.#challenges.set(challenge.challengeId, challenge);
    return challenge;
  }

  private consumeChallenge(
    challengeId: string,
    purpose: WebAuthnChallenge['purpose'],
    now: UtcInstant,
  ): WebAuthnChallenge {
    const challenge = this.#challenges.get(challengeId);
    if (!challenge) {
      throw new Error('unknown WebAuthn challenge');
    }
    if (challenge.purpose !== purpose) {
      throw new Error('WebAuthn challenge purpose mismatch');
    }
    if (challenge.consumedAt !== null) {
      throw new Error('WebAuthn challenge has already been used');
    }
    if (isExpired(challenge.expiresAt, now)) {
      throw new Error('WebAuthn challenge has expired');
    }
    const consumed = Object.freeze({ ...challenge, consumedAt: now });
    this.#challenges.set(challengeId, consumed);
    return consumed;
  }
}

function simulatedResult(
  providerRef: string,
  now: UtcInstant,
): { readonly providerRef: string; readonly outcome: 'VERIFIED'; readonly reasonCodes: readonly string[]; readonly evidenceRefs: readonly string[]; readonly observedAt: UtcInstant } {
  return Object.freeze({
    providerRef,
    outcome: 'VERIFIED',
    reasonCodes: Object.freeze(['SIMULATED']),
    evidenceRefs: Object.freeze([`evref_${providerRef}`]),
    observedAt: now,
  });
}

export const simulatedIdentityVerification: IdentityVerificationProvider = {
  verifyPerson: (identityId, now) => simulatedResult(`idv:${identityId}`, now),
};

export const simulatedDocumentVerification: DocumentVerificationProvider = {
  verifyDocument: (documentRef, now) => simulatedResult(`doc:${documentRef}`, now),
};

export const simulatedLiveness: LivenessVerificationProvider = {
  verifyLiveness: (sessionRef, now) => simulatedResult(`liv:${sessionRef}`, now),
};

export const simulatedBusinessVerification: BusinessVerificationProvider = {
  verifyBusiness: (business, now) => simulatedResult(`biz:${business.id}`, now),
};

export const simulatedBeneficialOwnership: BeneficialOwnershipProvider = {
  lookupBeneficialOwners: (registrationRef, now) =>
    Object.freeze({
      ownerRefs: Object.freeze([`bo:${registrationRef}`]),
      providerRef: `bo-provider:${registrationRef}`,
      observedAt: now,
    }),
};

export const simulatedDeviceRisk: DeviceRiskProvider = {
  assess(device: RegisteredDevice, now: UtcInstant): DeviceRiskSignal {
    return Object.freeze({
      deviceId: device.deviceId,
      recommendedState: device.trustState === 'BLOCKED' ? 'BLOCKED' : 'KNOWN',
      reasonCode: 'SIMULATED_NO_SIGNAL',
      observedAt: now,
    });
  },
};

export function simulatedProviderPorts(): IdentityProviderPorts {
  return {
    identityVerification: simulatedIdentityVerification,
    documentVerification: simulatedDocumentVerification,
    liveness: simulatedLiveness,
    businessVerification: simulatedBusinessVerification,
    beneficialOwnership: simulatedBeneficialOwnership,
    deviceRisk: simulatedDeviceRisk,
  };
}

const DEFAULT_OPERATOR_CAPABILITIES: readonly IdentityCapability[] = [
  'ACCOUNT_OPEN_REQUEST',
  'TRANSFER_REQUEST',
  'POST_DEPOSIT_REQUEST',
  'POST_WITHDRAWAL_REQUEST',
  'HOLD_REQUEST',
  'FEE_ASSESS_REQUEST',
  'REVERSAL_REQUEST',
  'INTEREST_POST_REQUEST',
  'SETTLEMENT_REQUEST',
  'VIEW_ACCOUNT',
  'MANAGE_PROFILE',
  'VIEW_ECONOMIC_GRAPH',
  'DECLARE_ECONOMIC_FACT',
];

/**
 * DEVELOPMENT/SIMULATION identity adapter.
 * Provisions an authenticated operator through the Identity service.
 * Accounts must consume the issued ActorContext; they cannot mint one.
 */
export class SimulatedIdentityAdapter {
  readonly label =
    'DEVELOPMENT/SIMULATION — authoritative identity adapter; not a production IdP';
  readonly service: IdentityService;
  readonly authenticator: SimulatedAuthenticator;
  readonly webauthn: SimulatedWebAuthnRelyingParty;
  private readonly clock: Clock;

  constructor(input: {
    readonly clock: Clock;
    readonly keys: KeyProvider;
    readonly evidence?: EvidenceVault;
    readonly events?: DomainEventLog;
    readonly service?: IdentityService;
  }) {
    this.clock = input.clock;
    this.authenticator = new SimulatedAuthenticator();
    this.webauthn = new SimulatedWebAuthnRelyingParty(this.authenticator);
    this.service =
      input.service ??
      new IdentityService({
        clock: input.clock,
        keys: input.keys,
        webauthn: this.webauthn,
        ...(input.evidence ? { evidence: input.evidence } : {}),
        ...(input.events ? { events: input.events } : {}),
        providers: simulatedProviderPorts(),
      });
  }

  provisionSimulatedActor(input: {
    readonly actorId: string;
    readonly jurisdiction: Jurisdiction;
    readonly customerId?: CustomerId;
    readonly identityId?: string;
    readonly capabilities?: readonly IdentityCapability[];
  }): Result<VerifiedActorContext, IdentityFailure> {
    const existing = this.service.resolveActorContext(input.actorId);
    if (existing.ok) {
      return existing;
    }
    const identity = this.service.createPersonIdentity({
      homeJurisdiction: input.jurisdiction,
      ...(input.identityId ? { id: input.identityId } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
    });
    const activated = this.service.activateIdentity(identity.id);
    if (!activated.ok) {
      return activated;
    }
    this.service.recordKyc({
      identityId: identity.id,
      providerRef: 'simulation:kyc',
      verificationState: 'VERIFIED',
      verificationLevel: 'STANDARD',
      jurisdiction: input.jurisdiction,
      verifiedAttributes: Object.freeze([{ name: 'legal_name', reference: 'sim-name-ref' }]),
      verifiedAt: this.clock.now(),
      expiresAt: addMs(this.clock.now(), 365n * 24n * 60n * 60n * 1000n),
      reasonCodes: Object.freeze(['SIMULATED']),
      evidenceRefs: Object.freeze(['sim-kyc-evidence']),
    });
    for (const capability of input.capabilities ?? DEFAULT_OPERATOR_CAPABILITIES) {
      const granted = this.service.grantCapability(identity.id, capability, 'IDENTITY_SERVICE');
      if (!granted.ok) {
        return granted;
      }
    }
    const enrolled = this.enrollAndAuthenticate(identity.id, input.actorId);
    if (!enrolled.ok) {
      return enrolled;
    }
    return ok(enrolled.value.context);
  }

  enrollAndAuthenticate(
    identityId: SolsticeIdentityId,
    actorId: string,
    deviceRef = 'sim-device-1',
    stepUp = false,
  ): Result<{ session: import('./auth.ts').IdentitySession; context: VerifiedActorContext }, IdentityFailure> {
    const registration = this.service.beginPasskeyRegistration(identityId, SIM_RP_ID, SIM_ORIGIN);
    const created = this.authenticator.register();
    const registered = this.service.completePasskeyRegistration(
      {
        challengeId: registration.challengeId,
        credentialId: created.credentialId,
        publicKeyMaterial: created.publicKeyMaterial,
        transports: ['internal'],
        attestationRef: null,
      },
      deviceRef,
    );
    if (!registered.ok) {
      return registered;
    }
    const auth = this.service.beginPasskeyAuthentication(identityId, SIM_RP_ID, SIM_ORIGIN);
    const assertion = this.authenticator.assert(created.credentialId, auth.challenge, 1);
    return this.service.authenticatePasskey(
      {
        challengeId: auth.challengeId,
        credentialId: created.credentialId,
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        signature: assertion.signature,
        signCount: 1,
      },
      actorId,
      deviceRef,
      stepUp,
    );
  }
}
