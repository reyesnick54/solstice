import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asJurisdiction } from '../../packages/domain/src/jurisdiction.ts';
import { isMfaRequired } from '../../packages/identity/src/authentication-service.ts';
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
      assert.equal(registered.ok, true);
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
      assert.equal(refreshed.ok, true);
      if (!refreshed.ok) {
        throw new Error(refreshed.error.message);
      }
      assert.equal(refreshed.value.session.subjectId, identityId);
      const ctx = second.authentication.authenticateRequest(refreshed.value.accessToken);
      assert.equal(ctx.ok, true);
      if (!ctx.ok) {
        throw new Error(ctx.error.message);
      }
      assert.equal(second.authentication.listTrustedDevices(ctx.value).length, 1);
      void accessToken;
    } finally {
      await second.close();
    }
  });
});
