import {
  FORBIDDEN_VALUATION_ACTORS,
  VALUATION_ACTORS,
  type ForbiddenValuationActor,
  type ValuationActor,
  type ValuationFailureCode,
  type VerifiedContributionValuationInput,
} from './types.ts';

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

const PEVE_KEYS = new Set([
  'peveScore',
  'peveComposite',
  'peve_composite',
  'peveQuantity',
  'personalEconomicValue',
  'peve',
]);

const INVARIANT_FALSE_FLAGS = new Set([
  'humanWorthScore',
  'humanWorthUsedAsValue',
  'peveScoreUsedAsValue',
  'peveUsedAsTokenFormula',
  'containsRawPersonalData',
  'aiAuthorized',
  'productionActivated',
]);

export function isPermittedValuationActor(actor: string): actor is ValuationActor {
  return (VALUATION_ACTORS as readonly string[]).includes(actor);
}

export function isForbiddenValuationActor(actor: string): actor is ForbiddenValuationActor {
  return (FORBIDDEN_VALUATION_ACTORS as readonly string[]).includes(actor);
}

export function actorValuationRejection(actor: string): ValuationFailureCode | null {
  if (actor === 'AI') {
    return 'AI_CANNOT_AUTHORIZE_VALUATION';
  }
  if (actor === 'FINANCIAL_AGENT' || actor === 'AGENT') {
    return 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_VALUATION';
  }
  if (actor === 'S3M') {
    return 'S3M_CANNOT_AUTHORIZE_VALUATION';
  }
  if (actor === 'GROK') {
    return 'GROK_CANNOT_AUTHORIZE_VALUATION';
  }
  if (actor === 'MODEL' || actor === 'MODEL_OUTPUT') {
    return 'MODEL_OUTPUT_CANNOT_AUTHORIZE_VALUATION';
  }
  if (!isPermittedValuationActor(actor)) {
    return 'VALUATION_ACTOR_FORBIDDEN';
  }
  return null;
}

function inspect(value: unknown, reject: (code: ValuationFailureCode) => void, depth = 0): void {
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
    if (HUMAN_WORTH_KEYS.has(key) && !invariantFalse) {
      reject('HUMAN_WORTH_SCORE_REJECTED');
      return;
    }
    if (PEVE_KEYS.has(key)) {
      reject('PEVE_CANNOT_BECOME_REFERENCE_VALUE');
      return;
    }
    inspect(inner, reject, depth + 1);
  }
}

export function valuationFirewallRejection(value: unknown): ValuationFailureCode | null {
  let code: ValuationFailureCode | null = null;
  inspect(value, (found) => {
    if (code === null) {
      code = found;
    }
  });
  return code;
}

export function validateValuationInput(
  contribution: VerifiedContributionValuationInput,
): ValuationFailureCode | null {
  const poisoned = valuationFirewallRejection(contribution);
  if (poisoned) {
    return poisoned;
  }
  if (contribution.status !== 'VERIFIED') {
    return 'CONTRIBUTION_NOT_VERIFIED';
  }
  if (!contribution.contributionId || !contribution.fingerprint) {
    return 'INVALID_MEASUREMENT';
  }
  if (contribution.measurementQuantity <= 0n) {
    return 'INVALID_MEASUREMENT';
  }
  if (contribution.containsRawPersonalData) {
    return 'RAW_PERSONAL_DATA_REJECTED';
  }
  if (contribution.humanWorthScore) {
    return 'HUMAN_WORTH_SCORE_REJECTED';
  }
  if (contribution.peveScoreUsedAsValue) {
    return 'PEVE_CANNOT_BECOME_REFERENCE_VALUE';
  }
  return null;
}
