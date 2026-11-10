import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AuthenticationService } from '@solstice/identity';
import type { Customer } from '@solstice/domain';
import { createSandboxWorld } from './fixtures.ts';
import {
  DurableCustomerAuth,
  REGISTRANT_CAPABILITIES,
  SANDBOX_VERIFICATION_PROVIDER,
  type CustomerAuthRuntime,
} from './durable-customer-auth.ts';
import { resolvePrincipal } from './session.ts';

const PASSWORD = 'correct horse battery staple';
const TERMS = 'sunrey-sandbox-terms-2026-11';

function harness(): {
  auth: DurableCustomerAuth;
  durable: CustomerAuthRuntime;
  persisted: { customers: Customer[]; authSnapshots: number };
} {
  const world = createSandboxWorld();
  const runtime = world.runtime;
  const persisted = { customers: [] as Customer[], authSnapshots: 0 };
  const durable: CustomerAuthRuntime = {
    runtime,
    authentication: new AuthenticationService({
      identity: runtime.identity.service,
      clock: runtime.clock,
      keys: runtime.keyProvider,
    }),
    async saveCustomer(customer) {
      runtime.customers.put(customer.id, customer);
      persisted.customers.push(customer);
    },
    async persistAuthentication() {
      persisted.authSnapshots += 1;
    },
  };
  return { auth: new DurableCustomerAuth(durable, { environment: 'simulation' }), durable, persisted };
}

function isError(value: unknown): value is { errorCode: string } {
  return Boolean(value && typeof value === 'object' && 'errorCode' in value);
}

async function registerAndLogin(auth: DurableCustomerAuth, email: string) {
  const registered = await auth.register({ email, password: PASSWORD, termsVersion: TERMS }, 'req_t');
  assert.equal(isError(registered), false, JSON.stringify(registered));
  const session = await auth.login({ email, password: PASSWORD }, 'req_t');
  assert.equal(isError(session), false, JSON.stringify(session));
  if (isError(session) || isError(registered) || session.kind !== 'SESSION') throw new Error('unreachable');
  return { registered, session };
}

describe('durable customer registration and login', () => {
  it('refuses to construct outside ENVIRONMENT=simulation', () => {
    const { durable } = harness();
    assert.throws(() => new DurableCustomerAuth(durable, { environment: 'production' }), /simulation/);
  });

  it('registers an ACTIVE customer bound to a new identity with labelled sandbox verification', async () => {
    const { auth, durable, persisted } = harness();
    const registered = await auth.register(
      { email: 'Ada@Example.com', password: PASSWORD, termsVersion: TERMS },
      'req_reg',
    );
    assert.equal(isError(registered), false);
    if (isError(registered)) return;
    assert.equal(registered.verification, 'SANDBOX_SIMULATED');
    assert.equal(registered.production, false);

    const customer = durable.runtime.customers.get(registered.customerId as never);
    assert.ok(customer);
    assert.equal(customer.status, 'ACTIVE');
    assert.equal(persisted.customers.length, 1);
    assert.ok(persisted.authSnapshots >= 1);

    const service = durable.runtime.identity.service;
    assert.equal(service.store.identityByCustomer.get(customer.id), registered.identityId);
    const kyc = [...service.store.kycRecords.values()].find((row) => row.identityId === registered.identityId);
    assert.ok(kyc, 'sandbox verification recorded');
    assert.equal(kyc.providerRef, SANDBOX_VERIFICATION_PROVIDER);

    const granted = [...service.store.grants.values()]
      .filter((grant) => grant.identityId === registered.identityId)
      .map((grant) => grant.capability);
    for (const capability of REGISTRANT_CAPABILITIES) {
      assert.ok(granted.includes(capability), `missing ${capability}`);
    }
    assert.equal(granted.includes('ADD_WITHDRAWAL_DESTINATION'), false, 'no external withdrawal destinations');
  });

  it('logs in and resolves the signed access token to that customer only', async () => {
    const { auth } = harness();
    const a = await registerAndLogin(auth, 'a@example.com');
    const b = await registerAndLogin(auth, 'b@example.com');
    assert.notEqual(a.registered.customerId, b.registered.customerId);

    const principalA = auth.resolveAccessToken(a.session.accessToken);
    const principalB = auth.resolveAccessToken(b.session.accessToken);
    assert.equal(principalA?.customerId, a.registered.customerId);
    assert.equal(principalB?.customerId, b.registered.customerId);
    assert.equal(principalA?.sandboxPersona, null);
    assert.equal(principalA?.verification, 'VERIFIED');
  });

  it('rejects wrong passwords, duplicate emails and weak passwords without detail', async () => {
    const { auth } = harness();
    await registerAndLogin(auth, 'dup@example.com');

    const wrong = await auth.login({ email: 'dup@example.com', password: 'not the password!!' }, 'req_w');
    assert.ok(isError(wrong));
    assert.equal(wrong.errorCode, 'AUTH_REQUIRED');

    const unknown = await auth.login({ email: 'nobody@example.com', password: PASSWORD }, 'req_u');
    assert.ok(isError(unknown));
    assert.equal(unknown.errorCode, 'AUTH_REQUIRED');

    const dup = await auth.register({ email: 'dup@example.com', password: PASSWORD, termsVersion: TERMS }, 'req_d');
    assert.ok(isError(dup));
    assert.equal(dup.errorCode, 'VALIDATION');

    const weak = await auth.register({ email: 'weak@example.com', password: 'short', termsVersion: TERMS }, 'req_p');
    assert.ok(isError(weak));
    assert.equal(weak.errorCode, 'VALIDATION');

    const noTerms = await auth.register({ email: 'terms@example.com', password: PASSWORD, termsVersion: '' }, 'req_x');
    assert.ok(isError(noTerms));
    assert.equal(noTerms.errorCode, 'VALIDATION');
  });

  it('revokes the session on logout', async () => {
    const { auth } = harness();
    const { session } = await registerAndLogin(auth, 'bye@example.com');
    assert.ok(auth.resolveAccessToken(session.accessToken));
    assert.equal(await auth.logout(session.accessToken), true);
    assert.equal(auth.resolveAccessToken(session.accessToken), null);
  });

  it('plugs into resolvePrincipal after sandbox sessions and rejects garbage tokens', async () => {
    const { auth } = harness();
    const { registered, session } = await registerAndLogin(auth, 'bff@example.com');
    const directory = new Map();

    const ok = resolvePrincipal({
      authorization: `Bearer ${session.accessToken}`,
      requestId: 'req_r',
      directory,
      customerAuth: auth,
    });
    assert.equal(isError(ok), false);
    if (!isError(ok)) assert.equal(ok.customerId, registered.customerId);

    const bad = resolvePrincipal({
      authorization: 'Bearer not-a-token',
      requestId: 'req_r2',
      directory,
      customerAuth: auth,
    });
    assert.ok(isError(bad));
    assert.equal(bad.errorCode, 'SESSION_INVALID');

    const without = resolvePrincipal({
      authorization: `Bearer ${session.accessToken}`,
      requestId: 'req_r3',
      directory,
    });
    assert.ok(isError(without), 'customer tokens are only honoured when customer auth is configured');
  });
});
