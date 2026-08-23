/**
 * Public / client-safe SunRey Agent productization SDK.
 * Wraps packages/sunrey-agent. Does not issue Execution Authority,
 * post journals, or connect a live model provider.
 */
export {
  AgentQualificationPlatform,
  defaultSandboxPorts,
  PHASE_F_FLAGS,
  LOVABLE_AGENT_CONTRACT,
  AGENT_TOOL_CATALOG,
  AGENT_EVAL_CASES,
  AGENT_THREAT_MODEL,
} from '../../sunrey-agent/src/productization/index.ts';
export type { AgentActionCard, AgentTurnResult, SandboxUser } from '../../sunrey-agent/src/productization/platform.ts';

import type { Clock } from '../../config/src/clock.ts';
import { AgentQualificationPlatform } from '../../sunrey-agent/src/productization/platform.ts';

export function createSunReyAgentClient(input: { readonly clock: Clock; readonly modelRef?: string }): AgentQualificationPlatform {
  return new AgentQualificationPlatform(input);
}
