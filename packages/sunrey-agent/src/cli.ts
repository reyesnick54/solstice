import { asUtcInstant } from '../../domain/src/time.ts';
import type { UserAgentMandateEngine } from './engine.ts';
import { exploreAgentMandateSafety } from './formal.ts';
import { createAgentSandboxScenario } from './sandbox.ts';

export const AGENT_CLI_COMMANDS = [
  'mandate',
  'proposals',
  'approve',
  'activity',
  'simulation',
  'permissions',
  'audit',
] as const;

export function agentCliUsage(): string {
  return [
    'sunrey-agent mandate create',
    'sunrey-agent mandate show <mandateId>',
    'sunrey-agent mandate revoke <mandateId>',
    'sunrey-agent proposals [mandateId]',
    'sunrey-agent approve <proposalId>',
    'sunrey-agent activity <walletId>',
    'sunrey-agent simulation',
    'sunrey-agent permissions <mandateId>',
    'sunrey-agent audit',
  ].join('\n');
}

export function runSunReyAgent(engine: UserAgentMandateEngine, args: readonly string[]): {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
} {
  const [head, ...rest] = args;
  if (head === 'mandate' && rest[0] === 'create') {
    const sandbox = createAgentSandboxScenario('cli');
    const created = engine.createMandate({
      owner: {
        kind: 'USER',
        ownerId: 'user_cli',
        walletId: 'wallet_cli',
        accountId: sandbox.walletAccountId,
      },
      agentLabel: 'cli-agent',
      modelRef: 'model:sim-v1',
      policyRef: 'policy:agent-mandates-v1',
      mode: 'SIMULATION_ONLY',
      environment: 'simulation',
      permissions: {
        actionClasses: ['READ_FINANCIAL_STATE', 'PREPARE_PAYMENT'],
        assets: [{ assetId: 'SUNREY_COIN', wildcard: false }],
        markets: [{ marketId: sandbox.marketId }],
        destinations: [{ kind: 'SPECIFIC_ADDRESS', destinationId: sandbox.destinationId }],
        humanInformationAccess: false,
        allowWildcardAssets: false,
      },
      budget: {
        perTransaction: 100n,
        perPeriod: 500n,
        periodHours: 24,
        perAsset: { SUNREY_COIN: '500' },
        perMarket: {},
        perActionClass: {},
      },
      approval: { class: 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE', highRiskAlwaysHuman: true },
      expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
      frequencyMaxPerPeriod: 8,
      riskPolicyId: 'risk:sim',
      jurisdictionPackId: 'SIM',
      delegatedSigningKeyId: null,
      createdByActorId: 'user_cli',
    });
    return { ok: created.ok, command: 'mandate create', payload: created.ok ? created.value : created.error };
  }
  if (head === 'mandate' && rest[0] === 'show') {
    const mandate = engine.getMandate(rest[1] ?? '');
    return { ok: Boolean(mandate), command: 'mandate show', payload: mandate ?? { error: 'not found' } };
  }
  if (head === 'mandate' && rest[0] === 'revoke') {
    const revoked = engine.revokeMandate({ mandateId: rest[1] ?? '', actorId: 'user_cli' });
    return { ok: revoked.ok, command: 'mandate revoke', payload: revoked.ok ? revoked.value : revoked.error };
  }
  if (head === 'proposals') {
    return { ok: true, command: 'proposals', payload: engine.listProposals(rest[0]) };
  }
  if (head === 'approve') {
    const approved = engine.approveProposal({
      proposalId: rest[0] ?? '',
      actorId: 'user_cli',
      approvalClass: 'MOBILE_CONFIRMATION',
      nonce: `nonce_${rest[0] ?? 'missing'}`,
    });
    return { ok: approved.ok, command: 'approve', payload: approved.ok ? approved.value : approved.error };
  }
  if (head === 'activity') {
    return { ok: true, command: 'activity', payload: engine.activity(rest[0] ?? 'wallet_cli') };
  }
  if (head === 'simulation') {
    return { ok: true, command: 'simulation', payload: { sandbox: createAgentSandboxScenario('cli-sim'), formal: exploreAgentMandateSafety() } };
  }
  if (head === 'permissions') {
    return { ok: true, command: 'permissions', payload: engine.permissions(rest[0] ?? '') ?? { error: 'not found' } };
  }
  if (head === 'audit') {
    return { ok: true, command: 'audit', payload: engine.audit() };
  }
  return { ok: false, command: head ?? 'missing', payload: { error: 'unknown command', usage: agentCliUsage() } };
}
