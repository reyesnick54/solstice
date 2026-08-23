import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { staffOperatorFromRoles, type StaffOperator } from '../../../identity/src/staff/operator.ts';
import { handleInternalOps, type StaffDirectory } from './http.ts';
import { OperationsControlPlane } from './service.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

function staff(role: StaffOperator['roles'][number], id: string): StaffOperator {
  return staffOperatorFromRoles({
    operatorId: id,
    identityId: `id_${id}`,
    roles: [role],
    assurance: 'STRONG',
    stepUpSatisfied: true,
    sessionId: `sess_${id}`,
  });
}

function directory(operators: readonly StaffOperator[]): StaffDirectory {
  const tokens = new Map(operators.map((row) => [`Bearer ${row.operatorId}`, row]));
  return {
    resolve(authorization) {
      return authorization ? tokens.get(authorization) ?? null : null;
    },
  };
}

function runtime(operators: readonly StaffOperator[]) {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  return {
    plane: new OperationsControlPlane({ clock, evidence }),
    staff: directory(operators),
  };
}

describe('internal operations HTTP', () => {
  it('is served only under /internal/v1 and requires staff auth', () => {
    const api = runtime([staff('COMPLIANCE_ANALYST', 'analyst_http')]);
    const wrongNs = handleInternalOps(api, {
      method: 'GET',
      path: '/api/v1/cases',
      query: {},
      body: {},
      authorization: 'Bearer analyst_http',
    });
    assert.equal(wrongNs.status, 404);
    const unauth = handleInternalOps(api, {
      method: 'GET',
      path: '/internal/v1/cases',
      query: {},
      body: {},
      authorization: undefined,
    });
    assert.equal(unauth.status, 401);
    const me = handleInternalOps(api, {
      method: 'GET',
      path: '/internal/v1/me',
      query: {},
      body: {},
      authorization: 'Bearer analyst_http',
    });
    assert.equal(me.status, 200);
    assert.equal((me.body as { principalKind: string }).principalKind, 'STAFF');
    assert.equal((me.body as { productionActive: boolean }).productionActive, false);
  });

  it('creates a case and denies cross-role privileged actions', () => {
    const support = staff('CUSTOMER_SUPPORT', 'support_http');
    const api = runtime([support]);
    const created = handleInternalOps(api, {
      method: 'POST',
      path: '/internal/v1/cases',
      query: {},
      body: {
        domain: 'CUSTOMER_SUPPORT',
        type: 'SUPPORT',
        subject: 'cust_1',
        reason: 'customer cannot see a payment',
      },
      authorization: 'Bearer support_http',
    });
    assert.equal(created.status, 201);
    const restricted = handleInternalOps(api, {
      method: 'POST',
      path: '/internal/v1/actions',
      query: {},
      body: { action: 'ACCOUNT_RESTRICT', reason: 'nope', subjectRef: 'acct_1' },
      authorization: 'Bearer support_http',
    });
    assert.equal(restricted.status, 403);
  });

  it('denies support custody reads and refuses ledger writes', () => {
    const support = staff('CUSTOMER_SUPPORT', 'support_http_2');
    const api = runtime([support]);
    const custody = handleInternalOps(api, {
      method: 'GET',
      path: '/internal/v1/custody',
      query: {},
      body: {},
      authorization: 'Bearer support_http_2',
    });
    assert.equal(custody.status, 403);
    const ledger = handleInternalOps(api, {
      method: 'POST',
      path: '/internal/v1/staff/ledger-write-attempt',
      query: {},
      body: {},
      authorization: 'Bearer support_http_2',
    });
    assert.equal(ledger.status, 403);
    assert.equal((ledger.body as { errorCode: string }).errorCode, 'LEDGER_MUTATION_FORBIDDEN');
  });

  it('health reports production remains disabled', () => {
    const api = runtime([]);
    const health = handleInternalOps(api, {
      method: 'GET',
      path: '/internal/v1/health',
      query: {},
      body: {},
      authorization: undefined,
    });
    assert.equal(health.status, 200);
    const body = health.body as { productionActive: boolean; lovableExposed: boolean };
    assert.equal(body.productionActive, false);
    assert.equal(body.lovableExposed, false);
  });
});
