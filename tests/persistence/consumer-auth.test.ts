import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { isMfaRequired } from '../../packages/identity/src/authentication-service.ts';
import { fromBase32, totpAt } from '../../packages/identity/src/totp.ts';
import { persistAuthenticationSnapshot, persistIdentitySnapshot } from '../../packages/persistence/src/index.ts';
import { createDurableRuntime, persistenceAvailable, preparePersistence } from './helpers.ts';

const describePersistence = persistenceAvailable() ? describe : describe.skip;

describePersistence('consumer authentication persistence', () => {
  it('sessions, refresh tokens, and devices survive PostgreSQL restart', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    let refreshToken = '';
    let accessToken = '';
    let identityId = '';
    try {
      const registered = await first.authentication.register({
        email: 'persist@example.com',
        password: 'correct-horse-battery-staple',
        homeJurisdiction: asJurisdiction('GB'),
        termsVersion: 'tos-persist',
      });
      if (!registered.ok) {
        throw new Error(registered.error.message);
      }
      identityId = registered.value.identityId;
      const login = await first.authentication.authenticate({
        email: 'persist@example.com',
        password: 'correct-horse-battery-staple',
        deviceRef: 'persist-device',
      });
      assert.equal(login.ok, true);
      if (!login.ok || isMfaRequired(login.value)) {
        throw new Error('expected session');
      }
      accessToken = login.value.accessToken;
      refreshToken = login.value.refreshToken;
      await persistIdentitySnapshot(first.session.pools.customer, first.runtime.identity.service.snapshot());
      await persistAuthenticationSnapshot(first.session.pools.customer, first.authentication.snapshot());
    } finally {
      await first.close();
    }

    const second = await createDurableRuntime(env);
    try {
      const refreshed = second.authentication.refreshSession({ refreshToken });
      if (!refreshed.ok) {
        throw new Error(refreshed.error.message);
      }
      assert.equal(refreshed.value.session.subjectId, identityId);
      const ctx = second.authentication.authenticateRequest(refreshed.value.accessToken);
      if (!ctx.ok) {
        throw new Error(ctx.error.message);
      }
      assert.equal(second.authentication.listTrustedDevices(ctx.value).length, 1);
      void accessToken;
    } finally {
      await second.close();
    }
  });

  it('restarting an unconfirmed TOTP enrollment persists (no duplicate-key crash) and the second secret is the one kept', async () => {
    const env = await preparePersistence();
    const first = await createDurableRuntime(env);
    let secondSecret = '';
    let identityId = '';
    let keptCredentialId = '';
    const unix = () => Math.floor(Date.parse(first.runtime.clock.now()) / 1000);
    try {
      const registered = await first.authentication.register({
        email: 'reenroll@example.com',
        password: 'correct-horse-battery-staple',
        homeJurisdiction: asJurisdiction('GB'),
        termsVersion: 'tos-reenroll',
      });
      if (!registered.ok) throw new Error(registered.error.message);
      identityId = registered.value.identityId;
      const login = await first.authentication.authenticate({ email: 'reenroll@example.com', password: 'correct-horse-battery-staple', deviceRef: 'reenroll-device' });
      if (!login.ok || isMfaRequired(login.value)) throw new Error('expected session');
      const ctx = first.authentication.authenticateRequest(login.value.accessToken);
      if (!ctx.ok) throw new Error(ctx.error.message);
      await persistIdentitySnapshot(first.session.pools.customer, first.runtime.identity.service.snapshot());

      // First attempt: started, saved, abandoned.
      const abandoned = first.authentication.enrollTotp(ctx.value);
      if (!abandoned.ok) throw new Error(abandoned.error.message);
      await persistAuthenticationSnapshot(first.session.pools.customer, first.authentication.snapshot());

      // Second attempt: this persist used to fail on totp_credential_identity_id_key.
      const retried = first.authentication.enrollTotp(ctx.value);
      if (!retried.ok) throw new Error(retried.error.message);
      await persistAuthenticationSnapshot(first.session.pools.customer, first.authentication.snapshot());
      secondSecret = retried.value.secretBase32;

      const code = totpAt(fromBase32(secondSecret), unix());
      const confirmed = first.authentication.confirmTotpEnrollment(ctx.value, retried.value.enrollToken, code);
      assert.equal(confirmed.ok, true, confirmed.ok ? '' : confirmed.error.message);
      await persistAuthenticationSnapshot(first.session.pools.customer, first.authentication.snapshot());
      const kept = first.authentication.snapshot().totp.find((t) => t.identityId === identityId);
      keptCredentialId = String(kept?.credentialId);

      // A third enrollment is refused once confirmed, and persisting stays safe.
      const third = first.authentication.enrollTotp(ctx.value);
      assert.equal(third.ok, false);
      await persistAuthenticationSnapshot(first.session.pools.customer, first.authentication.snapshot());
    } finally {
      await first.close();
    }

    // Exactly one credential row for the identity: the second, confirmed one.
    const check = await createDurableRuntime(env);
    try {
      const rows = await check.session.pools.customer.query(
        'SELECT credential_id, confirmed_at FROM identity.totp_credential WHERE identity_id = $1',
        [identityId],
      );
      assert.equal(rows.rowCount, 1);
      assert.equal(rows.rows[0].credential_id, keptCredentialId);
      assert.notEqual(rows.rows[0].confirmed_at, null);
      void secondSecret;
    } finally {
      await check.close();
    }
  });
});
