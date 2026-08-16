import type {
  CryptoSuiteRegistry,
  ProviderCatalog,
  PublicKeyDescriptor,
  SignatureDescriptor,
} from '../../security/src/index.ts';
import { signWithSuite, verifyWithSuite } from '../../security/src/index.ts';
import type { PrivateKeyMaterial } from '../../security/src/redaction.ts';
import type { ChainFailure } from './types.ts';

export type ChainSuiteSignInput = {
  readonly registry: CryptoSuiteRegistry;
  readonly catalog: ProviderCatalog;
  readonly suiteId: string;
  readonly publicKey: PublicKeyDescriptor;
  readonly privateKey: PrivateKeyMaterial;
  readonly payload: string | Buffer;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly messageDomain: string;
  readonly environment?: 'simulation' | 'test' | 'production';
};

export function signChainWithSuite(
  input: ChainSuiteSignInput,
): { readonly ok: true; readonly signature: SignatureDescriptor } | { readonly ok: false; readonly error: ChainFailure } {
  const signed = signWithSuite({
    registry: input.registry,
    catalog: input.catalog,
    suiteId: input.suiteId,
    policy: {
      protocolVersion: input.protocolVersion,
      networkId: input.networkId,
      actorType: 'USER',
      keyPurpose: input.publicKey.purpose,
      environment: input.environment ?? 'simulation',
      migrationState: 'CLASSICAL_ONLY',
    },
    publicKey: input.publicKey,
    privateKey: input.privateKey,
    payload: input.payload,
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    messageDomain: input.messageDomain,
  });
  if (!signed.ok) {
    return { ok: false, error: { code: signed.error.code, message: signed.error.message } };
  }
  return { ok: true, signature: signed.value };
}

export function verifyChainWithSuite(
  input: Omit<ChainSuiteSignInput, 'privateKey'> & { readonly signature: SignatureDescriptor },
): { readonly ok: true } | { readonly ok: false; readonly error: ChainFailure } {
  const verified = verifyWithSuite({
    registry: input.registry,
    catalog: input.catalog,
    suiteId: input.suiteId,
    policy: {
      protocolVersion: input.protocolVersion,
      networkId: input.networkId,
      actorType: 'USER',
      keyPurpose: input.publicKey.purpose,
      environment: input.environment ?? 'simulation',
      migrationState: 'CLASSICAL_ONLY',
    },
    publicKey: input.publicKey,
    payload: input.payload,
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    messageDomain: input.messageDomain,
    signature: input.signature,
  });
  if (!verified.ok) {
    return { ok: false, error: { code: verified.error.code, message: verified.error.message } };
  }
  return { ok: true };
}
