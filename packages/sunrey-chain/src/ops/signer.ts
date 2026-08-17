import { createHash } from 'node:crypto';

import {
  CANONICAL_VALIDATOR_SUITE_ID,
  LocalDevelopmentSigner,
  consensusSignBytesHash,
  encodeConsensusSignBytes,
  type ConsensusSignRequest,
  type ConsensusSigner,
} from '../validators/index.ts';
import { SignerFence } from './fencing.ts';
import { SignerSafetyStore } from './signer-safety.ts';
import {
  opsErr,
  opsOk,
  type OpsResult,
  type SignerClientIdentity,
  type SignerEndpoint,
  type SignerTransportKind,
} from './types.ts';

export type RemoteSignPolicy = {
  readonly networkId: string;
  readonly chainId: string;
  readonly validatorId: string;
  readonly cryptoSuiteId: string;
  readonly validatorSetVersion: bigint;
  readonly allowedClientIds: readonly string[];
};

export type RemoteSignResponse = {
  readonly signatureHex: string;
  readonly signBytesHash: string;
  readonly fencingToken: bigint;
};

function fingerprint(identity: SignerClientIdentity): string {
  return createHash('sha256')
    .update(`${identity.clientId}|${identity.role}|${identity.certificateFingerprint}`)
    .digest('hex');
}

export function authenticateSignerClient(
  identity: SignerClientIdentity,
  policy: RemoteSignPolicy,
): OpsResult<true> {
  if (identity.role === 'SENTRY') {
    return opsErr('SENTRY_CANNOT_SIGN', 'sentry nodes have no consensus voting key');
  }
  if (identity.role === 'PUBLIC_RPC') {
    return opsErr('PUBLIC_RPC_CANNOT_REACH_SIGNER', 'public RPC cannot reach the signer endpoint');
  }
  if (identity.role !== 'VALIDATOR') {
    return opsErr('UNAUTHENTICATED_CLIENT', 'an arbitrary host cannot request signatures');
  }
  if (!policy.allowedClientIds.includes(identity.clientId)) {
    return opsErr('UNAUTHENTICATED_CLIENT', `client ${identity.clientId} is not authorized for this signer`);
  }
  if (identity.certificateFingerprint.length < 16) {
    return opsErr('UNAUTHENTICATED_CLIENT', 'client certificate fingerprint missing');
  }
  void fingerprint(identity);
  return opsOk(true);
}

export function validateSignRequest(
  request: ConsensusSignRequest,
  policy: RemoteSignPolicy,
): OpsResult<true> {
  if (request.networkId !== policy.networkId) {
    return opsErr('WRONG_NETWORK', `signer expected network ${policy.networkId}`);
  }
  if (request.chainId !== policy.chainId) {
    return opsErr('WRONG_CHAIN', `signer expected chain ${policy.chainId}`);
  }
  if (request.validatorId !== policy.validatorId) {
    return opsErr('WRONG_VALIDATOR', `signer expected validator ${policy.validatorId}`);
  }
  if (request.cryptoSuiteId !== policy.cryptoSuiteId) {
    return opsErr('UNSUPPORTED_CRYPTO_SUITE', `unknown crypto suite ${request.cryptoSuiteId}`);
  }
  if (request.validatorSetVersion !== policy.validatorSetVersion) {
    return opsErr('VALIDATOR_SET_MISMATCH', 'validator-set context does not match signer policy');
  }
  if (request.height < 1n) {
    return opsErr('WRONG_HEIGHT', 'cannot sign height 0');
  }
  if (request.round < 0n) {
    return opsErr('WRONG_ROUND', 'round must be non-negative');
  }
  const encoded = encodeConsensusSignBytes(request);
  if (encoded.length === 0) {
    return opsErr('CANONICAL_BYTES_MISMATCH', 'canonical sign bytes are empty');
  }
  if (consensusSignBytesHash(request).length !== 64) {
    return opsErr('CANONICAL_BYTES_MISMATCH', 'canonical sign-bytes hash is malformed');
  }
  return opsOk(true);
}

export class RemoteSignerServer {
  readonly kind = 'REMOTE_SIGNER' as const;
  readonly transport: SignerTransportKind;
  readonly policy: RemoteSignPolicy;
  readonly fence: SignerFence;
  readonly store: SignerSafetyStore;
  readonly #inner: ConsensusSigner;
  readonly #holderId: string;
  #token: bigint | null = null;

  constructor(input: {
    readonly transport: SignerTransportKind;
    readonly policy: RemoteSignPolicy;
    readonly store: SignerSafetyStore;
    readonly fence: SignerFence;
    readonly inner: ConsensusSigner;
    readonly holderId: string;
  }) {
    this.transport = input.transport;
    this.policy = input.policy;
    this.store = input.store;
    this.fence = input.fence;
    this.#inner = input.inner;
    this.#holderId = input.holderId;
  }

  activate(ttlMs = 60_000): OpsResult<true> {
    const lease = this.fence.acquire(this.policy.validatorId, this.#holderId, ttlMs);
    if (!lease.ok) {
      return lease;
    }
    this.#token = lease.value.fencingToken;
    return opsOk(true);
  }

  sign(request: ConsensusSignRequest, client: SignerClientIdentity, nowUtc: string): OpsResult<RemoteSignResponse> {
    const auth = authenticateSignerClient(client, this.policy);
    if (!auth.ok) {
      return auth;
    }
    const policy = validateSignRequest(request, this.policy);
    if (!policy.ok) {
      return policy;
    }
    if (this.#token === null) {
      return opsErr('LEASE_FENCED', 'signer is not the active authority');
    }
    const lease = this.fence.assertActive(this.#holderId, this.#token);
    if (!lease.ok) {
      return lease;
    }
    const rollback = this.store.refuseRollback(request);
    if (!rollback.ok) {
      return rollback;
    }
    const signed = this.store.safety.protect(request, this.#inner, 'HUMAN', nowUtc);
    if (!signed.ok) {
      return opsErr('SIGNER_UNAVAILABLE', signed.error.message);
    }
    return opsOk({
      signatureHex: signed.value.signatureHex,
      signBytesHash: consensusSignBytesHash(request),
      fencingToken: this.#token,
    });
  }

  exportPrivateKey(): OpsResult<never> {
    return opsErr('PRIVATE_KEY_EXPORT_FORBIDDEN', 'private key material never leaves the signer provider');
  }
}

export class RemoteSignerClient implements ConsensusSigner {
  readonly kind = 'REMOTE_SIGNER' as const;
  readonly endpoint: SignerEndpoint;
  readonly identity: SignerClientIdentity;
  readonly #server: RemoteSignerServer;
  readonly #now: () => string;

  constructor(
    endpoint: SignerEndpoint,
    identity: SignerClientIdentity,
    server: RemoteSignerServer,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.endpoint = endpoint;
    this.identity = identity;
    this.#server = server;
    this.#now = now;
  }

  sign(request: ConsensusSignRequest): ReturnType<ConsensusSigner['sign']> {
    const result = this.#server.sign(request, this.identity, this.#now());
    if (!result.ok) {
      return {
        ok: false,
        error: { code: 'SIGNER_PROVIDER_UNAVAILABLE', message: `${result.error.code}: ${result.error.message}` },
      };
    }
    return { ok: true, value: { signatureHex: result.value.signatureHex, signBytesHash: result.value.signBytesHash } };
  }
}

export function developmentRemoteSigner(input: {
  readonly dataDir: string;
  readonly validatorId: string;
  readonly holderId?: string;
  readonly transport?: SignerTransportKind;
  readonly secretLabel?: string;
}): {
  readonly server: RemoteSignerServer;
  readonly client: RemoteSignerClient;
  readonly store: SignerSafetyStore;
} {
  const policy: RemoteSignPolicy = {
    networkId: 'net_sunrey_local_dev',
    chainId: 'chn_sunrey_local_dev',
    validatorId: input.validatorId,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
    validatorSetVersion: 1n,
    allowedClientIds: ['validator-client-a'],
  };
  const store = new SignerSafetyStore(input.dataDir, input.validatorId, policy.chainId);
  const fence = new SignerFence();
  const inner = new LocalDevelopmentSigner((message) =>
    createHash('sha256').update(`${input.secretLabel ?? 'dev-remote-signer'}`).update(message).digest('hex'),
  );
  const server = new RemoteSignerServer({
    transport: input.transport ?? 'UNIX_DOMAIN_SOCKET',
    policy,
    store,
    fence,
    inner,
    holderId: input.holderId ?? 'signer-region-a',
  });
  const activated = server.activate();
  if (!activated.ok) {
    throw new Error(activated.error.message);
  }
  const client = new RemoteSignerClient(
    {
      transport: input.transport ?? 'UNIX_DOMAIN_SOCKET',
      endpoint: `${input.dataDir}/signer.sock`,
      clientId: 'validator-client-a',
    },
    {
      clientId: 'validator-client-a',
      role: 'VALIDATOR',
      certificateFingerprint: 'a'.repeat(64),
    },
    server,
  );
  return { server, client, store };
}

export function publicRpcSignerIdentity(): SignerClientIdentity {
  return {
    clientId: 'public-rpc',
    role: 'PUBLIC_RPC',
    certificateFingerprint: 'b'.repeat(64),
  };
}

export function sentrySignerIdentity(): SignerClientIdentity {
  return {
    clientId: 'sentry-a',
    role: 'SENTRY',
    certificateFingerprint: 'c'.repeat(64),
  };
}
