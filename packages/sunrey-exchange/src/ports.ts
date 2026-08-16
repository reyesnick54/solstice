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
