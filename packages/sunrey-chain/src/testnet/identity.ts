/**
 * Canonical SunRey Testnet 1 identity.
 *
 * This is a public TEST NETWORK architecture. It is not mainnet.
 * ENVIRONMENT remains simulation. LIVE_* flags stay false.
 * Test units have no implied monetary value. Tickers remain NOT_ASSIGNED.
 *
 * Do not reuse local development network IDs.
 */

export const TESTNET_IDENTITY_SCHEMA_VERSION = 1 as const;

export const SUNREY_TESTNET_1_DISPLAY_NAME = 'SunRey Testnet 1' as const;
export const SUNREY_TESTNET_1_BANNER = 'SUNREY TESTNET' as const;
export const SUNREY_TESTNET_1_SDK_NAME = 'SUNREY_TESTNET_1' as const;

export const SUNREY_TESTNET_1_NETWORK_ID = 'net_sunrey_testnet_1' as const;
export const SUNREY_TESTNET_1_CHAIN_ID = 'chn_sunrey_testnet_1' as const;

export const TESTNET_ADDRESS_HRP = 'srtst' as const;
export const TESTNET_NETWORK_CLASS = 'RESERVED_TEST' as const;

export const LOCAL_DEV_NETWORK_ID = 'net_sunrey_local_dev' as const;
export const SIMULATION_NETWORK_ID = 'net_sunrey_simulation' as const;
export const P2P_DEV_NETWORK_ID = 'net_sunrey_development' as const;
export const RESERVED_TEST_PLACEHOLDER_NETWORK_ID = 'net_sunrey_reserved_test' as const;

export const FORBIDDEN_REUSED_NETWORK_IDS = [
  LOCAL_DEV_NETWORK_ID,
  SIMULATION_NETWORK_ID,
  P2P_DEV_NETWORK_ID,
] as const;

export const TESTNET_NETWORK_ID_PREFIX = 'net_sunrey_testnet_' as const;
export const TESTNET_CHAIN_ID_PREFIX = 'chn_sunrey_testnet_' as const;

export const TESTNET_PROTOCOL_VERSION = '1' as const;
export const TESTNET_ENVIRONMENT = 'simulation' as const;
export const TESTNET_PRODUCTION_NETWORK_ENABLED = false as const;

export const TESTNET_TICKER_STATUS = 'NOT_ASSIGNED' as const;

export const FIXTURE_ENVIRONMENT_VALUES = ['local', 'ci', 'test'] as const;
export type FixtureEnvironment = (typeof FIXTURE_ENVIRONMENT_VALUES)[number];

export function isTestnetNetworkId(networkId: string): boolean {
  return networkId.startsWith(TESTNET_NETWORK_ID_PREFIX) || networkId === RESERVED_TEST_PLACEHOLDER_NETWORK_ID;
}

export function isForbiddenReusedNetworkId(networkId: string): boolean {
  return (FORBIDDEN_REUSED_NETWORK_IDS as readonly string[]).includes(networkId);
}

export function testnetVersionFromNetworkId(networkId: string): number | null {
  if (!networkId.startsWith(TESTNET_NETWORK_ID_PREFIX)) {
    return null;
  }
  const suffix = networkId.slice(TESTNET_NETWORK_ID_PREFIX.length);
  if (!/^[1-9][0-9]*$/.test(suffix)) {
    return null;
  }
  return Number(suffix);
}

export function networkIdForTestnetVersion(version: number): `net_sunrey_testnet_${number}` {
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError('testnet version must be a positive integer');
  }
  return `net_sunrey_testnet_${version}`;
}

export function chainIdForTestnetVersion(version: number): `chn_sunrey_testnet_${number}` {
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError('testnet version must be a positive integer');
  }
  return `chn_sunrey_testnet_${version}`;
}

export function displayNameForTestnetVersion(version: number): string {
  return `SunRey Testnet ${version}`;
}
