/**
 * Privacy and human-worth firewall for the monetary evidence bridge.
 *
 * The system values an authorized economic contribution/event.
 * It does not price the human being.
 */

import type { BridgeRejection } from './types.ts';

const RAW_PERSONAL_KEYS = [
  'name',
  'legalName',
  'email',
  'phone',
  'address',
  'ssn',
  'passport',
  'dateOfBirth',
  'dob',
  'kyc',
  'pdvPayload',
  'cleanRoomRow',
  'rawPersonalData',
  'biometric',
  'fullName',
  'nationalId',
] as const;

const PROTECTED_TRAIT_KEYS = [
  'race',
  'religion',
  'ethnicity',
  'sexualOrientation',
  'sexual_orientation',
  'politicalAffiliation',
  'political_affiliation',
  'disability',
  'medicalCondition',
  'medical_condition',
] as const;

const HUMAN_WORTH_KEYS = [
  'humanWorthScore',
  'human_worth',
  'humanWorth',
  'socialCreditScore',
  'social_credit',
  'socialCredit',
  'creditScore',
  'credit_score',
  'desirabilityScore',
  'desirability',
] as const;

const PEVE_QUANTITY_KEYS = [
  'peveScore',
  'peveComposite',
  'peve_composite',
  'peveQuantity',
  'personalEconomicValue',
  'peve',
] as const;

export function collectObjectKeys(value: unknown, into: Set<string> = new Set(), depth = 0): Set<string> {
  if (value === null || value === undefined || typeof value !== 'object' || depth > 3) {
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, into, depth + 1);
    }
    return into;
  }
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    into.add(key);
    collectObjectKeys(inner, into, depth + 1);
  }
  return into;
}

export function firewallRejection(value: unknown): BridgeRejection | null {
  const keys = collectObjectKeys(value);
  for (const key of RAW_PERSONAL_KEYS) {
    if (keys.has(key)) {
      return 'RAW_PERSONAL_DATA_REJECTED';
    }
  }
  for (const key of PROTECTED_TRAIT_KEYS) {
    if (keys.has(key)) {
      return 'PROTECTED_TRAIT_VALUATION_REJECTED';
    }
  }
  for (const key of HUMAN_WORTH_KEYS) {
    if (keys.has(key)) {
      return 'HUMAN_WORTH_SCORE_REJECTED';
    }
  }
  for (const key of PEVE_QUANTITY_KEYS) {
    if (keys.has(key)) {
      return 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY';
    }
  }
  return null;
}

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
