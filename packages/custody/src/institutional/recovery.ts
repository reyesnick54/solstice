import { createHash } from 'node:crypto';

import type { ApprovalPolicy, CustodyVault, CustodyWallet, RecoveryManifest } from './types.ts';

export function buildRecoveryManifest(input: {
  readonly vault: CustodyVault;
  readonly wallets: readonly CustodyWallet[];
  readonly approvalPolicy: ApprovalPolicy;
  readonly coldBackupRefs: readonly string[];
  readonly hsmDisasterRecoveryRef: string;
  readonly configuration: Record<string, unknown>;
}): RecoveryManifest {
  const encoded = Buffer.from(JSON.stringify(input.configuration), 'utf8');
  return Object.freeze({
    walletMetadata: Object.freeze(input.wallets.map((wallet) => ({ walletId: wallet.walletId, address: wallet.address }))),
    keyHandles: Object.freeze(
      input.wallets
        .filter((wallet) => wallet.signerHandle)
        .map((wallet) => ({
          handleId: wallet.signerHandle!.handleId,
          keyId: wallet.signerHandle!.keyId,
        })),
    ),
    approvalPolicy: input.approvalPolicy,
    coldBackupRefs: Object.freeze([...input.coldBackupRefs]),
    hsmDisasterRecoveryRef: input.hsmDisasterRecoveryRef,
    encryptedConfiguration: createHash('sha256').update(encoded).digest('hex'),
    containsPlaintextSigningMaterial: false,
  });
}
