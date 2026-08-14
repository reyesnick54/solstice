import { isExpired, type Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import type { AuthenticationAssurance } from './assurance.ts';
import type { IdentityCapability } from './capability.ts';
import type { SessionId, SolsticeIdentityId } from './ids.ts';

export const ACTOR_CONTEXT_ISSUER = 'solstice-identity';
export const ACTOR_CONTEXT_TTL_MS = 15n * 60n * 1000n;

const VERIFIED_ACTOR_CONTEXT = Symbol('solstice.VerifiedActorContext');

export type ActorContextIntegrity = {
  readonly algorithm: 'HMAC-SHA256';
  readonly hex: string;
  readonly keyId: string;
  readonly keyVersion: number;
};

export type ActorContext = {
  readonly actorId: string;
  readonly subjectId: SolsticeIdentityId;
  readonly sessionId: SessionId;
  readonly authenticationAssurance: AuthenticationAssurance;
  readonly authorizedCapabilities: readonly IdentityCapability[];
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly issuer: typeof ACTOR_CONTEXT_ISSUER;
  readonly integrity: ActorContextIntegrity;
};

export type VerifiedActorContext = ActorContext & {
  readonly [VERIFIED_ACTOR_CONTEXT]: true;
};

export type ActorContextFailure = {
  readonly code:
    | 'ACTOR_CONTEXT_INVALID'
    | 'ACTOR_CONTEXT_EXPIRED'
    | 'ACTOR_CONTEXT_NOT_VERIFIED'
    | 'ACTOR_CONTEXT_ISSUER_MISMATCH';
  readonly message: string;
};

function canonicalPayload(context: Omit<ActorContext, 'integrity'>): string {
  return [
    context.actorId,
    context.subjectId,
    context.sessionId,
    context.authenticationAssurance,
    [...context.authorizedCapabilities].sort().join(','),
    context.issuedAt,
    context.expiresAt,
    context.issuer,
  ].join('\n');
}

function stampVerified(context: ActorContext): VerifiedActorContext {
  return Object.freeze({
    ...context,
    authorizedCapabilities: Object.freeze([...context.authorizedCapabilities]),
    integrity: Object.freeze({ ...context.integrity }),
    [VERIFIED_ACTOR_CONTEXT]: true as const,
  });
}

export function isVerifiedActorContext(value: unknown): value is VerifiedActorContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    VERIFIED_ACTOR_CONTEXT in value &&
    (value as VerifiedActorContext)[VERIFIED_ACTOR_CONTEXT] === true
  );
}

/**
 * Issues and verifies ActorContext using Chunk 4 SESSION_SIGNING keys.
 * Ordinary business code cannot stamp the verified seal.
 */
export class ActorContextIssuer {
  private readonly keys: KeyProvider;

  constructor(keys: KeyProvider) {
    this.keys = keys;
  }

  issue(input: Omit<ActorContext, 'integrity' | 'issuer'>): Result<VerifiedActorContext, ActorContextFailure> {
    const unsigned = Object.freeze({
      ...input,
      issuer: ACTOR_CONTEXT_ISSUER,
    });
    const signed = this.keys.sign('SESSION_SIGNING', canonicalPayload(unsigned));
    if (!signed.ok) {
      return err({
        code: 'ACTOR_CONTEXT_INVALID',
        message: signed.error.message,
      });
    }
    return ok(
      stampVerified({
        ...unsigned,
        integrity: {
          algorithm: 'HMAC-SHA256',
          hex: signed.value.hex,
          keyId: signed.value.keyId,
          keyVersion: signed.value.keyVersion,
        },
      }),
    );
  }

  verify(context: ActorContext, clock: Clock): Result<VerifiedActorContext, ActorContextFailure> {
    if (!context || context.issuer !== ACTOR_CONTEXT_ISSUER) {
      return err({
        code: 'ACTOR_CONTEXT_ISSUER_MISMATCH',
        message: 'ActorContext issuer is not the Identity service',
      });
    }
    const unsigned: Omit<ActorContext, 'integrity'> = {
      actorId: context.actorId,
      subjectId: context.subjectId,
      sessionId: context.sessionId,
      authenticationAssurance: context.authenticationAssurance,
      authorizedCapabilities: context.authorizedCapabilities,
      issuedAt: context.issuedAt,
      expiresAt: context.expiresAt,
      issuer: ACTOR_CONTEXT_ISSUER,
    };
    const verified = this.keys.verify(
      'SESSION_SIGNING',
      canonicalPayload(unsigned),
      context.integrity.hex,
      context.integrity.keyVersion,
    );
    if (!verified.ok) {
      return err({
        code: 'ACTOR_CONTEXT_INVALID',
        message: 'ActorContext integrity proof is invalid',
      });
    }
    if (isExpired(context.expiresAt, clock.now())) {
      return err({
        code: 'ACTOR_CONTEXT_EXPIRED',
        message: 'ActorContext has expired',
      });
    }
    return ok(stampVerified(context));
  }
}
