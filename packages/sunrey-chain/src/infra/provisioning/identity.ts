import {
  CANDIDATE_V2_ADDRESS_HRP,
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_NETWORK_ID,
} from '../../mainnet/candidate-v2/identity.ts';
import {
  DRESS_REHEARSAL_ADDRESS_HRP,
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_NETWORK_ID,
} from '../../production-ceremony/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../../testnet/identity.ts';
import type { ProductionEnvironmentClass, ProductionEnvironmentTarget } from './types.ts';

export const PROVISIONING_PLAN_ID = 'plan.sunrey.production-environment.v1' as const;
export const LOCAL_PROVISIONING_NETWORK_ID = 'net_sunrey_provisioning_local_1' as const;
export const LOCAL_PROVISIONING_CHAIN_ID = 'chn_sunrey_provisioning_local_1' as const;
export const REHEARSAL_PROVISIONING_NETWORK_ID = 'net_sunrey_provisioning_rehearsal_1' as const;
export const REHEARSAL_PROVISIONING_CHAIN_ID = 'chn_sunrey_provisioning_rehearsal_1' as const;

export const FORBIDDEN_PRODUCTION_NETWORK_IDS = [
  SUNREY_TESTNET_1_NETWORK_ID,
  LOCAL_PROVISIONING_NETWORK_ID,
  REHEARSAL_PROVISIONING_NETWORK_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
] as const;

export const FORBIDDEN_PRODUCTION_CHAIN_IDS = [
  SUNREY_TESTNET_1_CHAIN_ID,
  LOCAL_PROVISIONING_CHAIN_ID,
  REHEARSAL_PROVISIONING_CHAIN_ID,
  DRESS_REHEARSAL_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
] as const;

export function targetForClass(environmentClass: ProductionEnvironmentClass): ProductionEnvironmentTarget {
  if (environmentClass === 'PRODUCTION') {
    return Object.freeze({
      class: 'PRODUCTION',
      networkId: CANDIDATE_V2_NETWORK_ID,
      chainId: CANDIDATE_V2_CHAIN_ID,
      addressHrp: CANDIDATE_V2_ADDRESS_HRP,
      productionAuthorized: false,
      mainnetEnabled: false,
    });
  }
  if (environmentClass === 'PRODUCTION_CANDIDATE') {
    return Object.freeze({
      class: 'PRODUCTION_CANDIDATE',
      networkId: CANDIDATE_V2_NETWORK_ID,
      chainId: CANDIDATE_V2_CHAIN_ID,
      addressHrp: CANDIDATE_V2_ADDRESS_HRP,
      productionAuthorized: false,
      mainnetEnabled: false,
    });
  }
  if (environmentClass === 'TESTNET') {
    return Object.freeze({
      class: 'TESTNET',
      networkId: SUNREY_TESTNET_1_NETWORK_ID,
      chainId: SUNREY_TESTNET_1_CHAIN_ID,
      addressHrp: 'srdev',
      productionAuthorized: false,
      mainnetEnabled: false,
    });
  }
  if (environmentClass === 'MAINNET_REHEARSAL') {
    return Object.freeze({
      class: 'MAINNET_REHEARSAL',
      networkId: REHEARSAL_PROVISIONING_NETWORK_ID,
      chainId: REHEARSAL_PROVISIONING_CHAIN_ID,
      addressHrp: DRESS_REHEARSAL_ADDRESS_HRP,
      productionAuthorized: false,
      mainnetEnabled: false,
    });
  }
  return Object.freeze({
    class: 'LOCAL',
    networkId: LOCAL_PROVISIONING_NETWORK_ID,
    chainId: LOCAL_PROVISIONING_CHAIN_ID,
    addressHrp: 'srloc',
    productionAuthorized: false,
    mainnetEnabled: false,
  });
}

export function rejectTestNetworkForProduction(networkId: string, environmentClass: ProductionEnvironmentClass): void {
  if (environmentClass === 'PRODUCTION' && (FORBIDDEN_PRODUCTION_NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new TypeError(`test network ID rejected for production: ${networkId}`);
  }
}
