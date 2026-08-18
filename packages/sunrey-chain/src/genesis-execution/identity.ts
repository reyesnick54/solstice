/**
 * Distinct genesis-execution rehearsal identity.
 *
 * Isolated from testnet, launch rehearsal, economic rehearsal,
 * ceremony dress rehearsal, Candidate V1/V2, and reserved production
 * identifiers. Rehearsal artifacts are unusable as production inputs.
 */

import {
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
} from '../mainnet/identity.ts';
import {
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_ID,
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
import {
  DRESS_REHEARSAL_ADDRESS_HRP,
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  REHEARSAL_CANDIDATE_V2_ID,
  REHEARSAL_MAINNET_RC_ID,
} from '../production-ceremony/identity.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../testnet/identity.ts';
import { RESERVED_PRODUCTION_NETWORK_ID } from '../wallet/types.ts';

export const GENESIS_EXECUTION_DISPLAY_NAME = 'SunRey Authorized Genesis Execution' as const;
export const EXECUTION_REHEARSAL_DISPLAY_NAME = 'SunRey Genesis Execution Rehearsal 1' as const;
export const EXECUTION_REHEARSAL_ID = 'rehearsal_sunrey_genesis_execution_1' as const;
export const EXECUTION_REHEARSAL_NETWORK_ID = 'net_sunrey_genesis_execution_rehearsal_1' as const;
export const EXECUTION_REHEARSAL_CHAIN_ID = 'chn_sunrey_genesis_execution_rehearsal_1' as const;
export const EXECUTION_REHEARSAL_ADDRESS_HRP = 'srger' as const;
export const EXECUTION_REHEARSAL_PROTOCOL_VERSION = '1' as const;
export const EXECUTION_REHEARSAL_CANDIDATE_V2_ID = 'SUNREY_GEX_REHEARSAL_CANDIDATE_V2' as const;
export const EXECUTION_REHEARSAL_MAINNET_RC_ID = 'SUNREY_GEX_REHEARSAL_MAINNET_RC' as const;
export const EXECUTION_REHEARSAL_FIXTURE_GENESIS_TIME_MS = 1_767_225_600_000n;
export const EXECUTION_REHEARSAL_FIXTURE_GENESIS_TIME_UTC = '2026-01-01T00:00:00.000Z' as const;

export const EXPECTED_PRODUCTION_CANDIDATE_V2_ID = CANDIDATE_V2_ID;
export const EXPECTED_PRODUCTION_CANDIDATE_V2_NETWORK_ID = CANDIDATE_V2_NETWORK_ID;
export const EXPECTED_PRODUCTION_CANDIDATE_V2_CHAIN_ID = CANDIDATE_V2_CHAIN_ID;
export const EXPECTED_MAINNET_RC_ID = 'SUNREY_MAINNET_RC_1' as const;

export const FORBIDDEN_PRODUCTION_NETWORK_IDS = [
  EXECUTION_REHEARSAL_NETWORK_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  LAUNCH_REHEARSAL_NETWORK_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  SUNREY_TESTNET_1_NETWORK_ID,
  PRODUCTION_CANDIDATE_NETWORK_ID,
  'net_sunrey_local_dev',
  'net_sunrey_simulation',
  'net_sunrey_development',
  'net_sunrey_shadow',
  'net_sunrey_fixture',
] as const;

export const FORBIDDEN_PRODUCTION_CHAIN_IDS = [
  EXECUTION_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_CHAIN_ID,
  LAUNCH_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  SUNREY_TESTNET_1_CHAIN_ID,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  'chn_sunrey_local_dev',
  'chn_sunrey_simulation',
  'chn_sunrey_development',
  'chn_sunrey_shadow',
  'chn_sunrey_fixture',
] as const;

export const FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS = [
  'REHEARSAL',
  'FIXTURE',
  'TESTNET',
  'SHADOW',
  'NOT_FOR_PRODUCTION',
  'DRESS_REHEARSAL',
  'SIMULATION',
  EXECUTION_REHEARSAL_CANDIDATE_V2_ID,
  EXECUTION_REHEARSAL_MAINNET_RC_ID,
  REHEARSAL_CANDIDATE_V2_ID,
  REHEARSAL_MAINNET_RC_ID,
] as const;

export function assertExecutionRehearsalIdentity(networkId: string, chainId: string, addressHrp: string): void {
  if (networkId !== EXECUTION_REHEARSAL_NETWORK_ID) {
    throw new TypeError(`genesis-execution rehearsal network id must be ${EXECUTION_REHEARSAL_NETWORK_ID}`);
  }
  if (chainId !== EXECUTION_REHEARSAL_CHAIN_ID) {
    throw new TypeError(`genesis-execution rehearsal chain id must be ${EXECUTION_REHEARSAL_CHAIN_ID}`);
  }
  if (
    addressHrp === PRODUCTION_ADDRESS_HRP ||
    addressHrp === LAUNCH_REHEARSAL_HRP ||
    addressHrp === ECONOMIC_REHEARSAL_ADDRESS_HRP ||
    addressHrp === DRESS_REHEARSAL_ADDRESS_HRP
  ) {
    throw new TypeError('genesis-execution rehearsal must not present production or other-rehearsal addresses');
  }
  if (addressHrp !== EXECUTION_REHEARSAL_ADDRESS_HRP) {
    throw new TypeError(`genesis-execution rehearsal must use HRP ${EXECUTION_REHEARSAL_ADDRESS_HRP}`);
  }
}

export function isForbiddenProductionNetwork(networkId: string): boolean {
  return (FORBIDDEN_PRODUCTION_NETWORK_IDS as readonly string[]).includes(networkId);
}

export function isForbiddenProductionChain(chainId: string): boolean {
  return (FORBIDDEN_PRODUCTION_CHAIN_IDS as readonly string[]).includes(chainId);
}

export function artifactLooksLikeFixture(value: string): boolean {
  const upper = value.toUpperCase();
  return (FORBIDDEN_PRODUCTION_ARTIFACT_MARKERS as readonly string[]).some((marker) => upper.includes(marker));
}

export function rejectProductionFixtureArtifact(value: string, label: string): void {
  if (artifactLooksLikeFixture(value) || isForbiddenProductionNetwork(value) || isForbiddenProductionChain(value)) {
    throw new TypeError(`fixture/testnet/shadow/rehearsal ${label} rejected from production execution`);
  }
  if (value === RESERVED_PRODUCTION_NETWORK_ID) {
    throw new TypeError('reserved production placeholder cannot execute');
  }
}

export function rehearsalIdentityUnusableForProduction(value: string): boolean {
  return (
    isForbiddenProductionNetwork(value) ||
    isForbiddenProductionChain(value) ||
    artifactLooksLikeFixture(value)
  );
}
