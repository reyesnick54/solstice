import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { asEconomicWorkOrderId } from '../packages/platform/src/helios/ids.ts';
import {
  HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED,
  HELIOS_OS12_SERIS_UPSTREAM,
  HeliosOs12AgentPermissionGatewayService,
  assessOs12AgentPermissionGatewayQualification,
  authorizeAgentToolPermission,
  createAgentCapabilityGrant,
  createSimulationModelInferencePort,
  forbiddenPermissionsForResearchAgents,
} from '../packages/platform/src/helios/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-03T06:30:00.000Z');
const CUSTOMER = asCustomerId('cust_os12');
const WORK_ORDER = asEconomicWorkOrderId('ewo_os12');

function service() {
  return new HeliosOs12AgentPermissionGatewayService({
    clock: new FrozenClock(NOW),
    inference: createSimulationModelInferencePort(),
  });
}

describe('HELIOS OS12 — agent permission gateway (Seris patterns, Apache-2.0)', () => {
  it('architecture guard: OS12 module does not bypass canonical authority', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) =>
      row.file.includes('os12-agent-permission-gateway'),
    );
    assert.equal(findings.length, 0);
  });

  it('1. qualification marker and upstream attribution', () => {
    const report = assessOs12AgentPermissionGatewayQualification(NOW);
    assert.equal(report.marker, HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED);
    assert.equal(report.upstreamReferenceSha, HELIOS_OS12_SERIS_UPSTREAM.referenceSha);
    assert.equal(report.explicitResearchPermissions, 7);
    assert.equal(report.forbiddenPermissions, 5);
  });

  it('2. research grants exclude forbidden financial permissions', () => {
    const grant = createAgentCapabilityGrant({
      customerId: CUSTOMER,
      workOrderId: WORK_ORDER,
      agentLabel: 'macro-research-agent',
      now: NOW,
    });
    assert.equal(grant.grantsExecutionAuthority, false);
    assert.equal(grant.authorizesFinancialExecution, false);
    for (const forbidden of forbiddenPermissionsForResearchAgents()) {
      assert.ok(grant.forbiddenPermissions.includes(forbidden));
      assert.ok(!grant.permissions.includes(forbidden as never));
    }
  });

  it('3. explicit tool permissions allow research reads and deny execution', () => {
    const grant = createAgentCapabilityGrant({
      customerId: CUSTOMER,
      workOrderId: WORK_ORDER,
      agentLabel: 'research-agent',
      now: NOW,
    });
    const allowed = authorizeAgentToolPermission({
      grant,
      toolId: 'tool_market_observation',
      operation: 'READ',
    });
    assert.equal(allowed.outcome, 'ALLOWED');
    const denied = authorizeAgentToolPermission({
      grant,
      toolId: 'tool_brokerage',
      operation: 'EXECUTE',
    });
    assert.equal(denied.outcome, 'DENIED_FORBIDDEN');
    assert.equal(denied.permission, 'EXECUTE_ORDER');
  });

  it('4. persistent session tool activation stays within permitted tools', () => {
    const gateway = service();
    const grant = gateway.issueGrant({
      customerId: CUSTOMER,
      workOrderId: WORK_ORDER,
      agentLabel: 'session-agent',
    });
    const opened = gateway.openSession({
      grantId: grant.grantId,
      customerId: CUSTOMER,
      permittedToolIds: Object.freeze(['tool_market_observation', 'tool_economic_data_search']),
      modelProviderRef: 's3m',
      modelId: 's3m-finance-v1',
      modelVersion: '2026.09.01',
    });
    assert.ok(opened.ok);
    const activated = gateway.activateTools(opened.value.sessionId, CUSTOMER, ['tool_market_observation']);
    assert.ok(activated.ok);
    assert.ok(activated.value.activeToolIds.includes('tool_market_observation'));
    const blocked = gateway.activateTools(opened.value.sessionId, CUSTOMER, ['tool_brokerage']);
    assert.equal(blocked.ok, false);
  });

  it('5. model gateway records latency, cost, tool calls, and outcome attribution', () => {
    const gateway = service();
    const grant = gateway.issueGrant({
      customerId: CUSTOMER,
      workOrderId: WORK_ORDER,
      agentLabel: 'model-agent',
    });
    const opened = gateway.openSession({
      grantId: grant.grantId,
      customerId: CUSTOMER,
      permittedToolIds: Object.freeze(['tool_market_observation']),
    });
    assert.ok(opened.ok);
    const infer = gateway.infer({
      sessionId: opened.value.sessionId,
      grantId: grant.grantId,
      providerRef: 's3m',
      modelId: 's3m-finance-v1',
      modelVersion: '2026.09.01',
      promptTokens: 1200,
      maxOutputTokens: 512,
      toolCallsRequested: 2,
      researchOutcomeRef: 'research/outcome/os12-1',
    });
    assert.ok(infer.ok);
    assert.equal(infer.telemetry.providerGrantsExecutionAuthority, false);
    assert.equal(infer.telemetry.toolCalls, 2);
    assert.equal(infer.telemetry.researchOutcomeRef, 'research/outcome/os12-1');
    const audits = gateway.listAudits();
    assert.ok(audits.some((row) => row.kind === 'RESEARCH_OUTCOME_ATTRIBUTED'));
  });

  it('6. autopilot blocks forbidden permissions and allows research ticks', () => {
    const gateway = service();
    const grant = gateway.issueGrant({
      customerId: CUSTOMER,
      workOrderId: WORK_ORDER,
      agentLabel: 'autopilot-agent',
    });
    const opened = gateway.openSession({
      grantId: grant.grantId,
      customerId: CUSTOMER,
      permittedToolIds: Object.freeze(['tool_economic_data_search']),
    });
    assert.ok(opened.ok);
    const autopilot = gateway.registerAutopilot({
      grantId: grant.grantId,
      sessionId: opened.value.sessionId,
      customerId: CUSTOMER,
      kind: 'MACRO_MONITOR',
      intervalMs: 60_000,
    });
    assert.ok(autopilot.ok);
    assert.equal(autopilot.value.authorizesFinancialExecution, false);
    const blocked = gateway.runAutopilotTick(autopilot.value.autopilotId, CUSTOMER, 'EXECUTE_ORDER');
    assert.equal(blocked.ok, false);
    const tick = gateway.runAutopilotTick(autopilot.value.autopilotId, CUSTOMER, 'READ_MACRO');
    assert.ok(tick.ok);
    assert.equal(tick.value.runCount, 1);
  });
});
