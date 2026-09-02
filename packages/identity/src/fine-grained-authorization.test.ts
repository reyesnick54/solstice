import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import type { ServiceIdentity } from '../../security/src/identity.ts';
import {
  IdentityLinkRegistry,
  SimulationRelationshipEngine,
  authenticationChangePreservesEconomicIdentity,
  createDelegationRecord,
  createSimulationRelationshipEngine,
  evaluateAdminAuthorization,
  evaluateServiceAuthorization,
  governanceCannotBypassTransactionRules,
  revokeDelegation,
  validatorCannotBecomeGovernanceActor,
} from './fine-grained/index.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const LATER = asUtcInstant('2026-09-02T13:00:00.000Z');
const EXPIRED = asUtcInstant('2026-09-01T12:00:00.000Z');

function walletControlTuple(userId: string, walletId: string) {
  return Object.freeze({
    subjectType: 'HUMAN_USER' as const,
    subjectId: userId,
    relation: 'CONTROLS' as const,
    objectType: 'WALLET' as const,
    objectId: walletId,
  });
}

function agentActsForTuple(agentId: string, userId: string) {
  return Object.freeze({
    subjectType: 'AI_AGENT' as const,
    subjectId: agentId,
    relation: 'ACTS_FOR' as const,
    objectType: 'USER' as const,
    objectId: userId,
  });
}

function serviceReadTuple(serviceId: string, datasetId: string) {
  return Object.freeze({
    subjectType: 'SERVICE_IDENTITY' as const,
    subjectId: serviceId,
    relation: 'MAY_READ' as const,
    objectType: 'DATASET' as const,
    objectId: datasetId,
  });
}

function governanceAuthorizeTuple(governanceId: string, proposalId: string) {
  return Object.freeze({
    subjectType: 'HUMAN_GOVERNANCE' as const,
    subjectId: governanceId,
    relation: 'MAY_AUTHORIZE' as const,
    objectType: 'MONETARY_PROPOSAL' as const,
    objectId: proposalId,
  });
}

function validatorValidateTuple(validatorId: string, blockId: string) {
  return Object.freeze({
    subjectType: 'VALIDATOR' as const,
    subjectId: validatorId,
    relation: 'MAY_VALIDATE' as const,
    objectType: 'BLOCK' as const,
    objectId: blockId,
  });
}

describe('fine-grained authorization', () => {
  it('allows a user to access their own wallet', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(walletControlTuple('alice', 'wallet_alice'));

    const decision = engine.check({
      subject: {
        actorType: 'HUMAN_USER',
        actorId: 'alice',
        authenticationIdentityId: 'auth:alice',
        economicIdentityId: null,
      },
      relation: 'CONTROLS',
      resource: { type: 'WALLET', id: 'wallet_alice' },
      permission: 'read',
      purpose: null,
      delegation: null,
      now: NOW,
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.code, 'ALLOWED');
  });

  it('denies a user accessing another user wallet', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(walletControlTuple('alice', 'wallet_alice'));

    const decision = engine.check({
      subject: {
        actorType: 'HUMAN_USER',
        actorId: 'bob',
        authenticationIdentityId: 'auth:bob',
        economicIdentityId: null,
      },
      relation: 'CONTROLS',
      resource: { type: 'WALLET', id: 'wallet_alice' },
      permission: 'read',
      purpose: null,
      delegation: null,
      now: NOW,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'RELATIONSHIP_MISSING');
  });

  it('allows an agent delegated read when ACTS_FOR and delegation scope match', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(agentActsForTuple('agent_fin', 'alice'));

    const delegation = createDelegationRecord({
      delegationId: 'del_1',
      delegatorId: 'alice',
      delegateeId: 'agent_fin',
      delegateeType: 'AI_AGENT',
      scope: {
        resourceType: 'USER',
        resourceIds: ['alice'],
        permittedVerbs: ['read', 'analyze'],
        dataCategories: ['INVESTMENT_ANALYSIS'],
      },
      purpose: 'INVESTMENT_ANALYSIS',
      issuedAt: NOW,
      expiresAt: LATER,
    });

    const decision = engine.check({
      subject: {
        actorType: 'AI_AGENT',
        actorId: 'agent_fin',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'ACTS_FOR',
      resource: { type: 'USER', id: 'alice' },
      permission: 'analyze',
      purpose: 'INVESTMENT_ANALYSIS',
      delegation,
      now: NOW,
    });

    assert.equal(decision.allowed, true);
  });

  it('denies agent unauthorized write even with ACTS_FOR tuple', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(agentActsForTuple('agent_fin', 'alice'));

    const delegation = createDelegationRecord({
      delegationId: 'del_read_only',
      delegatorId: 'alice',
      delegateeId: 'agent_fin',
      delegateeType: 'AI_AGENT',
      scope: {
        resourceType: 'USER',
        resourceIds: ['alice'],
        permittedVerbs: ['read', 'analyze'],
        dataCategories: ['INVESTMENT_ANALYSIS'],
      },
      purpose: 'INVESTMENT_ANALYSIS',
      issuedAt: NOW,
      expiresAt: LATER,
    });

    const decision = engine.check({
      subject: {
        actorType: 'AI_AGENT',
        actorId: 'agent_fin',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'ACTS_FOR',
      resource: { type: 'USER', id: 'alice' },
      permission: 'withdraw',
      purpose: 'INVESTMENT_ANALYSIS',
      delegation,
      now: NOW,
    });

    assert.equal(decision.allowed, false);
    assert.ok(
      decision.code === 'VERB_NOT_PERMITTED' || decision.code === 'MONETARY_BYPASS_FORBIDDEN',
    );
  });

  it('denies expired delegation', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(agentActsForTuple('agent_fin', 'alice'));

    const delegation = createDelegationRecord({
      delegationId: 'del_expired',
      delegatorId: 'alice',
      delegateeId: 'agent_fin',
      delegateeType: 'AI_AGENT',
      scope: {
        resourceType: 'USER',
        resourceIds: ['alice'],
        permittedVerbs: ['read'],
        dataCategories: ['INVESTMENT_ANALYSIS'],
      },
      purpose: 'INVESTMENT_ANALYSIS',
      issuedAt: EXPIRED,
      expiresAt: NOW,
    });

    const decision = engine.check({
      subject: {
        actorType: 'AI_AGENT',
        actorId: 'agent_fin',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'ACTS_FOR',
      resource: { type: 'USER', id: 'alice' },
      permission: 'read',
      purpose: 'INVESTMENT_ANALYSIS',
      delegation,
      now: LATER,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'DELEGATION_DENIED');
  });

  it('denies revoked delegation', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(agentActsForTuple('agent_fin', 'alice'));

    const active = createDelegationRecord({
      delegationId: 'del_revoked',
      delegatorId: 'alice',
      delegateeId: 'agent_fin',
      delegateeType: 'AI_AGENT',
      scope: {
        resourceType: 'USER',
        resourceIds: ['alice'],
        permittedVerbs: ['read'],
        dataCategories: ['INVESTMENT_ANALYSIS'],
      },
      purpose: 'INVESTMENT_ANALYSIS',
      issuedAt: NOW,
      expiresAt: LATER,
    });
    const revoked = revokeDelegation(active, NOW);

    const decision = engine.check({
      subject: {
        actorType: 'AI_AGENT',
        actorId: 'agent_fin',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'ACTS_FOR',
      resource: { type: 'USER', id: 'alice' },
      permission: 'read',
      purpose: 'INVESTMENT_ANALYSIS',
      delegation: revoked,
      now: NOW,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'DELEGATION_DENIED');
  });

  it('allows service identity with explicit MAY_READ tuple', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(serviceReadTuple('svc_analytics', 'dataset_market'));

    const decision = engine.check({
      subject: {
        actorType: 'SERVICE_IDENTITY',
        actorId: 'svc_analytics',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'MAY_READ',
      resource: { type: 'DATASET', id: 'dataset_market' },
      permission: 'read',
      purpose: 'MARKET_ANALYTICS',
      delegation: null,
      now: NOW,
    });

    assert.equal(decision.allowed, true);
  });

  it('denies wrong service without tuple', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(serviceReadTuple('svc_analytics', 'dataset_market'));

    const decision = engine.check({
      subject: {
        actorType: 'SERVICE_IDENTITY',
        actorId: 'svc_intruder',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'MAY_READ',
      resource: { type: 'DATASET', id: 'dataset_market' },
      permission: 'read',
      purpose: null,
      delegation: null,
      now: NOW,
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.code, 'RELATIONSHIP_MISSING');
  });

  it('enforces admin role separation for sensitive actions', () => {
    const support = evaluateAdminAuthorization({
      action: 'PROVIDER_DISABLE',
      operatorRoles: ['CUSTOMER_SUPPORT'],
      operatorId: 'support_1',
      dualControlSatisfied: false,
      monetaryBypassAttempted: false,
    });
    assert.equal(support.allowed, false);
    if (!support.allowed) {
      assert.equal(support.code, 'ADMIN_ROLE_REQUIRED');
    }

    const security = evaluateAdminAuthorization({
      action: 'PROVIDER_DISABLE',
      operatorRoles: ['SECURITY_OPERATOR'],
      operatorId: 'sec_1',
      dualControlSatisfied: true,
      monetaryBypassAttempted: false,
    });
    assert.equal(security.allowed, true);
  });

  it('confirms validator cannot become governance actor', () => {
    assert.equal(validatorCannotBecomeGovernanceActor(['VALIDATOR_OPERATOR'], []), true);
    assert.equal(validatorCannotBecomeGovernanceActor([], ['GOVERNANCE_COUNCIL']), false);
  });

  it('confirms governance actor cannot bypass transaction rules', () => {
    assert.equal(governanceCannotBypassTransactionRules(true), false);
    assert.equal(governanceCannotBypassTransactionRules(false), true);
  });

  it('allows governance authorization only for HUMAN_GOVERNANCE with tuple', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(governanceAuthorizeTuple('gov_council', 'proposal_1'));

    const allowed = engine.check({
      subject: {
        actorType: 'HUMAN_GOVERNANCE',
        actorId: 'gov_council',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'MAY_AUTHORIZE',
      resource: { type: 'MONETARY_PROPOSAL', id: 'proposal_1' },
      permission: 'authorize',
      purpose: 'MAINNET_ISSUANCE',
      delegation: null,
      now: NOW,
    });
    assert.equal(allowed.allowed, true);

    const denied = engine.check({
      subject: {
        actorType: 'VALIDATOR',
        actorId: 'val_1',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'MAY_AUTHORIZE',
      resource: { type: 'MONETARY_PROPOSAL', id: 'proposal_1' },
      permission: 'authorize',
      purpose: null,
      delegation: null,
      now: NOW,
    });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, 'ACTOR_TYPE_MISMATCH');
  });

  it('allows validator block validation with explicit tuple', () => {
    const engine = createSimulationRelationshipEngine();
    engine.writeTuple(validatorValidateTuple('val_1', 'block_100'));

    const decision = engine.check({
      subject: {
        actorType: 'VALIDATOR',
        actorId: 'val_1',
        authenticationIdentityId: null,
        economicIdentityId: null,
      },
      relation: 'MAY_VALIDATE',
      resource: { type: 'BLOCK', id: 'block_100' },
      permission: 'validate',
      purpose: null,
      delegation: null,
      now: NOW,
    });
    assert.equal(decision.allowed, true);
  });

  it('preserves economic identity when login identity changes', () => {
    const registry = new IdentityLinkRegistry();
    registry.link({
      linkId: 'link_1',
      kind: 'BINDS_ECONOMIC',
      fromIdentityId: 'auth:alice_v1',
      toIdentityId: 'econ:alice_pseudo',
      establishedAt: NOW,
      revokedAt: null,
    });
    const beforeEcon = registry.resolveEconomicIdentity('auth:alice_v1');
    registry.revoke('link_1', NOW);
    registry.link({
      linkId: 'link_2',
      kind: 'BINDS_ECONOMIC',
      fromIdentityId: 'auth:alice_v2',
      toIdentityId: 'econ:alice_pseudo',
      establishedAt: LATER,
      revokedAt: null,
    });
    const afterEcon = registry.resolveEconomicIdentity('auth:alice_v2');
    assert.equal(
      authenticationChangePreservesEconomicIdentity(
        beforeEcon?.economicIdentityId ?? null,
        afterEcon?.economicIdentityId ?? null,
      ),
      true,
    );
    assert.equal(afterEcon?.economicIdentityId, 'econ:alice_pseudo');
  });

  it('evaluates zero-trust service authorization', () => {
    const identity: ServiceIdentity = Object.freeze({
      serviceId: 'accounts_svc',
      serviceRole: 'ACCOUNTS_SERVICE',
      credentialRef: { provider: 'SIMULATION', ref: 'cred_1' },
      allowedCapabilities: ['READ_BALANCES', 'SUBMIT_INTENT'],
      expiresAt: '2026-12-31T00:00:00.000Z',
      keyVersion: 1,
      status: 'ACTIVE',
    });

    const allowed = evaluateServiceAuthorization({
      caller: identity,
      requiredCapability: 'READ_BALANCES',
      targetServiceId: 'accounts_svc',
      now: NOW,
    });
    assert.equal(allowed.allowed, true);

    const denied = evaluateServiceAuthorization({
      caller: identity,
      requiredCapability: 'ADMINISTER',
      targetServiceId: 'kernel_svc',
      now: NOW,
    });
    assert.equal(denied.allowed, false);
  });

  it('implements FineGrainedAuthorization tuple operations', () => {
    const engine: SimulationRelationshipEngine = createSimulationRelationshipEngine();
    const tuple = walletControlTuple('carol', 'wallet_carol');
    assert.equal(engine.hasTuple(tuple), false);
    engine.writeTuple(tuple);
    assert.equal(engine.hasTuple(tuple), true);
    assert.equal(engine.listTuplesForSubject('carol').length, 1);
    engine.deleteTuple(tuple);
    assert.equal(engine.hasTuple(tuple), false);
  });
});
