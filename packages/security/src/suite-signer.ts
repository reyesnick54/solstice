import { createSignedBinding } from './crypto-binding.ts';
import type { PublicKeyDescriptor, SignatureDescriptor } from './crypto-descriptors.ts';
import { evaluateCryptoPolicy, type CryptoPolicyInput } from './crypto-policy.ts';
import type { ProviderCatalog } from './crypto-providers.ts';
import type { CryptoSuiteRegistry } from './crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { PrivateKeyMaterial } from './redaction.ts';

export type SuiteSignRequest = {
  readonly registry: CryptoSuiteRegistry;
  readonly catalog: ProviderCatalog;
  readonly suiteId: string;
  readonly policy: Omit<CryptoPolicyInput, 'suiteId' | 'operation'>;
  readonly publicKey: PublicKeyDescriptor;
  readonly privateKey: PrivateKeyMaterial;
  readonly payload: string | Buffer;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly messageDomain: string;
};

export function signWithSuite(request: SuiteSignRequest): SecurityResult<SignatureDescriptor> {
  const suite = request.registry.get(request.suiteId);
  if (!suite.ok) {
    return suite;
  }
  if (suite.value.signatureAlgorithm === null) {
    return securityErr('UNSUPPORTED_ALGORITHM', `suite ${request.suiteId} has no signature algorithm`);
  }
  const policy = evaluateCryptoPolicy(request.registry, {
    ...request.policy,
    suiteId: request.suiteId,
    operation: 'SIGN',
  });
  if (policy.outcome === 'REJECT') {
    return securityErr('POLICY_REJECTED', policy.reasonCode);
  }
  if (policy.outcome === 'VERIFY_ONLY') {
    return securityErr('SUITE_VERIFY_ONLY', policy.reasonCode);
  }
  if (policy.outcome === 'REQUIRE_HYBRID') {
    return securityErr('DOWNGRADE_REJECTED', policy.reasonCode);
  }
  if (request.publicKey.purpose !== request.policy.keyPurpose) {
    return securityErr('PURPOSE_MISMATCH', 'public key purpose does not match request purpose');
  }
  if (request.publicKey.algorithmId !== suite.value.signatureAlgorithm) {
    return securityErr(
      'PROVIDER_ALGORITHM_MISMATCH',
      'key algorithm does not match suite; no silent fallback',
    );
  }
  const provider = request.catalog.signature(suite.value.signatureAlgorithm);
  if (!provider.ok) {
    return provider;
  }
  const binding = createSignedBinding({
    networkId: request.networkId,
    chainId: request.chainId,
    protocolVersion: request.protocolVersion,
    algorithmId: suite.value.signatureAlgorithm,
    suiteId: suite.value.suiteId,
    keyPurpose: request.policy.keyPurpose,
    messageDomain: request.messageDomain,
    payload: request.payload,
  });
  return provider.value.sign(request.privateKey, request.publicKey, binding);
}

export function verifyWithSuite(
  request: Omit<SuiteSignRequest, 'privateKey'> & { readonly signature: SignatureDescriptor },
): SecurityResult<true> {
  const suite = request.registry.get(request.suiteId);
  if (!suite.ok) {
    return suite;
  }
  if (suite.value.signatureAlgorithm === null) {
    return securityErr('UNSUPPORTED_ALGORITHM', `suite ${request.suiteId} has no signature algorithm`);
  }
  const policy = evaluateCryptoPolicy(request.registry, {
    ...request.policy,
    suiteId: request.suiteId,
    operation: 'VERIFY',
  });
  if (policy.outcome === 'REJECT') {
    return securityErr('POLICY_REJECTED', policy.reasonCode);
  }
  if (request.publicKey.purpose !== request.policy.keyPurpose) {
    return securityErr('PURPOSE_MISMATCH', 'public key purpose does not match request purpose');
  }
  if (request.signature.domain !== request.messageDomain) {
    return securityErr('BINDING_MISMATCH', 'signature domain does not match');
  }
  const provider = request.catalog.signature(suite.value.signatureAlgorithm);
  if (!provider.ok) {
    return provider;
  }
  const binding = createSignedBinding({
    networkId: request.networkId,
    chainId: request.chainId,
    protocolVersion: request.protocolVersion,
    algorithmId: suite.value.signatureAlgorithm,
    suiteId: suite.value.suiteId,
    keyPurpose: request.policy.keyPurpose,
    messageDomain: request.messageDomain,
    payload: request.payload,
  });
  return provider.value.verify(request.publicKey, binding, request.signature);
}
