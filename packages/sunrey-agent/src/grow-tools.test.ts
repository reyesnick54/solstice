import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GROW_AGENT_TOOL_NAMES,
  invokeGrowAgentTool,
  refusePrivilegedGrowExecution,
  type GrowAgentToolPort,
} from './grow-tools.ts';

const port: GrowAgentToolPort = {
  getFinancialSnapshot: () => ({ snapshot: true }),
  getGoals: () => ({ goals: [] }),
  getOpportunities: () => ({ items: [] }),
  getGrowthPlan: () => ({ plan: null }),
  getPortfolio: () => ({ holdings: [] }),
  explainOpportunity: () => ({ why: 'idle cash' }),
  createGrowthProposal: () => ({ proposalId: 'fpr_x' }),
  modifyGrowthProposal: () => ({ version: 2 }),
  submitProposalForApproval: () => ({ awaitingHuman: true }),
  getExecutionStatus: () => ({ state: 'QUEUED' }),
};

describe('Grow agent tool hooks', () => {
  it('exposes the Phase F tool list and refuses privileged execution', () => {
    assert.ok(GROW_AGENT_TOOL_NAMES.includes('createGrowthProposal'));
    assert.ok(GROW_AGENT_TOOL_NAMES.includes('getExecutionStatus'));
    const snapshot = invokeGrowAgentTool(port, {
      tool: 'getFinancialSnapshot',
      subjectId: 'sub_1',
      actorId: 'agent_1',
      actorKind: 'AGENT',
      payload: {},
    });
    assert.equal(snapshot.ok, true);
    assert.equal(snapshot.mayExecute, false);
    const submitted = invokeGrowAgentTool(port, {
      tool: 'submitProposalForApproval',
      subjectId: 'sub_1',
      actorId: 'agent_1',
      actorKind: 'AGENT',
      payload: { proposalId: 'fpr_1' },
    });
    assert.equal(submitted.ok, true);
    const selfApprove = invokeGrowAgentTool(port, {
      tool: 'submitProposalForApproval',
      subjectId: 'sub_1',
      actorId: 'agent_1',
      actorKind: 'AGENT',
      payload: { proposalId: 'fpr_1', selfApprove: 'true' },
    });
    assert.equal(selfApprove.ok, false);
    if (!selfApprove.ok) {
      assert.equal(selfApprove.code, 'AGENT_CANNOT_SELF_APPROVE');
    }
    const privileged = refusePrivilegedGrowExecution();
    assert.equal(privileged.ok, false);
    if (!privileged.ok) {
      assert.equal(privileged.code, 'AGENT_CANNOT_EXECUTE');
    }
  });
});
