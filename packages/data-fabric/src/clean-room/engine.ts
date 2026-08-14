import { createHash } from 'node:crypto';

import { err, ok, type Result } from '@solstice/domain';
import {
  assertKernelAuthorization,
  type KernelAuthorization,
  type PersonalDataCategory,
} from '@solstice/kernel';

import type { DecryptedRow, SegmentedPersonalDataVault } from '../vault/segmented-vault.ts';
import type { PurposeAuthorization } from '../purpose/firewall.ts';
import type { AccessRequest } from '../purpose/access-request.ts';
import {
  HashIntegerNoiseMechanism,
  type DifferentialPrivacyMechanism,
} from './differential-privacy.ts';
import { PrivacyBudgetLedger, UNITS_PER_QUERY } from './budget.ts';

export const MIN_COHORT_SIZE = 5;

export type CleanRoomQuery = {
  readonly queryId: string;
  readonly metric: 'COUNT' | 'SUM' | 'MEAN_MILLI';
  readonly attribute?: string;
  readonly filterEquals?: Readonly<Record<string, string>>;
};

export type AuthorizedAggregate = {
  readonly queryId: string;
  readonly category: PersonalDataCategory;
  readonly purpose: PurposeAuthorization['purpose'];
  readonly metric: CleanRoomQuery['metric'];
  readonly value: bigint;
  readonly cohortSize: number;
  readonly budgetConsumed: number;
  readonly budgetRemaining: number;
  readonly resultHash: string;
  readonly consentRefs: PurposeAuthorization['consentRefs'];
  readonly noise: {
    readonly mechanismName: string;
    readonly formalGuaranteeClaimed: false;
    readonly specialistReviewRequired: true;
  };
  readonly rawRecordsReleased: false;
};

export type CleanRoomRefusal = {
  readonly code:
    | 'BELOW_COHORT'
    | 'PRIVACY_BUDGET_EXHAUSTED'
    | 'ISOLATION_RISK'
    | 'PURPOSE_AUTHORIZATION_MISMATCH'
    | 'UNKNOWN_ATTRIBUTE';
  readonly reasons: readonly string[];
};

export type CleanRoomJob = {
  readonly jobId: string;
  readonly queryHash: string;
  readonly purpose: PurposeAuthorization['purpose'];
  readonly consentRefs: PurposeAuthorization['consentRefs'];
  readonly cohortSize: number;
  readonly budgetConsumed: number;
  readonly resultHash: string;
};

/**
 * Clean room: compute against the vault, return only an authorized aggregate.
 * Raw records never leave. The raw result set is never logged.
 */
export class CleanRoom {
  readonly #vault: SegmentedPersonalDataVault;
  readonly #budget: PrivacyBudgetLedger;
  readonly #dp: DifferentialPrivacyMechanism;
  readonly #jobs: CleanRoomJob[] = [];

  constructor(
    vault: SegmentedPersonalDataVault,
    budget: PrivacyBudgetLedger = new PrivacyBudgetLedger(),
    dp: DifferentialPrivacyMechanism = new HashIntegerNoiseMechanism(),
  ) {
    this.#vault = vault;
    this.#budget = budget;
    this.#dp = dp;
  }

  jobs(): readonly CleanRoomJob[] {
    return this.#jobs.slice();
  }

  /** @kernelGated */
  executeAuthorizedQuery(
    authorization: KernelAuthorization,
    purposeAuth: PurposeAuthorization,
    request: AccessRequest,
    query: CleanRoomQuery,
    consentedSubjectRefs: readonly string[] = [],
  ): Result<AuthorizedAggregate, CleanRoomRefusal> {
    assertKernelAuthorization(authorization, 'RUN_CLEAN_ROOM');
    const category = request.dataCategories[0];
    if (
      purposeAuth.__brand !== 'PurposeAuthorization' ||
      category === undefined ||
      purposeAuth.category !== category ||
      purposeAuth.purpose !== request.purpose ||
      purposeAuth.requesterId !== request.requester.id
    ) {
      return err({
        code: 'PURPOSE_AUTHORIZATION_MISMATCH',
        reasons: Object.freeze(['clean room requires a PurposeAuthorization minted by the Purpose Firewall']),
      });
    }

    const budgetKey = { buyerId: request.requester.id, category };
    if (!this.#budget.canConsume(budgetKey, UNITS_PER_QUERY)) {
      return err({
        code: 'PRIVACY_BUDGET_EXHAUSTED',
        reasons: Object.freeze([
          `privacy budget exhausted for buyer ${request.requester.id} category ${category}`,
        ]),
      });
    }

    return this.#vault.computeInCategory(authorization, category, (rows) => {
      const consented = consentedSubjectRefs.length
        ? rows.filter((row) => consentedSubjectRefs.includes(row.subjectRef))
        : rows;
      const targeting = targetingIsolation(consented, query);
      if (targeting) {
        return err({
          code: 'ISOLATION_RISK',
          reasons: Object.freeze([targeting]),
        });
      }
      const filtered = applyFilter(consented, query.filterEquals);
      if (filtered.length < MIN_COHORT_SIZE) {
        return err({
          code: 'BELOW_COHORT',
          reasons: Object.freeze([
            `cohort size ${filtered.length} is below minimum ${MIN_COHORT_SIZE}`,
          ]),
        });
      }
      const isolation = resultIsolation(filtered, query);
      if (isolation) {
        return err({
          code: 'ISOLATION_RISK',
          reasons: Object.freeze([isolation]),
        });
      }

      const trueValue = metricValue(filtered, query);
      if (trueValue === null) {
        return err({
          code: 'UNKNOWN_ATTRIBUTE',
          reasons: Object.freeze([`attribute ${query.attribute ?? ''} is missing or non-integer`]),
        });
      }

      const spent = this.#budget.consume(budgetKey, UNITS_PER_QUERY);
      const noised = this.#dp.addIntegerNoise(
        trueValue,
        `${query.queryId}:${request.requester.id}:${category}`,
      );
      const resultHash = sha256(
        JSON.stringify({
          queryId: query.queryId,
          metric: query.metric,
          value: noised.noisedValue.toString(),
          cohortSize: filtered.length,
        }),
      );
      const queryHash = sha256(
        JSON.stringify({
          queryId: query.queryId,
          metric: query.metric,
          attribute: query.attribute ?? null,
          filterKeys: query.filterEquals ? Object.keys(query.filterEquals).sort() : [],
        }),
      );
      this.#jobs.push(
        Object.freeze({
          jobId: `job_${resultHash.slice(0, 12)}`,
          queryHash,
          purpose: request.purpose,
          consentRefs: purposeAuth.consentRefs,
          cohortSize: filtered.length,
          budgetConsumed: UNITS_PER_QUERY,
          resultHash,
        }),
      );

      return ok(
        Object.freeze({
          queryId: query.queryId,
          category,
          purpose: request.purpose,
          metric: query.metric,
          value: noised.noisedValue,
          cohortSize: filtered.length,
          budgetConsumed: spent.consumed,
          budgetRemaining: spent.remaining,
          resultHash,
          consentRefs: purposeAuth.consentRefs,
          noise: Object.freeze({
            mechanismName: this.#dp.name,
            formalGuaranteeClaimed: false as const,
            specialistReviewRequired: true as const,
          }),
          rawRecordsReleased: false as const,
        }),
      );
    });
  }
}

function applyFilter(
  rows: readonly DecryptedRow[],
  filter: CleanRoomQuery['filterEquals'],
): readonly DecryptedRow[] {
  if (!filter) {
    return rows;
  }
  return rows.filter((row) =>
    Object.entries(filter).every(([key, expected]) => String(row.attributes[key] ?? '') === expected),
  );
}

function targetingIsolation(rows: readonly DecryptedRow[], query: CleanRoomQuery): string | null {
  if (!query.filterEquals) {
    return null;
  }
  for (const key of Object.keys(query.filterEquals)) {
    const values = rows.map((row) => String(row.attributes[key] ?? ''));
    if (values.length > 0 && new Set(values).size === values.length) {
        return 'filter on a unique-valued attribute could isolate an individual';
    }
  }
  return null;
}

function resultIsolation(rows: readonly DecryptedRow[], query: CleanRoomQuery): string | null {
  const subjects = new Set(rows.map((row) => row.subjectRef));
  if (subjects.size < MIN_COHORT_SIZE) {
    return `result would isolate fewer than ${MIN_COHORT_SIZE} subjects`;
  }
  if (query.metric !== 'COUNT' && query.attribute) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.attributes[query.attribute] ?? '');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      if (count === 1) {
        return 'metric attribute has a unique value that could isolate an individual';
      }
    }
  }
  return null;
}

function metricValue(rows: readonly DecryptedRow[], query: CleanRoomQuery): bigint | null {
  if (query.metric === 'COUNT') {
    return BigInt(rows.length);
  }
  if (!query.attribute) {
    return null;
  }
  const values: bigint[] = [];
  for (const row of rows) {
    const raw = row.attributes[query.attribute];
    if (typeof raw === 'bigint') {
      values.push(raw);
    } else if (typeof raw === 'string' && /^-?\d+n?$/.test(raw)) {
      values.push(BigInt(raw.replace(/n$/, '')));
    } else {
      return null;
    }
  }
  const sum = values.reduce((acc, value) => acc + value, 0n);
  if (query.metric === 'SUM') {
    return sum;
  }
  if (values.length === 0n as unknown as boolean) {
    return null;
  }
  return (sum * 1000n) / BigInt(values.length);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
