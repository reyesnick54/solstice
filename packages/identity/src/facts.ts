import type { CustomerId } from '../../domain/src/customer.ts';
import type { AuthenticationAssurance } from './assurance.ts';
import type { IdentityCapability } from './capability.ts';
import type { KycVerificationLevel, KycVerificationState } from './kyc.ts';
import type { IdentityStatus } from './model.ts';

/**
 * Authoritative identity facts for the existing Compliance Kernel.
 * Policy decisions stay in later policy-engine rules. Identity supplies facts.
 */
export type IdentityFacts = {
  readonly identityExists: boolean;
  readonly identityStatus: IdentityStatus | null;
  readonly subjectId: string | null;
  readonly actorId: string;
  readonly actorSubjectMatch: boolean;
  readonly authenticated: boolean;
  readonly sessionValid: boolean;
  readonly authenticationAssurance: AuthenticationAssurance | null;
  readonly kycState: KycVerificationState | null;
  readonly kycLevel: KycVerificationLevel | null;
  readonly kycFresh: boolean;
  readonly kycVersion: number | null;
  readonly customerId: CustomerId | null;
  readonly authorizedCapabilities: readonly IdentityCapability[];
};
