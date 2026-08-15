import { assuranceAtLeast, type AuthenticationAssurance } from '../../../identity/src/assurance.ts';
import type { DeviceTrustState } from '../../../identity/src/auth.ts';
import type { IdentityFacts } from '../../../identity/src/facts.ts';
import type { KycVerificationState } from '../../../identity/src/kyc.ts';
import type { Card } from '../card.ts';
import type { CardProgram } from '../program.ts';
import type { WalletProvider } from './token.ts';

export const WALLET_ELIGIBILITY_OUTCOMES = ['ELIGIBLE', 'STEP_UP_REQUIRED', 'REVIEW', 'INELIGIBLE'] as const;
export type WalletEligibilityOutcome = (typeof WALLET_ELIGIBILITY_OUTCOMES)[number];

export type WalletEligibilityInput = {
  readonly identity: IdentityFacts;
  readonly deviceTrust: DeviceTrustState | null;
  readonly card: Card | undefined;
  readonly program: CardProgram | undefined;
  readonly walletProvider: WalletProvider;
  readonly fraudOutcome: 'ALLOW' | 'STEP_UP' | 'REVIEW' | 'HOLD' | 'BLOCK';
  readonly complianceClear: boolean;
  readonly jurisdictionPermitted: boolean;
};

export type WalletEligibilityResult = {
  readonly outcome: WalletEligibilityOutcome;
  readonly reasons: readonly string[];
  readonly requiredAssurance: AuthenticationAssurance | null;
};

/**
 * Deterministic local eligibility. Provider provisioning must not start
 * unless the outcome is ELIGIBLE.
 */
export function evaluateWalletEligibility(input: WalletEligibilityInput): WalletEligibilityResult {
  const reasons: string[] = [];

  if (!input.identity.identityExists || input.identity.identityStatus !== 'ACTIVE') {
    return done('INELIGIBLE', ['IDENTITY_NOT_ACTIVE']);
  }
  if (!input.identity.sessionValid || !input.identity.authenticated) {
    return done('INELIGIBLE', ['SESSION_INVALID']);
  }
  const kyc = input.identity.kycState as KycVerificationState | null;
  if (kyc !== 'VERIFIED' || !input.identity.kycFresh) {
    return done('INELIGIBLE', ['KYC_NOT_VERIFIED']);
  }
  if (input.deviceTrust === 'BLOCKED' || input.deviceTrust === null) {
    return done('INELIGIBLE', ['DEVICE_NOT_TRUSTED']);
  }
  if (input.deviceTrust === 'REVIEW_REQUIRED') {
    return done('REVIEW', ['DEVICE_REVIEW_REQUIRED']);
  }
  if (!input.card || input.card.status !== 'ACTIVE') {
    return done('INELIGIBLE', ['CARD_NOT_ACTIVE']);
  }
  if (!input.program || !input.program.simulationEnabled || input.program.liveCapability) {
    return done('INELIGIBLE', ['PROGRAM_DISABLED']);
  }
  if (!input.program.supportedCapabilities.includes('WALLET_PROVISION')) {
    return done('INELIGIBLE', ['PROGRAM_WALLET_DISABLED']);
  }
  if (!input.jurisdictionPermitted) {
    return done('INELIGIBLE', ['JURISDICTION_NOT_PERMITTED']);
  }
  if (!input.complianceClear) {
    return done('INELIGIBLE', ['COMPLIANCE_NOT_CLEAR']);
  }
  if (input.fraudOutcome === 'BLOCK' || input.fraudOutcome === 'HOLD') {
    return done('INELIGIBLE', [`FRAUD_${input.fraudOutcome}`]);
  }
  if (input.fraudOutcome === 'REVIEW') {
    return done('REVIEW', ['FRAUD_REVIEW']);
  }
  if (input.deviceTrust !== 'TRUSTED') {
    return done('STEP_UP_REQUIRED', ['DEVICE_NOT_TRUSTED_YET'], 'HIGH_ASSURANCE');
  }
  if (
    !input.identity.authenticationAssurance ||
    !assuranceAtLeast(input.identity.authenticationAssurance, 'HIGH_ASSURANCE')
  ) {
    return done('STEP_UP_REQUIRED', ['STEP_UP_REQUIRED'], 'HIGH_ASSURANCE');
  }
  if (input.fraudOutcome === 'STEP_UP') {
    return done('STEP_UP_REQUIRED', ['FRAUD_STEP_UP'], 'HIGH_ASSURANCE');
  }
  reasons.push('ELIGIBLE');
  reasons.push(input.walletProvider);
  return done('ELIGIBLE', reasons);
}

function done(
  outcome: WalletEligibilityOutcome,
  reasons: readonly string[],
  requiredAssurance: AuthenticationAssurance | null = null,
): WalletEligibilityResult {
  return Object.freeze({
    outcome,
    reasons: Object.freeze([...reasons]),
    requiredAssurance,
  });
}
