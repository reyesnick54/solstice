/**
 * Create and deploy the isolated pre-genesis shadow network definition.
 */

import { buildShadowGenesis, sevenShadowValidators, type PregenesisGenesisBundle } from './genesis.ts';
import {
  PREGENESIS_ADDRESS_HRP,
  PREGENESIS_CHAIN_ID,
  PREGENESIS_DISPLAY_NAME,
  PREGENESIS_NETWORK_ID,
  assertPregenesisIdentity,
} from './identity.ts';
import { shadowTopology, type ShadowTopology } from './topology.ts';
import type { PregenesisNetworkDefinition } from './types.ts';

export type PregenesisNetwork = {
  readonly definition: PregenesisNetworkDefinition;
  readonly genesis: PregenesisGenesisBundle;
  readonly topology: ShadowTopology;
  readonly harnessEnvironment: 'LOCAL';
};

export function createPregenesisNetwork(): PregenesisNetwork {
  assertPregenesisIdentity(PREGENESIS_NETWORK_ID, PREGENESIS_CHAIN_ID, PREGENESIS_ADDRESS_HRP);
  const validators = sevenShadowValidators();
  const genesis = buildShadowGenesis(validators);
  const topology = shadowTopology(validators);
  return Object.freeze({
    definition: Object.freeze({
      schemaVersion: 1,
      networkId: PREGENESIS_NETWORK_ID,
      chainId: PREGENESIS_CHAIN_ID,
      addressHrp: PREGENESIS_ADDRESS_HRP,
      genesisHash: genesis.genesisHash,
      validatorSetHash: genesis.validatorSetHash,
      displayName: PREGENESIS_DISPLAY_NAME,
      environment: 'simulation',
      mainnetEnabled: false,
      productionAuthorized: false,
      usableAsProductionAuthorization: false,
    }),
    genesis,
    topology,
    harnessEnvironment: 'LOCAL',
  });
}

export function deployPregenesisRehearsal(network: PregenesisNetwork = createPregenesisNetwork()): {
  readonly deployed: true;
  readonly network: PregenesisNetwork;
  readonly infraEnvironment: 'LOCAL';
  readonly productionCredentialsUsed: false;
} {
  return Object.freeze({
    deployed: true,
    network,
    infraEnvironment: 'LOCAL',
    productionCredentialsUsed: false,
  });
}
