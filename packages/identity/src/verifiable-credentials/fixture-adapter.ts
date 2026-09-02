import { err, ok } from '../../../domain/src/result.ts';
import type { VerifiableCredential } from './types.ts';
import type { VerifiableCredentialVerifier } from './adapter.ts';

/**
 * Simulation fixture for VC verification. Returns claim names only — never
 * the full credential subject document.
 */
export function createFixtureVerifiableCredentialVerifier(): VerifiableCredentialVerifier {
  return Object.freeze({
    capability: 'PARTIAL',
    async verify(input) {
      const issuer =
        typeof input.credential.issuer === 'string'
          ? input.credential.issuer
          : input.credential.issuer.id;
      if (issuer.includes('untrusted')) {
        return err({
          code: 'ISSUER_UNTRUSTED',
          message: 'issuer is not in the simulation trust registry',
        });
      }
      const expiration = input.credential.expirationDate;
      if (expiration && Date.parse(expiration) < Date.now()) {
        return err({
          code: 'CREDENTIAL_EXPIRED',
          message: 'credential expirationDate is in the past',
        });
      }
      if (!input.credential.proof?.proofValue) {
        return err({
          code: 'CREDENTIAL_PROOF_FAILED',
          message: 'credential proof is missing or invalid in simulation',
        });
      }
      const disclosed = input.requiredClaims.filter(
        (claim) => claim in input.credential.credentialSubject,
      );
      return ok({
        valid: disclosed.length === input.requiredClaims.length,
        issuerDid: issuer,
        disclosedClaimNames: Object.freeze([...disclosed]),
        rawCredentialReturned: false,
      });
    },
  });
}

export function sampleSimulationCredential(): VerifiableCredential {
  return Object.freeze({
    '@context': Object.freeze(['https://www.w3.org/2018/credentials/v1']),
    type: Object.freeze(['VerifiableCredential', 'SunReySimulationCredential']),
    issuer: 'did:web:simulation.sunrey.example',
    issuanceDate: '2026-01-01T00:00:00.000Z',
    expirationDate: '2027-01-01T00:00:00.000Z',
    credentialSubject: Object.freeze({
      id: 'did:example:subject-commitment-abc',
      credentialStatus: 'VALID',
      employmentStatus: 'VERIFIED',
    }),
    proof: Object.freeze({
      type: 'Ed25519Signature2020',
      proofPurpose: 'assertionMethod',
      verificationMethod: 'did:web:simulation.sunrey.example#key-1',
      proofValue: 'simulation-proof-value',
    }),
  });
}
