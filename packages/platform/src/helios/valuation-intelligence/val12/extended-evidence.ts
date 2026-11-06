import type { UtcInstant } from '@solstice/domain';

import type { ValuationExtendedModelEvidence } from './types.ts';

export function compileValuationExtendedModelEvidence(input: {
  readonly val07ResidualIncomeRef: string;
  readonly val08ComparablesRef: string;
  readonly val09SotpRef: string;
  readonly val10UncertaintyRef: string;
  readonly val11EnsembleRef: string;
  readonly compiledAt: UtcInstant;
}): ValuationExtendedModelEvidence {
  return Object.freeze({
    schema: 'sunrey.helios.valuation-extended-model-evidence.v1',
    val07ResidualIncomeRef: input.val07ResidualIncomeRef,
    val08ComparablesRef: input.val08ComparablesRef,
    val09SotpRef: input.val09SotpRef,
    val10UncertaintyRef: input.val10UncertaintyRef,
    val11EnsembleRef: input.val11EnsembleRef,
    compiledAt: input.compiledAt,
  });
}

export function assertValuationExtendedEvidenceComplete(
  evidence: ValuationExtendedModelEvidence | null | undefined,
): readonly string[] {
  if (!evidence) return Object.freeze(['extended_model_evidence_missing']);
  const blockers: string[] = [];
  if (!evidence.val07ResidualIncomeRef) blockers.push('val07_ref');
  if (!evidence.val08ComparablesRef) blockers.push('val08_ref');
  if (!evidence.val09SotpRef) blockers.push('val09_ref');
  if (!evidence.val10UncertaintyRef) blockers.push('val10_ref');
  if (!evidence.val11EnsembleRef) blockers.push('val11_ref');
  return Object.freeze(blockers);
}
