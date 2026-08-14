import { type Brand, brandAs } from './brand.ts';

export type CustomerId = Brand<string, 'CustomerId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type AgentId = Brand<string, 'AgentId'>;
export type ProposalId = Brand<string, 'ProposalId'>;
export type MandateId = Brand<string, 'MandateId'>;
export type MandateClauseId = Brand<string, 'MandateClauseId'>;
export type TokenId = Brand<string, 'TokenId'>;
export type EventId = Brand<string, 'EventId'>;
export type GrowthEntryId = Brand<string, 'GrowthEntryId'>;
export type OpportunityId = Brand<string, 'OpportunityId'>;
export type SponsorId = Brand<string, 'SponsorId'>;
export type MerchantId = Brand<string, 'MerchantId'>;

function nonEmpty<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return brandAs<string, Name>(value);
}

export function asCustomerId(value: string): CustomerId {
  return nonEmpty(value, 'CustomerId');
}
export function asAccountId(value: string): AccountId {
  return nonEmpty(value, 'AccountId');
}
export function asAgentId(value: string): AgentId {
  return nonEmpty(value, 'AgentId');
}
export function asProposalId(value: string): ProposalId {
  return nonEmpty(value, 'ProposalId');
}
export function asMandateId(value: string): MandateId {
  return nonEmpty(value, 'MandateId');
}
export function asMandateClauseId(value: string): MandateClauseId {
  return nonEmpty(value, 'MandateClauseId');
}
export function asTokenId(value: string): TokenId {
  return nonEmpty(value, 'TokenId');
}
export function asEventId(value: string): EventId {
  return nonEmpty(value, 'EventId');
}
export function asGrowthEntryId(value: string): GrowthEntryId {
  return nonEmpty(value, 'GrowthEntryId');
}
export function asOpportunityId(value: string): OpportunityId {
  return nonEmpty(value, 'OpportunityId');
}
export function asSponsorId(value: string): SponsorId {
  return nonEmpty(value, 'SponsorId');
}
export function asMerchantId(value: string): MerchantId {
  return nonEmpty(value, 'MerchantId');
}
