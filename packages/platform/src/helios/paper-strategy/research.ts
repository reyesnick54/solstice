import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { AdmissibleEvidenceRecord } from '../executable-opportunity/types.ts';
import type { QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { HeliosPaperResearchResult } from './types.ts';
import type { HeliosPaperStrategyId } from './taxonomy.ts';

/**
 * Deterministic research synthesis from qualified observation evidence.
 * Does not invoke LLM; structured candidate only.
 */
export function synthesizeDeterministicResearch(input: {
  readonly strategyId: HeliosPaperStrategyId;
  readonly evidenceRefs: readonly string[];
  readonly evidenceRecords: readonly AdmissibleEvidenceRecord[];
  readonly terms: QualificationTermsSnapshot;
  readonly now: UtcInstant;
}): HeliosPaperResearchResult {
  const primary = input.evidenceRecords[0];
  if (!primary) {
    throw new Error('research synthesis requires at least one admissible evidence record');
  }
  const price = input.terms.priceReference;
  if (!price) {
    throw new Error('research synthesis requires price reference from qualification terms');
  }
  const material = `${input.strategyId}:${input.evidenceRefs.join(',')}:${price.asOf}`;
  const researchId = `hr_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
  return Object.freeze({
    researchId,
    strategyId: input.strategyId,
    hypothesis: `Reference price observation supports bounded paper entry on ${price.symbol}`,
    synthesizedAt: input.now,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    referencePrice: Object.freeze({ minorUnits: price.minorUnits, currency: price.currency }),
    referenceAsOf: price.asOf,
    informationTimeObservedAt: primary.observedAt,
    informationTimeArrivedAt: primary.arrivedAt,
    deterministic: true,
    llmSourced: false,
  });
}
