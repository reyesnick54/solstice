import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import type { AmlCategory } from './types.ts';

export type AmlProfileInput = {
  readonly subjectRef: string;
  readonly jurisdiction: string;
  readonly customerType: 'PERSON' | 'BUSINESS';
  readonly kycState: string;
  readonly accountAgeDays: number;
  readonly productExposure: readonly string[];
  readonly sanctionsOutcome: string;
  readonly pepOutcome: string;
  readonly knownRiskFactor: boolean;
  readonly now: UtcInstant;
};

export type AmlRiskProfile = {
  readonly profileId: string;
  readonly subjectRef: string;
  readonly version: number;
  readonly category: AmlCategory;
  readonly reasonCodes: readonly string[];
  readonly inputHash: string;
  readonly jurisdiction: string;
  readonly createdAt: UtcInstant;
};

/**
 * Deterministic AML category. Not a legal conclusion. Not generative AI.
 */
export function evaluateAmlProfile(
  input: AmlProfileInput,
  previousVersion = 0,
): AmlRiskProfile {
  const reasonCodes: string[] = [];
  let category: AmlCategory = 'STANDARD';
  if (input.sanctionsOutcome === 'BLOCK') {
    category = 'PROHIBITED';
    reasonCodes.push('SANCTIONS_BLOCK');
  } else if (input.kycState === 'FAILED' || input.kycState === 'EXPIRED') {
    category = 'PROHIBITED';
    reasonCodes.push('KYC_FORBIDDEN');
  } else if (input.knownRiskFactor || input.sanctionsOutcome === 'REVIEW' || input.sanctionsOutcome === 'HOLD') {
    category = 'HIGH';
    reasonCodes.push('KNOWN_RISK_OR_SANCTIONS_REVIEW');
  } else if (input.pepOutcome === 'REVIEW') {
    category = 'ELEVATED';
    reasonCodes.push('PEP_INDICATION');
  } else if (input.accountAgeDays < 7) {
    category = 'ELEVATED';
    reasonCodes.push('NEW_ACCOUNT');
  } else if (input.kycState === 'VERIFIED' && input.accountAgeDays >= 30) {
    category = 'LOW';
    reasonCodes.push('ESTABLISHED_VERIFIED');
  } else {
    reasonCodes.push('DEFAULT_STANDARD');
  }
  const inputHash = sha256Hex(
    JSON.stringify({
      subjectRef: input.subjectRef,
      jurisdiction: input.jurisdiction,
      customerType: input.customerType,
      kycState: input.kycState,
      accountAgeDays: input.accountAgeDays,
      productExposure: [...input.productExposure].sort(),
      sanctionsOutcome: input.sanctionsOutcome,
      pepOutcome: input.pepOutcome,
      knownRiskFactor: input.knownRiskFactor,
    }),
  );
  return Object.freeze({
    profileId: randomUUID(),
    subjectRef: input.subjectRef,
    version: previousVersion + 1,
    category,
    reasonCodes: Object.freeze(reasonCodes),
    inputHash,
    jurisdiction: input.jurisdiction,
    createdAt: input.now,
  });
}
