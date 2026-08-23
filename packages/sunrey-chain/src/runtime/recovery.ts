export const RECOVERY_PROCEDURES = [
  'STATE_BACKUP',
  'SNAPSHOT',
  'RESTORE',
  'NODE_REBUILD',
  'VALIDATOR_DISASTER_RECOVERY',
] as const;
export type RecoveryProcedure = (typeof RECOVERY_PROCEDURES)[number];

export type RecoveryPlan = {
  readonly procedure: RecoveryProcedure;
  readonly environment: 'LOCAL' | 'DEVNET' | 'TESTNET' | 'PREPRODUCTION';
  readonly verifyIntegrityBeforeTrust: true;
  readonly productionRestoreForbidden: true;
};

export function recoveryPlan(procedure: RecoveryProcedure): RecoveryPlan {
  return {
    procedure,
    environment: 'TESTNET',
    verifyIntegrityBeforeTrust: true,
    productionRestoreForbidden: true,
  };
}

export function snapshotTrust(input: {
  readonly manifestHash: string;
  readonly computedHash: string;
  readonly chainId: string;
  readonly expectedChainId: string;
}): 'TRUSTED_FOR_NON_PRODUCTION' | 'REJECTED' {
  if (input.manifestHash !== input.computedHash || input.chainId !== input.expectedChainId) {
    return 'REJECTED';
  }
  return 'TRUSTED_FOR_NON_PRODUCTION';
}
