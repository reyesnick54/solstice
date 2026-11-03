/**
 * Bind AAF07 certification evidence to the canonical Provider Runtime store.
 */

import { recordCertification } from '../../../../sunrey-chain/src/provider-runtime/universal/governance.ts';
import type { InMemoryUniversalProviderStore } from '../../../../sunrey-chain/src/provider-runtime/universal/store.ts';
import type { MarketDataHealthEvidence } from './health-evidence.ts';

export function bindMarketDataCertificationToProviderRuntime(input: {
  readonly store: InMemoryUniversalProviderStore;
  readonly evidence: MarketDataHealthEvidence;
  readonly adapterVersion: string;
  readonly testSuiteVersion: string;
  readonly distinction: 'INTERNAL_ADAPTER_TESTED' | 'EXTERNAL_PROVIDER_CERTIFIED';
  readonly approvedBy?: string | null;
  readonly approvedAtUtc?: string | null;
}): void {
  const allPassed = Object.values(input.evidence.proofSummary).every(Boolean);
  const recordResult = recordCertification({
    certificationId: `aaf07:${input.evidence.providerId}:${input.evidence.sealedAtUtc}`,
    providerId: input.evidence.providerId,
    adapterVersion: input.adapterVersion,
    environment: 'SANDBOX',
    testSuiteVersion: input.testSuiteVersion,
    testDateUtc: input.evidence.sealedAtUtc,
    result: allPassed ? 'PASS' : 'FAIL',
    distinction: input.distinction,
    evidenceRefs: Object.freeze([input.evidence.harnessDigest]),
    approvedBy: input.approvedBy ?? null,
    approvedAtUtc: input.approvedAtUtc ?? null,
  });
  if (!recordResult.ok) {
    return;
  }
  input.store.putCertification(recordResult.value);
}
