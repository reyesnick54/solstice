/**
 * Wave 2 — environment isolation for SunRey chain runtime.
 *
 * Prevents accidental cross-environment reuse of chain identity, genesis,
 * keys, databases, RPC endpoints, provider credentials, and governance
 * authorizations. Development transactions must never be valid on mainnet.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import {
  canonicalIdentity,
  identityFor,
  replayBinding,
  type NetworkEnvironment,
  type NetworkIdentity,
} from './identity.ts';

export const RUNTIME_ENVIRONMENT_LABEL = ENVIRONMENT;

export type IsolationResource =
  | 'CHAIN_ID'
  | 'GENESIS'
  | 'VALIDATOR_KEYS'
  | 'TRANSACTION_SIGNATURES'
  | 'DATABASE'
  | 'RPC_ENDPOINT'
  | 'PROVIDER_CREDENTIALS'
  | 'GOVERNANCE_AUTHORIZATION';

export type EnvironmentMatrixRow = {
  readonly environment: NetworkEnvironment;
  readonly networkId: string;
  readonly chainId: string;
  readonly deployable: boolean;
  readonly databaseNamespace: string;
  readonly rpcPlaneDefault: 'PUBLIC_RPC' | 'VALIDATOR_RPC' | 'ADMIN_RPC' | 'LOCAL_COMBINED';
  readonly credentialScope: string;
  readonly governanceScope: string;
  readonly genesisScope: string;
  readonly replayBinding: string;
  readonly productionEconomicsAuthorized: false;
};

function row(environment: NetworkEnvironment, deployable: boolean): EnvironmentMatrixRow {
  const identity = canonicalIdentity(environment);
  return Object.freeze({
    environment,
    networkId: identity.networkId,
    chainId: identity.chainId,
    deployable,
    databaseNamespace: `sunrey_chain_${environment.toLowerCase()}`,
    rpcPlaneDefault:
      environment === 'LOCAL' || environment === 'DEVNET'
        ? 'LOCAL_COMBINED'
        : environment === 'MAINNET'
          ? 'VALIDATOR_RPC'
          : 'PUBLIC_RPC',
    credentialScope: `sunrey.credentials.${environment.toLowerCase()}`,
    governanceScope: `sunrey.governance.${environment.toLowerCase()}`,
    genesisScope: `sunrey.genesis.${environment.toLowerCase()}`,
    replayBinding: replayBinding(identity.networkId, identity.chainId),
    productionEconomicsAuthorized: false,
  });
}

export const ENVIRONMENT_MATRIX: readonly EnvironmentMatrixRow[] = Object.freeze([
  row('LOCAL', true),
  row('DEVNET', true),
  row('TESTNET', true),
  row('PREPRODUCTION', false),
  row('MAINNET', false),
]);

export function matrixRow(environment: NetworkEnvironment): EnvironmentMatrixRow {
  const found = ENVIRONMENT_MATRIX.find((entry) => entry.environment === environment);
  if (!found) {
    throw new Error('ENVIRONMENT_MATRIX_MISSING');
  }
  return found;
}

export type EnvironmentBindingCheck =
  | { readonly ok: true; readonly identity: NetworkIdentity }
  | {
      readonly ok: false;
      readonly code:
        | 'WRONG_NETWORK'
        | 'WRONG_CHAIN'
        | 'UNKNOWN_IDENTITY'
        | 'CROSS_ENVIRONMENT_REUSE'
        | 'MAINNET_NOT_DEPLOYABLE';
      readonly detail: string;
    };

export function assertEnvironmentBinding(input: {
  readonly expectedEnvironment: NetworkEnvironment;
  readonly networkId: string;
  readonly chainId: string;
}): EnvironmentBindingCheck {
  const expected = matrixRow(input.expectedEnvironment);
  if (input.expectedEnvironment === 'MAINNET' && !expected.deployable) {
    return {
      ok: false,
      code: 'MAINNET_NOT_DEPLOYABLE',
      detail: 'MAINNET remains fail-closed until governance authorizes deployment',
    };
  }
  const identity = identityFor(input.networkId, input.chainId);
  if (!identity) {
    return { ok: false, code: 'UNKNOWN_IDENTITY', detail: `${input.networkId}/${input.chainId}` };
  }
  if (identity.networkId !== expected.networkId) {
    return {
      ok: false,
      code: 'WRONG_NETWORK',
      detail: `expected ${expected.networkId}, got ${identity.networkId}`,
    };
  }
  if (identity.chainId !== expected.chainId) {
    return {
      ok: false,
      code: 'WRONG_CHAIN',
      detail: `expected ${expected.chainId}, got ${identity.chainId}`,
    };
  }
  if (identity.environment !== input.expectedEnvironment) {
    return {
      ok: false,
      code: 'CROSS_ENVIRONMENT_REUSE',
      detail: `identity belongs to ${identity.environment}, not ${input.expectedEnvironment}`,
    };
  }
  return { ok: true, identity };
}

export type ResourceIsolationCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly resource: IsolationResource; readonly detail: string };

export function assertResourceIsolation(input: {
  readonly sourceEnvironment: NetworkEnvironment;
  readonly targetEnvironment: NetworkEnvironment;
  readonly resource: IsolationResource;
  readonly sourceValue: string;
  readonly targetValue: string;
}): ResourceIsolationCheck {
  if (input.sourceEnvironment === input.targetEnvironment) {
    return { ok: true };
  }
  if (input.sourceValue === input.targetValue) {
    return {
      ok: false,
      resource: input.resource,
      detail: `${input.resource} reused across ${input.sourceEnvironment} and ${input.targetEnvironment}`,
    };
  }
  return { ok: true };
}

export function developmentSignatureInvalidOnMainnet(input: {
  readonly signedNetworkId: string;
  readonly signedChainId: string;
}): boolean {
  const dev = matrixRow('DEVNET');
  const local = matrixRow('LOCAL');
  const testnet = matrixRow('TESTNET');
  const mainnet = matrixRow('MAINNET');
  const isDevSignature =
    (input.signedNetworkId === dev.networkId && input.signedChainId === dev.chainId) ||
    (input.signedNetworkId === local.networkId && input.signedChainId === local.chainId) ||
    (input.signedNetworkId === testnet.networkId && input.signedChainId === testnet.chainId);
  const targetsMainnet =
    input.signedNetworkId === mainnet.networkId || input.signedChainId === mainnet.chainId;
  return isDevSignature && targetsMainnet;
}
