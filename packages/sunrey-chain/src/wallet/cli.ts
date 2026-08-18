/**
 * sunrey-wallet CLI.
 *
 * Commands stay understandable for nontechnical users. Private keys
 * are never printed.
 */

import { WalletEngine, createRecoveryPolicy } from './engine.ts';
import { mobileWalletUsage, runMobileWalletCommand } from './mobile-sync/cli.ts';
import { runWalletSecurityCommand, walletSecurityUsage } from './security/cli.ts';
import { isWalletRejection } from './types.ts';

export type CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'create',
  'address',
  'account',
  'balance',
  'build',
  'sign',
  'submit',
  'tx',
  'history',
  'key-rotate',
  'recovery',
  'delegate',
  'watch',
  'sync',
  'sync-status',
  'sync-rebuild',
  'push-test',
  'payment-request',
  'offline-draft',
  'finality',
  'security',
  'devices',
  'sessions',
  'trusted-destinations',
  'rotate-key',
  'delegations',
  'audit',
] as const;

export function walletUsage(): string {
  return [
    'sunrey-wallet create <walletId> <owner> [human|enterprise|machine|watch]',
    'sunrey-wallet address <walletId>',
    'sunrey-wallet account <walletId>',
    'sunrey-wallet balance <walletId>',
    'sunrey-wallet build <from> <to> <amount> <maxFee>',
    'sunrey-wallet sign <walletId> <keyId>',
    'sunrey-wallet submit <walletId>',
    'sunrey-wallet tx <txId>',
    'sunrey-wallet history <walletId>',
    'sunrey-wallet key-rotate <walletId> <currentKeyId> <nextLabel>',
    'sunrey-wallet recovery <walletId> request|cancel|state',
    'sunrey-wallet delegate <walletId> <label> <maxAmount>',
    'sunrey-wallet watch <walletId>',
    mobileWalletUsage(),
    walletSecurityUsage(),
  ].join('\n');
}

const engines = new Map<string, WalletEngine>();
const pending = new Map<string, ReturnType<WalletEngine['buildTransfer']>>();

function engine(): WalletEngine {
  const existing = engines.get('default');
  if (existing) {
    return existing;
  }
  const created = new WalletEngine();
  created.unlock(process.env.SUNREY_WALLET_PASSPHRASE ?? 'development-passphrase');
  engines.set('default', created);
  return created;
}

export function runWalletCommand(args: readonly string[]): CliResult {
  const command = args[0];
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command: command ?? 'missing', payload: { error: 'unknown wallet command', usage: walletUsage() } };
  }
  const wallet = engine();
  switch (command) {
    case 'create': {
      const [walletId, owner, kind] = args.slice(1);
      if (!walletId || !owner) {
        return { ok: false, command, payload: { error: 'usage: create <walletId> <owner> [type]' } };
      }
      const watch = kind === 'watch';
      const result = wallet.createWallet({
        walletId,
        ownerActorId: owner,
        walletType: watch ? 'WATCH_ONLY' : kind === 'enterprise' ? 'ENTERPRISE' : kind === 'machine' ? 'MACHINE' : 'HUMAN',
        watchOnly: watch,
        signerLabels: watch ? [] : [`${walletId}.primary`],
      });
      if (isWalletRejection(result)) {
        return { ok: false, command, payload: result };
      }
      const account = wallet.getAccount(`bca.${walletId}`);
      return {
        ok: true,
        command,
        payload: {
          walletId: result.walletId,
          address: account?.address.text,
          accountId: account?.accountId,
          type: result.walletType,
        },
      };
    }
    case 'address': {
      const account = wallet.getAccount(`bca.${args[1] ?? ''}`);
      return { ok: Boolean(account), command, payload: account ? { address: account.address.text, network: account.address.networkId } : { error: 'not found' } };
    }
    case 'account': {
      const account = wallet.getAccount(`bca.${args[1] ?? ''}`);
      return { ok: Boolean(account), command, payload: account ?? { error: 'not found' } };
    }
    case 'balance': {
      const account = wallet.getAccount(`bca.${args[1] ?? ''}`);
      if (!account) {
        return { ok: false, command, payload: { error: 'not found' } };
      }
      const sun = wallet.holdings(account.accountId, 'SUNREY_COIN');
      const moon = wallet.holdings(account.accountId, 'MOONREY_COIN');
      return {
        ok: true,
        command,
        payload: {
          accountId: account.accountId,
          SUNREY_COIN: { available: sun.available.toString(), reserved: sun.reserved.toString(), locked: sun.locked.toString() },
          MOONREY_COIN: { available: moon.available.toString(), reserved: moon.reserved.toString(), locked: moon.locked.toString() },
          tickerStatus: 'NOT_ASSIGNED',
          note: 'balances are canonical chain state, not wallet metadata',
        },
      };
    }
    case 'build': {
      const [from, to, amount, maxFee] = args.slice(1);
      const destination = wallet.getAccount(`bca.${to ?? ''}`);
      if (!from || !to || !amount || !maxFee || !destination) {
        return { ok: false, command, payload: { error: 'usage: build <from> <to> <amount> <maxFee>' } };
      }
      const built = wallet.buildTransfer({
        walletId: from,
        toAccountId: destination.accountId,
        toAddressText: destination.address.text,
        amount: BigInt(amount),
        maxFee: BigInt(maxFee),
      });
      pending.set(from, built);
      if (isWalletRejection(built)) {
        return { ok: false, command, payload: built };
      }
      return {
        ok: true,
        command,
        payload: {
          clientTxId: built.clientTxId,
          estimatedFee: built.fee.estimatedFee.toString(),
          maximumAuthorizedFee: built.fee.maximumAuthorizedFee.toString(),
          actualFinalizedFee: null,
          unsigned: true,
        },
      };
    }
    case 'sign': {
      const [walletId, keyId] = args.slice(1);
      const built = pending.get(walletId ?? '');
      if (!walletId || !keyId || !built || isWalletRejection(built)) {
        return { ok: false, command, payload: { error: 'build a transfer first' } };
      }
      const signed = wallet.sign({ walletId, built, keyIds: [keyId] });
      return { ok: signed.ok !== false, command, payload: signed };
    }
    case 'submit': {
      const walletId = args[1] ?? '';
      const built = pending.get(walletId);
      if (!built || isWalletRejection(built)) {
        return { ok: false, command, payload: { error: 'nothing to submit' } };
      }
      const account = wallet.getAccount(`bca.${walletId}`);
      const keyId = account?.keys.find((key) => key.status === 'ACTIVE')?.keyId;
      if (!keyId) {
        return { ok: false, command, payload: { error: 'no active key' } };
      }
      const signed = wallet.sign({ walletId, built, keyIds: [keyId] });
      if (signed.ok === false) {
        return { ok: false, command, payload: signed };
      }
      const submitted = wallet.submit({ walletId, built, signatures: signed.signatures });
      return { ok: submitted.ok !== false, command, payload: submitted };
    }
    case 'tx': {
      const record = wallet.history.get(args[1] ?? '');
      return { ok: Boolean(record), command, payload: record ?? { error: 'not found' } };
    }
    case 'history': {
      const account = wallet.getAccount(`bca.${args[1] ?? ''}`);
      return { ok: true, command, payload: wallet.history.list(account?.accountId) };
    }
    case 'key-rotate': {
      const [walletId, currentKeyId, nextLabel] = args.slice(1);
      if (!walletId || !currentKeyId || !nextLabel) {
        return { ok: false, command, payload: { error: 'usage: key-rotate <walletId> <currentKeyId> <nextLabel>' } };
      }
      const result = wallet.rotateKey({ walletId, currentKeyId, nextLabel });
      return { ok: result.ok !== false, command, payload: result };
    }
    case 'recovery': {
      const walletId = args[1] ?? '';
      const action = args[2] ?? 'request';
      if (action === 'state') {
        return runWalletSecurityCommand(args);
      }
      if (action === 'cancel') {
        return { ok: true, command, payload: wallet.cancelPendingRecovery(walletId, `rec.${walletId}`) };
      }
      const policy = createRecoveryPolicy({
        policyId: `rec.${walletId}`,
        kind: 'OWNER_RECOVERY_KEY',
        threshold: 1,
        delayHeights: 2,
        ownerMayCancel: true,
        credentials: [
          {
            schemaVersion: 1,
            credentialId: `cred.${walletId}.recovery`,
            kind: 'OWNER_RECOVERY_KEY',
            actorId: walletId,
            keyId: `${walletId}.recovery`,
            publicKeyHex: '00',
            grantsEverydaySpend: false,
          },
        ],
      });
      if (!wallet.getWallet(walletId)) {
        return { ok: false, command, payload: { error: 'wallet not found' } };
      }
      wallet.registerRecoveryPolicy(policy);
      const result = wallet.beginRecovery({
        walletId,
        policyId: policy.policyId,
        nextLabel: `${walletId}.recovered`,
        authorizingCredentialIds: [`cred.${walletId}.recovery`],
      });
      return { ok: result.ok !== false, command, payload: result };
    }
    case 'delegate': {
      const [walletId, label, maxAmount] = args.slice(1);
      if (!walletId || !label || !maxAmount) {
        return { ok: false, command, payload: { error: 'usage: delegate <walletId> <label> <maxAmount>' } };
      }
      const result = wallet.delegate({
        walletId,
        label,
        limit: {
          allowedTransactionTypes: ['NATIVE_ASSET'],
          allowedAsset: 'SUNREY_COIN',
          maximumAmount: BigInt(maxAmount),
          maximumTotalAmount: BigInt(maxAmount),
          expirationHeight: null,
          allowedCounterparty: null,
          purpose: 'session',
          feeCeiling: 2_000n,
        },
      });
      return { ok: result.ok !== false, command, payload: result };
    }
    case 'sync':
    case 'sync-status':
    case 'sync-rebuild':
    case 'push-test':
    case 'payment-request':
    case 'offline-draft':
    case 'finality':
      return runMobileWalletCommand(args);
    case 'security':
    case 'devices':
    case 'sessions':
    case 'trusted-destinations':
    case 'rotate-key':
    case 'delegations':
    case 'audit':
      return runWalletSecurityCommand(args);
    case 'watch': {
      const [walletId] = args.slice(1);
      if (!walletId) {
        return { ok: false, command, payload: { error: 'usage: watch <walletId>' } };
      }
      const result = wallet.createWallet({
        walletId,
        ownerActorId: walletId,
        walletType: 'WATCH_ONLY',
        watchOnly: true,
        signerLabels: [],
      });
      return { ok: !isWalletRejection(result), command, payload: result };
    }
    default:
      return { ok: false, command, payload: { usage: walletUsage() } };
  }
}

export async function main(): Promise<void> {
  const result = runWalletCommand(process.argv.slice(2));
  const text = JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
  if (/private[_-]?key|seedHex|pkcs8/i.test(text)) {
    throw new Error('CLI refused to print private key material');
  }
  console.log(text);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
