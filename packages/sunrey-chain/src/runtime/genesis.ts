import {
  canonicalIdentity,
  type NetworkEnvironment,
  type NetworkIdentity,
} from './identity.ts';

export type GenesisGenerationInput = {
  readonly environment: NetworkEnvironment;
  readonly schemaRegistryHash: string;
  readonly cryptoPolicyId: string;
  readonly governanceFieldsComplete: boolean;
  readonly economicParametersApproved: boolean;
  readonly counselConfirmed: boolean;
};

export type GenesisGenerationResult =
  | {
      readonly ok: true;
      readonly identity: NetworkIdentity;
      readonly productionNetworkEnabled: false;
      readonly environmentLabel: 'simulation';
      readonly supplyNote: 'TESTNET_OR_DEV_VALUES_NON_PRODUCTION';
    }
  | {
      readonly ok: false;
      readonly reason: 'GOVERNANCE_REJECTED' | 'MAINNET_INACTIVE';
    };

export function generateGenesis(input: GenesisGenerationInput): GenesisGenerationResult {
  if (input.environment === 'MAINNET') {
    return { ok: false, reason: 'GOVERNANCE_REJECTED' };
  }
  const identity = canonicalIdentity(input.environment);
  return {
    ok: true,
    identity,
    productionNetworkEnabled: false,
    environmentLabel: 'simulation',
    supplyNote: 'TESTNET_OR_DEV_VALUES_NON_PRODUCTION',
  };
}

export function mainnetGenesisFailsClosed(): true {
  const result = generateGenesis({
    environment: 'MAINNET',
    schemaRegistryHash: '00',
    cryptoPolicyId: 'cs_ed25519_sha256_v1',
    governanceFieldsComplete: true,
    economicParametersApproved: true,
    counselConfirmed: true,
  });
  if (result.ok) {
    throw new Error('mainnet genesis must fail closed');
  }
  return true;
}
