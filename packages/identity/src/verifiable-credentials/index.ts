export {
  createUnavailableVerifiableCredentialVerifier,
  type VerifiableCredentialVerifier,
} from './adapter.ts';
export { createFixtureVerifiableCredentialVerifier, sampleSimulationCredential } from './fixture-adapter.ts';
export {
  VERIFIABLE_CREDENTIALS_CAPABILITY,
  type CredentialVerificationFailure,
  type CredentialVerificationResult,
  type VerifiableCredential,
  type VerifiableCredentialProof,
} from './types.ts';
