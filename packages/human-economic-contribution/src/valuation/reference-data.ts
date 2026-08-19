import type { UtcInstant } from '../../../domain/src/time.ts';
import { sha256Canonical } from '../ids.ts';
import type { ContributionClass, MeasurementUnit } from '../taxonomy.ts';
import { valuationReferenceIdFor } from './ids.ts';
import type {
  ReferenceQuery,
  ValuationMethod,
  ValuationReferenceDataPort,
  ValuationReferenceDatum,
  ValuationReferenceSourceClass,
} from './types.ts';

export type ReferenceFixtureInput = {
  readonly seed: string;
  readonly sourceClass: ValuationReferenceSourceClass;
  readonly observedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
  readonly expiresAt?: UtcInstant | null;
  readonly jurisdiction: string;
  readonly unit: ValuationReferenceDatum['unit'];
  readonly value: bigint;
  readonly royaltyBasisPoints?: bigint | null;
  readonly quality?: ValuationReferenceDatum['quality'];
  readonly confidenceBps?: bigint;
  readonly contributionClass?: ContributionClass | null;
  readonly valuationMethod?: ValuationMethod | null;
  readonly measurementUnit?: MeasurementUnit | null;
  readonly relatedContributionId?: ValuationReferenceDatum['relatedContributionId'];
  readonly policyCompatibility?: boolean;
};

export function createReferenceDatum(input: ReferenceFixtureInput): ValuationReferenceDatum {
  return Object.freeze({
    referenceId: valuationReferenceIdFor(input.seed),
    sourceClass: input.sourceClass,
    observedAt: input.observedAt,
    effectiveAt: input.effectiveAt,
    expiresAt: input.expiresAt ?? null,
    jurisdiction: input.jurisdiction,
    unit: input.unit,
    value: input.value,
    royaltyBasisPoints: input.royaltyBasisPoints ?? null,
    quality: input.quality ?? 'APPROVED',
    confidenceBps: input.confidenceBps ?? 8000n,
    provenanceDigest: sha256Canonical(`ref:${input.seed}:${input.value.toString()}`),
    policyCompatibility: input.policyCompatibility ?? true,
    contributionClass: input.contributionClass ?? null,
    valuationMethod: input.valuationMethod ?? null,
    measurementUnit: input.measurementUnit ?? null,
    relatedContributionId: input.relatedContributionId ?? null,
    selfReferential: false,
  });
}

export class InMemoryValuationReferenceDataPort implements ValuationReferenceDataPort {
  private readonly records: ValuationReferenceDatum[];

  constructor(records: readonly ValuationReferenceDatum[] = []) {
    this.records = [...records];
  }

  add(record: ValuationReferenceDatum): void {
    this.records.push(record);
  }

  resolve(query: ReferenceQuery): readonly ValuationReferenceDatum[] {
    return Object.freeze(
      this.records
        .filter((record) => {
          if (!query.sourceClasses.includes(record.sourceClass)) {
            return false;
          }
          if (record.jurisdiction !== 'GLOBAL' && record.jurisdiction !== query.jurisdiction) {
            return false;
          }
          if (record.contributionClass && record.contributionClass !== query.contributionClass) {
            return false;
          }
          if (record.valuationMethod && record.valuationMethod !== query.valuationMethod) {
            return false;
          }
          if (record.measurementUnit && record.measurementUnit !== query.measurementUnit) {
            return false;
          }
          if (record.effectiveAt > query.at) {
            return false;
          }
          if (record.expiresAt && record.expiresAt <= query.at) {
            return false;
          }
          return true;
        })
        .sort((left, right) => left.referenceId.localeCompare(right.referenceId)),
    );
  }
}
