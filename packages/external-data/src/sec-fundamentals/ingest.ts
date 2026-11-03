/**
 * Ingest SEC fundamental observations into the external-data plane (simulation).
 */

import type { SecFundamentalObservation } from './types.ts';
import { runSecEdgarAsFiledDataflow, type SecEdgarSubmissionRecord } from './edgar-dataflow.ts';

export type SecFundamentalsIngestResult = {
  readonly observationCount: number;
  readonly filingIds: readonly string[];
  readonly observations: readonly SecFundamentalObservation[];
};

export function ingestSecFundamentalSubmissions(
  submissions: readonly SecEdgarSubmissionRecord[],
): SecFundamentalsIngestResult {
  const observations = runSecEdgarAsFiledDataflow(submissions);
  const filingIds = Object.freeze([...new Set(observations.map((o) => o.filingId))]);
  return Object.freeze({
    observationCount: observations.length,
    filingIds,
    observations,
  });
}
