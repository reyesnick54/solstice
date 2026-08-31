/**
 * Wave 7 — External Data Trust Engine.
 *
 * Multi-source reference reconciliation. Never fabricates canonical values.
 */

import { buildConfidence } from '../../../provider-sdk/src/confidence.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';
import type { TrustEngineOutcome, TrustEngineResult } from './models.ts';

export type TrustObservation = {
  readonly providerId: string;
  readonly value: number;
  readonly observedAtUtc: string;
  readonly authorityClass: AuthorityClass;
  readonly quarantined?: boolean;
  readonly stale?: boolean;
};

export type TrustEnginePolicy = {
  readonly agreementTolerancePct: number;
  readonly minimumSources: number;
  readonly officialSourceIds?: readonly string[];
};

export const DEFAULT_TRUST_ENGINE_POLICY: TrustEnginePolicy = Object.freeze({
  agreementTolerancePct: 2,
  minimumSources: 2,
  officialSourceIds: Object.freeze([]),
});

export class ExternalDataTrustEngine {
  readonly #policy: TrustEnginePolicy;

  constructor(policy: TrustEnginePolicy = DEFAULT_TRUST_ENGINE_POLICY) {
    this.#policy = policy;
  }

  reconcile(observations: readonly TrustObservation[]): TrustEngineResult<number> {
    const usable = observations.filter((o) => !o.quarantined && !o.stale);
    if (usable.length === 0) {
      return result('UNAVAILABLE', null, [], 'No usable observations after quarantine/stale filter.');
    }

    const official = this.#policy.officialSourceIds?.length
      ? usable.filter((o) => this.#policy.officialSourceIds!.includes(o.providerId))
      : [];
    if (official.length === 1) {
      const confidence = buildConfidence({
        authorityClass: official[0]!.authorityClass,
        freshnessStatus: 'fresh',
        validationStatus: 'valid',
        corroborationCount: 1,
      });
      if (confidence.score === null) {
        return result('LOW_CONFIDENCE', null, [official[0]!.providerId], 'Official source confidence insufficient.');
      }
      return result('AGREEMENT', official[0]!.value, [official[0]!.providerId], 'Official source precedence.');
    }

    if (usable.length < this.#policy.minimumSources) {
      return result(
        'LOW_CONFIDENCE',
        null,
        usable.map((o) => o.providerId),
        `Insufficient sources: ${usable.length} < ${this.#policy.minimumSources}.`,
      );
    }

    const values = usable.map((o) => o.value);
    const median = medianOf(values);
    const outliers = usable.filter((o) => pctDiff(o.value, median) > this.#policy.agreementTolerancePct);
    if (outliers.length > 0 && outliers.length < usable.length) {
      const agreeing = usable.filter((o) => pctDiff(o.value, median) <= this.#policy.agreementTolerancePct);
      if (agreeing.length < this.#policy.minimumSources) {
        return result(
          'CONFLICTED',
          null,
          usable.map((o) => o.providerId),
          'Provider disagreement exceeds tolerance.',
        );
      }
      const agreedMedian = medianOf(agreeing.map((o) => o.value));
      return result(
        'AGREEMENT',
        agreedMedian,
        agreeing.map((o) => o.providerId),
        'Outliers excluded; agreeing sources within tolerance.',
      );
    }

    if (outliers.length === usable.length) {
      return result(
        'CONFLICTED',
        null,
        usable.map((o) => o.providerId),
        'All sources disagree beyond tolerance.',
      );
    }

    return result('AGREEMENT', median, usable.map((o) => o.providerId), 'Sources agree within tolerance.');
  }
}

function result<T>(
  outcome: TrustEngineOutcome,
  value: T | null,
  contributingProviders: readonly string[],
  notes: string,
): TrustEngineResult<T> {
  return Object.freeze({ outcome, value, contributingProviders: Object.freeze([...contributingProviders]), notes });
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function pctDiff(a: number, b: number): number {
  if (b === 0) {
    return a === 0 ? 0 : 100;
  }
  return Math.abs((a - b) / b) * 100;
}
