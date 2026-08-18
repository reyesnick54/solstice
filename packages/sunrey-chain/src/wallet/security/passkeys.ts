/**
 * Provider-neutral passkey / WebAuthn-compatible authentication.
 *
 * Passkeys authenticate a user, device, or application session.
 * They are never treated as the native blockchain private key.
 * Production deployments bind a WebAuthn library; this development
 * adapter uses node:crypto only.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import type { PasskeyChallenge, PasskeyPublicCredential, WalletSecurityRejection } from './types.ts';

export type PasskeyAuthenticator = {
  beginRegistration(input: {
    readonly identityRef: string;
    readonly rpId: string;
    readonly origin: string;
    readonly now: string;
  }): PasskeyChallenge;
  completeRegistration(input: {
    readonly challengeId: string;
    readonly credentialId: string;
    readonly publicKeyMaterial: string;
    readonly now: string;
  }): PasskeyPublicCredential | WalletSecurityRejection;
  beginAuthentication(input: {
    readonly identityRef: string;
    readonly rpId: string;
    readonly origin: string;
    readonly now: string;
  }): PasskeyChallenge;
  completeAuthentication(input: {
    readonly challengeId: string;
    readonly credentialId: string;
    readonly assertion: string;
    readonly now: string;
  }): PasskeyPublicCredential | WalletSecurityRejection;
};

function later(now: string, ms: number): string {
  return new Date(Date.parse(now) + ms).toISOString();
}

export class DevelopmentPasskeyAuthenticator implements PasskeyAuthenticator {
  private readonly challenges = new Map<string, PasskeyChallenge & { readonly identityRef: string }>();
  private readonly credentials = new Map<string, PasskeyPublicCredential>();

  beginRegistration(input: {
    readonly identityRef: string;
    readonly rpId: string;
    readonly origin: string;
    readonly now: string;
  }): PasskeyChallenge {
    return this.issue(input, 'REGISTRATION');
  }

  completeRegistration(input: {
    readonly challengeId: string;
    readonly credentialId: string;
    readonly publicKeyMaterial: string;
    readonly now: string;
  }): PasskeyPublicCredential | WalletSecurityRejection {
    const challenge = this.consume(input.challengeId, 'REGISTRATION', input.now);
    if ('ok' in challenge) {
      return challenge;
    }
    const credential: PasskeyPublicCredential = Object.freeze({
      credentialId: input.credentialId,
      identityRef: challenge.identityRef,
      publicKeyMaterial: input.publicKeyMaterial,
      signCount: 0,
      createdAt: input.now,
    });
    this.credentials.set(credential.credentialId, credential);
    return credential;
  }

  beginAuthentication(input: {
    readonly identityRef: string;
    readonly rpId: string;
    readonly origin: string;
    readonly now: string;
  }): PasskeyChallenge {
    return this.issue(input, 'AUTHENTICATION');
  }

  completeAuthentication(input: {
    readonly challengeId: string;
    readonly credentialId: string;
    readonly assertion: string;
    readonly now: string;
  }): PasskeyPublicCredential | WalletSecurityRejection {
    const challenge = this.consume(input.challengeId, 'AUTHENTICATION', input.now);
    if ('ok' in challenge) {
      return challenge;
    }
    const credential = this.credentials.get(input.credentialId);
    if (!credential || credential.identityRef !== challenge.identityRef) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'passkey credential is not registered for this identity' };
    }
    const expected = createHash('sha256')
      .update(`SUNREY-PASSKEY-ASSERT-V1:${credential.publicKeyMaterial}:${challenge.challenge}`)
      .digest();
    const presented = Buffer.from(input.assertion, 'hex');
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'passkey assertion failed' };
    }
    const next: PasskeyPublicCredential = Object.freeze({
      ...credential,
      signCount: credential.signCount + 1,
    });
    this.credentials.set(next.credentialId, next);
    return next;
  }

  getCredential(credentialId: string): PasskeyPublicCredential | undefined {
    return this.credentials.get(credentialId);
  }

  static assertionFor(publicKeyMaterial: string, challenge: string): string {
    return createHash('sha256').update(`SUNREY-PASSKEY-ASSERT-V1:${publicKeyMaterial}:${challenge}`).digest('hex');
  }

  private issue(
    input: { readonly identityRef: string; readonly rpId: string; readonly origin: string; readonly now: string },
    purpose: PasskeyChallenge['purpose'],
  ): PasskeyChallenge {
    const challenge: PasskeyChallenge & { readonly identityRef: string } = Object.freeze({
      challengeId: `pkc.${randomBytes(8).toString('hex')}`,
      purpose,
      challenge: randomBytes(32).toString('hex'),
      rpId: input.rpId,
      origin: input.origin,
      expiresAt: later(input.now, 5 * 60 * 1000),
      consumed: false,
      identityRef: input.identityRef,
    });
    this.challenges.set(challenge.challengeId, challenge);
    return challenge;
  }

  private consume(
    challengeId: string,
    purpose: PasskeyChallenge['purpose'],
    now: string,
  ): (PasskeyChallenge & { readonly identityRef: string }) | WalletSecurityRejection {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'unknown passkey challenge' };
    }
    if (challenge.purpose !== purpose) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'passkey challenge purpose mismatch' };
    }
    if (challenge.consumed) {
      return { ok: false, code: 'RECOVERY_REPLAY', detail: 'passkey challenge already consumed' };
    }
    if (Date.parse(now) >= Date.parse(challenge.expiresAt)) {
      return { ok: false, code: 'POLICY_NOT_SATISFIED', detail: 'passkey challenge expired' };
    }
    const consumed = Object.freeze({ ...challenge, consumed: true });
    this.challenges.set(challengeId, consumed);
    return consumed;
  }
}

export function passkeyIsNotNativeKey(_credential: PasskeyPublicCredential): true {
  return true;
}
