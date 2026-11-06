import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';

import { HELIOS_VALUATION_INTELLIGENCE_SCHEMA } from '../taxonomy.ts';
import type { ValuationValidationReport } from './types.ts';

export const HELIOS_VALUATION_INTELLIGENCE_EVIDENCE_KIND =
  'helios.valuation-intelligence.validation.v1' as const;

export function valuationValidationContentHash(report: ValuationValidationReport): string {
  const payload = JSON.stringify(report, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function appendValuationValidationEvidence(input: {
  readonly vault: EvidenceVault;
  readonly report: ValuationValidationReport;
  readonly stateId: string;
  readonly sealedAt: UtcInstant;
}): { readonly evidenceId: string; readonly contentHash: string } {
  const contentHash = valuationValidationContentHash(input.report);
  const record = input.vault.seal(HELIOS_VALUATION_INTELLIGENCE_EVIDENCE_KIND, {
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    contentHash,
    stateId: input.stateId,
    valuationQualityGate: input.report.valuationQualityGate,
    generatedAt: input.report.generatedAt,
    gitSha: input.report.gitSha,
    sealedAt: input.sealedAt,
  });
  return Object.freeze({ evidenceId: record.evidenceId, contentHash });
}
