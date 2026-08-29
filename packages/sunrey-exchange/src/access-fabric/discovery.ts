import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExchangeMarketId } from '../ids.ts';
import type { ExchangePrice } from '../price.ts';
import type { CapacityAccessTerms, CapacityDiscoveryQuery, CapacityDiscoveryRecord } from './types.ts';
import type { CapacityTradeMechanism } from './taxonomy.ts';
import { evaluateTermsCompleteness, windowsOverlap } from './terms.ts';

/**
 * Productive capacity discovery.
 *
 * A read index over listed capacity on the canonical Exchange. It holds no
 * consideration, no balances, and no order book: matching stays with the
 * canonical matching, auction, and clearing paths.
 */
export class CapacityDiscoveryIndex {
  private readonly records = new Map<string, CapacityDiscoveryRecord>();

  publish(input: {
    readonly listingId: string;
    readonly marketId: ExchangeMarketId;
    readonly mechanism: CapacityTradeMechanism;
    readonly terms: CapacityAccessTerms;
    readonly offeredQuantity: bigint;
    readonly indicativeUnitPrice?: ExchangePrice | null;
    readonly at: UtcInstant;
  }): CapacityDiscoveryRecord {
    const completeness = evaluateTermsCompleteness(input.terms);
    if (!completeness.complete) {
      throw new TypeError(
        `capacity listing refused: incomplete terms (${completeness.missing.join(', ')})`,
      );
    }
    if (input.offeredQuantity <= 0n) {
      throw new TypeError('capacity listing requires a positive offered quantity');
    }
    const record: CapacityDiscoveryRecord = Object.freeze({
      listingId: input.listingId,
      marketId: input.marketId,
      mechanism: input.mechanism,
      terms: input.terms,
      offeredQuantity: input.offeredQuantity,
      committedQuantity: 0n,
      indicativeUnitPrice: input.indicativeUnitPrice ?? null,
      publishedAt: input.at,
    });
    this.records.set(record.listingId, record);
    return record;
  }

  get(listingId: string): CapacityDiscoveryRecord | null {
    return this.records.get(listingId) ?? null;
  }

  /** Record a commitment against a listing. Availability is derived, not stored as a balance. */
  commit(listingId: string, quantity: bigint): CapacityDiscoveryRecord {
    const record = this.records.get(listingId);
    if (!record) {
      throw new TypeError(`unknown capacity listing ${listingId}`);
    }
    const committed = record.committedQuantity + quantity;
    if (committed > record.offeredQuantity) {
      throw new TypeError('capacity commitment exceeds the offered quantity');
    }
    const next: CapacityDiscoveryRecord = Object.freeze({ ...record, committedQuantity: committed });
    this.records.set(listingId, next);
    return next;
  }

  releaseCommitment(listingId: string, quantity: bigint): CapacityDiscoveryRecord {
    const record = this.records.get(listingId);
    if (!record) {
      throw new TypeError(`unknown capacity listing ${listingId}`);
    }
    const committed = record.committedQuantity - quantity;
    const next: CapacityDiscoveryRecord = Object.freeze({
      ...record,
      committedQuantity: committed < 0n ? 0n : committed,
    });
    this.records.set(listingId, next);
    return next;
  }

  availableQuantity(listingId: string): bigint {
    const record = this.records.get(listingId);
    if (!record) {
      return 0n;
    }
    return record.offeredQuantity - record.committedQuantity;
  }

  /**
   * Deterministic discovery. Filters only; no ranking score is applied, so a
   * non-matching listing can never surface under any weighting.
   */
  search(query: CapacityDiscoveryQuery): readonly CapacityDiscoveryRecord[] {
    const results: CapacityDiscoveryRecord[] = [];
    for (const record of this.records.values()) {
      if (!matches(record, query)) {
        continue;
      }
      results.push(record);
    }
    return Object.freeze(
      results.sort((a, b) => (a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0)),
    );
  }

  list(): readonly CapacityDiscoveryRecord[] {
    return this.search({});
  }
}

function matches(record: CapacityDiscoveryRecord, query: CapacityDiscoveryQuery): boolean {
  const terms = record.terms;
  if (query.productiveObjectId && terms.productiveObject.objectId !== query.productiveObjectId) {
    return false;
  }
  if (
    query.productiveCategory &&
    terms.productiveObject.productiveCategory !== query.productiveCategory
  ) {
    return false;
  }
  if (query.unit && terms.unit !== query.unit) {
    return false;
  }
  if (
    query.minimumQuantity !== undefined &&
    record.offeredQuantity - record.committedQuantity < query.minimumQuantity
  ) {
    return false;
  }
  if (query.deliveryLocation && terms.geography.deliveryLocation !== query.deliveryLocation) {
    return false;
  }
  if (query.serviceClassLabel && terms.serviceClass.label !== query.serviceClassLabel) {
    return false;
  }
  if (query.jurisdiction) {
    if (terms.policyRequirements.deniedJurisdictions.includes(query.jurisdiction)) {
      return false;
    }
    if (
      terms.policyRequirements.permittedJurisdictions.length > 0 &&
      !terms.policyRequirements.permittedJurisdictions.includes(query.jurisdiction)
    ) {
      return false;
    }
  }
  if (query.mechanism && record.mechanism !== query.mechanism) {
    return false;
  }
  if (query.withinWindow) {
    const requested = {
      startHeight: query.withinWindow.startHeight,
      endHeight: query.withinWindow.endHeight,
      startAt: null,
      endAt: null,
    };
    if (!windowsOverlap(terms.availabilityWindow, requested)) {
      return false;
    }
  }
  if (query.consideration && !terms.permittedConsideration.includes(query.consideration)) {
    return false;
  }
  return true;
}
