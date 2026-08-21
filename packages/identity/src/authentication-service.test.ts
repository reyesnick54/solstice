import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { AuthenticationService, isMfaRequired } from './authentication-service.ts';
import { dispatchAuthHttp } from './http/auth-http.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { SimulatedIdentityAdapter } from './simulation.ts';
import { ACCESS_TOKEN_TTL_MS } from './tokens.ts';
import { totpAt, verifyTotp, fromBase32 } from './totp.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');
const GB = asJurisdiction('GB');
const PASSWORD = 'correct-horse-battery-staple';

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const evidence = new EvidenceVault(clock);
  const events = new DomainEventLog();
  const adapter = new SimulatedIdentityAdapter({ clock, keys, evidence, events });
  const auth = new AuthenticationService({
    identity: adapter.service,
    clock,
    keys,
    events,
    evidence,
  });
  return { clock, keys, evidence, events, adapter, auth, service: adapter.service };
}

async function registerUser(
  auth: AuthenticationService,
  email = 'user@example.com',
  password = PASSWORD,
) {
  return auth.register({
    email,
    password,
    homeJurisdiction: GB,
    termsVersion: 'tos-2026-08-21',
    ip: '203.0.113.10',
    userAgent: 'SunReyTest/1.0',
  });
}

describe('AuthenticationService', () => {
  it('registers a user without treating registration as KYC', async () => {
    const { auth, service } = harness();
    const registered = await registerUser(auth);
    assert.equal(registered.ok, true);
    if (!registered.ok) {
      throw new Error('expected ok');
    }
    assert.equal(registered.value.kycCompleted, false);
    assert.equal(registered.value.verificationState, 'UNVERIFIED');
    assert.equal(service.latestKyc(registered.value.identityId), undefined);
  });

  it('rejects duplicate registration of the same email', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const duplicate = await registerUser(auth);
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'IDENTIFIER_UNAVAILABLE');
    }
  });

  it('authenticates a valid password and rejects an invalid one', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const valid = await auth.authenticate({
      email: 'user@example.com',
      password: PASSWORD,
      deviceRef: 'browser-1',
      ip: '203.0.113.10',
    });
    assert.equal(valid.ok, true);
    if (!valid.ok || isMfaRequired(valid.value)) {
      throw new Error('expected session');
    }
    assert.equal(valid.value.authenticationStrength, 'LOW');
    assert.match(valid.value.accessToken, /^sr_at\./);
    assert.match(valid.value.refreshToken, /^sr_rt\./);
    assert.equal(valid.value.session.revocationState, 'ACTIVE');

    const invalid = await auth.authenticate({
      email: 'user@example.com',
      password: 'definitely-not-the-password',
      ip: '203.0.113.10',
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.error.code, 'CREDENTIAL_INVALID');
    }
  });

  it('creates a persistent session that middleware can load', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({
      email: 'user@example.com',
      password: PASSWORD,
      deviceRef: 'browser-1',
      ip: '203.0.113.10',
      userAgent: 'SunReyTest/1.0',
    });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const ctx = auth.authenticateRequest(login.value.accessToken);
    assert.equal(ctx.ok, true);
    if (!ctx.ok) {
      throw new Error(ctx.error.message);
    }
    assert.equal(ctx.value.identityId, login.value.session.subjectId);
    assert.equal(ctx.value.session.sessionId, login.value.session.sessionId);
    assert.ok(ctx.value.session.ipHash);
    assert.ok(ctx.value.device);
  });

  it('expires access tokens and sessions', async () => {
    const { auth, clock } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    clock.advanceMs(ACCESS_TOKEN_TTL_MS + 1n);
    const expiredToken = auth.authenticateRequest(login.value.accessToken);
    assert.equal(expiredToken.ok, false);
    if (!expiredToken.ok) {
      assert.equal(expiredToken.error.code, 'SESSION_EXPIRED');
    }
    clock.advanceMs(8n * 60n * 60n * 1000n);
    const expiredRefresh = auth.refreshSession({ refreshToken: login.value.refreshToken });
    assert.equal(expiredRefresh.ok, false);
  });

  it('revokes a session and blocks later access', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const ctx = auth.authenticateRequest(login.value.accessToken);
    assert.equal(ctx.ok, true);
    if (!ctx.ok) {
      throw new Error(ctx.error.message);
    }
    assert.equal(auth.revokeSession(ctx.value.session.sessionId, ctx.value).ok, true);
    const after = auth.authenticateRequest(login.value.accessToken);
    assert.equal(after.ok, false);
    if (!after.ok) {
      assert.equal(after.error.code, 'SESSION_REVOKED');
    }
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const first = auth.refreshSession({ refreshToken: login.value.refreshToken });
    assert.equal(first.ok, true);
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    assert.notEqual(first.value.refreshToken, login.value.refreshToken);
    const reuse = auth.refreshSession({ refreshToken: login.value.refreshToken });
    assert.equal(reuse.ok, false);
    if (!reuse.ok) {
      assert.equal(reuse.error.code, 'REFRESH_REUSE');
    }
    const afterReuse = auth.authenticateRequest(first.value.accessToken);
    assert.equal(afterReuse.ok, false);
  });

  it('enforces TOTP MFA after enrollment', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const ctx = auth.authenticateRequest(login.value.accessToken);
    if (!ctx.ok) {
      throw new Error(ctx.error.message);
    }
    const enrolled = auth.enrollTotp(ctx.value);
    assert.equal(enrolled.ok, true);
    if (!enrolled.ok) {
      throw new Error(enrolled.error.message);
    }
    const secret = fromBase32(enrolled.value.secretBase32);
    const code = totpAt(secret, Math.floor(Date.parse(NOW) / 1000));
    assert.equal(auth.confirmTotpEnrollment(ctx.value, enrolled.value.enrollToken, code).ok, true);

    const second = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    assert.equal(second.ok, true);
    if (!second.ok || !isMfaRequired(second.value)) {
      throw new Error('expected MFA');
    }
    const bad = await auth.verifyMfa({ mfaToken: second.value.mfaToken, code: '000000' });
    assert.equal(bad.ok, false);
    const good = await auth.verifyMfa({ mfaToken: second.value.mfaToken, code });
    assert.equal(good.ok, true);
  });

  it('registers and revokes a device without trusting client device IDs', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({
      email: 'user@example.com',
      password: PASSWORD,
      deviceRef: 'phone-a',
    });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const ctx = auth.authenticateRequest(login.value.accessToken);
    if (!ctx.ok) {
      throw new Error(ctx.error.message);
    }
    const devices = auth.listTrustedDevices(ctx.value);
    assert.equal(devices.length, 1);
    assert.notEqual(devices[0]!.deviceId, 'phone-a');
    assert.equal(auth.revokeDevice(ctx.value, devices[0]!.deviceId).ok, true);
    const again = await auth.authenticate({
      email: 'user@example.com',
      password: PASSWORD,
      deviceRef: 'phone-a',
    });
    assert.equal(again.ok, false);
    if (!again.ok) {
      assert.equal(again.error.code, 'DEVICE_REVOKED');
    }
  });

  it('recovers an account without revealing whether arbitrary users exist', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const unknown = auth.beginRecovery({ email: 'nobody@example.com', ip: '203.0.113.10' });
    const known = auth.beginRecovery({ email: 'user@example.com', ip: '203.0.113.11' });
    assert.equal(unknown.ok, true);
    assert.equal(known.ok, true);
    if (unknown.ok && known.ok) {
      assert.deepEqual(unknown.value, known.value);
    }
    const registered = await registerUser(auth, 'user@example.com');
    assert.equal(registered.ok, false);
    const identityId = login.value.session.subjectId;
    const token = auth.peekIssuedRecoveryToken(identityId);
    assert.ok(token);
    const recovered = await auth.completeRecovery({
      recoveryToken: token!,
      newPassword: 'new-correct-horse-battery',
    });
    assert.equal(recovered.ok, true);
    const old = auth.authenticateRequest(login.value.accessToken);
    assert.equal(old.ok, false);
    const next = await auth.authenticate({
      email: 'user@example.com',
      password: 'new-correct-horse-battery',
    });
    assert.equal(next.ok, true);
  });

  it('rate limits login attempts', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    let limited = false;
    for (let i = 0; i < 8; i += 1) {
      const result = await auth.authenticate({
        email: 'user@example.com',
        password: 'wrong-password-xx',
        ip: '198.51.100.9',
      });
      if (!result.ok && result.error.code === 'RATE_LIMITED') {
        limited = true;
        break;
      }
    }
    assert.equal(limited, true);
  });

  it('records redacted security events', async () => {
    const { auth, events } = harness();
    assert.equal((await registerUser(auth, 'secret.user@example.com')).ok, true);
    await auth.authenticate({
      email: 'secret.user@example.com',
      password: PASSWORD,
      ip: '203.0.113.10',
    });
    await auth.authenticate({
      email: 'secret.user@example.com',
      password: 'wrong-password-xx',
      ip: '203.0.113.10',
    });
    const serialized = JSON.stringify(events.list()) + JSON.stringify(auth.store.snapshot());
    assert.equal(serialized.includes(PASSWORD), false);
    assert.equal(serialized.includes('secret.user@example.com'), false);
    assert.ok(events.list().some((event) => event.eventType === 'IdentitySecurityRecorded'));
  });

  it('hashes passwords with unique salts and never stores plaintext', async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);
    assert.notEqual(first.saltHex, second.saltHex);
    assert.notEqual(first.digestHex, second.digestHex);
    assert.equal(await verifyPassword(PASSWORD, first), true);
    assert.equal(await verifyPassword('wrong-password-xx', first), false);
    assert.equal(JSON.stringify(first).includes(PASSWORD), false);
  });

  it('verifies RFC 6238 TOTP codes in the allowed window', () => {
    const secret = Buffer.from('12345678901234567890');
    const unix = 1_111_111_111;
    const code = totpAt(secret, unix);
    assert.equal(verifyTotp(secret, code, unix), true);
    assert.equal(verifyTotp(secret, '000000', unix), false);
  });

  it('exposes step-up assurance without encoding financial action limits', async () => {
    const { auth } = harness();
    assert.equal((await registerUser(auth)).ok, true);
    const login = await auth.authenticate({ email: 'user@example.com', password: PASSWORD });
    if (!login.ok || isMfaRequired(login.value)) {
      throw new Error('expected session');
    }
    const ctx = auth.authenticateRequest(login.value.accessToken);
    if (!ctx.ok) {
      throw new Error(ctx.error.message);
    }
    const decision = auth.requireAssurance(ctx.value, 'HIGH_ASSURANCE');
    assert.equal(decision.ok, true);
    if (!decision.ok || decision.value.satisfied) {
      throw new Error('password-only login must not satisfy high assurance');
    }
    assert.equal(decision.value.needed, 'HIGH_ASSURANCE');
    assert.equal('beneficiary' in decision.value, false);
  });

  it('documents the production WebAuthn blocker', () => {
    const { auth } = harness();
    const status = auth.webauthnProductionStatus();
    assert.equal(status.implemented, false);
    assert.equal(status.missingDependency, '@simplewebauthn/server');
  });
});

describe('authentication HTTP dispatcher', () => {
  it('registers, logs in, lists sessions, and refuses client-selected identity', async () => {
    const { auth } = harness();
    const registered = await dispatchAuthHttp(auth, {
      method: 'POST',
      path: '/api/v1/auth/register',
      headers: {},
      body: {
        email: 'api@example.com',
        password: PASSWORD,
        homeJurisdiction: 'GB',
        termsVersion: 'tos-1',
      },
      ip: '203.0.113.20',
    });
    assert.equal(registered.status, 201);

    const rejected = await dispatchAuthHttp(auth, {
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: {},
      body: { email: 'api@example.com', password: PASSWORD, userId: 'idn_forged' },
      ip: '203.0.113.20',
    });
    assert.equal(rejected.status, 400);

    const login = await dispatchAuthHttp(auth, {
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'user-agent': 'SunReyTest/1.0' },
      body: { email: 'api@example.com', password: PASSWORD, deviceRef: 'laptop' },
      ip: '203.0.113.20',
    });
    assert.equal(login.status, 200);
    const tokens = login.body as { access_token: string; session_id: string };
    const sessions = await dispatchAuthHttp(auth, {
      method: 'GET',
      path: '/api/v1/auth/sessions',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      body: {},
    });
    assert.equal(sessions.status, 200);
    const logout = await dispatchAuthHttp(auth, {
      method: 'POST',
      path: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      body: {},
    });
    assert.equal(logout.status, 200);
    const me = await dispatchAuthHttp(auth, {
      method: 'GET',
      path: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      body: {},
    });
    assert.equal(me.status, 401);
  });

  it('rate limits the login route', async () => {
    const { auth } = harness();
    await dispatchAuthHttp(auth, {
      method: 'POST',
      path: '/api/v1/auth/register',
      headers: {},
      body: { email: 'limit@example.com', password: PASSWORD, homeJurisdiction: 'GB', termsVersion: 'tos-1' },
      ip: '198.51.100.20',
    });
    let limited = false;
    for (let i = 0; i < 8; i += 1) {
      const response = await dispatchAuthHttp(auth, {
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: {},
        body: { email: 'limit@example.com', password: 'wrong-password-xx' },
        ip: '198.51.100.20',
      });
      if (response.status === 429) {
        limited = true;
        const body = response.body as { error_code: string };
        assert.equal(body.error_code, 'RATE_LIMITED');
        break;
      }
    }
    assert.equal(limited, true);
  });
});
