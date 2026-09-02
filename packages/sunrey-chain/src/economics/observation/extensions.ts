/**
 * Wave 4 — domain-specific observation extensions.
 *
 * Domain metadata lives in typed extensions rather than bloating the
 * shared envelope with every domain's fields.
 */

import type { EconomicDomain } from './types.ts';

export const DOMAIN_EXTENSION_SCHEMA = 'sunrey.economic-observation.extension.v1' as const;

export type EnergyExtension = {
  readonly kind: 'ENERGY';
  readonly generationType: string | null;
  readonly fuelType: string | null;
  readonly gridInterconnection: string | null;
  readonly capacityFactor: string | null;
};

export type ComputeExtension = {
  readonly kind: 'COMPUTE';
  readonly acceleratorType: string | null;
  readonly workloadClass: string | null;
  readonly modelFamily: string | null;
  readonly tokenDirection: 'INPUT' | 'OUTPUT' | 'BOTH' | null;
};

export type ManufacturingExtension = {
  readonly kind: 'MANUFACTURING';
  readonly productSku: string | null;
  readonly productionLine: string | null;
  readonly defectRate: string | null;
};

export type AgricultureExtension = {
  readonly kind: 'AGRICULTURE';
  readonly cropType: string | null;
  readonly harvestSeason: string | null;
  readonly irrigationSource: string | null;
};

export type ResearchExtension = {
  readonly kind: 'RESEARCH';
  readonly publicationId: string | null;
  readonly doi: string | null;
  readonly journal: string | null;
  readonly peerReviewed: boolean | null;
};

export type WorkforceExtension = {
  readonly kind: 'WORKFORCE';
  readonly occupationCode: string | null;
  readonly employmentType: string | null;
  readonly industrySector: string | null;
  readonly educationLevel: string | null;
};

export type HealthPublicExtension = {
  readonly kind: 'HEALTH_PUBLIC';
  readonly conditionCode: string | null;
  readonly surveillanceSystem: string | null;
  readonly populationDenominator: string | null;
};

export type GeospatialExtension = {
  readonly kind: 'GEOSPATIAL';
  readonly featureType: string | null;
  readonly crs: string | null;
  readonly resolutionMeters: number | null;
};

export type GenericExtension = {
  readonly kind: 'GENERIC';
  readonly fields: Readonly<Record<string, string>>;
};

export type DomainExtension =
  | EnergyExtension
  | ComputeExtension
  | ManufacturingExtension
  | AgricultureExtension
  | ResearchExtension
  | WorkforceExtension
  | HealthPublicExtension
  | GeospatialExtension
  | GenericExtension;

export function extensionForDomain(
  domain: EconomicDomain,
  fields: Record<string, string | boolean | number | null>,
): DomainExtension | null {
  switch (domain) {
    case 'ENERGY':
      return Object.freeze({
        kind: 'ENERGY',
        generationType: str(fields.generationType),
        fuelType: str(fields.fuelType),
        gridInterconnection: str(fields.gridInterconnection),
        capacityFactor: str(fields.capacityFactor),
      });
    case 'COMPUTE':
      return Object.freeze({
        kind: 'COMPUTE',
        acceleratorType: str(fields.acceleratorType),
        workloadClass: str(fields.workloadClass),
        modelFamily: str(fields.modelFamily),
        tokenDirection: tokenDir(fields.tokenDirection),
      });
    case 'MANUFACTURING':
      return Object.freeze({
        kind: 'MANUFACTURING',
        productSku: str(fields.productSku),
        productionLine: str(fields.productionLine),
        defectRate: str(fields.defectRate),
      });
    case 'AGRICULTURE':
      return Object.freeze({
        kind: 'AGRICULTURE',
        cropType: str(fields.cropType),
        harvestSeason: str(fields.harvestSeason),
        irrigationSource: str(fields.irrigationSource),
      });
    case 'RESEARCH':
      return Object.freeze({
        kind: 'RESEARCH',
        publicationId: str(fields.publicationId),
        doi: str(fields.doi),
        journal: str(fields.journal),
        peerReviewed: typeof fields.peerReviewed === 'boolean' ? fields.peerReviewed : null,
      });
    case 'WORKFORCE':
      return Object.freeze({
        kind: 'WORKFORCE',
        occupationCode: str(fields.occupationCode),
        employmentType: str(fields.employmentType),
        industrySector: str(fields.industrySector),
        educationLevel: str(fields.educationLevel),
      });
    case 'HEALTH_PUBLIC':
      return Object.freeze({
        kind: 'HEALTH_PUBLIC',
        conditionCode: str(fields.conditionCode),
        surveillanceSystem: str(fields.surveillanceSystem),
        populationDenominator: str(fields.populationDenominator),
      });
    case 'GEOSPATIAL':
      return Object.freeze({
        kind: 'GEOSPATIAL',
        featureType: str(fields.featureType),
        crs: str(fields.crs),
        resolutionMeters: typeof fields.resolutionMeters === 'number' ? fields.resolutionMeters : null,
      });
    default:
      if (Object.keys(fields).length === 0) return null;
      const generic: Record<string, string> = {};
      for (const [key, val] of Object.entries(fields)) {
        if (val !== null && val !== undefined) generic[key] = String(val);
      }
      return Object.freeze({ kind: 'GENERIC', fields: Object.freeze(generic) });
  }
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function tokenDir(value: unknown): 'INPUT' | 'OUTPUT' | 'BOTH' | null {
  if (value === 'INPUT' || value === 'OUTPUT' || value === 'BOTH') return value;
  return null;
}

export function extensionSchemaVersionFor(domain: EconomicDomain): string {
  return `${DOMAIN_EXTENSION_SCHEMA}.${domain.toLowerCase()}`;
}
