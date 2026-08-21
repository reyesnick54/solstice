import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { assertCapability, deriveAuthorizationContext } from './authorization-context.ts';
import { clientDenial, privilegedClientClaims } from './client-denial.ts';
import { hasProductCapability } from './product-capability.ts';
import { ResourceOwnershipRegistry } from './resource-ownership.ts';
import { IdentityService } from './service.ts';
import { SimulatedIdentityAdapter } from './simulation.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');
const GB = asJurisdiction('GB');

function harness() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const evidence = new EvidenceVault(clock);
  const adapter = new SimulatedIdentityAdapter({ clock, keys, evidence });
  return { clock, keys, evidence, adapter, service: adapter.service };
}

describe('authorization context and ownership', () => {
  it('builds a server-owned context from session facts, not client claims', () => {
    const { adapter, service } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'actor_ctx', jurisdiction: GB }).ok, true);
    const session = service.activeSessionForActor('actor_ctx');
    assert.ok(session);
    const resolved = service.resolveActorContext('actor_ctx');
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      throw new Error('expected context');
    }
    const identity = service.getIdentity(session.subjectId);
    assert.ok(identity);
    const context = deriveAuthorizationContext({
      identityStatus: identity.status,
      session,
      device: session.deviceId ? service.getDevice(session.deviceId) ?? null : null,
      kyc: service.latestKyc(identity.id) ?? null,
      customerId: service.identityFactsFor('actor_ctx').customerId,
      jurisdiction: identity.homeJurisdiction,
      capabilities: resolved.value.authorizedCapabilities,
      actorContext: resolved.value,
      requestedCapability: 'ACCOUNT_READ',
      requestedResource: null,
      ownedResource: null,
      request: {
        requestId: 'req_1',
        correlationId: null,
        method: 'GET',
        path: '/v1/authority/context',
      },
    });
    assert.equal(context.serverOwned, true);
    assert.equal(context.user.actorId, 'actor_ctx');
    assert.equal(context.requestedCapability, 'ACCOUNT_READ');
    assert.equal(privilegedClientClaims({ roles: ['admin'], kycState: 'VERIFIED' }).includes('roles'), true);
    assert.equal(clientDenial('POLICY_DENIED').message.includes('sanction'), false);
  });

  it('rejects a client-supplied accountId as ownership proof', () => {
    const { adapter, service } = harness();
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'owner_a', jurisdiction: GB }).ok, true);
    assert.equal(adapter.provisionSimulatedActor({ actorId: 'owner_b', jurisdiction: GB }).ok, true);
    const owner = service.resolveActorContext('owner_a');
    const other = service.resolveActorContext('owner_b');
    assert.equal(owner.ok && other.ok, true);
    if (!owner.ok || !other.ok) {
      throw new Error('expected actors');
    }
    const registry = new ResourceOwnershipRegistry();
    registry.register({
      kind: 'account',
      id: 'acct_owned',
      ownerSubjectId: owner.value.subjectId,
      ownerCustomerId: null,
      ownerActorId: owner.value.actorId,
    });
    const stolen = registry.assertOwnedBySubject('account', 'acct_owned', other.value.subjectId);
    assert.equal(stolen.ok, false);
    if (!stolen.ok) {
      assert.equal(stolen.error.code, 'RESOURCE_NOT_OWNED');
    }
    const owned = registry.assertOwnedBySubject('account', 'acct_owned', owner.value.subjectId);
    assert.equal(owned.ok, true);
  });

  it('maps product capabilities through identity grants and refuses Agent self-approval', () => {
    const { adapter, service } = harness();
    assert.equal(
      adapter.provisionSimulatedActor({
        actorId: 'actor_cap',
        jurisdiction: GB,
        customerId: asCustomerId('cust_cap'),
        capabilities: ['VIEW_ACCOUNT', 'AUTHORITY_PATH_REHEARSE', 'AGENT_USE'],
      }).ok,
      true,
    );
    const facts = service.identityFactsFor('actor_cap');
    assert.equal(hasProductCapability(facts.authorizedCapabilities, 'ACCOUNT_READ'), true);
    assert.equal(hasProductCapability(facts.authorizedCapabilities, 'PAYMENT_CREATE'), false);
    const session = service.activeSessionForActor('actor_cap');
    assert.ok(session);
    const resolved = service.resolveActorContext('actor_cap');
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      throw new Error('expected context');
    }
    const identity = service.getIdentity(session.subjectId);
    assert.ok(identity);
    const agentContext = deriveAuthorizationContext({
      identityStatus: identity.status,
      session,
      device: null,
      kyc: service.latestKyc(identity.id) ?? null,
      customerId: 'cust_cap',
      jurisdiction: identity.homeJurisdiction,
      capabilities: ['AGENT_ACTION_APPROVE'],
      actorContext: resolved.value,
      requestedCapability: 'AGENT_ACTION_APPROVE',
      requestedResource: null,
      ownedResource: null,
      request: {
        requestId: 'req_agent',
        correlationId: null,
        method: 'POST',
        path: '/v1/authority/rehearsal',
      },
      principalKind: 'AGENT',
    });
    const denied = assertCapability(agentContext, 'AGENT_ACTION_APPROVE');
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'AGENT_CANNOT_SELF_APPROVE');
    }
  });
});
