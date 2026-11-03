/**
 * Map SEC fundamental observations to HELIOS feature-fabric fact records.
 */

import type { FinancialFactObservation, SecFundamentalObservation } from './types.ts';

export type HeliosFundamentalFactRecord = {
  readonly factId: string;
  readonly filingId: string;
  readonly canonicalEntityId: string;
  readonly concept: string;
  readonly unit: string;
  readonly valueMinor: bigint | null;
  readonly numericValue: number | null;
  readonly periodEnd: string;
  readonly fiscalPeriod: string;
  readonly evidenceRef: string;
  readonly knowableAt: string;
};

export function mapSecObservationsToHeliosFacts(
  observations: readonly SecFundamentalObservation[],
): readonly HeliosFundamentalFactRecord[] {
  return Object.freeze(
    observations
      .filter((obs): obs is FinancialFactObservation => obs.observationKind === 'financial_fact')
      .map((fact) =>
        Object.freeze({
          factId: fact.factId,
          filingId: fact.filingId,
          canonicalEntityId: fact.canonicalEntityId,
          concept: fact.concept,
          unit: fact.unit,
          valueMinor: fact.valueMinor,
          numericValue: fact.numericValue,
          periodEnd: fact.periodEnd,
          fiscalPeriod: fact.fiscalPeriod,
          evidenceRef: fact.evidenceRef,
          knowableAt: fact.knowableAt,
        }),
      ),
  );
}
