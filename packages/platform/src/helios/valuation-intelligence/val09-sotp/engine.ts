import type { UtcInstant } from '@solstice/domain';

import { distributionPercentiles } from '../val04-probabilistic-dcf/percentiles.ts';
import { VAL09_SOTP_SCHEMA } from './taxonomy.ts';

export type SotpSegment = {
  readonly segmentId: string;
  readonly label: string;
  readonly valuePerShareSamples: readonly number[];
};

export type SotpResult = {
  readonly schema: typeof VAL09_SOTP_SCHEMA;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly segmentValuePerShare: Readonly<Record<string, ReturnType<typeof distributionPercentiles>>>;
  readonly consolidatedValuePerShare: ReturnType<typeof distributionPercentiles>;
  readonly holdingCompanyDiscountBps: number;
  readonly evidenceRef: string;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

export function runSotpValuation(input: {
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly segments: readonly SotpSegment[];
  readonly holdingCompanyDiscountBps: number;
  readonly evidenceRef: string;
}): SotpResult {
  const pathCount = input.segments[0]?.valuePerShareSamples.length ?? 0;
  const consolidated: number[] = [];
  const segmentValuePerShare: Record<string, ReturnType<typeof distributionPercentiles>> = {};
  for (const segment of input.segments) {
    segmentValuePerShare[segment.segmentId] = distributionPercentiles([...segment.valuePerShareSamples]);
  }
  for (let i = 0; i < pathCount; i += 1) {
    let sum = 0;
    for (const segment of input.segments) {
      sum += segment.valuePerShareSamples[i] ?? 0;
    }
    consolidated.push(sum * (1 - input.holdingCompanyDiscountBps / 10_000));
  }
  return Object.freeze({
    schema: VAL09_SOTP_SCHEMA,
    entityId: input.entityId,
    asOf: input.asOf,
    segmentValuePerShare: Object.freeze(segmentValuePerShare),
    consolidatedValuePerShare: distributionPercentiles(consolidated),
    holdingCompanyDiscountBps: input.holdingCompanyDiscountBps,
    evidenceRef: input.evidenceRef,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
