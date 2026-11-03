import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED } from '../../../ai-runtime/src/native-agent-runtime/taxonomy.ts';
import {
  assessNativeAgentRuntimeLayerQualification,
  NativeAgentRuntimeService,
  RESEARCH_AGENT_PERMISSIONS,
  type NativeAgentCapabilityGrant,
} from './index.ts';

const NOW = asUtcInstant('2026-11-03T09:00:00.000Z');

describe('native agent runtime (sunrey-agent)', () => {
  it('qualifies the agent session and permission layer', () => {
    const report = assessNativeAgentRuntimeLayerQualification(NOW);
    assert.equal(report.marker, HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED);
  });

  it('gates research tools and forbids execution permissions', () => {
    const clock = new FrozenClock(NOW);
    const runtime = new NativeAgentRuntimeService({ clock });
    const grant: NativeAgentCapabilityGrant = Object.freeze({
      grantId: 'grant_1',
      ownerId: 'owner_1',
      agentId: 'agent_1',
      permissions: [...RESEARCH_AGENT_PERMISSIONS],
      state: 'ACTIVE',
      createdAt: NOW,
    });
    const session = runtime.openSession({
      grant,
      sessionId: 'sess_1',
      permittedToolIds: ['tool_market_snapshot', 'tool_brokerage'],
      initialActiveToolIds: ['tool_market_snapshot'],
    });
    assert.equal(session.grantsExecutionAuthority, false);

    const allowed = runtime.invokeResearchTool({
      sessionId: session.sessionId,
      grant,
      toolId: 'tool_market_snapshot',
      operation: 'READ',
      payload: { symbol: 'SRX' },
    });
    assert.equal(allowed.decision.outcome, 'ALLOWED');

    runtime.activateTools(session.sessionId, ['tool_brokerage']);
    const forbidden = runtime.invokeResearchTool({
      sessionId: session.sessionId,
      grant,
      toolId: 'tool_brokerage',
      operation: 'EXECUTE',
      payload: { side: 'BUY' },
    });
    assert.equal(forbidden.decision.outcome, 'DENIED_FORBIDDEN');
    assert.equal(runtime.audit.forSession(session.sessionId).length, 2);
  });
});
