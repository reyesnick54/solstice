import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import type { EarningsValidationReport } from './types.ts';
import { HELIOS_EARNINGS_INTELLIGENCE_SCHEMA } from './taxonomy.ts';

export const HELIOS_EARNINGS_INTELLIGENCE_EVIDENCE_KIND =
  'helios.earnings-intelligence.validation.v1' as const;

export function earningsValidationContentHash(report: EarningsValidationReport): string {
  const payload = JSON.stringify(report, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function appendEarningsValidationEvidence(input: {
  readonly vault: EvidenceVault;
  readonly report: EarningsValidationReport;
  readonly sealedAt: UtcInstant;
}): { readonly evidenceId: string; readonly contentHash: string } {
  const contentHash = earningsValidationContentHash(input.report);
  const record = input.vault.seal(HELIOS_EARNINGS_INTELLIGENCE_EVIDENCE_KIND, {
    schema: HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
    contentHash,
    realityGate: input.report.realityGate,
    generatedAt: input.report.generatedAt,
    gitSha: input.report.gitSha,
    chronology: input.report.chronology,
    antiOverfitting: input.report.antiOverfitting,
    sealedAt: input.sealedAt,
  });
  return Object.freeze({ evidenceId: record.evidenceId, contentHash });
}
