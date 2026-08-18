/**
 * Chunk 96 wallet security SDK helpers.
 *
 * Signing helpers preserve local / private-key boundaries. The SDK
 * never asks a SunRey server for a self-custody private key.
 */

import {
  WalletSecurityEngine,
  type SigningIntent,
  type WalletSecurityProfile,
  type WalletDeviceBinding,
  type WalletSession,
  type WalletRecoveryRequest,
  type WalletRecoveryPolicy,
} from '../../sunrey-chain/src/wallet/security/index.ts';
import type { BuiltTransaction } from '../../sunrey-chain/src/wallet/types.ts';
import type { TransactionRequirementKind } from '../../sunrey-chain/src/wallet/security/types.ts';

export class WalletSecurityClient {
  readonly engine: WalletSecurityEngine;

  constructor(engine: WalletSecurityEngine = new WalletSecurityEngine()) {
    this.engine = engine;
  }

  getWalletSecurityProfile(walletId: string): WalletSecurityProfile | undefined {
    return this.engine.getWalletSecurityProfile(walletId);
  }

  getWalletDevices(walletId: string): readonly WalletDeviceBinding[] {
    return this.engine.getWalletDevices(walletId);
  }

  getWalletSessions(walletId: string): readonly WalletSession[] {
    return this.engine.getWalletSessions(walletId);
  }

  buildSigningIntent(
    walletId: string,
    built: BuiltTransaction,
    requirements: readonly TransactionRequirementKind[] = ['NORMAL_USER_SIGNATURE'],
  ): SigningIntent {
    return this.engine.buildSigningIntent(walletId, built, requirements);
  }

  getWalletPolicies(walletId: string) {
    return this.engine.getWalletPolicies(walletId);
  }

  getRecoveryState(walletId: string): {
    readonly policy: WalletRecoveryPolicy | undefined;
    readonly pending: readonly WalletRecoveryRequest[];
  } {
    return this.engine.getRecoveryState(walletId);
  }

  retrieveSelfCustodyPrivateKey(walletId: string) {
    return this.engine.retrieveSelfCustodyPrivateKey(walletId);
  }
}

export function getWalletSecurityProfile(engine: WalletSecurityEngine, walletId: string) {
  return engine.getWalletSecurityProfile(walletId);
}

export function getWalletDevices(engine: WalletSecurityEngine, walletId: string) {
  return engine.getWalletDevices(walletId);
}

export function getWalletSessions(engine: WalletSecurityEngine, walletId: string) {
  return engine.getWalletSessions(walletId);
}

export function buildSigningIntent(
  engine: WalletSecurityEngine,
  walletId: string,
  built: BuiltTransaction,
  requirements: readonly TransactionRequirementKind[] = ['NORMAL_USER_SIGNATURE'],
) {
  return engine.buildSigningIntent(walletId, built, requirements);
}

export function getWalletPolicies(engine: WalletSecurityEngine, walletId: string) {
  return engine.getWalletPolicies(walletId);
}

export function getRecoveryState(engine: WalletSecurityEngine, walletId: string) {
  return engine.getRecoveryState(walletId);
}
