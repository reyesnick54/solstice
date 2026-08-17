import type { Result } from '../../domain/src/result.ts';
import type { AssetQuantity } from '../../money/src/asset-quantity.ts';
import type { Money } from '../../money/src/money.ts';
import type { ExchangeFailure } from './types.ts';

export type CoinPort = {
  placeHold(accountId: string, amount: AssetQuantity): Result<{ holdId: string }, ExchangeFailure>;
  releaseHold(holdId: string): Result<unknown, ExchangeFailure>;
  transfer(
    actorId: string,
    customerId: string,
    sourceOwnerId: string,
    destinationOwnerId: string,
    amount: AssetQuantity,
  ): Result<{ journalId: string }, ExchangeFailure>;
  position(ownerId: string): { available: AssetQuantity; held: AssetQuantity; settled: AssetQuantity };
  supply(): { circulating: AssetQuantity };
};

export type FiatPort = {
  reserve(accountId: string, amount: Money, idempotencyKey: string): Result<{ holdId: string }, ExchangeFailure>;
  release(holdId: string): Result<unknown, ExchangeFailure>;
  capture(holdId: string, amount: Money): Result<unknown, ExchangeFailure>;
  transfer(
    actorId: string,
    sourceAccountId: string,
    destinationAccountId: string,
    amount: Money,
    idempotencyKey: string,
  ): Result<{ journalId: string }, ExchangeFailure>;
  postFee(
    actorId: string,
    sourceAccountId: string,
    feeBookId: string,
    amount: Money,
    idempotencyKey: string,
  ): Result<{ journalId: string }, ExchangeFailure>;
  available(accountId: string): Money;
};

export type InformationMarketPort = {
  executeApprovedCompute(input: {
    readonly listingId: string;
    readonly requesterActorId: string;
    readonly sponsorCustomerId: string;
  }): Result<
    {
      readonly contractKind: 'COMPUTE';
      readonly rawRows: false;
      readonly receiptId: string;
      readonly contributionId: string;
      readonly settled: boolean;
    },
    ExchangeFailure
  >;
};

export type ChainAnchorPort = {
  requestSettlementAnchor(input: {
    readonly tradeId: string;
    readonly settlementId: string;
    readonly listingVersion: string;
  }): { readonly requested: true; readonly authoritative: false };
};

export type ConsentCheckInput = {
  readonly consentRef: string;
  readonly subjectOrCohortRef: string;
  readonly purpose: string;
  readonly recipientClass: string;
  readonly operation: 'LIST' | 'MATCH' | 'DELIVER';
};

export type ConsentCheckResult = {
  readonly active: boolean;
  readonly revoked: boolean;
  readonly purposeMatch: boolean;
  readonly rawExportAllowed: false;
  readonly reasonCode: string;
};

export type ConsentPort = {
  check(input: ConsentCheckInput): ConsentCheckResult;
  revoke(consentRef: string): { readonly revoked: true };
  grant(input: {
    readonly consentRef: string;
    readonly subjectOrCohortRef: string;
    readonly purpose: string;
    readonly recipientClass: string;
  }): { readonly granted: true };
};

export type CleanRoomComputeInput = {
  readonly templateId: string;
  readonly purpose: string;
  readonly cohortRef: string;
  readonly requesterId: string;
};

export type CleanRoomComputeResult = {
  readonly receiptId: string;
  readonly authorizedOutputType: string;
  readonly aggregate: Readonly<Record<string, string>>;
  readonly rawRows: false;
  readonly rawPayload: null;
};

export type CleanRoomPort = {
  executeAggregate(input: CleanRoomComputeInput): Result<CleanRoomComputeResult, ExchangeFailure>;
};

export type OracleFactRecord = {
  readonly factId: string;
  readonly contractId: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly quality: 'FINALIZED' | 'CONFLICTED' | 'STALE' | 'SELF_REPORT';
  readonly providerId: string;
  readonly factType: string;
};

export type OraclePort = {
  record(fact: OracleFactRecord): Result<OracleFactRecord, ExchangeFailure>;
  latest(contractId: string): OracleFactRecord | null;
};

export type ProductiveGraphPort = {
  recordCapacityReference(input: {
    readonly objectId: string;
    readonly contractId: string;
    readonly quantity: bigint;
    readonly unit: string;
    readonly category: string;
  }): Result<{ readonly recorded: true; readonly doubleCounted: false }, ExchangeFailure>;
  hasReference(objectId: string, contractId: string): boolean;
};

export type MachineCapabilityPort = {
  hasCapability(machineId: string, capability: string): boolean;
  grant(machineId: string, capability: string): void;
};
