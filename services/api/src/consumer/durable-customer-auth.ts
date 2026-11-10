import { randomBytes } from 'node:crypto';

import {
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  createProspect,
  isOk,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
  type UtcInstant,
} from '@solstice/domain';
import type { IdentityCapability } from '@solstice/identity';

import type { AuthenticationService } from '../../../../packages/identity/src/authentication-service.ts';
import { asSessionId } from '../../../../packages/identity/src/ids.ts';
import type { SimulationRuntime } from '../../../accounts/src/runtime.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';
import { principalFromIdentitySession } from './session.ts';

/**
 * Durable customer self-registration and login for the Consumer BFF.
 *
 * This replaces the shared preview login for real users of the hosted
 * sandbox (dashboard.sunrey.xyz). Every registrant gets their own identity,
 * password credential, and customer record in PostgreSQL. Nothing here opens
 * an account, funds an account, or issues an Execution Authority: account
 * opening and sandbox funding still go through the existing Kernel-gated
 * routes (`POST /api/v1/accounts`, `POST /api/v1/sandbox/funding`) under the
 * customer's own actor.
 *
 * Identity verification is SIMULATED. In ENVIRONMENT=simulation a registrant
 * receives a clearly labelled sandbox verification (`sandbox:self-registration`)
 * so that sandbox workflows can run. This is not KYC. The constructor refuses
 * to run in any other environment, so a production deployment cannot reach
 * this path without a real verification provider being designed in.
 */

export const CUSTOMER_AUTH_SCHEMA = 'sunrey.customer-auth.v1' as const;
export const SANDBOX_VERIFICATION_PROVIDER = 'sandbox:self-registration' as const;
export const SANDBOX_VERIFICATION_REASON = 'SANDBOX_SIMULATED_VERIFICATION_NOT_KYC' as const;

/** Legal entity and jurisdiction of the existing sandbox cash products. */
const SANDBOX_LEGAL_ENTITY = 'le_solstice_uk_ltd';
const SANDBOX_JURISDICTION = 'GB';
const SANDBOX_VERIFICATION_TTL_MS = 365n * 24n * 60n * 60n * 1000n;

/**
 * Capabilities a self-registered sandbox customer may request. Requests are
 * still evaluated by the Compliance Kernel, which requires a STRONG session
 * (password + TOTP step-up) for financial capabilities at the moment of use;
 * a capability is permission to ask, not authority to execute.
 * PAYMENT_REQUEST (external payments) is deliberately absent: enabling outbound
 * payments for self-registered users is a policy decision, not a default.
 */
export const REGISTRANT_CAPABILITIES: readonly IdentityCapability[] = Object.freeze([
  'VIEW_ACCOUNT',
  'MANAGE_PROFILE',
  'ACCOUNT_OPEN_REQUEST',
  // Sandbox internal transfers and testnet SR/MR exchange orders. The Kernel
  // still requires a STRONG (TOTP step-up) session when these are used.
  'TRANSFER_REQUEST',
  'EXCHANGE_OPERATE_REQUEST',
  // A data subject may always see, and withdraw, their own consents and vault.
  'VAULT_VIEW_OWN',
  'CONSENT_VIEW_OWN',
  'CONSENT_REVOKE_OWN',
]);

/** The narrow slice of the durable runtime this module needs. */
export type CustomerAuthRuntime = {
  readonly runtime: Pick<SimulationRuntime, 'customers' | 'identity' | 'clock'>;
  readonly authentication: AuthenticationService;
  saveCustomer(customer: Customer): Promise<void>;
  persistAuthentication(): Promise<void>;
};

export type CustomerRegistrationInput = {
  readonly email: string | undefined;
  readonly password: string;
  readonly termsVersion: string;
  readonly ip?: string;
  readonly userAgent?: string;
};

export type CustomerRegistrationResult = {
  readonly schema: typeof CUSTOMER_AUTH_SCHEMA;
  readonly kind: 'REGISTERED';
  readonly customerId: string;
  readonly identityId: string;
  readonly verification: 'SANDBOX_SIMULATED';
  readonly environment: 'simulation';
  readonly production: false;
};

export type CustomerTokenBundle = {
  readonly schema: typeof CUSTOMER_AUTH_SCHEMA;
  readonly kind: 'SESSION';
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly refreshExpiresAt: string;
  readonly sessionId: string;
  readonly authenticationStrength: string;
  readonly environment: 'simulation';
  readonly production: false;
};

export type CustomerMfaChallenge = {
  readonly schema: typeof CUSTOMER_AUTH_SCHEMA;
  readonly kind: 'MFA_REQUIRED';
  readonly mfaToken: string;
  readonly methods: readonly string[];
};

type Failure = { readonly code: string; readonly message: string };

/** Map identity failure codes to BFF error envelopes without leaking detail. */
function authFailure(failure: Failure, requestId: string): BffErrorEnvelope {
  switch (failure.code) {
    case 'RATE_LIMITED':
      return bffError({
        errorCode: 'SERVICE_DEGRADED',
        category: 'TEMPORARY_UNAVAILABLE',
        message: 'too many attempts; try again later',
        retryable: true,
        requestId,
        detailsSafeForClient: { reason: 'RATE_LIMITED' },
      });
    case 'PASSWORD_POLICY':
    case 'TERMS_REQUIRED':
    case 'IDENTIFIER_INVALID':
    case 'IDENTIFIER_REQUIRED':
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: failure.message,
        retryable: false,
        requestId,
        detailsSafeForClient: { reason: failure.code },
      });
    case 'IDENTIFIER_UNAVAILABLE':
      // Same wording whether or not the address exists elsewhere, so the
      // registration endpoint is not an account-enumeration oracle beyond
      // what the identity service already decides.
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'that email cannot be used to register',
        retryable: false,
        requestId,
        detailsSafeForClient: { reason: 'IDENTIFIER_UNAVAILABLE' },
      });
    case 'CREDENTIAL_INVALID':
      return bffError({
        errorCode: 'AUTH_REQUIRED',
        category: 'AUTHENTICATION',
        message: 'email or password is incorrect',
        retryable: false,
        requestId,
      });
    default:
      return bffError({
        errorCode: 'SESSION_INVALID',
        category: 'AUTHENTICATION',
        message: 'authentication could not be completed',
        retryable: false,
        requestId,
      });
  }
}

function mfaFailure(failure: Failure, requestId: string): BffErrorEnvelope {
  if (failure.code === 'RATE_LIMITED') return authFailure(failure, requestId);
  const notEnrolled = failure.code === 'MFA_NOT_ENROLLED';
  return bffError({
    errorCode: notEnrolled ? 'ACTION_REQUIRED' : 'AUTH_REQUIRED',
    category: 'AUTHENTICATION',
    message: notEnrolled ? 'two-step verification is not set up' : 'verification code was not accepted',
    retryable: false,
    requestId,
    detailsSafeForClient: { reason: notEnrolled ? 'MFA_NOT_ENROLLED' : 'MFA_INVALID' },
  });
}

function newCustomerId(): string {
  return `cust_${randomBytes(12).toString('hex')}`;
}

function addMs(instant: UtcInstant, ms: bigint): UtcInstant {
  const next = new Date(Date.parse(instant) + Number(ms));
  return next.toISOString() as UtcInstant;
}

export class DurableCustomerAuth {
  private readonly durable: CustomerAuthRuntime;
  /** Serialises registrations so snapshot persistence never interleaves. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(durable: CustomerAuthRuntime, options: { readonly environment: string }) {
    if (options.environment !== 'simulation') {
      throw new Error(
        'DurableCustomerAuth uses simulated identity verification and may only run with ENVIRONMENT=simulation',
      );
    }
    this.durable = durable;
  }

  private serialise<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  register(
    input: CustomerRegistrationInput,
    requestId: string,
  ): Promise<CustomerRegistrationResult | BffErrorEnvelope> {
    return this.serialise(() => this.registerUnserialised(input, requestId));
  }

  private async registerUnserialised(
    input: CustomerRegistrationInput,
    requestId: string,
  ): Promise<CustomerRegistrationResult | BffErrorEnvelope> {
    const runtime = this.durable.runtime;
    const service = runtime.identity.service;

    const registered = await this.durable.authentication.register({
      email: input.email,
      password: input.password,
      homeJurisdiction: asJurisdiction(SANDBOX_JURISDICTION),
      termsVersion: input.termsVersion,
      ...(input.ip ? { ip: input.ip } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    } as Parameters<AuthenticationService['register']>[0]);
    if (!registered.ok) {
      return authFailure(registered.error, requestId);
    }
    const identityId = registered.value.identityId;
    const now = runtime.clock.now();

    // Customer record: PROSPECT -> PENDING_VERIFICATION -> (sandbox verified) -> ACTIVE.
    const customerId = asCustomerId(newCustomerId());
    let customer = createProspect({
      id: customerId,
      legalEntityId: asLegalEntityId(SANDBOX_LEGAL_ENTITY),
      jurisdiction: asJurisdiction(SANDBOX_JURISDICTION),
      residency: asResidency(SANDBOX_JURISDICTION),
      verification: notStartedVerification(addMs(now, SANDBOX_VERIFICATION_TTL_MS)),
      createdAt: now,
    });
    const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', now);
    if (!isOk(pending)) {
      return authFailure({ code: 'ONBOARDING_FAILED', message: 'customer onboarding failed' }, requestId);
    }
    customer = Object.freeze({
      ...pending.value.customer,
      verification: Object.freeze({
        kycState: 'VERIFIED' as const,
        kycRecordVersion: 1,
        refreshBy: addMs(now, SANDBOX_VERIFICATION_TTL_MS),
      }),
    });
    const active = transitionCustomerStatus(customer, 'ACTIVE', now);
    if (!isOk(active)) {
      return authFailure({ code: 'ONBOARDING_FAILED', message: 'customer onboarding failed' }, requestId);
    }
    customer = active.value.customer;

    service.linkCustomer(identityId, customer.id);
    service.recordKyc({
      identityId,
      providerRef: SANDBOX_VERIFICATION_PROVIDER,
      verificationState: 'VERIFIED',
      verificationLevel: 'STANDARD',
      jurisdiction: asJurisdiction(SANDBOX_JURISDICTION),
      verifiedAttributes: Object.freeze([]),
      verifiedAt: now,
      expiresAt: addMs(now, SANDBOX_VERIFICATION_TTL_MS),
      reasonCodes: Object.freeze([SANDBOX_VERIFICATION_REASON]),
      evidenceRefs: Object.freeze([`sandbox-registration:${customer.id}`]),
    } as Parameters<typeof service.recordKyc>[0]);
    for (const capability of REGISTRANT_CAPABILITIES) {
      const granted = service.grantCapability(identityId, capability, 'IDENTITY_SERVICE', 'operator_1');
      if (!granted.ok) {
        return authFailure({ code: 'ONBOARDING_FAILED', message: granted.error.message }, requestId);
      }
    }

    await this.durable.saveCustomer(customer);
    await this.durable.persistAuthentication();

    return Object.freeze({
      schema: CUSTOMER_AUTH_SCHEMA,
      kind: 'REGISTERED',
      customerId: String(customer.id),
      identityId: String(identityId),
      verification: 'SANDBOX_SIMULATED',
      environment: 'simulation',
      production: false,
    });
  }

  async login(
    input: {
      readonly email: string | undefined;
      readonly password: string;
      readonly ip?: string;
      readonly userAgent?: string;
    },
    requestId: string,
  ): Promise<CustomerTokenBundle | CustomerMfaChallenge | BffErrorEnvelope> {
    const result = await this.durable.authentication.authenticate({
      email: input.email,
      password: input.password,
      ...(input.ip ? { ip: input.ip } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    } as Parameters<AuthenticationService['authenticate']>[0]);
    if (!result.ok) {
      return authFailure(result.error, requestId);
    }
    const value = result.value as unknown as Record<string, unknown>;
    if (value.status === 'MFA_REQUIRED') {
      return Object.freeze({
        schema: CUSTOMER_AUTH_SCHEMA,
        kind: 'MFA_REQUIRED',
        mfaToken: String(value.mfaToken),
        methods: Object.freeze([...(value.methods as readonly string[])]),
      });
    }
    await this.durable.persistAuthentication();
    return this.bundle(result.value as unknown as TokenBundleSource);
  }

  async refresh(
    input: { readonly refreshToken: string; readonly ip?: string; readonly userAgent?: string },
    requestId: string,
  ): Promise<CustomerTokenBundle | BffErrorEnvelope> {
    const result = this.durable.authentication.refreshSession({
      refreshToken: input.refreshToken,
      ...(input.ip ? { ip: input.ip } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    } as Parameters<AuthenticationService['refreshSession']>[0]);
    if (!result.ok) {
      return authFailure(result.error, requestId);
    }
    await this.durable.persistAuthentication();
    return this.bundle(result.value as unknown as TokenBundleSource);
  }

  /** Returns true when the token belonged to a customer session and was revoked. */
  async logout(accessToken: string): Promise<boolean> {
    const result = this.durable.authentication.logout(accessToken);
    if (!result.ok) {
      return false;
    }
    await this.durable.persistAuthentication();
    return true;
  }

  /**
   * TOTP enrollment and step-up. Password-only sessions are LOW assurance and
   * the Compliance Kernel requires STRONG for financial capabilities, so a
   * customer enrolls TOTP once and steps up (password + TOTP + step-up =
   * STRONG) before opening accounts or moving money. These delegate to the
   * existing AuthenticationService; nothing here relaxes a Kernel proof.
   */
  async enrollTotp(
    accessToken: string,
    requestId: string,
  ): Promise<{ readonly secretBase32: string; readonly otpauth: string; readonly enrollToken: string } | BffErrorEnvelope> {
    const caller = this.durable.authentication.authenticateRequest(accessToken);
    if (!caller.ok) return authFailure(caller.error, requestId);
    const result = this.durable.authentication.enrollTotp(caller.value);
    if (!result.ok) return mfaFailure(result.error, requestId);
    await this.durable.persistAuthentication();
    return Object.freeze({ ...result.value });
  }

  async confirmTotp(
    accessToken: string,
    input: { readonly enrollToken: string; readonly code: string },
    requestId: string,
  ): Promise<{ readonly enrolled: true } | BffErrorEnvelope> {
    const caller = this.durable.authentication.authenticateRequest(accessToken);
    if (!caller.ok) return authFailure(caller.error, requestId);
    const result = this.durable.authentication.confirmTotpEnrollment(caller.value, input.enrollToken, input.code);
    if (!result.ok) return mfaFailure(result.error, requestId);
    await this.durable.persistAuthentication();
    return Object.freeze({ enrolled: true as const });
  }

  async beginStepUp(
    accessToken: string,
    requestId: string,
  ): Promise<CustomerMfaChallenge | BffErrorEnvelope> {
    const caller = this.durable.authentication.authenticateRequest(accessToken);
    if (!caller.ok) return authFailure(caller.error, requestId);
    const result = this.durable.authentication.beginMfa(caller.value);
    if (!result.ok) return mfaFailure(result.error, requestId);
    await this.durable.persistAuthentication();
    return Object.freeze({
      schema: CUSTOMER_AUTH_SCHEMA,
      kind: 'MFA_REQUIRED',
      mfaToken: result.value.mfaToken,
      methods: Object.freeze([...result.value.methods]),
    });
  }

  /** Completes either an MFA login challenge or a step-up challenge. */
  async verifyMfa(
    input: { readonly mfaToken: string; readonly code: string; readonly ip?: string; readonly userAgent?: string },
    requestId: string,
  ): Promise<CustomerTokenBundle | BffErrorEnvelope> {
    const result = await this.durable.authentication.verifyMfa({
      mfaToken: input.mfaToken,
      code: input.code,
      ...(input.ip ? { ip: input.ip } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    });
    if (!result.ok) return mfaFailure(result.error, requestId);
    await this.durable.persistAuthentication();
    return this.bundle(result.value as unknown as TokenBundleSource);
  }

  /** Whether TOTP is confirmed for the identity behind this token. */
  mfaStatus(accessToken: string): { readonly totpEnrolled: boolean; readonly authenticationStrength: string } | null {
    const caller = this.durable.authentication.authenticateRequest(accessToken);
    if (!caller.ok) return null;
    const totp = this.durable.authentication.store.totp.get(caller.value.identityId);
    return Object.freeze({
      totpEnrolled: Boolean(totp?.confirmedAt),
      authenticationStrength: caller.value.session.authenticationStrength,
    });
  }

  /**
   * Resolve a signed customer access token to a BFF principal. Returns null
   * when the token is not a valid customer token so other resolvers may try.
   */
  resolveAccessToken(accessToken: string): BffPrincipal | null {
    const authenticated = this.durable.authentication.authenticateRequest(accessToken);
    if (!authenticated.ok) {
      return null;
    }
    const identity = this.durable.runtime.identity.service;
    const session = identity.store.sessions.get(asSessionId(authenticated.value.session.sessionId));
    if (!session) {
      return null;
    }
    const principal = principalFromIdentitySession(identity, session);
    return principal && !('errorCode' in principal) ? principal : null;
  }

  private bundle(source: TokenBundleSource): CustomerTokenBundle {
    return Object.freeze({
      schema: CUSTOMER_AUTH_SCHEMA,
      kind: 'SESSION',
      tokenType: 'Bearer',
      accessToken: source.accessToken,
      refreshToken: source.refreshToken,
      accessExpiresAt: source.accessExpiresAt,
      refreshExpiresAt: source.refreshExpiresAt,
      sessionId: source.session.sessionId,
      authenticationStrength: source.authenticationStrength,
      environment: 'simulation',
      production: false,
    });
  }
}

type TokenBundleSource = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly refreshExpiresAt: string;
  readonly session: { readonly sessionId: string };
  readonly authenticationStrength: string;
};
