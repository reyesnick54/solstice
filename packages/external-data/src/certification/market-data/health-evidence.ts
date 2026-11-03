/**
 * Provider-health evidence sealed for certification reports.
 */

import { hashRawJsonPayload } from '../../../../provider-sdk/src/hash.ts';
import type { MarketDataProviderHealth } from '../../../../provider-sdk/src/market-data-capability/types.ts';
import type { MarketDataQualificationHarnessResult } from './harness.ts';

export const MARKET_DATA_HEALTH_EVIDENCE_SCHEMA = 'sunrey.market-data-health-evidence.v1' as const;

export type MarketDataHealthEvidence = {
  readonly schemaVersion: typeof MARKET_DATA_HEALTH_EVIDENCE_SCHEMA;
  readonly providerId: string;
  readonly sealedAtUtc: string;
  readonly providerHealth: MarketDataProviderHealth;
  readonly harnessDigest: string;
  readonly proofSummary: Readonly<Record<string, boolean>>;
};

export function sealMarketDataHealthEvidence(input: {
  readonly providerId: string;
  readonly sealedAtUtc: string;
  readonly providerHealth: MarketDataProviderHealth;
  readonly harness: MarketDataQualificationHarnessResult;
}): MarketDataHealthEvidence {
  const proofSummary: Record<string, boolean> = {};
  for (const row of input.harness.proofs) {
    proofSummary[row.id] = row.passed;
  }
  const harnessDigest = hashRawJsonPayload({
    providerId: input.providerId,
    proofs: input.harness.proofs,
    rawPayloadEvidenceHash: input.harness.rawPayloadEvidenceHash,
  }).digest;

  return Object.freeze({
    schemaVersion: MARKET_DATA_HEALTH_EVIDENCE_SCHEMA,
    providerId: input.providerId,
    sealedAtUtc: input.sealedAtUtc,
    providerHealth: input.providerHealth,
    harnessDigest,
    proofSummary: Object.freeze(proofSummary),
  });
}
