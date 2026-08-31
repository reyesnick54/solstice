/**
 * ACCESS Wave 1 — Access Funding Pool and source registry.
 */

import { randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { fundingValueKindForSource } from './taxonomy.ts';
import type {
  AccessFundingPool,
  AccessFundingSource,
  FundingCategoryPolicy,
  AccessFundingSourceType,
  FundingRestriction,
} from './types.ts';

export class AccessFundingPoolRegistry {
  private readonly pools = new Map<string, AccessFundingPool>();
  private readonly sources = new Map<string, AccessFundingSource>();

  createPool(input: {
    readonly name: string;
    readonly category: string | null;
    readonly currency: string;
    readonly geography?: string | null;
    readonly programId?: string | null;
    readonly categoryPolicy?: FundingCategoryPolicy;
    readonly now: UtcInstant;
  }): AccessFundingPool {
    const pool: AccessFundingPool = Object.freeze({
      fundingPoolId: `afpool_${randomUUID()}`,
      name: input.name,
      category: input.category,
      currency: input.currency,
      geography: input.geography ?? null,
      programId: input.programId ?? null,
      categoryPolicy: input.categoryPolicy ?? 'STRICT_CATEGORY',
      status: 'ACTIVE',
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.pools.set(pool.fundingPoolId, pool);
    return pool;
  }

  getPool(fundingPoolId: string): AccessFundingPool | undefined {
    return this.pools.get(fundingPoolId);
  }

  suspendPool(fundingPoolId: string, now: UtcInstant): AccessFundingPool | null {
    const current = this.pools.get(fundingPoolId);
    if (!current) {
      return null;
    }
    const next: AccessFundingPool = Object.freeze({
      ...current,
      status: 'SUSPENDED',
      updatedAt: now,
    });
    this.pools.set(fundingPoolId, next);
    return next;
  }

  resumePool(fundingPoolId: string, now: UtcInstant): AccessFundingPool | null {
    const current = this.pools.get(fundingPoolId);
    if (!current || current.status === 'CLOSED') {
      return null;
    }
    const next: AccessFundingPool = Object.freeze({
      ...current,
      status: 'ACTIVE',
      updatedAt: now,
    });
    this.pools.set(fundingPoolId, next);
    return next;
  }

  listPools(): readonly AccessFundingPool[] {
    return Object.freeze([...this.pools.values()]);
  }

  findPoolForCategory(category: string, currency: string): AccessFundingPool | undefined {
    const strict = [...this.pools.values()].find(
      (pool) =>
        pool.category === category &&
        pool.currency === currency &&
        pool.status === 'ACTIVE' &&
        pool.categoryPolicy === 'STRICT_CATEGORY',
    );
    if (strict) {
      return strict;
    }
    return [...this.pools.values()].find(
      (pool) =>
        pool.category === null &&
        pool.currency === currency &&
        pool.status === 'ACTIVE' &&
        pool.categoryPolicy === 'SHARED_POOL',
    );
  }

  addSource(input: {
    readonly fundingPoolId: string;
    readonly sourceType: AccessFundingSourceType;
    readonly currency: string;
    readonly amountCommitted: bigint;
    readonly amountReceived: bigint;
    readonly restrictions?: FundingRestriction;
    readonly effectiveFrom: UtcInstant;
    readonly expiresAt?: UtcInstant | null;
    readonly evidenceReference: string;
  }): AccessFundingSource {
    const pool = this.pools.get(input.fundingPoolId);
    if (!pool) {
      throw new Error(`funding pool not found: ${input.fundingPoolId}`);
    }
    const source: AccessFundingSource = Object.freeze({
      sourceId: `afsrc_${randomUUID()}`,
      fundingPoolId: input.fundingPoolId,
      sourceType: input.sourceType,
      valueKind: fundingValueKindForSource(input.sourceType),
      currency: input.currency,
      amountCommitted: input.amountCommitted,
      amountReceived: input.amountReceived,
      restrictions: Object.freeze(input.restrictions ?? {}),
      effectiveFrom: input.effectiveFrom,
      expiresAt: input.expiresAt ?? null,
      evidenceReference: input.evidenceReference,
      status: 'ACTIVE',
    });
    this.sources.set(source.sourceId, source);
    return source;
  }

  getSource(sourceId: string): AccessFundingSource | undefined {
    return this.sources.get(sourceId);
  }

  listSources(fundingPoolId?: string): readonly AccessFundingSource[] {
    const all = [...this.sources.values()];
    if (fundingPoolId) {
      return Object.freeze(all.filter((row) => row.fundingPoolId === fundingPoolId));
    }
    return Object.freeze(all);
  }

  expireSource(sourceId: string, now: UtcInstant): AccessFundingSource | null {
    const current = this.sources.get(sourceId);
    if (!current) {
      return null;
    }
    const next: AccessFundingSource = Object.freeze({
      ...current,
      status: 'EXPIRED',
      expiresAt: now,
    });
    this.sources.set(sourceId, next);
    return next;
  }

  activeSourcesForPool(fundingPoolId: string, now: string): readonly AccessFundingSource[] {
    return Object.freeze(
      [...this.sources.values()].filter(
        (src) =>
          src.fundingPoolId === fundingPoolId &&
          src.status === 'ACTIVE' &&
          src.effectiveFrom <= now &&
          (src.expiresAt === null || src.expiresAt > now),
      ),
    );
  }
}
