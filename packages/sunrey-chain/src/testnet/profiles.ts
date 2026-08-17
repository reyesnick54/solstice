/**
 * Node profiles: validator private network, seed/sentry, public RPC.
 *
 * Administrative endpoints are not bound publicly by default.
 */

import type { TestnetInterfaceKind, TestnetNodeRole } from './types.ts';

export type BindSpec = {
  readonly kind: TestnetInterfaceKind;
  readonly bind: string;
  readonly public: boolean;
};

export type NodeProfile = {
  readonly role: TestnetNodeRole;
  readonly votes: boolean;
  readonly holdsValidatorKeys: boolean;
  readonly holdsGovernanceKeys: boolean;
  readonly holdsCustodyHsmSecrets: boolean;
  readonly interfaces: readonly BindSpec[];
  readonly httpApi: boolean;
  readonly eventStream: boolean;
  readonly explorerSourceApi: boolean;
};

export function validatorProfile(): NodeProfile {
  return Object.freeze({
    role: 'VALIDATOR',
    votes: true,
    holdsValidatorKeys: true,
    holdsGovernanceKeys: true,
    holdsCustodyHsmSecrets: false,
    interfaces: Object.freeze([
      Object.freeze({ kind: 'CONSENSUS', bind: '127.0.0.1:26656', public: false }),
      Object.freeze({ kind: 'SENTRY_PEER', bind: '0.0.0.0:26657', public: false }),
      Object.freeze({ kind: 'OPERATOR_LOCAL', bind: '127.0.0.1:26660', public: false }),
    ]),
    httpApi: false,
    eventStream: false,
    explorerSourceApi: false,
  });
}

export function seedProfile(): NodeProfile {
  return Object.freeze({
    role: 'SEED',
    votes: false,
    holdsValidatorKeys: false,
    holdsGovernanceKeys: false,
    holdsCustodyHsmSecrets: false,
    interfaces: Object.freeze([
      Object.freeze({ kind: 'SENTRY_PEER', bind: '0.0.0.0:26656', public: true }),
    ]),
    httpApi: false,
    eventStream: false,
    explorerSourceApi: false,
  });
}

export function publicRpcProfile(): NodeProfile {
  return Object.freeze({
    role: 'PUBLIC_RPC',
    votes: false,
    holdsValidatorKeys: false,
    holdsGovernanceKeys: false,
    holdsCustodyHsmSecrets: false,
    interfaces: Object.freeze([
      Object.freeze({ kind: 'PUBLIC_RPC', bind: '0.0.0.0:26657', public: true }),
      Object.freeze({ kind: 'OPERATOR_LOCAL', bind: '127.0.0.1:26660', public: false }),
    ]),
    httpApi: true,
    eventStream: true,
    explorerSourceApi: true,
  });
}

export function faucetProfile(): NodeProfile {
  return Object.freeze({
    role: 'FAUCET',
    votes: false,
    holdsValidatorKeys: false,
    holdsGovernanceKeys: false,
    holdsCustodyHsmSecrets: false,
    interfaces: Object.freeze([
      Object.freeze({ kind: 'PUBLIC_RPC', bind: '0.0.0.0:8787', public: true }),
    ]),
    httpApi: true,
    eventStream: false,
    explorerSourceApi: false,
  });
}

export function explorerProfile(): NodeProfile {
  return Object.freeze({
    role: 'EXPLORER',
    votes: false,
    holdsValidatorKeys: false,
    holdsGovernanceKeys: false,
    holdsCustodyHsmSecrets: false,
    interfaces: Object.freeze([
      Object.freeze({ kind: 'PUBLIC_RPC', bind: '0.0.0.0:8080', public: true }),
    ]),
    httpApi: true,
    eventStream: true,
    explorerSourceApi: true,
  });
}

export function relayerProfile(): NodeProfile {
  return Object.freeze({
    role: 'RELAYER',
    votes: false,
    holdsValidatorKeys: false,
    holdsGovernanceKeys: false,
    holdsCustodyHsmSecrets: false,
    interfaces: Object.freeze([
      Object.freeze({ kind: 'SENTRY_PEER', bind: '127.0.0.1:26670', public: false }),
    ]),
    httpApi: false,
    eventStream: false,
    explorerSourceApi: false,
  });
}

export function publicBindsAdministrative(profile: NodeProfile): boolean {
  return profile.interfaces.some((row) => row.kind === 'OPERATOR_LOCAL' && row.public);
}
