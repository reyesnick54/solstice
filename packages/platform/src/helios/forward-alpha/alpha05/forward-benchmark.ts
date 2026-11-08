import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import {
  ALPHA05_RULE_FLAGS,
  FORWARD_BENCHMARK_KINDS,
  HELIOS_ALPHA05_SCHEMA,
  type ForwardBenchmarkKind,
} from './taxonomy.ts';
import type { ForwardBenchmark } from './types.ts';

export type SealForwardBenchmarkInput = {
  readonly campaignId: string;
  readonly kind: ForwardBenchmarkKind;
  readonly methodology: string;
  readonly referenceId?: string | null;
  readonly selectedBeforeCampaignAt: UtcInstant;
  readonly campaignStartsAt: UtcInstant;
  /** When true, benchmark selection used observed campaign outcomes — forbidden. */
  readonly observedOutcomesUsedForSelection?: boolean;
};

export type ForwardBenchmarkSealFailure = {
  readonly code:
    | 'BENCHMARK_SELECTED_AFTER_CAMPAIGN_START'
    | 'POST_HOC_BENCHMARK_FORBIDDEN'
    | 'UNKNOWN_BENCHMARK_KIND';
  readonly message: string;
};

export type ForwardBenchmarkSealResult =
  | { readonly ok: true; readonly value: ForwardBenchmark }
  | { readonly ok: false; readonly failure: ForwardBenchmarkSealFailure };

function parseInstant(iso: UtcInstant): number {
  return Date.parse(iso);
}

export function validateForwardBenchmarkSelectionTiming(input: SealForwardBenchmarkInput): ForwardBenchmarkSealFailure | null {
  if (!FORWARD_BENCHMARK_KINDS.includes(input.kind)) {
    return {
      code: 'UNKNOWN_BENCHMARK_KIND',
      message: `unknown forward benchmark kind: ${input.kind}`,
    };
  }
  if (input.observedOutcomesUsedForSelection === true) {
    return {
      code: 'POST_HOC_BENCHMARK_FORBIDDEN',
      message: 'benchmark must not be chosen after observing campaign results',
    };
  }
  if (parseInstant(input.selectedBeforeCampaignAt) >= parseInstant(input.campaignStartsAt)) {
    return {
      code: 'BENCHMARK_SELECTED_AFTER_CAMPAIGN_START',
      message: 'benchmark must be frozen before campaign start',
    };
  }
  return null;
}

export function sealForwardBenchmark(input: SealForwardBenchmarkInput): ForwardBenchmarkSealResult {
  const timing = validateForwardBenchmarkSelectionTiming(input);
  if (timing) {
    return { ok: false, failure: timing };
  }

  const material = [
    input.campaignId,
    input.kind,
    input.methodology,
    input.referenceId ?? '',
    input.selectedBeforeCampaignAt,
    input.campaignStartsAt,
  ].join('|');
  const digest = createHash('sha256').update(material).digest('hex');
  const benchmarkId = `alpha05-bm:${digest.slice(0, 20)}`;

  return {
    ok: true,
    value: Object.freeze({
      schema: HELIOS_ALPHA05_SCHEMA,
      benchmarkId,
      campaignId: input.campaignId,
      kind: input.kind,
      methodology: input.methodology,
      referenceId: input.referenceId ?? null,
      selectedBeforeCampaignAt: input.selectedBeforeCampaignAt,
      campaignStartsAt: input.campaignStartsAt,
      frozenHash: digest,
      rules: ALPHA05_RULE_FLAGS,
    }),
  };
}
