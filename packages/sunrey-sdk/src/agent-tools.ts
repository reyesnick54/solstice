/**
 * Phase F Prompt 3 SDK adapter. Frontend does not invoke privileged
 * Agent tools. Lovable talks to the Agent message API; the runtime
 * lives in packages/sunrey-agent.
 */
export {
  AgentToolRuntime,
  createAgentToolRuntime,
  createCanonicalToolRegistry,
  CANONICAL_AGENT_TOOLS,
  CANONICAL_TOOL_COUNT,
} from '../../sunrey-agent/src/index.ts';
export type {
  AgentToolDefinition,
  AgentToolResult,
  StructuredToolCall,
  ToolSession,
} from '../../sunrey-agent/src/index.ts';
