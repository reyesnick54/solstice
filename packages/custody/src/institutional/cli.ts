import type { InstitutionalCustodyService } from './service.ts';
import type { NativeWithdrawalId, VaultId } from './ids.ts';
import type { CustodyActorKind } from './taxonomy.ts';

export function custodyUsage(): string {
  return [
    'sunrey-custody vault create',
    'sunrey-custody vault show <vaultId>',
    'sunrey-custody address create <vaultId>',
    'sunrey-custody deposits [vaultId]',
    'sunrey-custody withdrawal request <vaultId> <walletId> <destinationId> <quantity>',
    'sunrey-custody withdrawal approve <withdrawalId> <actorId>',
    'sunrey-custody withdrawal status <withdrawalId>',
    'sunrey-custody signer status',
    'sunrey-custody signer rotate <walletId>',
    'sunrey-custody reconcile',
    'sunrey-custody security-halt <WITHDRAWAL_HALT|SIGNING_HALT|HOT_VAULT_HALT|ASSET_WITHDRAWAL_HALT>',
  ].join('\n');
}

export type CliResult = { readonly ok: boolean; readonly output: string };

export function runCustodyCommand(
  custody: InstitutionalCustodyService,
  argv: readonly string[],
  actor: { readonly actorId: string; readonly actorKind: CustodyActorKind },
): CliResult {
  const [command, sub, ...rest] = argv;
  if (!command || command === 'help') {
    return { ok: true, output: custodyUsage() };
  }
  if (command === 'vault' && sub === 'create') {
    const created = custody.createVault({
      actorKind: actor.actorKind,
      custodyType: 'INSTITUTIONAL',
      securityTier: 'HOT',
      approvalMode: 'DUAL_CONTROL',
      authorizedApproverIds: [actor.actorId, 'actor_ops_b'],
      classifications: ['SEGREGATED', 'HOT'],
    });
    return format(created);
  }
  if (command === 'vault' && sub === 'show') {
    const vault = custody.showVault(rest[0] as VaultId);
    return vault ? { ok: true, output: JSON.stringify(vault) } : { ok: false, output: 'vault not found' };
  }
  if (command === 'address' && sub === 'create') {
    return format(
      custody.createAddress({
        actorKind: actor.actorKind,
        vaultId: rest[0] as VaultId,
        classifications: ['SEGREGATED', 'HOT'],
      }),
    );
  }
  if (command === 'deposits') {
    return { ok: true, output: JSON.stringify(custody.listDeposits(rest[0] as VaultId | undefined)) };
  }
  if (command === 'withdrawal' && sub === 'status') {
    const withdrawal = custody.getWithdrawal(rest[0] as NativeWithdrawalId);
    return withdrawal
      ? { ok: true, output: JSON.stringify({ withdrawalId: withdrawal.withdrawalId, state: withdrawal.state }) }
      : { ok: false, output: 'withdrawal not found' };
  }
  if (command === 'signer' && sub === 'status') {
    return { ok: true, output: JSON.stringify(custody.signerStatus()) };
  }
  if (command === 'signer' && sub === 'rotate') {
    return format(custody.rotateSigner({ actorKind: actor.actorKind, walletId: rest[0] as never }));
  }
  if (command === 'reconcile') {
    return { ok: true, output: JSON.stringify(custody.reconcile()) };
  }
  if (command === 'security-halt') {
    const kind = rest[0];
    if (
      kind !== 'WITHDRAWAL_HALT' &&
      kind !== 'SIGNING_HALT' &&
      kind !== 'HOT_VAULT_HALT' &&
      kind !== 'ASSET_WITHDRAWAL_HALT'
    ) {
      return { ok: false, output: 'unknown control' };
    }
    return format(
      custody.setSecurityControl({
        kind,
        active: true,
        actorId: actor.actorId,
        actorKind: actor.actorKind,
      }),
    );
  }
  return { ok: false, output: `unknown command\n${custodyUsage()}` };
}

function format(result: { readonly outcome: string; readonly code?: string; readonly message?: string; readonly value?: unknown }): CliResult {
  if (result.outcome === 'OK') {
    return { ok: true, output: JSON.stringify(result.value) };
  }
  return { ok: false, output: `${result.code ?? result.outcome}: ${result.message ?? ''}` };
}

export function main(argv = process.argv.slice(2)): void {
  console.log(custodyUsage());
  if (argv.length === 0) {
    return;
  }
  console.log('operator CLI requires an in-process InstitutionalCustodyService; see institutional demo');
}
