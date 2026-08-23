import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import {
  AgentKillSwitchBoard,
  AgentOperationsTelemetry,
  AgentTraceRecorder,
  DEFAULT_AGENT_COST_LIMITS,
  enforceCostLimits,
  evaluateDegradedMode,
  observeLatency,
  openEscalation,
} from './productization/ops.ts';
import { AGENT_THREAT_MODEL } from './productization/threat-model.ts';
import { AGENT_TOOL_CATALOG } from './productization/tools.ts';
import { AGENT_THREAT_IDS } from './productization/taxonomy.ts';
import { AgentQualificationPlatform } from './productization/platform.ts';

describe('Phase F observability, cost, kill switches, and escalation', () => {
  it('records metrics without sensitive labels and traces the Agent path', () => {
    const now = asUtcInstant('2026-08-23T00:00:00.000Z');
    const telemetry = new AgentOperationsTelemetry();
    telemetry.record('requests', 1, now, { surface: 'agent' });
    assert.equal(telemetry.snapshot().requests, 1);
    assert.throws(() => telemetry.record('requests', 1, now, { prompt: 'secret' }));
    const traces = new AgentTraceRecorder();
    traces.start({ correlationId: 'corr_1', name: 'frontend_request', at: now });
    traces.start({ correlationId: 'corr_1', name: 'agent', at: now, parentSpanId: 'span_1_frontend_request' });
    traces.start({ correlationId: 'corr_1', name: 'model_gateway', at: now });
    traces.start({ correlationId: 'corr_1', name: 'tool', at: now });
    traces.start({ correlationId: 'corr_1', name: 'proposal', at: now });
    traces.start({ correlationId: 'corr_1', name: 'approval', at: now });
    traces.start({ correlationId: 'corr_1', name: 'execution_authority', at: now });
    traces.start({ correlationId: 'corr_1', name: 'provider', at: now });
    traces.start({ correlationId: 'corr_1', name: 'ledger_evidence', at: now });
    assert.equal(traces.byCorrelation('corr_1').length, 9);
    assert.equal(AGENT_THREAT_MODEL.length, AGENT_THREAT_IDS.length);
    assert.ok(AGENT_TOOL_CATALOG.length >= 20);
  });

  it('enforces cost limits and degrades without breaking Money', () => {
    const over = enforceCostLimits({
      limits: DEFAULT_AGENT_COST_LIMITS,
      modelCallsThisTurn: 9,
      toolCallsThisTurn: 1,
      contextChars: 10,
      turnsThisMinute: 1,
      spentMinor: 1n,
    });
    assert.equal(over.ok, false);
    const degraded = evaluateDegradedMode({ gatewayAvailable: false });
    assert.equal(degraded.agentUiStatus, 'TEMPORARILY_UNAVAILABLE');
    assert.equal(degraded.ordinaryApisAvailable, true);
    assert.equal(degraded.moneyBackendIntact, true);
    assert.equal(degraded.exchangeBackendIntact, true);
    const latency = observeLatency('first_streaming_token', 0, 12);
    assert.equal(latency.productionSlaClaimed, false);
    assert.equal(latency.environment, 'simulation');
  });

  it('kill switches are server-side, auditable, and do not disable accounts', () => {
    const now = asUtcInstant('2026-08-23T00:00:00.000Z');
    const board = new AgentKillSwitchBoard();
    board.engage({
      switchId: 'ks_all',
      scope: 'ALL_AGENT_USAGE',
      targetId: null,
      actorId: 'staff_1',
      reason: 'incident',
      at: now,
    });
    const hit = board.blocked({});
    assert.ok(hit);
    assert.equal(hit?.disablesOrdinaryAccountAccess, false);
    assert.equal(board.auditLog().length >= 1, true);
    const platform = new AgentQualificationPlatform({
      clock: new FrozenClock(now),
    });
    platform.killSwitches.engage({
      switchId: 'ks_tools',
      scope: 'FINANCIAL_PROPOSAL_TOOLS',
      targetId: null,
      actorId: 'staff_1',
      reason: 'pause proposals',
      at: now,
    });
    const user = platform.authenticateSandboxUser('user_a');
    const convo = platform.openConversation(user);
    assert.equal(convo.ok, true);
    if (!convo.ok) {
      return;
    }
    const paused = platform.chat(user, convo.value.conversationId, 'Send Ahmed 1,000 SAR.');
    assert.equal(paused.ok && paused.value.degraded, true);
  });

  it('escalations require authorized staff and are not Agent-resolved', () => {
    const row = openEscalation({
      escalationId: 'esc_1',
      kind: 'COMPLIANCE_QUESTION',
      ownerUserId: 'user_a',
      conversationId: null,
      summary: 'User asked a compliance question the Agent cannot resolve.',
      createdAt: asUtcInstant('2026-08-23T00:00:00.000Z'),
    });
    assert.equal(row.agentResolved, false);
    assert.equal(row.requiresAuthorizedStaff, true);
  });
});
