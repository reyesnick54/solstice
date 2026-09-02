/**
 * Wave 2 — formal node role configuration with secure boundaries.
 *
 * Validator nodes hold consensus keys. Public RPC/query nodes must not.
 */

import type { NetworkEnvironment } from './identity.ts';
import { matrixRow } from './environment.ts';

export const NODE_ROLES = ['VALIDATOR', 'FULL_NODE', 'READ_ONLY_RPC'] as const;
export type NodeRole = (typeof NODE_ROLES)[number];

export type NodeRoleConfig = {
  readonly role: NodeRole;
  readonly environment: NetworkEnvironment;
  readonly votes: boolean;
  readonly holdsValidatorPrivateKeys: boolean;
  readonly holdsGovernanceKeys: boolean;
  readonly exposesPublicRpc: boolean;
  readonly exposesAdminRpc: boolean;
  readonly p2pEnabled: boolean;
  readonly rpcBindHost: string;
  readonly operatorBindHost: string;
  readonly secretsInRepository: false;
};

const PRIVATE_BIND = '127.0.0.1';
const PUBLIC_BIND = '0.0.0.0';

export function nodeRoleConfig(
  role: NodeRole,
  environment: NetworkEnvironment = 'TESTNET',
): NodeRoleConfig {
  const matrix = matrixRow(environment);
  switch (role) {
    case 'VALIDATOR':
      return Object.freeze({
        role,
        environment,
        votes: true,
        holdsValidatorPrivateKeys: true,
        holdsGovernanceKeys: true,
        exposesPublicRpc: false,
        exposesAdminRpc: false,
        p2pEnabled: true,
        rpcBindHost: PRIVATE_BIND,
        operatorBindHost: PRIVATE_BIND,
        secretsInRepository: false,
      });
    case 'FULL_NODE':
      return Object.freeze({
        role,
        environment,
        votes: false,
        holdsValidatorPrivateKeys: false,
        holdsGovernanceKeys: false,
        exposesPublicRpc: false,
        exposesAdminRpc: false,
        p2pEnabled: true,
        rpcBindHost: PRIVATE_BIND,
        operatorBindHost: PRIVATE_BIND,
        secretsInRepository: false,
      });
    case 'READ_ONLY_RPC':
      return Object.freeze({
        role,
        environment,
        votes: false,
        holdsValidatorPrivateKeys: false,
        holdsGovernanceKeys: false,
        exposesPublicRpc: true,
        exposesAdminRpc: false,
        p2pEnabled: false,
        rpcBindHost: environment === 'LOCAL' || environment === 'DEVNET' ? PRIVATE_BIND : PUBLIC_BIND,
        operatorBindHost: PRIVATE_BIND,
        secretsInRepository: false,
      });
    default: {
      const _exhaustive: never = role;
      throw new Error(`UNKNOWN_NODE_ROLE:${String(_exhaustive)}`);
    }
  }
}

export type NodeRoleValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly detail: string };

export function validateNodeRoleConfig(config: NodeRoleConfig): NodeRoleValidation {
  if (config.secretsInRepository) {
    return { ok: false, code: 'SECRETS_IN_REPO', detail: 'private keys must not be committed' };
  }
  if (config.role === 'READ_ONLY_RPC' && config.holdsValidatorPrivateKeys) {
    return {
      ok: false,
      code: 'RPC_HOLDS_VALIDATOR_KEYS',
      detail: 'public query nodes must not hold validator private keys',
    };
  }
  if (config.role === 'VALIDATOR' && config.exposesPublicRpc) {
    return {
      ok: false,
      code: 'VALIDATOR_PUBLIC_RPC',
      detail: 'validators must not expose public RPC',
    };
  }
  if (config.role === 'VALIDATOR' && config.rpcBindHost === PUBLIC_BIND) {
    return {
      ok: false,
      code: 'VALIDATOR_PUBLIC_BIND',
      detail: 'validator RPC must bind to a private operator network',
    };
  }
  if (config.role === 'READ_ONLY_RPC' && config.exposesAdminRpc) {
    return {
      ok: false,
      code: 'RPC_ADMIN_EXPOSED',
      detail: 'read-only RPC must not expose admin endpoints',
    };
  }
  if (!config.p2pEnabled && config.role !== 'READ_ONLY_RPC') {
    return {
      ok: false,
      code: 'P2P_REQUIRED',
      detail: `${config.role} requires P2P`,
    };
  }
  const matrix = matrixRow(config.environment);
  if (config.environment === 'MAINNET' && !matrix.deployable) {
    return {
      ok: false,
      code: 'MAINNET_NOT_DEPLOYABLE',
      detail: 'mainnet node roles remain fail-closed',
    };
  }
  return { ok: true };
}

export const PRODUCTION_PRIVATE_KEYS_COMMITTED = false as const;
