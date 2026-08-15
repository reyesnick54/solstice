import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { HoldId } from '../../domain/src/hold.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { assertNoSensitiveCardData } from './pci-boundary.ts';
import type {
  CardAuthorizationId,
  CardId,
  MerchantReference,
  ProcessorCardReference,
} from './ids.ts';

export const AUTHORIZATION_DECISIONS = ['APPROVE', 'DECLINE', 'REVIEW'] as const;
export type AuthorizationDecisionKind = (typeof AUTHORIZATION_DECISIONS)[number];

export const AUTHORIZATION_REASON_CODES = [
  'APPROVED',
  'INSUFFICIENT_FUNDS',
  'CARD_FROZEN',
  'CARD_CLOSED',
  'CARD_NOT_ACTIVE',
  'MERCHANT_CATEGORY_BLOCKED',
  'COUNTRY_BLOCKED',
  'AMOUNT_LIMIT',
  'VELOCITY_LIMIT',
  'FRAUD_BLOCK',
  'CURRENCY_NOT_SUPPORTED',
  'POLICY_BLOCK',
  'ECOMMERCE_DISABLED',
  'CASH_ATM_DISABLED',
  'PROGRAM_DISABLED',
  'INVALID_CALLBACK',
  'STEP_UP_REQUIRED',
] as const;

export type AuthorizationReasonCode = (typeof AUTHORIZATION_REASON_CODES)[number];

export const AUTHORIZATION_STATES = ['PENDING', 'APPROVED', 'DECLINED', 'REVERSED', 'EXPIRED', 'CLEARED'] as const;
export type AuthorizationState = (typeof AUTHORIZATION_STATES)[number];

export type CardAuthorizationRequest = {
  readonly authorizationId: CardAuthorizationId;
  readonly cardId: CardId;
  readonly processorCardRef: ProcessorCardReference;
  readonly merchantRef: MerchantReference;
  readonly merchantCategory: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly country: string;
  readonly requestedAt: UtcInstant;
  readonly cardPresent: boolean;
  readonly ecommerce: boolean;
  readonly recurring: boolean;
  readonly cashAtm: boolean;
  readonly processorReference: string;
};

export type CardAuthorizationRecord = {
  readonly authorizationId: CardAuthorizationId;
  readonly cardId: CardId;
  readonly request: CardAuthorizationRequest;
  readonly decision: AuthorizationDecisionKind;
  readonly reasonCode: AuthorizationReasonCode;
  readonly holdId: HoldId | null;
  readonly state: AuthorizationState;
  readonly externalReason: string;
  readonly fraudEvaluationId: string | null;
  readonly policyVersionId: string | null;
  readonly kernelDecisionId: string | null;
  readonly expiresAt: UtcInstant | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export function freezeAuthorizationRequest(request: CardAuthorizationRequest): CardAuthorizationRequest {
  assertNoSensitiveCardData(request, 'authorizationRequest');
  if (!(request.amount instanceof Money) || typeof request.amount.minorUnits !== 'bigint') {
    throw new TypeError('authorization amount must be Money bigint minor units');
  }
  return Object.freeze({ ...request });
}

export function freezeAuthorizationRecord(record: CardAuthorizationRecord): CardAuthorizationRecord {
  assertNoSensitiveCardData(record, 'authorization');
  return Object.freeze({
    ...record,
    request: freezeAuthorizationRequest(record.request),
  });
}

/**
 * External processor response reason. Does not include internal fraud detail.
 */
export function externalAuthorizationReason(code: AuthorizationReasonCode): string {
  switch (code) {
    case 'APPROVED':
      return 'approved';
    case 'INSUFFICIENT_FUNDS':
      return 'insufficient_funds';
    case 'CARD_FROZEN':
    case 'CARD_CLOSED':
    case 'CARD_NOT_ACTIVE':
      return 'card_not_usable';
    case 'FRAUD_BLOCK':
    case 'POLICY_BLOCK':
    case 'STEP_UP_REQUIRED':
      return 'do_not_honor';
    case 'CURRENCY_NOT_SUPPORTED':
      return 'currency_not_supported';
    case 'INVALID_CALLBACK':
      return 'invalid_request';
    default:
      return 'declined';
  }
}
