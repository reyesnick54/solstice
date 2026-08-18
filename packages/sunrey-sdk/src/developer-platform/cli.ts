import { startLocalDeveloperStack } from './local-devnet.ts';
import { DeveloperPlatformEngine } from './portal.ts';
import type { ApplicationEnvironment, DeveloperPermission } from './types.ts';

export type CliContext = {
  readonly portal: DeveloperPlatformEngine;
  actorAccountId?: string;
  organizationId?: string;
};

export function createCliContext(): CliContext {
  return { portal: new DeveloperPlatformEngine() };
}

export async function runSunReyDev(argv: readonly string[], context: CliContext = createCliContext()): Promise<string> {
  const [command, sub, ...rest] = argv;
  if (command !== 'sunrey-dev' && command !== undefined) {
    return fail(`unknown program ${command}`);
  }
  switch (sub) {
    case 'app':
      return appCommand(rest, context);
    case 'key':
      return keyCommand(rest, context);
    case 'webhook':
      return webhookCommand(rest, context);
    case 'usage':
      return usageCommand(rest, context);
    case 'sandbox':
      return sandboxCommand(rest, context);
    case 'testnet':
      return testnetCommand(rest, context);
    case 'status':
      return JSON.stringify(context.portal.status(), null, 2);
    case 'local':
      if (rest[0] === 'devnet' || rest[0] === undefined) {
        const stack = await startLocalDeveloperStack();
        const line = `rpc=${stack.gateway.url}/v1 labels=${stack.labels.join(',')}`;
        await stack.close();
        return line;
      }
      return fail('usage: sunrey-dev local devnet');
    case undefined:
    case 'help':
      return helpText();
    default:
      return fail(`unknown command ${sub}`);
  }
}

function helpText(): string {
  return [
    'sunrey-dev app create|list',
    'sunrey-dev key create|revoke',
    'sunrey-dev webhook add|test',
    'sunrey-dev usage',
    'sunrey-dev sandbox create',
    'sunrey-dev testnet faucet',
    'sunrey-dev status',
    'sunrey-dev local devnet',
  ].join('\n');
}

function appCommand(args: readonly string[], context: CliContext): string {
  const action = args[0];
  ensureActor(context);
  if (action === 'create') {
    const name = flag(args, '--name') ?? 'sample-app';
    const environment = (flag(args, '--env') ?? 'SANDBOX') as ApplicationEnvironment;
    const org = context.portal.createOrganization({
      name: `${name}-org`,
      ownerAccountId: context.actorAccountId!,
    });
    if (!org.ok) {
      return fail(org.reason);
    }
    context.organizationId = org.value.organizationId;
    const created = context.portal.createApplication({
      actorAccountId: context.actorAccountId!,
      organizationId: org.value.organizationId,
      name,
      environment,
      permissions: defaultScopes(environment),
    });
    return created.ok ? created.value.appId : fail(created.reason);
  }
  if (action === 'list') {
    if (!context.organizationId) {
      return fail('no organization');
    }
    const listed = context.portal.listApplications({
      actorAccountId: context.actorAccountId!,
      organizationId: context.organizationId,
    });
    return listed.ok ? listed.value.map((app) => app.appId).join('\n') : fail(listed.reason);
  }
  return fail('usage: sunrey-dev app create|list');
}

function keyCommand(args: readonly string[], context: CliContext): string {
  const action = args[0];
  ensureActor(context);
  const appId = flag(args, '--app');
  if (action === 'create') {
    if (!appId) {
      return fail('--app required');
    }
    const created = context.portal.createCredential({
      actorAccountId: context.actorAccountId!,
      appId,
      kind: 'SERVER_SECRET',
      scopes: ['CHAIN_READ', 'TRANSACTION_SUBMIT', 'FAUCET_REQUEST'],
    });
    return created.ok ? `${created.value.credential.credentialId} ${created.value.plaintextSecret}` : fail(created.reason);
  }
  if (action === 'revoke') {
    const credentialId = flag(args, '--key');
    if (!credentialId) {
      return fail('--key required');
    }
    const revoked = context.portal.revokeCredential({
      actorAccountId: context.actorAccountId!,
      credentialId,
    });
    return revoked.ok ? revoked.value.status : fail(revoked.reason);
  }
  return fail('usage: sunrey-dev key create|revoke');
}

function webhookCommand(args: readonly string[], context: CliContext): string {
  const action = args[0];
  ensureActor(context);
  if (action === 'add') {
    const appId = flag(args, '--app');
    const url = flag(args, '--url') ?? 'mock://local-webhook-receiver';
    if (!appId) {
      return fail('--app required');
    }
    const added = context.portal.addWebhook({
      actorAccountId: context.actorAccountId!,
      appId,
      url,
      events: ['transaction.finalized'],
    });
    return added.ok ? added.value.endpoint.endpointId : fail(added.reason);
  }
  if (action === 'test') {
    const endpointId = flag(args, '--endpoint');
    if (!endpointId) {
      return fail('--endpoint required');
    }
    return 'queued';
  }
  return fail('usage: sunrey-dev webhook add|test');
}

function usageCommand(args: readonly string[], context: CliContext): string {
  const appId = flag(args, '--app');
  if (!appId) {
    return fail('--app required');
  }
  return JSON.stringify(context.portal.usage(appId));
}

function sandboxCommand(args: readonly string[], context: CliContext): string {
  if (args[0] !== 'create') {
    return fail('usage: sunrey-dev sandbox create');
  }
  ensureActor(context);
  const appId = flag(args, '--app');
  if (!appId) {
    return fail('--app required');
  }
  const created = context.portal.createSandbox({
    actorAccountId: context.actorAccountId!,
    appId,
    label: flag(args, '--label') ?? 'default',
  });
  return created.ok ? created.value.sandboxId : fail(created.reason);
}

function testnetCommand(args: readonly string[], context: CliContext): string {
  if (args[0] !== 'faucet') {
    return fail('usage: sunrey-dev testnet faucet');
  }
  const credentialId = flag(args, '--key');
  const secret = flag(args, '--secret');
  const address = flag(args, '--address');
  if (!credentialId || !secret || !address) {
    return fail('--key --secret --address required');
  }
  const issued = context.portal.requestFaucet({
    credentialId,
    secret,
    address,
    asset: 'SUNREY_COIN',
    quantity: 1_000n,
  });
  return issued.ok ? issued.value.txId : fail(issued.reason);
}

function ensureActor(context: CliContext): void {
  if (!context.actorAccountId) {
    context.actorAccountId = context.portal.createAccount({
      email: 'dev@example.test',
      displayName: 'local-developer',
    }).accountId;
  }
}

function defaultScopes(environment: ApplicationEnvironment): readonly DeveloperPermission[] {
  const base: DeveloperPermission[] = [
    'CHAIN_READ',
    'TRANSACTION_SUBMIT',
    'WALLET_READ_PUBLIC',
    'WEBHOOK_MANAGE',
    'MARKET_DATA_READ',
    'ORACLE_PUBLIC_READ',
    'MACHINE_PUBLIC_READ',
    'GOVERNANCE_PUBLIC_READ',
    'VALIDATOR_PUBLIC_READ',
    'MONETARY_PUBLIC_READ',
    'FAUCET_REQUEST',
    'SANDBOX_MANAGE',
  ];
  return environment === 'PRODUCTION' ? base.filter((scope) => scope !== 'FAUCET_REQUEST') : base;
}

function flag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function fail(message: string): string {
  return `error: ${message}`;
}
