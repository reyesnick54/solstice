/**
 * Evidence sealing for prediction-market research artifacts.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { PredictionMarketEvidenceRecord } from './types.ts';

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

export function sealPredictionMarketEvidence(input: {
  readonly kind: string;
  readonly payload: unknown;
  readonly sealedAt: UtcInstant;
}): PredictionMarketEvidenceRecord {
  const body = stableJson(input.payload);
  const payloadHash = createHash('sha256').update(body).digest('hex');
  const evidenceId = createHash('sha256')
    .update(`${input.kind}:${payloadHash}:${input.sealedAt}`)
    .digest('hex')
    .slice(0, 32);
  return Object.freeze({
    evidenceId: `pm_ev_${evidenceId}`,
    kind: input.kind,
    payloadHash,
    sealedAt: input.sealedAt,
  });
}
