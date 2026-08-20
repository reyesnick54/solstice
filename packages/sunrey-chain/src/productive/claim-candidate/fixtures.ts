import type { FactType, QualityStatus, UnitCode, VerifiedEconomicFact } from '../../oracle/types.ts';
import { mappingById } from '../../oracle/source-taxonomy/registry.ts';
import type { SourceProductiveMapping } from '../../oracle/source-taxonomy/types.ts';
import { fixtureObject, fixtureRight } from '../fixtures.ts';
import type { ProductiveEconomicObject } from '../objects.ts';
import type { ClaimType, GeographyRef, MeasurementPeriod, ProductiveCategory } from '../types.ts';
import type { ClaimCandidateBuildInput } from './types.ts';

export const CANDIDATE_NOW = 1_800_000_000n;

export const CANDIDATE_PERIOD: MeasurementPeriod = Object.freeze({
  validFromUnixSeconds: 1_799_000_000n,
  validUntilUnixSeconds: 1_800_000_000n,
  epoch: 1,
});

export function fixtureVerifiedFact(input: {
  readonly factId?: string | undefined;
  readonly subject: string;
  readonly unit: UnitCode;
  readonly quantity?: bigint | undefined;
  readonly qualityStatus?: QualityStatus | undefined;
  readonly validUntilUnix?: bigint | undefined;
  readonly feedId?: string | undefined;
}): VerifiedEconomicFact {
  return Object.freeze({
    schemaVersion: 1,
    factId: input.factId ?? `fact.${input.subject}`,
    feedId: input.feedId ?? `feed.${input.subject}`,
    subject: input.subject,
    aggregatedValue: Object.freeze({
      schemaVersion: 1 as const,
      mantissa: input.quantity ?? 1_200n,
      scale: 0,
      unit: input.unit,
    }),
    sourceObservationIds: Object.freeze([`obs.${input.subject}.1`, `obs.${input.subject}.2`, `obs.${input.subject}.3`]),
    aggregationPolicy: 'MEDIAN',
    observationWindow: Object.freeze({
      startUnix: 1_799_000_000n,
      endUnix: 1_800_500_000n,
    }),
    validUntilUnix: input.validUntilUnix ?? 1_801_000_000n,
    qualityStatus: input.qualityStatus ?? 'VERIFIED',
    finalizedHeight: 8,
    conflictReason: input.qualityStatus === 'CONFLICTED' ? 'MATERIAL_DISAGREEMENT' : null,
  });
}

export function requireMapping(mappingId: string, mappingVersion = 1): SourceProductiveMapping {
  const found = mappingById(mappingId, mappingVersion);
  if (!found) {
    throw new Error(`missing mapping ${mappingId}@${mappingVersion}`);
  }
  return found;
}

export function energyBuildInput(overrides?: {
  readonly object?: ProductiveEconomicObject | undefined;
  readonly subject?: string | undefined;
  readonly qualityStatus?: QualityStatus | undefined;
  readonly unit?: UnitCode | undefined;
  readonly claimType?: ClaimType | undefined;
  readonly geography?: GeographyRef | null | undefined;
  readonly measurementPeriod?: MeasurementPeriod | null | undefined;
  readonly rightsReferences?: readonly string[] | undefined;
  readonly attributionPolicyRef?: string | null | undefined;
  readonly requireApprovedAttributionPolicy?: boolean | undefined;
  readonly mapping?: SourceProductiveMapping | undefined;
  readonly nowUnix?: bigint | undefined;
  readonly factType?: FactType | undefined;
  readonly sourceCategory?: string | undefined;
}): ClaimCandidateBuildInput {
  const object = overrides?.object ?? fixtureObject({ objectId: 'obj.solar.alpha', category: 'ENERGY', unitSchema: 'kWh' });
  const subject = overrides?.subject ?? object.objectId;
  return {
    object,
    fact: fixtureVerifiedFact({
      subject,
      unit: overrides?.unit ?? 'kWh',
      qualityStatus: overrides?.qualityStatus,
    }),
    mapping: overrides?.mapping ?? requireMapping('spm.energy.ENERGY_PRODUCTION.ENERGY', 2),
    sourceCategory: overrides?.sourceCategory ?? 'energy',
    factType: overrides?.factType ?? 'ENERGY_PRODUCTION',
    proposedClaimType: overrides?.claimType ?? 'OUTPUT',
    nowUnix: overrides?.nowUnix ?? CANDIDATE_NOW,
    measurementPeriod: overrides?.measurementPeriod === undefined ? CANDIDATE_PERIOD : overrides.measurementPeriod,
    geography: overrides?.geography === undefined ? object.geography : overrides.geography,
    rightsReferences: overrides?.rightsReferences ?? [object.rightsReference],
    sourceId: 'src.energy.sim',
    attributionPolicyRef: overrides?.attributionPolicyRef ?? null,
    requireApprovedAttributionPolicy: overrides?.requireApprovedAttributionPolicy === true,
    quorumCount: 3,
  };
}

export function pathBuildInput(input: {
  readonly objectId: string;
  readonly category: ProductiveCategory;
  readonly mappingId: string;
  readonly mappingVersion?: number | undefined;
  readonly sourceCategory: string;
  readonly factType: FactType;
  readonly unit: UnitCode;
  readonly claimType: ClaimType;
  readonly unitSchema: string;
}): ClaimCandidateBuildInput {
  const object = fixtureObject({ objectId: input.objectId, category: input.category, unitSchema: input.unitSchema });
  return {
    object,
    fact: fixtureVerifiedFact({ subject: object.objectId, unit: input.unit }),
    mapping: requireMapping(input.mappingId, input.mappingVersion ?? 1),
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    proposedClaimType: input.claimType,
    nowUnix: CANDIDATE_NOW,
    measurementPeriod: CANDIDATE_PERIOD,
    geography: object.geography,
    rightsReferences: [object.rightsReference],
    sourceId: `src.${input.sourceCategory}.sim`,
    attributionPolicyRef: null,
    requireApprovedAttributionPolicy: false,
    quorumCount: 3,
  };
}

export { fixtureObject, fixtureRight };
