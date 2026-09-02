import { err, ok, type Result } from '../../../domain/src/result.ts';
import type {
  CredentialVerificationFailure,
  CredentialVerificationResult,
  VerifiableCredential,
} from './types.ts';
import { VERIFIABLE_CREDENTIALS_CAPABILITY } from './types.ts';

export type VerifiableCredentialVerifier = {
  readonly capability: typeof VERIFIABLE_CREDENTIALS_CAPABILITY | 'PARTIAL' | 'IMPLEMENTED';
  verify(input: {
    readonly credential: VerifiableCredential;
    readonly purposeId: string;
    readonly requiredClaims: readonly string[];
  }): Promise<Result<CredentialVerificationResult, CredentialVerificationFailure>>;
};

export function createUnavailableVerifiableCredentialVerifier(): VerifiableCredentialVerifier {
  return Object.freeze({
    capability: VERIFIABLE_CREDENTIALS_CAPABILITY,
    async verify() {
      return err({
        code: 'VC_ADAPTER_UNAVAILABLE',
        message: 'W3C Verifiable Credentials verification adapter is not configured',
      });
    },
  });
}
