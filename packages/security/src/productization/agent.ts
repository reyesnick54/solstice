/**
 * Agent security isolation. The Agent cannot hold secrets, provider
 * credentials, private keys, Execution Authority, or privileged tools.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { assertNoPrivateKeyMaterial } from '../crypto-leakage.ts';

export const AGENT_FORBIDDEN_CONTEXT = [
  'provider credentials',
  'private keys',
  'Execution Authority',
  'database passwords',
  'HSM handles as exportable material',
] as const;

export function assertAgentContextClean(modelContext: unknown): SecurityResult<true> {
  const leakage = assertNoPrivateKeyMaterial(modelContext, 'agent-model-context');
  if (!leakage.ok) {
    return leakage;
  }
  const text = JSON.stringify(modelContext);
  if (
    /execution.?authority|secret:\/\/|BEGIN [A-Z ]*PRIVATE KEY|sk_live_|provider[_-]?secret|hsm[_-]?export/i.test(
      text,
    )
  ) {
    return securityErr('PRIVATE_KEY_LEAKAGE', 'Agent model context contains a forbidden secret class');
  }
  return securityOk(true);
}

export function assertAgentCannotIssueAuthority(issuerKind: string): SecurityResult<true> {
  if (issuerKind === 'AGENT' || issuerKind === 'MODEL') {
    return securityErr('AI_ROLE_FORBIDDEN', 'Agent cannot issue Execution Authority');
  }
  return securityOk(true);
}

export function assertNoPrivilegedToolInjection(toolName: string): SecurityResult<true> {
  if (/postJournal|openAccount|AuthorityIssuer|addBeneficiary|activateProduction|LIVE_/i.test(toolName)) {
    return securityErr('AI_ROLE_FORBIDDEN', `privileged tool '${toolName}' cannot be injected into the Agent`);
  }
  return securityOk(true);
}
