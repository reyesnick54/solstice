import type { IdentityService } from '../../../../packages/identity/src/service.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';
import type { IdentityVerificationClientState, RiskDisplayLevel, VerificationDisplayState } from './types.ts';

export type SessionDirectory = Map<string, BffPrincipal>;

function mapVerification(state: string | null | undefined): VerificationDisplayState {
  if (state === 'REQUIRES_REVIEW') {
    return 'IN_PROGRESS';
  }
  if (state === 'VERIFIED' || state === 'IN_PROGRESS' || state === 'FAILED' || state === 'EXPIRED') {
    return state;
  }
  return 'NOT_STARTED';
}

export function mapIdentityVerificationClientState(
  state: string | null | undefined,
): IdentityVerificationClientState {
  if (state === 'VERIFIED') return 'VERIFIED';
  if (state === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (state === 'REQUIRES_REVIEW') return 'REVIEW';
  if (state === 'FAILED' || state === 'EXPIRED') return 'ACTION_REQUIRED';
  return 'NOT_STARTED';
}

function mapRisk(state: string | null | undefined, restricted: boolean): RiskDisplayLevel {
  if (restricted) {
    return 'RESTRICTED';
  }
  if (state === 'ELEVATED' || state === 'HIGH') {
    return 'ELEVATED';
  }
  if (state === 'CLEAR' || state === 'LOW') {
    return 'LOW';
  }
  return 'STANDARD';
}

export function resolvePrincipal(input: {
  readonly authorization: string | undefined;
  readonly requestId: string;
  readonly directory: SessionDirectory;
  readonly identity?: IdentityService;
}): BffPrincipal | BffErrorEnvelope {
  if (!input.authorization) {
    return bffError({
      errorCode: 'AUTH_REQUIRED',
      category: 'AUTHENTICATION',
      message: 'consumer BFF routes require an authenticated session',
      retryable: false,
      requestId: input.requestId,
    });
  }
  const token = input.authorization.startsWith('Bearer ')
    ? input.authorization.slice('Bearer '.length).trim()
    : input.authorization.trim();
  if (token.length === 0) {
    return bffError({
      errorCode: 'AUTH_REQUIRED',
      category: 'AUTHENTICATION',
      message: 'consumer BFF routes require an authenticated session',
      retryable: false,
      requestId: input.requestId,
    });
  }

  const sandbox = input.directory.get(token);
  if (sandbox) {
    return sandbox;
  }

  const identity = input.identity;
  if (identity) {
    const session = identity.store.sessions.get(token);
    if (session && session.revocationState === 'ACTIVE') {
      const usable = identity.activeSessionForActor(session.actorId);
      if (usable && usable.sessionId === session.sessionId) {
        const facts = identity.identityFactsFor(session.actorId);
        if (!facts.customerId) {
          return bffError({
            errorCode: 'SESSION_INVALID',
            category: 'AUTHENTICATION',
            message: 'session is not bound to a customer',
            retryable: false,
            requestId: input.requestId,
          });
        }
        const person = identity.store.identities.get(session.subjectId);
        const restricted =
          person?.status === 'SUSPENDED' ||
          person?.status === 'LOCKED' ||
          person?.status === 'CLOSED';
        const principal: BffPrincipal = Object.freeze({
          actorId: session.actorId,
          customerId: String(facts.customerId),
          identityId: session.subjectId,
          sessionId: session.sessionId,
          jurisdiction: person?.homeJurisdiction ?? 'GB',
          verification: mapVerification(facts.kycState),
          customerStatus: 'ACTIVE',
          identityStatus: facts.identityStatus ?? 'UNKNOWN',
          capabilities: facts.authorizedCapabilities,
          risk: mapRisk(session.riskState, restricted),
          restricted,
          sandboxPersona: null,
          deviceSummary: Object.freeze({
            deviceId: session.deviceId,
            trustState: null,
          }),
        });
        return principal;
      }
    }
  }

  return bffError({
    errorCode: 'SESSION_INVALID',
    category: 'AUTHENTICATION',
    message: 'session is missing, expired, or revoked',
    retryable: false,
    requestId: input.requestId,
  });
}
