/**
 * Isolated pre-genesis shadow-network identity.
 *
 * Distinct from production, Candidate V1/V2, testnet, launch rehearsal,
 * economic rehearsal, and production-ceremony dress rehearsal. Shadow
 * artifacts are unusable as production authorization.
 */

import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import {
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_NETWORK_ID,
} from '../mainnet/candidate-v2/identity.ts';
import {
  REHEARSAL_ADDRESS_HRP as LAUNCH_REHEARSAL_HRP,
  REHEARSAL_CHAIN_ID as LAUNCH_REHEARSAL_CHAIN_ID,
  REHEARSAL_NETWORK_ID as LAUNCH_REHEARSAL_NETWORK_ID,
} from '../launch-rehearsal/identity.ts';
import {
  ECONOMIC_REHEARSAL_ADDRESS_HRP,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
} from '../economic-rehearsal/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../testnet/identity.ts';
import { RESERVED_PRODUCTION_NETWORK_ID } from '../wallet/types.ts';

const DRESS_REHEARSAL_NETWORK_ID = 'net_sunrey_production_genesis_ceremony_rehearsal_1';
const DRESS_REHEARSAL_CHAIN_ID = 'chn_sunrey_production_genesis_ceremony_rehearsal_1';
const DRESS_REHEARSAL_ADDRESS_HRP = 'srpgc';

export const PREGENESIS_DISPLAY_NAME = 'SunRey Pre-Genesis Shadow Network 1' as const;
export const PREGENESIS_ID = 'pregenesis_sunrey_shadow_1' as const;
export const PREGENESIS_NETWORK_ID = 'net_sunrey_pregenesis_shadow_1' as const;
export const PREGENESIS_CHAIN_ID = 'chn_sunrey_pregenesis_shadow_1' as const;
export const PREGENESIS_ADDRESS_HRP = 'srpgn' as const;
export const PREGENESIS_BANNER = 'PRE-GENESIS SHADOW NETWORK' as const;
export const PREGENESIS_PROTOCOL_VERSION = '1' as const;
export const PREGENESIS_GENESIS_VERSION = 'pregenesis-shadow-1' as const;
export const PREGENESIS_FIXTURE_GENESIS_TIME_MS = 1_767_225_600_000n;
export const PREGENESIS_FIXTURE_GENESIS_TIME_UTC = '2026-01-01T00:00:00.000Z' as const;
export const PREGENESIS_DOMAIN = 'SUNREY_PREGENESIS_SHADOW_V1' as const;

export const FORBIDDEN_PREGENESIS_NETWORK_IDS = [
  PRODUCTION_CANDIDATE_NETWORK_ID,
  CANDIDATE_V2_NETWORK_ID,
  RESERVED_PRODUCTION_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  LAUNCH_REHEARSAL_NETWORK_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
] as const;

export const FORBIDDEN_PREGENESIS_CHAIN_IDS = [
  PRODUCTION_CANDIDATE_CHAIN_ID,
  CANDIDATE_V2_CHAIN_ID,
  SUNREY_TESTNET_1_CHAIN_ID,
  LAUNCH_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
] as const;

export const FORBIDDEN_PREGENESIS_ADDRESS_HRPS = [
  PRODUCTION_ADDRESS_HRP,
  LAUNCH_REHEARSAL_HRP,
  ECONOMIC_REHEARSAL_ADDRESS_HRP,
  DRESS_REHEARSAL_ADDRESS_HRP,
] as const;

export function assertPregenesisIdentity(networkId: string, chainId: string, addressHrp: string): void {
  if ((FORBIDDEN_PREGENESIS_NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new TypeError(`pre-genesis shadow must not reuse network id ${networkId}`);
  }
  if ((FORBIDDEN_PREGENESIS_CHAIN_IDS as readonly string[]).includes(chainId)) {
    throw new TypeError(`pre-genesis shadow must not reuse chain id ${chainId}`);
  }
  if (networkId !== PREGENESIS_NETWORK_ID) {
    throw new TypeError(`pre-genesis network id must be ${PREGENESIS_NETWORK_ID}`);
  }
  if (chainId !== PREGENESIS_CHAIN_ID) {
    throw new TypeError(`pre-genesis chain id must be ${PREGENESIS_CHAIN_ID}`);
  }
  if ((FORBIDDEN_PREGENESIS_ADDRESS_HRPS as readonly string[]).includes(addressHrp)) {
    throw new TypeError(`pre-genesis must not use address HRP ${addressHrp}`);
  }
  if (addressHrp !== PREGENESIS_ADDRESS_HRP) {
    throw new TypeError(`pre-genesis must use isolated HRP ${PREGENESIS_ADDRESS_HRP}`);
  }
}

export function shadowArtifactsUnusableForProduction(value: string): boolean {
  return (
    value === PREGENESIS_NETWORK_ID ||
    value === PREGENESIS_CHAIN_ID ||
    value === PREGENESIS_ID ||
    value.includes('PREGENESIS_SHADOW') ||
    value.includes('pregenesis_sunrey_shadow')
  );
}

export function rejectShadowAsProductionAuthorization(value: string): void {
  if (shadowArtifactsUnusableForProduction(value)) {
    throw new TypeError('shadow-network artifact rejected as production authorization');
  }
}

export function pregenesisIsNotProduction(): true {
  return true;
}
