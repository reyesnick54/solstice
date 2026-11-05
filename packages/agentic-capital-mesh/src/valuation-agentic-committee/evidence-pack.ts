import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type {
  CanonicalFinancialFact,
  FrozenValuationEvidencePack,
  ValuationEvidenceRef,
} from './types.ts';

function stableEvidenceDigest(evidence: readonly ValuationEvidenceRef[]): string {
  const rows = [...evidence]
    .map((row) =>
      [
        row.evidenceId,
        row.sourceKind,
        row.sourceRef,
        row.observedAt,
        row.freshnessOk ? '1' : '0',
        row.entitlementOk ? '1' : '0',
        row.provenanceRef,
      ].join('|'),
    )
    .sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

function stableFactsDigest(facts: readonly CanonicalFinancialFact[]): string {
  const rows = [...facts]
    .map((row) =>
      [row.factId, row.label, row.valueMinor.toString(), row.currency, row.asOf, row.sourceRef].join(
        '|',
      ),
    )
    .sort();
  return createHash('sha256').update(rows.join('\n')).digest('hex');
}

export function freezeValuationEvidencePack(input: {
  readonly packId: string;
  readonly evidence: readonly ValuationEvidenceRef[];
  readonly canonicalFinancialFacts: readonly CanonicalFinancialFact[];
  readonly frozenAt: UtcInstant;
}): FrozenValuationEvidencePack {
  if (input.evidence.length === 0) {
    throw new Error('VAL06 committee requires a non-empty AAF-certified evidence pack');
  }
  if (input.canonicalFinancialFacts.length === 0) {
    throw new Error('VAL06 committee requires canonical financial facts; agents may not rewrite them');
  }
  const contentHash = stableEvidenceDigest(input.evidence);
  const factsHash = stableFactsDigest(input.canonicalFinancialFacts);
  return Object.freeze({
    packId: input.packId,
    contentHash,
    factsHash,
    frozenAt: input.frozenAt,
    evidence: Object.freeze([...input.evidence]),
    canonicalFinancialFacts: Object.freeze([...input.canonicalFinancialFacts]),
  });
}

export function assertValuationEvidencePackUnchanged(
  pack: FrozenValuationEvidencePack,
  candidateEvidence: readonly ValuationEvidenceRef[],
  candidateFacts: readonly CanonicalFinancialFact[],
): void {
  const evidenceDigest = stableEvidenceDigest(candidateEvidence);
  if (evidenceDigest !== pack.contentHash) {
    throw new Error('evidence pack changed after freeze; VAL06 committee aborted');
  }
  const factsDigest = stableFactsDigest(candidateFacts);
  if (factsDigest !== pack.factsHash) {
    throw new Error('canonical financial facts changed after freeze; VAL06 committee aborted');
  }
}
