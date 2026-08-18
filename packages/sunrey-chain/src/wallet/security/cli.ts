/**
 * sunrey-wallet security / devices / sessions / recovery / audit commands.
 *
 * Private keys are never printed.
 */

import { containsPrivateMaterial } from '../keys.ts';
import { WalletEngine } from '../engine.ts';
import { isWalletRejection } from '../types.ts';
import { WalletSecurityEngine } from './engine.ts';
import { isWalletSecurityRejection } from './types.ts';

export type SecurityCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const SECURITY_COMMANDS = [
  'security',
  'devices',
  'sessions',
  'trusted-destinations',
  'recovery',
  'rotate-key',
  'delegations',
  'audit',
] as const;

export function walletSecurityUsage(): string {
  return [
    'sunrey-wallet security <walletId>',
    'sunrey-wallet devices <walletId> [register <deviceId> <descriptor>|revoke <deviceId>]',
    'sunrey-wallet sessions <walletId> [revoke <sessionId>|revoke-device <deviceId>|revoke-all]',
    'sunrey-wallet trusted-destinations <walletId> [set <address> <state>]',
    'sunrey-wallet recovery <walletId> [state|request|cancel <requestId>]',
    'sunrey-wallet rotate-key <walletId> <oldKeyId> <newPublicKeyHex>',
    'sunrey-wallet delegations <walletId>',
    'sunrey-wallet audit <walletId>',
  ].join('\n');
}

const securityEngines = new Map<string, { readonly wallet: WalletEngine; readonly security: WalletSecurityEngine }>();

function context(): { readonly wallet: WalletEngine; readonly security: WalletSecurityEngine } {
  const existing = securityEngines.get('default');
  if (existing) {
    return existing;
  }
  const wallet = new WalletEngine();
  wallet.unlock(process.env.SUNREY_WALLET_PASSPHRASE ?? 'development-passphrase');
  const created = { wallet, security: new WalletSecurityEngine() };
  securityEngines.set('default', created);
  return created;
}

function ensureProfile(walletId: string) {
  const { wallet, security } = context();
  let descriptor = wallet.getWallet(walletId);
  if (!descriptor) {
    const created = wallet.createWallet({
      walletId,
      ownerActorId: `actor.${walletId}`,
      walletType: 'HUMAN',
      signerLabels: [`${walletId}.primary`],
    });
    if (isWalletRejection(created)) {
      return created;
    }
    descriptor = created;
  }
  return (
    security.getWalletSecurityProfile(walletId) ??
    security.attachWallet({
      wallet: descriptor,
      custodyClass: descriptor.walletType === 'INSTITUTIONAL' ? 'INSTITUTIONAL_CUSTODY' : 'SELF_CUSTODY',
      identityRef: `id.${descriptor.ownerActorId}`,
    })
  );
}

export function runWalletSecurityCommand(args: readonly string[]): SecurityCliResult {
  const command = args[0];
  if (!command || !(SECURITY_COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command: command ?? 'missing', payload: { error: 'unknown security command', usage: walletSecurityUsage() } };
  }
  const { security } = context();
  const walletId = args[1] ?? '';
  if (!walletId) {
    return { ok: false, command, payload: { error: 'walletId required', usage: walletSecurityUsage() } };
  }
  const profile = ensureProfile(walletId);
  if (isWalletSecurityRejection(profile) || isWalletRejection(profile)) {
    return { ok: false, command, payload: profile };
  }
  switch (command) {
    case 'security':
      return { ok: true, command, payload: security.getWalletSecurityProfile(walletId) };
    case 'devices': {
      const action = args[2];
      if (action === 'register') {
        const result = security.registerDevice({
          walletId,
          deviceId: args[3] ?? `dev.${walletId}`,
          publicDescriptor: args[4] ?? `pub.${walletId}`,
          platformClass: 'MOBILE',
          evidence: 'cli-registration',
        });
        return { ok: !isWalletSecurityRejection(result), command, payload: result };
      }
      if (action === 'revoke') {
        const result = security.setDeviceTrust(walletId, args[3] ?? '', 'REVOKED');
        return { ok: !isWalletSecurityRejection(result), command, payload: result };
      }
      return { ok: true, command, payload: security.getWalletDevices(walletId) };
    }
    case 'sessions': {
      const action = args[2];
      if (action === 'revoke' && args[3]) {
        return { ok: true, command, payload: security.revokeSession(args[3]) };
      }
      if (action === 'revoke-device' && args[3]) {
        return { ok: true, command, payload: { revoked: security.revokeDeviceSessions(walletId, args[3]) } };
      }
      if (action === 'revoke-all') {
        return { ok: true, command, payload: { revoked: security.revokeAllSessions(walletId) } };
      }
      return { ok: true, command, payload: security.getWalletSessions(walletId) };
    }
    case 'trusted-destinations': {
      if (args[2] === 'set' && args[3] && args[4]) {
        const devices = security.getWalletDevices(walletId);
        const device = devices[0] ?? security.registerDevice({
          walletId,
          deviceId: `${walletId}.cli`,
          publicDescriptor: `pub.${walletId}`,
          platformClass: 'DESKTOP',
          evidence: 'cli',
        });
        if (isWalletSecurityRejection(device)) {
          return { ok: false, command, payload: device };
        }
        const session = security.authenticateSession({
          walletId,
          identityRef: profile.identityRef,
          deviceId: device.deviceId,
          method: 'DEVICE',
          scope: 'PROFILE_MANAGEMENT',
        });
        if (isWalletSecurityRejection(session)) {
          return { ok: false, command, payload: session };
        }
        const result = security.setDestinationTrust({
          walletId,
          addressText: args[3],
          networkId: profile.networkId,
          trustState: args[4] as 'TRUSTED',
          label: args[5] ?? args[3],
          sessionId: session.sessionId,
        });
        return { ok: !isWalletSecurityRejection(result), command, payload: result };
      }
      return { ok: true, command, payload: security.getWalletPolicies(walletId)?.destination };
    }
    case 'recovery': {
      if (args[2] === 'cancel' && args[3]) {
        return { ok: true, command, payload: security.cancelRecovery(walletId, args[3], true) };
      }
      return { ok: true, command, payload: security.getRecoveryState(walletId) };
    }
    case 'rotate-key': {
      const oldKeyId = args[2];
      const newPublicKeyHex = args[3];
      if (!oldKeyId || !newPublicKeyHex) {
        return { ok: false, command, payload: { error: 'usage: rotate-key <walletId> <oldKeyId> <newPublicKeyHex>' } };
      }
      const plan = security.planKeyRotation({
        walletId,
        oldKeyId,
        newPublicKeyHex,
        policyId: `pol.${walletId}`,
        authorizationRef: 'cli',
      });
      return { ok: !isWalletSecurityRejection(plan), command, payload: plan };
    }
    case 'delegations':
      return { ok: true, command, payload: security.getDelegations(walletId) };
    case 'audit':
      return { ok: true, command, payload: security.audit(walletId) };
    default:
      return { ok: false, command, payload: { usage: walletSecurityUsage() } };
  }
}

export function assertSecurityCliSafe(payload: unknown): void {
  const text = JSON.stringify(payload);
  if (containsPrivateMaterial(text)) {
    throw new Error('security CLI refused to print private key material');
  }
}
