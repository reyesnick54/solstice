/**
 * Chain security posture. Mainnet remains off. Validator keys are not
 * general service secrets. RPC cannot reach HSM.
 */

export const CHAIN_SECURITY_POSTURE = Object.freeze({
  mainnetEnabled: false,
  productionSigningEnabled: false,
  validatorKeysAreServiceSecrets: false,
  rpcCanReachHsm: false,
  publicAdminControls: false,
  nativeIssuanceAuthority: 'packages/sunrey-chain AssetSupplyBook / Chunk 71 mint',
  replayProtection: 'network id + nonce / height',
  genesisMutableAfterFreeze: false,
  environment: 'simulation',
});

export function assertMainnetOff(): true {
  if (CHAIN_SECURITY_POSTURE.mainnetEnabled !== false) {
    throw new Error('mainnet must remain off');
  }
  return true;
}
