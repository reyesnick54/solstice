import { randomUUID } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { Money } from '../../money/src/money.ts';
import { SUNREY_COIN_ASSET_ID } from '../../sunrey-coin/src/ids.ts';
import type {
  ChainAnchorPort,
  CleanRoomComputeInput,
  CleanRoomComputeResult,
  CleanRoomPort,
  CoinPort,
  ConsentCheckInput,
  ConsentCheckResult,
  ConsentPort,
  FiatPort,
  InformationMarketPort,
  MachineCapabilityPort,
  OracleFactRecord,
  OraclePort,
  ProductiveGraphPort,
} from './ports.ts';
import type { ExchangeFailure } from './types.ts';

type CoinPosition = { available: bigint; held: bigint };

/**
 * Simulation coin double. Tracks circulating supply so a matched trade
 * can prove supply is unchanged. Not a second ledger.
 */
export class InMemoryCoinPort implements CoinPort {
  private readonly positions = new Map<string, CoinPosition>();
  private readonly holds = new Map<string, { ownerId: string; amount: bigint }>();
  private readonly accountOwners = new Map<string, string>();
  private circulating = 0n;

  seed(ownerId: string, amount: AssetQuantity, custodyAccountId = ownerId): void {
    const current = this.positions.get(ownerId) ?? { available: 0n, held: 0n };
    current.available += amount.scaledUnits;
    this.positions.set(ownerId, current);
    this.circulating += amount.scaledUnits;
    this.accountOwners.set(custodyAccountId, ownerId);
  }

  placeHold(accountId: string, amount: AssetQuantity): Result<{ holdId: string }, ExchangeFailure> {
    const ownerId = this.accountOwners.get(accountId) ?? accountId;
    const position = this.positions.get(ownerId);
    if (!position || position.available < amount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'sell exceeds owned available coin' });
    }
    position.available -= amount.scaledUnits;
    position.held += amount.scaledUnits;
    const holdId = `chold_${randomUUID().replace(/-/g, '')}`;
    this.holds.set(holdId, { ownerId, amount: amount.scaledUnits });
    return ok({ holdId });
  }

  releaseHold(holdId: string): Result<unknown, ExchangeFailure> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      return err({ code: 'UNKNOWN_HOLD', message: 'coin hold not found' });
    }
    const position = this.positions.get(hold.ownerId);
    if (position) {
      position.held -= hold.amount;
      position.available += hold.amount;
    }
    this.holds.delete(holdId);
    return ok(true);
  }

  transfer(
    _actorId: string,
    _customerId: string,
    sourceOwnerId: string,
    destinationOwnerId: string,
    amount: AssetQuantity,
  ): Result<{ journalId: string }, ExchangeFailure> {
    const source = this.positions.get(sourceOwnerId);
    if (!source || source.available < amount.scaledUnits) {
      return err({ code: 'INSUFFICIENT_ASSET', message: 'coin transfer exceeds available' });
    }
    source.available -= amount.scaledUnits;
    const destination = this.positions.get(destinationOwnerId) ?? { available: 0n, held: 0n };
    destination.available += amount.scaledUnits;
    this.positions.set(destinationOwnerId, destination);
    return ok({ journalId: `cjn_${randomUUID().replace(/-/g, '')}` });
  }

  position(ownerId: string): { available: AssetQuantity; held: AssetQuantity; settled: AssetQuantity } {
    const position = this.positions.get(ownerId) ?? { available: 0n, held: 0n };
    return {
      available: AssetQuantity.fromScaledUnits(position.available, SUNREY_COIN_ASSET_ID),
      held: AssetQuantity.fromScaledUnits(position.held, SUNREY_COIN_ASSET_ID),
      settled: AssetQuantity.fromScaledUnits(position.available + position.held, SUNREY_COIN_ASSET_ID),
    };
  }

  supply(): { circulating: AssetQuantity } {
    return { circulating: AssetQuantity.fromScaledUnits(this.circulating, SUNREY_COIN_ASSET_ID) };
  }
}

type FiatBook = { available: bigint; captured: bigint };

/**
 * Simulation cash double. Reserved funds leave available; capture moves
 * them to a settlement purse; transfer spends the purse. Not a second ledger.
 */
export class InMemoryFiatPort implements FiatPort {
  private readonly books = new Map<string, FiatBook>();
  private readonly holds = new Map<string, { accountId: string; remaining: bigint; currency: Money['currency'] }>();

  seed(accountId: string, amount: Money): void {
    const book = this.books.get(accountId) ?? { available: 0n, captured: 0n };
    book.available += amount.minorUnits;
    this.books.set(accountId, book);
  }

  reserve(accountId: string, amount: Money, _idempotencyKey: string): Result<{ holdId: string }, ExchangeFailure> {
    const book = this.books.get(accountId) ?? { available: 0n, captured: 0n };
    if (book.available < amount.minorUnits) {
      return err({ code: 'INSUFFICIENT_FUNDS', message: 'buy exceeds available cash plus fee buffer' });
    }
    book.available -= amount.minorUnits;
    this.books.set(accountId, book);
    const holdId = `fhold_${randomUUID().replace(/-/g, '')}`;
    this.holds.set(holdId, { accountId, remaining: amount.minorUnits, currency: amount.currency });
    return ok({ holdId });
  }

  release(holdId: string): Result<unknown, ExchangeFailure> {
    const hold = this.holds.get(holdId);
    if (!hold) {
      return err({ code: 'UNKNOWN_HOLD', message: 'fiat hold not found' });
    }
    const book = this.books.get(hold.accountId) ?? { available: 0n, captured: 0n };
    book.available += hold.remaining;
    this.books.set(hold.accountId, book);
    this.holds.delete(holdId);
    return ok(true);
  }

  capture(holdId: string, amount: Money): Result<unknown, ExchangeFailure> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.remaining < amount.minorUnits) {
      return err({ code: 'ORDER_HOLD_MISMATCH', message: 'fiat capture exceeds hold' });
    }
    hold.remaining -= amount.minorUnits;
    const book = this.books.get(hold.accountId) ?? { available: 0n, captured: 0n };
    book.captured += amount.minorUnits;
    this.books.set(hold.accountId, book);
    return ok(true);
  }

  transfer(
    _actorId: string,
    sourceAccountId: string,
    destinationAccountId: string,
    amount: Money,
    _idempotencyKey: string,
  ): Result<{ journalId: string }, ExchangeFailure> {
    const moved = this.spend(sourceAccountId, amount.minorUnits);
    if (!moved.ok) {
      return moved;
    }
    const destination = this.books.get(destinationAccountId) ?? { available: 0n, captured: 0n };
    destination.available += amount.minorUnits;
    this.books.set(destinationAccountId, destination);
    return ok({ journalId: `fjn_${randomUUID().replace(/-/g, '')}` });
  }

  postFee(
    _actorId: string,
    sourceAccountId: string,
    feeBookId: string,
    amount: Money,
    _idempotencyKey: string,
  ): Result<{ journalId: string }, ExchangeFailure> {
    const moved = this.spend(sourceAccountId, amount.minorUnits);
    if (!moved.ok) {
      return moved;
    }
    const fees = this.books.get(feeBookId) ?? { available: 0n, captured: 0n };
    fees.available += amount.minorUnits;
    this.books.set(feeBookId, fees);
    return ok({ journalId: `fee_${randomUUID().replace(/-/g, '')}` });
  }

  available(accountId: string): Money {
    return Money.fromMinorUnits(this.books.get(accountId)?.available ?? 0n, 'USD');
  }

  private spend(accountId: string, amount: bigint): Result<true, ExchangeFailure> {
    const book = this.books.get(accountId) ?? { available: 0n, captured: 0n };
    if (book.captured >= amount) {
      book.captured -= amount;
      this.books.set(accountId, book);
      return ok(true);
    }
    const rest = amount - book.captured;
    if (book.available < rest) {
      return err({ code: 'INSUFFICIENT_FUNDS', message: 'fiat transfer exceeds captured and available cash' });
    }
    book.captured = 0n;
    book.available -= rest;
    this.books.set(accountId, book);
    return ok(true);
  }
}

export class RecordingChainAnchorPort implements ChainAnchorPort {
  readonly anchors: { tradeId: string; settlementId: string; listingVersion: string; authoritative: false }[] = [];

  requestSettlementAnchor(input: {
    readonly tradeId: string;
    readonly settlementId: string;
    readonly listingVersion: string;
  }): { readonly requested: true; readonly authoritative: false } {
    this.anchors.push({ ...input, authoritative: false });
    return { requested: true, authoritative: false };
  }
}

export class StubInformationMarketPort implements InformationMarketPort {
  private readonly result: Result<
    {
      readonly contractKind: 'COMPUTE';
      readonly rawRows: false;
      readonly receiptId: string;
      readonly contributionId: string;
      readonly settled: boolean;
    },
    ExchangeFailure
  >;

  constructor(
    result: Result<
      {
        readonly contractKind: 'COMPUTE';
        readonly rawRows: false;
        readonly receiptId: string;
        readonly contributionId: string;
        readonly settled: boolean;
      },
      ExchangeFailure
    > = ok({
      contractKind: 'COMPUTE',
      rawRows: false,
      receiptId: 'imkt_receipt_sim',
      contributionId: 'imkt_contrib_sim',
      settled: true,
    }),
  ) {
    this.result = result;
  }

  executeApprovedCompute(_input: {
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
  > {
    return this.result;
  }
}

export class InMemoryConsentPort implements ConsentPort {
  private readonly grants = new Map<
    string,
    { subjectOrCohortRef: string; purpose: string; recipientClass: string; revoked: boolean }
  >();

  grant(input: {
    readonly consentRef: string;
    readonly subjectOrCohortRef: string;
    readonly purpose: string;
    readonly recipientClass: string;
  }): { readonly granted: true } {
    this.grants.set(input.consentRef, { ...input, revoked: false });
    return { granted: true };
  }

  revoke(consentRef: string): { readonly revoked: true } {
    const existing = this.grants.get(consentRef);
    if (existing) {
      this.grants.set(consentRef, { ...existing, revoked: true });
    } else {
      this.grants.set(consentRef, { subjectOrCohortRef: '', purpose: '', recipientClass: '', revoked: true });
    }
    return { revoked: true };
  }

  check(input: ConsentCheckInput): ConsentCheckResult {
    const grant = this.grants.get(input.consentRef);
    if (!grant) {
      return { active: false, revoked: false, purposeMatch: false, rawExportAllowed: false, reasonCode: 'CONSENT_MISSING' };
    }
    if (grant.revoked) {
      return { active: false, revoked: true, purposeMatch: false, rawExportAllowed: false, reasonCode: 'CONSENT_REVOKED' };
    }
    if (grant.purpose !== input.purpose) {
      return { active: true, revoked: false, purposeMatch: false, rawExportAllowed: false, reasonCode: 'PURPOSE_MISMATCH' };
    }
    if (grant.recipientClass !== input.recipientClass) {
      return { active: true, revoked: false, purposeMatch: true, rawExportAllowed: false, reasonCode: 'COUNTERPARTY_CLASS_DENIED' };
    }
    return { active: true, revoked: false, purposeMatch: true, rawExportAllowed: false, reasonCode: 'ELIGIBLE' };
  }
}

export class InMemoryCleanRoomPort implements CleanRoomPort {
  executeAggregate(input: CleanRoomComputeInput): Result<CleanRoomComputeResult, ExchangeFailure> {
    if (input.templateId.includes('raw') || input.purpose === 'RAW_EXPORT') {
      return err({ code: 'RAW_INFORMATION_UNAVAILABLE', message: 'raw subject rows are unavailable by default' });
    }
    return ok({
      receiptId: `cr_${input.cohortRef}_${input.templateId}`,
      authorizedOutputType: 'AGGREGATE_ONLY',
      aggregate: Object.freeze({ count: '12', meanMinor: '1840' }),
      rawRows: false,
      rawPayload: null,
    });
  }
}

export class InMemoryOraclePort implements OraclePort {
  private readonly facts = new Map<string, OracleFactRecord[]>();

  record(fact: OracleFactRecord): Result<OracleFactRecord, ExchangeFailure> {
    const list = this.facts.get(fact.contractId) ?? [];
    this.facts.set(fact.contractId, [...list, fact]);
    return ok(fact);
  }

  latest(contractId: string): OracleFactRecord | null {
    const list = this.facts.get(contractId) ?? [];
    return list[list.length - 1] ?? null;
  }
}

export class InMemoryProductiveGraphPort implements ProductiveGraphPort {
  private readonly refs = new Set<string>();

  recordCapacityReference(input: {
    readonly objectId: string;
    readonly contractId: string;
    readonly quantity: bigint;
    readonly unit: string;
    readonly category: string;
  }): Result<{ readonly recorded: true; readonly doubleCounted: false }, ExchangeFailure> {
    const key = `${input.objectId}::${input.contractId}`;
    if (this.refs.has(key)) {
      return err({ code: 'DOUBLE_COUNT_FORBIDDEN', message: 'productive graph already holds this contract reference' });
    }
    this.refs.add(key);
    void input.quantity;
    void input.unit;
    void input.category;
    return ok({ recorded: true, doubleCounted: false });
  }

  hasReference(objectId: string, contractId: string): boolean {
    return this.refs.has(`${objectId}::${contractId}`);
  }
}

export class InMemoryMachineCapabilityPort implements MachineCapabilityPort {
  private readonly caps = new Map<string, Set<string>>();

  grant(machineId: string, capability: string): void {
    const set = this.caps.get(machineId) ?? new Set<string>();
    set.add(capability);
    this.caps.set(machineId, set);
  }

  hasCapability(machineId: string, capability: string): boolean {
    return this.caps.get(machineId)?.has(capability) ?? false;
  }
}
