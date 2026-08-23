import { detectPromptInjection } from '../policy.ts';
import type { UserAgent, UserAgentMandate } from '../types.ts';
import type { AgentToolDefinition, ToolSession } from './types.ts';

export type ToolAuthorizationFailure = {
  readonly ok: false;
  readonly status: 'NOT_ELIGIBLE' | 'FAILED' | 'UNAVAILABLE';
  readonly code: string;
  readonly safeMessage: string;
};

export function authorizeToolCall(input: {
  readonly tool: AgentToolDefinition;
  readonly session: ToolSession;
  readonly agent: UserAgent | undefined;
  readonly mandate: UserAgentMandate | undefined;
  readonly rationale?: string;
}): { readonly ok: true } | ToolAuthorizationFailure {
  const { tool, session } = input;
  if (detectPromptInjection(session.modelText) || (input.rationale && detectPromptInjection(input.rationale))) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'PROMPT_INJECTION',
      safeMessage: 'I cannot change tool permissions from conversation text.',
    };
  }
  if (session.ownerId !== session.sessionOwnerId) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'WRONG_OWNER',
      safeMessage: 'I can only use tools for the signed-in owner.',
    };
  }
  if (!input.agent || input.agent.status !== 'ACTIVE' || session.agentState !== 'ACTIVE') {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'AGENT_NOT_ACTIVE',
      safeMessage: 'The agent is not active, so I cannot use this tool.',
    };
  }
  if (input.agent.owner.ownerId !== session.ownerId) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'WRONG_OWNER',
      safeMessage: 'This agent does not belong to the signed-in owner.',
    };
  }
  if (!input.mandate || input.mandate.state !== 'ACTIVE') {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'MISSING_MANDATE',
      safeMessage: 'A valid agent mandate is required before I can use this tool.',
    };
  }
  if (session.now > input.mandate.policy.expiry) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'MANDATE_EXPIRED',
      safeMessage: 'The agent mandate has expired.',
    };
  }
  if (input.mandate.owner.ownerId !== session.ownerId || input.mandate.owner.accountId !== session.accountId) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'WRONG_OWNER',
      safeMessage: 'The mandate does not match this owner and account.',
    };
  }
  if (tool.requiredMandate !== 'NONE' && !input.mandate.permissions.actionClasses.includes(tool.requiredMandate)) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'MISSING_MANDATE',
      safeMessage: `The mandate does not permit ${tool.requiredMandate}.`,
    };
  }
  if (!tool.enabledEnvironments.includes(session.environment)) {
    return {
      ok: false,
      status: 'UNAVAILABLE',
      code: 'ENVIRONMENT_DISABLED',
      safeMessage: 'This tool is not enabled in the current environment.',
    };
  }
  if (!session.jurisdictionAvailable) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'JURISDICTION_UNAVAILABLE',
      safeMessage: 'This action is not available in the current jurisdiction.',
    };
  }
  for (const capability of tool.requiredCapabilities) {
    if (!session.productCapabilities.includes(capability)) {
      return {
        ok: false,
        status: 'UNAVAILABLE',
        code: 'PRODUCT_UNAVAILABLE',
        safeMessage: 'That product capability is not available right now.',
      };
    }
  }
  for (const dataClass of tool.requiredDataClasses) {
    if (!session.allowedDataClasses.includes(dataClass)) {
      return {
        ok: false,
        status: 'NOT_ELIGIBLE',
        code: 'DATA_CLASS_DENIED',
        safeMessage: 'The current purpose and data classification do not allow this read.',
      };
    }
  }
  const approved = session.approvedToolVersions[tool.toolId];
  if (approved && !approved.includes(tool.version)) {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'TOOL_VERSION_NOT_APPROVED',
      safeMessage: 'This tool version is not approved by the agent policy.',
    };
  }
  if (tool.riskClass === 'PRIVILEGED_FINANCIAL_MUTATION') {
    return {
      ok: false,
      status: 'NOT_ELIGIBLE',
      code: 'PRIVILEGED_MUTATION_FORBIDDEN',
      safeMessage: 'Agents cannot perform privileged financial mutations. I can only create a proposal for a human to review.',
    };
  }
  return { ok: true };
}
