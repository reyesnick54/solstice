/**
 * Machine-readable testnet health for a future status UI.
 * Does not expose confidential topology.
 */

import { SUNREY_TESTNET_1_BANNER, SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID, TESTNET_PROTOCOL_VERSION } from './identity.ts';
import type { TestnetHealth } from './types.ts';

export function testnetHealth(input: {
  readonly height: number;
  readonly finalizedHeight: number;
  readonly onlineValidators: number;
  readonly totalValidators: number;
  readonly onlinePower: bigint;
  readonly totalPower: bigint;
  readonly quorumSatisfied: boolean;
  readonly rpcHealth: TestnetHealth['rpcHealth'];
  readonly explorerLag: number;
  readonly faucetHealth: TestnetHealth['faucetHealth'];
  readonly genesisHash: string;
}): TestnetHealth {
  return Object.freeze({
    network: SUNREY_TESTNET_1_NETWORK_ID,
    chainId: SUNREY_TESTNET_1_CHAIN_ID,
    banner: SUNREY_TESTNET_1_BANNER,
    height: input.height,
    finalizedHeight: input.finalizedHeight,
    validatorParticipation: Object.freeze({
      online: input.onlineValidators,
      total: input.totalValidators,
      votingPowerOnline: input.onlinePower.toString(),
      votingPowerTotal: input.totalPower.toString(),
      quorumSatisfied: input.quorumSatisfied,
    }),
    rpcHealth: input.rpcHealth,
    explorerLag: input.explorerLag,
    faucetHealth: input.faucetHealth,
    protocolVersion: TESTNET_PROTOCOL_VERSION,
    genesisHash: input.genesisHash,
  });
}

export function healthOmitsConfidentialTopology(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return !/privateKey|consensusInterface|validatorHost|hsm|seedList/.test(text);
}
