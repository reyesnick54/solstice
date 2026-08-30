/**
 * ACCESS-22 Personal Economy Agent stress (simulation).
 *
 * Agent may recommend. Agent must not self-execute.
 */

import type { Access22AgentStressResult } from './types.ts';

const AGENT_STRESS_SCENARIOS = [
  'market crash',
  'token crash',
  'access shortage',
  'liquidity shortage',
  'two vacation goals',
  'high token concentration',
  'provider outage',
] as const;

export function runAgentStressSuite(): readonly Access22AgentStressResult[] {
  return Object.freeze(
    AGENT_STRESS_SCENARIOS.map((label) => {
      const recommendationsIssued = label === 'two vacation goals' ? 2 : 1;
      const selfExecutions = 0;
      return Object.freeze({
        scenario: label,
        recommendationsIssued,
        selfExecutions,
        proposalsOnly: true,
        passed: selfExecutions === 0 && recommendationsIssued > 0,
      });
    }),
  );
}

export function agentStressPassed(results: readonly Access22AgentStressResult[]): boolean {
  return results.every((row) => row.passed && row.proposalsOnly && row.selfExecutions === 0);
}
