import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { PersonalEconomyAgent } from '../../agent/src/service.ts';
import { freezeAgentPorts } from '../../agent/src/ports.ts';
import { AccessDemandEngine } from './access/demand-engine.ts';
import { UserAgentMandateEngine, type CreateMandateInput } from './engine.ts';
import { createCanonicalToolRegistry } from './tools/catalog.ts';
import { createAgentToolRuntime } from './tools/runtime.ts';
import { createFixtureToolPorts, FIXTURE_OWNER } from './tools/fixtures.ts';
import type { ToolSession } from './tools/types.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function graphSlice() {
  return {
    mandateId: 'mandate_fixture',
    purpose: 'AGENT_ANALYSIS' as const,
    authorizedCategories: Object.freeze(['GOAL'] as const),
    categoryLabels: Object.freeze({ GOAL: Object.freeze(['Travel goals']) }),
    consentRefs: Object.freeze(['consent_fixture_access']),
  };
}

function basePorts() {
  return freezeAgentPorts({
    context: {
      subjectId: FIXTURE_OWNER,
      generatedAt: NOW,
      writePath: false,
      liquidMinorUnitsByCurrency: {},
      incomeLabels: [],
      obligationLabels: [],
      debtLabels: [],
      goalLabels: ['Travel goals'],
      opportunityLabels: [],
    },
    claims: {
      actorId: 'actor_fixture',
      subjectId: FIXTURE_OWNER,
      authorizedCapabilities: ['CREATE_ACCESS_PROPOSAL'],
      mayProposeOnly: true,
      mayExecute: false,
    },
    mandates: [
      {
        mandateId: 'mandate_fixture',
        version: 1,
        status: 'ACTIVE',
        hardConstraintSummaries: [],
        goalSummaries: ['Travel goals'],
        softPreferenceSummaries: [],
      },
    ],
  });
}

function runtimeFixture() {
  const clock = new FrozenClock(NOW);
  const engine = new UserAgentMandateEngine({
    clock,
    kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_access' }) },
  });
  const input: CreateMandateInput = {
    owner: { kind: 'USER', ownerId: FIXTURE_OWNER, walletId: 'wallet_1', accountId: 'acct_cash_1' },
    agentLabel: 'access',
    modelRef: 'model:sim-v1',
    policyRef: 'policy:access-v1',
    mode: 'SIMULATION_ONLY',
    environment: 'simulation',
    permissions: {
      actionClasses: ['READ_FINANCIAL_STATE', 'PROPOSE_ACCESS_INTENT'],
      assets: [{ assetId: 'FIAT_ACCOUNT', wildcard: false }],
      markets: [],
      destinations: [],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 5_000_000n,
      perPeriod: 10_000_000n,
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
    },
    approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true },
    expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
    frequencyMaxPerPeriod: 20,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: 'SIM',
    delegatedSigningKeyId: null,
    createdByActorId: FIXTURE_OWNER,
    assistScopes: ['CREATE_ACCESS_PROPOSAL'],
    entitledTools: ['proposeAccessIntent', 'confirmAccessReservation'],
  };
  const mandate = engine.createMandate(input);
  if (!mandate.ok) {
    throw new Error(mandate.error.detail);
  }
  const session: ToolSession = {
    conversationId: 'conv_access',
    turnId: 'turn_access',
    correlationId: 'corr_access',
    agentId: mandate.value.agentId,
    agentState: 'ACTIVE',
    mandateId: mandate.value.mandateId,
    ownerId: FIXTURE_OWNER,
    sessionOwnerId: FIXTURE_OWNER,
    accountId: 'acct_cash_1',
    walletId: 'wallet_1',
    actorId: FIXTURE_OWNER,
    environment: 'simulation',
    jurisdictionAvailable: true,
    purpose: 'FINANCIAL_EXPLANATION',
    allowedDataClasses: ['FINANCIAL_PRIVATE', 'PUBLIC', 'PERSONAL_SENSITIVE'],
    productCapabilities: ['accounts', 'access'],
    approvedToolVersions: { proposeAccessIntent: ['1.0.0'], confirmAccessReservation: ['1.0.0'] },
    modelText: 'access request',
    now: clock.now(),
  };
  return {
    runtime: createAgentToolRuntime({ engine, ports: createFixtureToolPorts(), clock }),
    session,
    mandate: mandate.value,
    engine,
  };
}

describe('SunRey Agent access demand integration', () => {
  it('refuses reservation confirmation and self-issued execution authority', () => {
    const engine = new AccessDemandEngine(new PersonalEconomyAgent({ clock: new FrozenClock(NOW) }));
    const reservation = engine.confirmReservation();
    assert.equal(reservation.ok, false);
    assert.equal(reservation.error.code, 'PROHIBITED_CONFIRMATION');
    const authority = engine.issueExecutionAuthority();
    assert.equal(authority.ok, false);
    assert.equal(authority.error.code, 'SELF_ISSUED_AUTHORITY');
  });

  it('maps a validated intent to a proposal-only ActionIntent envelope', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
    const provisioned = identity.provisionSimulatedActor({
      actorId: 'actor_fixture',
      jurisdiction: asJurisdiction('US'),
      identityId: FIXTURE_OWNER,
      capabilities: ['VIEW_GROWTH_PLAN'],
    });
    if (!provisioned.ok) {
      throw new Error(provisioned.error.message);
    }
    const actor = identity.service.resolveActorContext('actor_fixture');
    if (!actor.ok) {
      throw new Error(actor.error.message);
    }
    const engine = new AccessDemandEngine(new PersonalEconomyAgent({ clock }));
    const result = engine.propose({
      actor: actor.value,
      ports: basePorts(),
      subjectId: FIXTURE_OWNER,
      sourceText: 'I want a Mustang convertible in Miami for two weeks.',
      graphSlice: graphSlice(),
      actorId: actor.value.actorId,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.actionIntent.actionType, 'PROPOSE_ACCESS_INTENT');
    assert.equal(result.actionIntent.purpose, 'ACCESS_REQUEST');
    assert.equal(result.intent.executable, false);
    assert.equal(result.intent.confirmsReservation, false);
  });

  it('exposes proposeAccessIntent tool that only creates proposals', () => {
    const registry = createCanonicalToolRegistry();
    const tool = registry.get('proposeAccessIntent');
    assert.ok(tool);
    assert.equal(tool?.createsProposal, true);
    assert.equal(tool?.requiresUserApproval, true);
    assert.equal(tool?.requiredMandate, 'PROPOSE_ACCESS_INTENT');
  });

  it('tool runtime refuses confirmAccessReservation for agents', () => {
    const { runtime, session } = runtimeFixture();
    const refused = runtime.invoke(session, {
      toolId: 'confirmAccessReservation',
      version: '1.0.0',
      input: { reservationId: 'res_1' },
    });
    assert.equal(refused.status, 'NOT_ELIGIBLE');
    assert.match(refused.error?.safeMessage ?? '', /cannot confirm/i);
  });

  it('tool runtime creates an access intent proposal without confirming reservations', () => {
    const { runtime, session } = runtimeFixture();
    const proposed = runtime.invoke(session, {
      toolId: 'proposeAccessIntent',
      version: '1.0.0',
      input: { sourceText: 'I want a Mustang convertible in Miami for two weeks.' },
    });
    assert.equal(proposed.status, 'SUCCESS');
    assert.ok(proposed.proposalId);
    const payload = proposed.payload as { confirmsReservation: boolean; grantsEntitlement: boolean };
    assert.equal(payload.confirmsReservation, false);
    assert.equal(payload.grantsEntitlement, false);
  });
});
