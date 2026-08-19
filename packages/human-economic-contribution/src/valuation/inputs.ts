import { err, ok, type Result } from '../../../domain/src/result.ts';
import { PROTECTED_TRAIT_FIELDS } from '../taxonomy.ts';
import type { ValuationFailure } from './types.ts';
import { valuationFailure } from './types.ts';
import type { ValuationInputRef } from './ids.ts';

export const ALLOWED_VALUATION_INPUT_TYPES = [
  'VERIFIED_MEASUREMENT',
  'MEASUREMENT_UNIT',
  'MEASUREMENT_PERIOD',
  'CONTRACTUAL_COMPENSATION_REFERENCE',
  'LICENSE_ROYALTY_REFERENCE',
  'INFORMATION_USAGE_SCOPE',
  'VERIFIED_USE_COUNT',
  'SERVICE_DELIVERY_UNITS',
  'RESEARCH_PARTICIPATION_UNITS',
  'VERIFIED_OUTCOME_ATTRIBUTION',
  'MARKET_REFERENCE_DATA_OBSERVATION',
  'RIGHTS_SCOPE',
  'EVIDENCE_QUALITY_CONFIDENCE',
  'REALIZATION_STATUS',
  'JURISDICTION_POLICY',
  'ECONOMIC_EVENT_CONTEXT',
  'PROFESSIONAL_CREDENTIAL_FACT',
] as const;
export type AllowedValuationInputType = (typeof ALLOWED_VALUATION_INPUT_TYPES)[number];

export const FORBIDDEN_VALUATION_INPUT_TYPES = [
  'RACE',
  'ETHNICITY',
  'RELIGION',
  'SEX',
  'SEXUAL_ORIENTATION',
  'POLITICAL_AFFILIATION',
  'DISABILITY',
  'MEDICAL_CONDITION',
  'PEVE_COMPOSITE_SCORE',
  'CREDIT_SCORE',
  'SOCIAL_CREDIT_SCORE',
  'HUMAN_WORTH_SCORE',
  'WALLET_BALANCE',
  'NET_WORTH',
  'WEALTH',
  'ACCOUNT_BALANCE',
  'GENERAL_POPULARITY',
  'OPAQUE_REPUTATION_SCORE',
  'AI_OPINION_PERSON_VALUE',
] as const;
export type ForbiddenValuationInputType = (typeof FORBIDDEN_VALUATION_INPUT_TYPES)[number];

export const FORBIDDEN_VALUATION_INPUT_KEYS = [
  ...PROTECTED_TRAIT_FIELDS,
  'sex',
  'gender',
  'peveScore',
  'peve_score',
  'peveCompositeScore',
  'creditScore',
  'credit_score',
  'socialCreditScore',
  'social_credit_score',
  'humanWorthScore',
  'human_worth_score',
  'walletBalance',
  'wallet_balance',
  'netWorth',
  'net_worth',
  'wealth',
  'accountBalance',
  'account_balance',
  'popularity',
  'generalPopularity',
  'opaqueReputationScore',
  'reputationScore',
  'aiOpinion',
  'aiPersonValue',
  'aiSubjectiveScore',
  'personDesirability',
  'personQuality',
  'socialStatus',
  'demographicValue',
] as const;

export type TraceableValuationInput = {
  readonly inputType: AllowedValuationInputType;
  readonly inputRef: ValuationInputRef;
  readonly sourceRef: string;
  readonly evidenceRef: string;
  readonly observedAt: string;
  readonly integerQuantity: bigint | null;
  readonly unit: string | null;
  readonly appliesToContributionEvent: true;
  readonly personLevelMultiplier: false;
};

function walkKeysAndStrings(value: unknown, keys: string[], strings: string[]): void {
  if (typeof value === 'string') {
    strings.push(value);
    return;
  }
  if (typeof value === 'bigint' || typeof value === 'boolean' || value === null) {
    return;
  }
  if (typeof value === 'number') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkKeysAndStrings(item, keys, strings);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      keys.push(key);
      walkKeysAndStrings(item, keys, strings);
    }
  }
}

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_VALUATION_INPUT_KEYS.map((key) => key.toLowerCase()));
const FORBIDDEN_TYPE_SET = new Set<string>(FORBIDDEN_VALUATION_INPUT_TYPES);
const PROTECTED_TRAIT_SET = new Set<string>(PROTECTED_TRAIT_FIELDS.map((key) => key.toLowerCase()));
const PERSON_RANK_KEYS = new Set([
  'pevescore',
  'peve_score',
  'pevecompositescore',
  'creditscore',
  'credit_score',
  'socialcreditscore',
  'social_credit_score',
  'humanworthscore',
  'human_worth_score',
  'walletbalance',
  'wallet_balance',
  'networth',
  'net_worth',
  'wealth',
  'accountbalance',
  'account_balance',
  'popularity',
  'generalpopularity',
  'opaquereputationscore',
  'reputationscore',
  'aiopinion',
  'aipersonvalue',
  'aisubjectivescore',
  'persondesirability',
  'personquality',
  'socialstatus',
  'demographicvalue',
]);

function classifyForbiddenKey(key: string): ValuationFailure {
  const lower = key.toLowerCase();
  if (PROTECTED_TRAIT_SET.has(lower) || lower === 'sex' || lower === 'gender') {
    return valuationFailure('PROTECTED_TRAIT_INPUT_FORBIDDEN', `protected trait '${key}' cannot be a valuation input`);
  }
  if (
    lower.includes('peve') ||
    lower === 'humanworthscore' ||
    lower === 'human_worth_score' ||
    lower === 'creditscore' ||
    lower === 'socialcreditscore'
  ) {
    if (lower.includes('peve')) {
      return valuationFailure('PEVE_INPUT_FORBIDDEN', `PEVE field '${key}' cannot be a valuation input`);
    }
    if (lower.includes('humanworth') || lower.includes('human_worth')) {
      return valuationFailure('HUMAN_WORTH_INPUT_FORBIDDEN', `human-worth field '${key}' cannot be a valuation input`);
    }
    return valuationFailure('PERSON_RANK_INPUT_FORBIDDEN', `person-rank field '${key}' cannot be a valuation input`);
  }
  if (lower.includes('wallet') || lower.includes('networth') || lower.includes('net_worth') || lower === 'wealth' || lower.includes('accountbalance')) {
    return valuationFailure('WEALTH_MULTIPLIER_FORBIDDEN', `wallet/net-worth field '${key}' cannot be a valuation multiplier`);
  }
  if (lower.includes('ai') || lower.includes('reputation') || lower.includes('popularity')) {
    return valuationFailure('AI_SUBJECTIVE_SCORE_FORBIDDEN', `AI or opaque reputation field '${key}' cannot be a valuation input`);
  }
  return valuationFailure('FORBIDDEN_VALUATION_INPUT', `forbidden valuation input '${key}'`);
}

export function scanForbiddenValuationInputs(input: unknown): Result<true, ValuationFailure> {
  const keys: string[] = [];
  const strings: string[] = [];
  walkKeysAndStrings(input, keys, strings);

  for (const key of keys) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEY_SET.has(lower) || PERSON_RANK_KEYS.has(lower) || FORBIDDEN_TYPE_SET.has(key)) {
      return err(classifyForbiddenKey(key));
    }
  }
  for (const text of strings) {
    if (FORBIDDEN_TYPE_SET.has(text)) {
      return err(classifyForbiddenKey(text));
    }
  }
  return ok(true);
}

export function isAllowedValuationInputType(value: string): value is AllowedValuationInputType {
  return (ALLOWED_VALUATION_INPUT_TYPES as readonly string[]).includes(value);
}

export function assertTraceableInput(input: TraceableValuationInput): Result<true, ValuationFailure> {
  const forbidden = scanForbiddenValuationInputs(input);
  if (!forbidden.ok) {
    return forbidden;
  }
  if (!isAllowedValuationInputType(input.inputType)) {
    return err(valuationFailure('FORBIDDEN_VALUATION_INPUT', `input type '${input.inputType}' is not allowed`));
  }
  if (input.sourceRef.length === 0 || input.evidenceRef.length === 0 || input.observedAt.length === 0) {
    return err(valuationFailure('INPUT_NOT_TRACEABLE', 'every valuation input must be traceable to a source and evidence reference'));
  }
  if (input.personLevelMultiplier !== false || input.appliesToContributionEvent !== true) {
    return err(
      valuationFailure(
        'PERSON_LEVEL_MULTIPLIER_FORBIDDEN',
        'a credential or input may establish a contribution-event fact; it cannot become a person-level multiplier',
      ),
    );
  }
  if (input.integerQuantity !== null && typeof input.integerQuantity !== 'bigint') {
    return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'valuation input quantities must be bigint'));
  }
  return ok(true);
}
