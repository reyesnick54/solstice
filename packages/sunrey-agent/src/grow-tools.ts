/**
 * Phase F Financial Agent tool hooks for Grow My Money.
 * The Agent can create or request a proposal. It cannot invoke
 * privileged execution or self-approve.
 */

import { assertAgentCannotSelfApprove } from './safety.ts';

export const GROW_AGENT_TOOL_NAMES = [
  'getFinancialSnapshot',
  'getGoals',
  'getOpportunities',
  'getGrowthPlan',
  'getPortfolio',
  'explainOpportunity',
  'createGrowthProposal',
  'modifyGrowthProposal',
  'submitProposalForApproval',
  'getExecutionStatus',
] as const;
export type GrowAgentToolName = (typeof GROW_AGENT_TOOL_NAMES)[number];

export const GROW_AGENT_PRIVILEGED_TOOLS = [
  'executeProposal',
  'issueExecutionAuthority',
  'postJournal',
  'selfApproveProposal',
] as const;

export type GrowAgentToolRequest = {
  readonly tool: GrowAgentToolName;
  readonly subjectId: string;
  readonly actorId: string;
  readonly actorKind: 'AGENT';
  readonly payload: Readonly<Record<string, string>>;
};

export type GrowAgentToolResult =
  | { readonly ok: true; readonly tool: GrowAgentToolName; readonly value: Readonly<Record<string, unknown>>; readonly mayExecute: false }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly mayExecute: false };

export type GrowAgentToolPort = {
  getFinancialSnapshot(subjectId: string): Readonly<Record<string, unknown>>;
  getGoals(subjectId: string): Readonly<Record<string, unknown>>;
  getOpportunities(subjectId: string): Readonly<Record<string, unknown>>;
  getGrowthPlan(subjectId: string): Readonly<Record<string, unknown>>;
  getPortfolio(subjectId: string): Readonly<Record<string, unknown>>;
  explainOpportunity(subjectId: string, opportunityId: string): Readonly<Record<string, unknown>>;
  createGrowthProposal(subjectId: string, actionId: string): Readonly<Record<string, unknown>>;
  modifyGrowthProposal(subjectId: string, proposalId: string, amountMinorUnits: string): Readonly<Record<string, unknown>>;
  submitProposalForApproval(subjectId: string, proposalId: string): Readonly<Record<string, unknown>>;
  getExecutionStatus(subjectId: string, executionId: string): Readonly<Record<string, unknown>>;
};

export function invokeGrowAgentTool(
  port: GrowAgentToolPort,
  request: GrowAgentToolRequest,
): GrowAgentToolResult {
  if (request.payload.selfApprove === 'true') {
    const denied = assertAgentCannotSelfApprove({
      humanRequesterId: request.subjectId,
      agentActorId: request.actorId,
      mandateId: 'grow-agent-hook',
      proposalId: request.payload.proposalId ?? 'none',
      approverId: request.actorId,
      approverKind: 'AGENT',
    });
    if (!denied.ok) {
      return {
        ok: false,
        code: 'AGENT_CANNOT_SELF_APPROVE',
        message: 'Agent can submit a proposal for human approval but cannot approve or execute it',
        mayExecute: false,
      };
    }
  }
  if ((GROW_AGENT_PRIVILEGED_TOOLS as readonly string[]).includes(request.tool)) {
    return {
      ok: false,
      code: 'AGENT_CANNOT_EXECUTE',
      message: 'Agent cannot invoke privileged execution without canonical approval and Execution Authority',
      mayExecute: false,
    };
  }
  const value = dispatch(port, request);
  return { ok: true, tool: request.tool, value, mayExecute: false };
}

export function refusePrivilegedGrowExecution(): GrowAgentToolResult {
  return {
    ok: false,
    code: 'AGENT_CANNOT_EXECUTE',
    message: 'Agent cannot invoke privileged execution without canonical approval and Execution Authority',
    mayExecute: false,
  };
}

function dispatch(port: GrowAgentToolPort, request: GrowAgentToolRequest): Readonly<Record<string, unknown>> {
  switch (request.tool) {
    case 'getFinancialSnapshot':
      return port.getFinancialSnapshot(request.subjectId);
    case 'getGoals':
      return port.getGoals(request.subjectId);
    case 'getOpportunities':
      return port.getOpportunities(request.subjectId);
    case 'getGrowthPlan':
      return port.getGrowthPlan(request.subjectId);
    case 'getPortfolio':
      return port.getPortfolio(request.subjectId);
    case 'explainOpportunity':
      return port.explainOpportunity(request.subjectId, request.payload.opportunityId ?? '');
    case 'createGrowthProposal':
      return port.createGrowthProposal(request.subjectId, request.payload.actionId ?? '');
    case 'modifyGrowthProposal':
      return port.modifyGrowthProposal(
        request.subjectId,
        request.payload.proposalId ?? '',
        request.payload.amountMinorUnits ?? '0',
      );
    case 'submitProposalForApproval':
      return port.submitProposalForApproval(request.subjectId, request.payload.proposalId ?? '');
    case 'getExecutionStatus':
      return port.getExecutionStatus(request.subjectId, request.payload.executionId ?? '');
    default: {
      const exhaustive: never = request.tool;
      return exhaustive;
    }
  }
}
