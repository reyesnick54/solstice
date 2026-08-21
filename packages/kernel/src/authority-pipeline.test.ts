import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { ENVIRONMENT } from '../../config/src/flags.ts';
import { asAccountId } from '../../domain/src/account.ts';
import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
} from '../../domain/src/customer.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asJurisdiction, asResidency } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId, freezeLegalEntity } from '../../domain/src/legal-entity.ts';
import { asProductId, freezeProduct } from '../../domain/src/product.ts';
import { isOk } from '../../domain/src/result.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { ResourceOwnershipRegistry } from '../../identity/src/resource-ownership.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { AuthorityPipeline, type AuthorityHttpRequest } from './authority-pipeline.ts';
import { ComplianceKernel } from './kernel.ts';
import { mapKernelStatus } from './middleware.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');
const GB = asJurisdiction('GB');

const GB_ENTITY = freezeLegalEntity({
  id: asLegalEntityId('le_solstice_uk_ltd'),
  name: 'Solstice UK Ltd (simulation)',
  jurisdiction: GB,
  status: 'ACTIVE',
});

const GB_PRODUCT = freezeProduct({
  id: asProductId('prod_demand_usd_gb'),
  name: 'GB demand',
  accountClass: 'DEMAND_DEPOSIT',
  currency: asCurrencyCode('USD'),
  legalEntityId: GB_ENTITY.id,
  jurisdiction: GB,
  status: 'ACTIVE',
});

function verifiedCustomer(id: string, status: Customer['status'] = 'ACTIVE'): Customer {
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: GB_ENTITY.id,
    jurisdiction: GB,
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-01-15T09:00:00.000Z'),
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', NOW);
  assert.equal(isOk(pending), true);
  if (!isOk(pending)) {
    throw new Error('pending');
  }
  customer = {
    ...pending.value.customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(customer, 'ACTIVE', NOW);
  assert.equal(isOk(active), true);
  if (!isOk(active)) {
    throw new Error('active');
  }
  if (status === 'ACTIVE') {
    return active.value.customer;
  }
  const next = transitionCustomerStatus(active.value.customer, status, NOW);
  assert.equal(isOk(next), true);
  if (!isOk(next)) {
    throw new Error(status);
  }
  return next.value.customer;
}

function pipeline(input: {
  readonly customer?: Customer;
  readonly grantRehearse?: boolean;
  readonly stepUp?: boolean;
}) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const evidence = new EvidenceVault(clock);
  const issuer = new AuthorityIssuer(keys);
  const kernel = new ComplianceKernel(issuer, evidence, clock);
  const adapter = new SimulatedIdentityAdapter({ clock, keys, evidence });
  const customer = input.customer ?? verifiedCustomer('cust_auth');
  const capabilities = [
    'VIEW_ACCOUNT' as const,
    ...(input.grantRehearse === false ? [] : (['AUTHORITY_PATH_REHEARSE'] as const)),
    'AGENT_USE' as const,
    'AGENT_ACTION_APPROVE' as const,
  ];
  const provisioned = adapter.provisionSimulatedActor({
    actorId: 'actor_auth',
    jurisdiction: GB,
    customerId: customer.id,
    capabilities,
    stepUp: input.stepUp === true,
  });
  assert.equal(provisioned.ok, true);
  if (!provisioned.ok) {
    throw new Error(provisioned.error.message);
  }
  const ownership = new ResourceOwnershipRegistry();
  ownership.register({
    kind: 'account',
    id: 'acct_owned',
    ownerSubjectId: provisioned.value.subjectId,
    ownerCustomerId: customer.id,
    ownerActorId: 'actor_auth',
  });
  ownership.register({
    kind: 'account',
    id: 'acct_other',
    ownerSubjectId: asCustomerId('idn_other') as never,
    ownerCustomerId: 'cust_other',
    ownerActorId: 'actor_other',
  });
  const service = adapter.service;
  const session = service.activeSessionForActor('actor_auth');
  assert.ok(session);
  const pipe = new AuthorityPipeline({
    identity: service,
    kernel,
    issuer,
    evidence,
    clock,
    ownership,
    catalog: {
      customerFor: (id) => (id === customer.id ? customer : undefined),
      product: GB_PRODUCT,
      legalEntity: GB_ENTITY,
    },
  });
  return { clock, evidence, issuer, kernel, adapter, service, pipe, session, customer, ownership };
}

function request(
  path: string,
  overrides: Partial<AuthorityHttpRequest> & { readonly sessionId?: string } = {},
): AuthorityHttpRequest {
  const { sessionId, headers, ...rest } = overrides;
  return {
    method: rest.method ?? (path === '/v1/authority/context' ? 'GET' : 'POST'),
    path,
    headers: {
      'x-sunrey-session-id': sessionId,
      'x-sunrey-request-id': 'req_test',
      ...headers,
    },
    body: rest.body ?? {},
  };
}

describe('authority pipeline middleware', () => {
  it('rejects unauthenticated requests', () => {
    const { pipe } = pipeline({ stepUp: true });
    const response = pipe.handle(request('/v1/authority/context'));
    assert.equal(response.status, 401);
    assert.equal(response.body.error?.code, 'UNAUTHENTICATED');
    assert.equal(response.body.frontend.displayState, 'DENIED');
    assert.ok(response.body.evidenceId);
  });

  it('rejects wrong-user resource access', () => {
    const { pipe, session } = pipeline({ stepUp: true });
    const response = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_other', idempotencyKey: 'idem_other' },
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'RESOURCE_NOT_OWNED');
  });

  it('rejects a missing capability before the Kernel', () => {
    const { pipe, session } = pipeline({ grantRehearse: false, stepUp: true });
    const response = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_perm' },
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'PERMISSION_DENIED');
  });

  it('requires step-up when assurance is below HIGH_ASSURANCE', () => {
    const { pipe, session } = pipeline({ stepUp: false });
    const response = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_mfa' },
      }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.body.error?.code, 'STEP_UP_REQUIRED');
    assert.equal(response.body.frontend.displayState, 'REQUIRES_MFA');
  });

  it('allows a Kernel-approved rehearsal and records evidence', () => {
    const { pipe, session, evidence } = pipeline({ stepUp: true });
    const context = pipe.handle(
      request('/v1/authority/context', { sessionId: session.sessionId }),
    );
    assert.equal(context.status, 200);
    assert.equal(context.body.authorization?.serverOwned, true);
    const response = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_ok' },
      }),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body.error));
    assert.equal(response.body.frontend.displayState, 'ALLOWED');
    assert.equal(response.body.proposal?.state, 'EXECUTED');
    assert.ok(response.body.proposal?.executionAuthorityId);
    assert.ok(evidence.list().some((row) => row.kind === 'KERNEL_DECISION'));
    assert.ok(evidence.list().some((row) => row.kind === 'AUTHORITY_REHEARSAL_EXECUTED'));
    assert.equal(ENVIRONMENT, 'simulation');
    void asAccountId;
  });

  it('maps Kernel denial to a client-safe POLICY_DENIED', () => {
    const { pipe, session } = pipeline({
      stepUp: true,
      customer: verifiedCustomer('cust_suspended', 'SUSPENDED'),
    });
    const response = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_deny' },
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'POLICY_DENIED');
    assert.equal(response.body.frontend.displayState, 'DENIED');
    assert.equal(/sanction|rule pack|CONFIRMED_BY_COUNSEL/i.test(response.body.error?.message ?? ''), false);
  });

  it('holds Agent proposals for human approval and refuses Agent self-approval', () => {
    const { pipe, session } = pipeline({ stepUp: true });
    const pending = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        headers: {
          'x-sunrey-session-id': session.sessionId,
          'x-sunrey-principal-kind': 'AGENT',
          'x-sunrey-agent-id': 'agt_1',
          'x-sunrey-agent-mandate-id': 'man_1',
        },
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_agent' },
      }),
    );
    assert.equal(pending.status, 202);
    assert.equal(pending.body.frontend.displayState, 'REQUIRES_APPROVAL');
    assert.equal(pending.body.proposal?.state, 'AWAITING_USER_APPROVAL');
    assert.ok(pending.body.authorization);
    const self = pipe.approveProposal({
      proposalId: pending.body.proposal!.proposalId,
      approverContext: {
        ...pending.body.authorization!,
        principalKind: 'AGENT',
      },
    });
    assert.equal(self.ok, false);
    if (!self.ok) {
      assert.equal(self.error.code, 'AGENT_CANNOT_SELF_APPROVE');
    }
  });

  it('expires a proposal and refuses later execution', () => {
    const { pipe, session } = pipeline({ stepUp: true });
    const pending = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        headers: {
          'x-sunrey-session-id': session.sessionId,
          'x-sunrey-principal-kind': 'AGENT',
          'x-sunrey-agent-id': 'agt_1',
          'x-sunrey-agent-mandate-id': 'man_1',
        },
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_exp' },
      }),
    );
    assert.ok(pending.body.proposal);
    const expired = pipe.expireProposal(pending.body.proposal.proposalId);
    assert.equal(expired.ok, true);
    if (expired.ok) {
      assert.equal(expired.value.state, 'EXPIRED');
    }
  });

  it('replays a duplicate rehearsal by idempotency key', () => {
    const { pipe, session } = pipeline({ stepUp: true });
    const first = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_dup' },
      }),
    );
    assert.equal(first.status, 200, JSON.stringify(first.body.error));
    const second = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: { resourceId: 'acct_owned', idempotencyKey: 'idem_dup' },
      }),
    );
    assert.equal(second.status, 200);
    assert.equal(second.body.proposal?.proposalId, first.body.proposal?.proposalId);
  });

  it('rejects a frontend attempt to supply Execution Authority', () => {
    const { pipe, session } = pipeline({ stepUp: true });
    const response = pipe.handle(
      request('/v1/authority/rehearsal', {
        sessionId: session.sessionId,
        body: {
          resourceId: 'acct_owned',
          idempotencyKey: 'idem_bypass',
          executionAuthority: { signature: 'forged' },
        },
      }),
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'CLIENT_PRIVILEGE_REJECTED');
  });

  it('maps canonical Kernel statuses without inventing a second vocabulary', () => {
    assert.equal(mapKernelStatus('ALLOW'), 'ALLOW');
    assert.equal(mapKernelStatus('BLOCK'), 'DENY');
    assert.equal(mapKernelStatus('REQUIRE_MANUAL_REVIEW'), 'REQUIRE_COMPLIANCE_REVIEW');
    assert.equal(mapKernelStatus('DEFER'), 'UNAVAILABLE');
    assert.equal(ACTION_TYPES.REHEARSE_AUTHORITY_PATH, 'REHEARSE_AUTHORITY_PATH');
  });
});
