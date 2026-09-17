import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { HeliosResearchTaskInput, GrokResearchFailure } from './types.ts';
import type { ResearchPrivacyClass } from './taxonomy.ts';

const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  'kycDocument',
  'kyc_document',
  'passport',
  'ssn',
  'nationalId',
  'privateKey',
  'private_key',
  'seedPhrase',
  'mnemonic',
  'pan',
  'cvv',
  'cardNumber',
  'apiKey',
  'api_key',
  'password',
  'masterKey',
]);

const PRIVATE_FIELD_KEYS = new Set([
  'customerId',
  'customerName',
  'email',
  'bankAccount',
  'ledgerBalance',
  'transactionHistory',
  'rawPeg',
  'walletSecrets',
  'privateHoldings',
  'kyc',
  'identity',
  'riskProfile',
  'accountNumber',
  'portfolioBalance',
  'medicalData',
  'hinRecord',
  'vaultContents',
  'ssn',
  'passport',
  'nationalId',
  'privateKey',
  'seedPhrase',
  'mnemonic',
  'pan',
  'cvv',
  'cardNumber',
  'apiKey',
  'password',
  'subjectId',
]);

export type SanitizedResearchContext = {
  readonly privacyClass: 'PUBLIC';
  readonly question: string;
  readonly publicContext: Readonly<Record<string, unknown>>;
  readonly abstractConstraints: readonly string[];
  readonly strippedPrivateKeys: readonly string[];
};

export function buildPublicResearchContext(
  input: HeliosResearchTaskInput,
): Result<SanitizedResearchContext, GrokResearchFailure> {
  if (input.privacyClass === 'RESTRICTED') {
    return err({
      code: 'PRIVATE_CONTEXT_REJECTED',
      message: 'restricted research tasks cannot be dispatched to external Grok research',
      partialResult: null,
    });
  }

  const stripped: string[] = [];
  const merged = { ...input.publicContext };

  if (input.privateContext) {
    for (const [key, value] of Object.entries(input.privateContext)) {
      if (PRIVATE_FIELD_KEYS.has(key) || FORBIDDEN_CONTEXT_KEYS.includes(key)) {
        stripped.push(key);
        continue;
      }
      if (containsPrivateData(value)) {
        stripped.push(key);
        continue;
      }
      merged[key] = value;
    }
  }

  const scan = scanForPrivateKeys(merged);
  if (scan.found.length > 0) {
    return err({
      code: 'PRIVATE_CONTEXT_REJECTED',
      message: `public research context contains private fields: ${scan.found.join(', ')}`,
      partialResult: null,
    });
  }

  const abstractConstraints: string[] = [];
  if (input.timeHorizonDays !== null) {
    abstractConstraints.push(`time_horizon_days:${input.timeHorizonDays}`);
  }
  if (input.candidateOpportunityKey) {
    abstractConstraints.push(`opportunity_key:${input.candidateOpportunityKey}`);
  }

  return ok(Object.freeze({
    privacyClass: 'PUBLIC' as const,
    question: input.question,
    publicContext: Object.freeze(merged),
    abstractConstraints: Object.freeze(abstractConstraints),
    strippedPrivateKeys: Object.freeze([...stripped, ...scan.found]),
  }));
}

function scanForPrivateKeys(
  value: Readonly<Record<string, unknown>>,
  prefix = '',
): { readonly found: readonly string[] } {
  const found: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (PRIVATE_FIELD_KEYS.has(key) || FORBIDDEN_CONTEXT_KEYS.includes(key)) {
      found.push(path);
      continue;
    }
    if (containsPrivateData(child)) {
      found.push(path);
    }
  }
  return Object.freeze({ found: Object.freeze(found) });
}

function containsPrivateData(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    return /\$[\d,]+\.\d{2}/.test(value) && value.length < 40;
  }
  if (Array.isArray(value)) {
    return value.some(containsPrivateData);
  }
  if (typeof value === 'object') {
    return Object.entries(value).some(
      ([key, child]) => PRIVATE_FIELD_KEYS.has(key) || containsPrivateData(child),
    );
  }
  return false;
}

export function defaultPrivacyClassForTask(
  hasPrivateContext: boolean,
): ResearchPrivacyClass {
  return hasPrivateContext ? 'CUSTOMER_PRIVATE' : 'PUBLIC';
}
