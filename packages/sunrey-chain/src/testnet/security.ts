/**
 * Testnet security boundaries and fixture-key guardrails.
 *
 * Fixture secrets are test-only and must never be reused as production keys.
 */

import { FIXTURE_ENVIRONMENT_VALUES, SUNREY_TESTNET_1_NETWORK_ID, isTestnetNetworkId } from './identity.ts';

export const FIXTURE_KEY_MARKER = 'NOT_FOR_PRODUCTION' as const;
export const FIXTURE_ENV_VARIABLE = 'SUNREY_FIXTURE_ENV' as const;

export const FORBIDDEN_HOST_MATERIALS = [
  'VALIDATOR_VOTING_KEY',
  'GOVERNANCE_KEY',
  'CUSTODY_HSM_SECRET',
] as const;

export type HostProfile = 'VALIDATOR' | 'SEED' | 'PUBLIC_RPC' | 'FAUCET' | 'EXPLORER' | 'RELAYER';

export function fixtureEnvironmentAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = env[FIXTURE_ENV_VARIABLE];
  if (explicit && (FIXTURE_ENVIRONMENT_VALUES as readonly string[]).includes(explicit)) {
    return true;
  }
  if (env.CI === 'true' || env.CI === '1') {
    return true;
  }
  if (env.NODE_ENV === 'test' || Boolean(env.NODE_TEST_CONTEXT)) {
    return true;
  }
  return false;
}

export function assertFixtureEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (!fixtureEnvironmentAllowed(env)) {
    throw new Error(
      'SunRey testnet fixture keys are rejected outside local/CI/test environments. Set SUNREY_FIXTURE_ENV=local.',
    );
  }
}

export function assertFixtureLabel(label: string): void {
  if (!label.includes(FIXTURE_KEY_MARKER)) {
    throw new Error('testnet fixture key labels must include NOT_FOR_PRODUCTION');
  }
  if (/mainnet|production_live|LIVE_/i.test(label) && !label.includes(FIXTURE_KEY_MARKER)) {
    throw new Error('fixture label must not look like a production key');
  }
}

export function faucetMayGovern(): false {
  return false;
}

export function faucetMayValidate(): false {
  return false;
}

export function explorerMayMutate(): false {
  return false;
}

export function rpcMayAccessValidatorSigner(): false {
  return false;
}

export function relayerMayGovern(): false {
  return false;
}

export function testnetMayEnableProductionBankingRails(): false {
  return false;
}

export function hostMayHold(
  profile: HostProfile,
  material: (typeof FORBIDDEN_HOST_MATERIALS)[number],
): boolean {
  if (profile === 'VALIDATOR') {
    return material === 'VALIDATOR_VOTING_KEY' || material === 'GOVERNANCE_KEY';
  }
  return false;
}

export function assertFaucetNetwork(networkId: string): void {
  if (!isTestnetNetworkId(networkId) && networkId !== SUNREY_TESTNET_1_NETWORK_ID) {
    throw new Error('faucet authorization is valid only for designated test networks');
  }
}

export function assertNoPrivateKeyInConfig(text: string): void {
  if (
    /-----BEGIN .*PRIVATE KEY-----/.test(text) ||
    /"privateKey"\s*:/.test(text) ||
    /private_key\s*:/.test(text)
  ) {
    throw new Error('private key values must not appear in committed configuration');
  }
}
