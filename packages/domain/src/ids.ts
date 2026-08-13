import { type Brand, brandAs } from './brand.ts';

function nonEmpty(label: string, value: string): string {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

export type AccountId = Brand<string, 'AccountId'>;
export type BeneficiaryId = Brand<string, 'BeneficiaryId'>;
export type JournalId = Brand<string, 'JournalId'>;
export type JournalLineId = Brand<string, 'JournalLineId'>;
export type PaymentId = Brand<string, 'PaymentId'>;
export type ActionIntentId = Brand<string, 'ActionIntentId'>;
export type EvidenceId = Brand<string, 'EvidenceId'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;
export type ActorId = Brand<string, 'ActorId'>;
export type QuoteId = Brand<string, 'QuoteId'>;
export type RouteId = Brand<string, 'RouteId'>;

export function asAccountId(value: string): AccountId {
  return brandAs<string, 'AccountId'>(nonEmpty('AccountId', value));
}
export function asBeneficiaryId(value: string): BeneficiaryId {
  return brandAs<string, 'BeneficiaryId'>(nonEmpty('BeneficiaryId', value));
}
export function asJournalId(value: string): JournalId {
  return brandAs<string, 'JournalId'>(nonEmpty('JournalId', value));
}
export function asJournalLineId(value: string): JournalLineId {
  return brandAs<string, 'JournalLineId'>(nonEmpty('JournalLineId', value));
}
export function asPaymentId(value: string): PaymentId {
  return brandAs<string, 'PaymentId'>(nonEmpty('PaymentId', value));
}
export function asActionIntentId(value: string): ActionIntentId {
  return brandAs<string, 'ActionIntentId'>(nonEmpty('ActionIntentId', value));
}
export function asEvidenceId(value: string): EvidenceId {
  return brandAs<string, 'EvidenceId'>(nonEmpty('EvidenceId', value));
}
export function asIdempotencyKey(value: string): IdempotencyKey {
  return brandAs<string, 'IdempotencyKey'>(nonEmpty('IdempotencyKey', value));
}
export function asActorId(value: string): ActorId {
  return brandAs<string, 'ActorId'>(nonEmpty('ActorId', value));
}
export function asQuoteId(value: string): QuoteId {
  return brandAs<string, 'QuoteId'>(nonEmpty('QuoteId', value));
}
export function asRouteId(value: string): RouteId {
  return brandAs<string, 'RouteId'>(nonEmpty('RouteId', value));
}
