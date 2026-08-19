/**
 * Privacy and human-worth firewall for the monetary evidence bridge.
 *
 * The system values an authorized economic contribution/event.
 * It does not price the human being.
 */

import type { BridgeRejection } from './types.ts';

const RAW_PERSONAL_KEYS = new Set([
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
]);

const PROTECTED_TRAIT_KEYS = new Set([
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
]);

const HUMAN_WORTH_KEYS = new Set([
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
]);

const PEVE_QUANTITY_KEYS = new Set([
  'peveScore',
  'peveComposite',
  'peve_composite',
  'peveQuantity',
  'personalEconomicValue',
  'peve',
]);

/** Explicit false invariants on the privacy-safe adapter are not valuation features. */
const INVARIANT_FALSE_FLAGS = new Set([
  'humanWorthScore',
  'peveScoreUsedAsQuantity',
  'peveUsedAsTokenFormula',
  'containsRawPersonalData',
  'pdvSourceExposed',
  'cleanRoomSourceExposed',
  'aiAuthorized',
  'valuationEngineImplemented',
  'mappingIsIssuanceAuthorization',
  'humanWorthUsedAsValue',
  'productionActivated',
  'productionValuationActivated',
  'referenceValueEqualsSunReyByDefinition',
]);

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

function inspect(value: unknown, reject: (code: BridgeRejection) => void, depth = 0): void {
  if (value === null || value === undefined || typeof value !== 'object' || depth > 3) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      inspect(item, reject, depth + 1);
    }
    return;
  }
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const invariantFalse = INVARIANT_FALSE_FLAGS.has(key) && inner === false;
    if (RAW_PERSONAL_KEYS.has(key) && !invariantFalse) {
      reject('RAW_PERSONAL_DATA_REJECTED');
      return;
    }
    if (PROTECTED_TRAIT_KEYS.has(key)) {
      reject('PROTECTED_TRAIT_VALUATION_REJECTED');
      return;
    }
    if (HUMAN_WORTH_KEYS.has(key) && !invariantFalse) {
      reject('HUMAN_WORTH_SCORE_REJECTED');
      return;
    }
    if (PEVE_QUANTITY_KEYS.has(key)) {
      reject('PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY');
      return;
    }
    inspect(inner, reject, depth + 1);
  }
}

export function firewallRejection(value: unknown): BridgeRejection | null {
  let code: BridgeRejection | null = null;
  inspect(value, (found) => {
    if (code === null) {
      code = found;
    }
  });
  return code;
}

export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
