/**
 * sunrey-testnet verify
 */

import {
  buildGenesis,
  testnet1GenesisInput,
  testnetNativeAssets,
  TESTNET_CRYPTO_SUITE_POLICY,
  TESTNET_FEE_POLICY,
} from './genesis.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID, TESTNET_PROTOCOL_VERSION } from './identity.ts';
import type { TestnetNetwork } from './network.ts';
import { testnetGovernancePolicy } from './validators.ts';
import type { TestnetVerifyReport } from './types.ts';

export function verifyTestnet(net: TestnetNetwork): TestnetVerifyReport {
  const expected = buildGenesis(testnet1GenesisInput(net.validators));
  const health = net.health();
  const assets = testnetNativeAssets();
  const governance = testnetGovernancePolicy(net.validators);
  const checks = [
    check('genesis hash', net.genesis.genesisHash === expected.genesisHash, net.genesis.genesisHash),
    check('network ID', net.genesis.manifest.networkId === SUNREY_TESTNET_1_NETWORK_ID, net.genesis.manifest.networkId),
    check('chain ID', net.genesis.manifest.chainId === SUNREY_TESTNET_1_CHAIN_ID, net.genesis.manifest.chainId),
    check('validator-set hash', net.genesis.validatorSetHash === expected.validatorSetHash, net.genesis.validatorSetHash),
    check('protocol version', net.genesis.manifest.protocolVersion === TESTNET_PROTOCOL_VERSION, net.genesis.manifest.protocolVersion),
    check('CryptoSuite policy', net.genesis.manifest.cryptoSuitePolicy === TESTNET_CRYPTO_SUITE_POLICY, net.genesis.manifest.cryptoSuitePolicy),
    check('fee policy', net.genesis.manifest.feePolicy === TESTNET_FEE_POLICY, net.genesis.manifest.feePolicy),
    check(
      'native asset registry',
      assets.every((asset) => asset.tickerStatus === 'NOT_ASSIGNED') && assets.length === 2,
      assets.map((asset) => asset.assetId).join(','),
    ),
    check(
      'governance policy',
      governance.thresholdModel === 'VALIDATOR_SUPERMAJORITY' && governance.automaticBinaryUpgrade === false,
      governance.thresholdModel,
    ),
    check('peer connectivity', net.seedIsOnline() && health.rpcHealth === 'UP', health.rpcHealth),
    check('finalized height', health.finalizedHeight > 0, String(health.finalizedHeight)),
    check('Explorer lag', health.explorerLag === 0, String(health.explorerLag)),
    check('faucet status', health.faucetHealth === 'UP', health.faucetHealth),
  ];
  return { ok: checks.every((row) => row.ok), checks };
}

function check(name: string, ok: boolean, detail: string) {
  return { name, ok, detail };
}
