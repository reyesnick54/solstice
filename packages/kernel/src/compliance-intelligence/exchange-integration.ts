/**
 * Exchange integration — compliance evidence available to exchange gates via Kernel facts.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ComplianceScreeningEvidenceService } from './service.ts';

export type ExchangeComplianceEvidenceContext = {
  readonly schema: 'sunrey.exchange.compliance-evidence.v1';
  readonly subjectRef: string;
  readonly evidenceCount: number;
  readonly sanctionsEvidence: number;
  readonly pepEvidence: number;
  readonly wantedEvidence: number;
  readonly providerIds: readonly string[];
  readonly bypassesKernel: false;
  readonly directProviderAccess: false;
};

export async function buildExchangeComplianceContext(
  service: ComplianceScreeningEvidenceService,
  input: { readonly subjectRef: string; readonly name: string; readonly nowUtc: UtcInstant },
): Promise<ExchangeComplianceEvidenceContext> {
  const evidence = await service.screenPerson({
    name: input.name,
    canonicalSubjectId: input.subjectRef,
    nowUtc: input.nowUtc,
  });
  const positive = evidence.filter((e) => e.match.matchType !== 'NEGATIVE_OBSERVATION');
  return Object.freeze({
    schema: 'sunrey.exchange.compliance-evidence.v1',
    subjectRef: input.subjectRef,
    evidenceCount: positive.length,
    sanctionsEvidence: positive.filter((e) => e.classification === 'SANCTIONS').length,
    pepEvidence: positive.filter((e) => e.classification === 'PEP').length,
    wantedEvidence: positive.filter((e) => e.classification === 'WANTED').length,
    providerIds: Object.freeze([...new Set(positive.map((e) => e.source.providerId))]),
    bypassesKernel: false,
    directProviderAccess: false,
  });
}
