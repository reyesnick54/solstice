import type { UtcInstant } from '../../../../domain/src/time.ts';
import { newPurposeAuthorizationId } from '../rights/ids.ts';
import type { ConsentGrant, PurposeAuthorization } from '../rights/types.ts';
import type { HumanEconomyConsentGrantId } from './ids.ts';
import { newHumanEconomyConsentGrantId } from './ids.ts';
import type { ConsentLifecycleState, HumanEconomyPurposeCode } from './taxonomy.ts';
import { HUMAN_ECONOMY_SCHEMA_VERSION } from './taxonomy.ts';
import type { HumanEconomyConsentGrant } from './types.ts';

export type BuildHumanEconomyConsentInput = {
  readonly baseConsentGrant: ConsentGrant;
  readonly purposeCode: HumanEconomyPurposeCode;
  readonly consentVersion: number;
  readonly recipientSystemRef: string;
  readonly scopeLabels: readonly string[];
  readonly renewedFromConsentId?: HumanEconomyConsentGrantId | null;
  readonly lifecycleState?: ConsentLifecycleState;
};

export function buildHumanEconomyConsentGrant(
  seed: string,
  input: BuildHumanEconomyConsentInput,
): HumanEconomyConsentGrant {
  return Object.freeze({
    schemaVersion: HUMAN_ECONOMY_SCHEMA_VERSION,
    humanConsentGrantId: newHumanEconomyConsentGrantId(seed),
    baseConsentGrant: input.baseConsentGrant,
    purposeCode: input.purposeCode,
    consentVersion: input.consentVersion,
    renewedFromConsentId: input.renewedFromConsentId ?? null,
    recipientSystemRef: input.recipientSystemRef,
    scopeLabels: Object.freeze([...input.scopeLabels]),
    lifecycleState: input.lifecycleState ?? 'ACTIVE',
    usageReceiptCommitments: Object.freeze([]),
    authorizesMonetaryIssuance: false,
    authorizesDatasetMonetization: false,
  });
}

export function renewHumanEconomyConsent(
  prior: HumanEconomyConsentGrant,
  seed: string,
  input: {
    readonly baseConsentGrant: ConsentGrant;
    readonly effectiveFrom: UtcInstant;
    readonly effectiveUntil: UtcInstant | null;
    readonly consentVersion: number;
  },
): HumanEconomyConsentGrant {
  const renewedBase: ConsentGrant = Object.freeze({
    ...input.baseConsentGrant,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
  });

  return Object.freeze({
    ...prior,
    humanConsentGrantId: newHumanEconomyConsentGrantId(seed),
    baseConsentGrant: renewedBase,
    consentVersion: input.consentVersion,
    renewedFromConsentId: prior.humanConsentGrantId,
    lifecycleState: 'ACTIVE',
    usageReceiptCommitments: Object.freeze([]),
  });
}

export function markConsentRevoked(consent: HumanEconomyConsentGrant): HumanEconomyConsentGrant {
  return Object.freeze({
    ...consent,
    lifecycleState: 'REVOKED',
  });
}

export function markConsentExpired(consent: HumanEconomyConsentGrant): HumanEconomyConsentGrant {
  return Object.freeze({
    ...consent,
    lifecycleState: 'EXPIRED',
  });
}

export function attachUsageReceiptCommitment(
  consent: HumanEconomyConsentGrant,
  receiptCommitment: string,
): HumanEconomyConsentGrant {
  return Object.freeze({
    ...consent,
    usageReceiptCommitments: Object.freeze([...consent.usageReceiptCommitments, receiptCommitment]),
  });
}

export function humanEconomyPurposeAuthorization(
  purposeCode: HumanEconomyPurposeCode,
  version: number,
): PurposeAuthorization {
  return Object.freeze({
    schemaVersion: 1,
    purposeId: newPurposeAuthorizationId(purposeCode, version),
    purposeVersion: version,
    code: purposeCode === 'RESEARCH_USE'
      ? 'RESEARCH'
      : purposeCode === 'AUTHORIZED_COMPUTATION' || purposeCode === 'PERSONAL_AGENT_USE'
        ? 'AGENT_COMPUTATION'
        : purposeCode === 'IDENTITY_VERIFICATION'
          ? 'CONTRIBUTION_VERIFICATION'
          : purposeCode,
    description: `Human Economy purpose: ${purposeCode}`,
  });
}

export function consentCoversScope(
  consent: HumanEconomyConsentGrant,
  requestedLabels: readonly string[],
): boolean {
  const permitted = new Set(consent.scopeLabels);
  return requestedLabels.every((label) => permitted.has(label));
}

export function consentCoversRecipient(
  consent: HumanEconomyConsentGrant,
  recipientSystemRef: string,
): boolean {
  return consent.recipientSystemRef === recipientSystemRef;
}
