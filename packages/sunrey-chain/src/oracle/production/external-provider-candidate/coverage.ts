import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../../../productive/types.ts';
import { familyForSourceCategory } from '../economic-data-fabric/routing.ts';
import { CANONICAL_FAMILY_REGISTRY } from '../economic-data-fabric/registry.ts';
import { lookupUnit } from '../../../units/convert.ts';
import {
  EXTERNAL_PROVIDER_CANDIDATE_ID,
  EXTERNAL_PROVIDER_CANDIDATE_VERSION,
  type CandidateCoverageRow,
  type ExternalEconomicOracleProviderCandidateProfile,
  type ProviderCandidateCoverageReport,
} from './types.ts';

const CATEGORY_UNITS: Readonly<Partial<Record<ProductiveCategory, string>>> = Object.freeze({
  ENERGY: 'MWh',
  COMPUTE: 'compute_s',
  AI_COMPUTE: 'gpu_s',
  MANUFACTURING: 'units_produced',
  LOGISTICS_TRANSPORTATION: 'tonne_km',
  STORAGE: 'm3',
  MINERALS_RAW_MATERIALS: 'tonne',
  FOOD_AGRICULTURE: 'kg',
  WATER: 'm3',
  REAL_ESTATE_USE: 'm2_hour',
  INFRASTRUCTURE: 'facility_hour',
  BANDWIDTH_COMMUNICATIONS: 'GB',
  GOODS: 'units_produced',
  SERVICES: 'service_hour',
  AUTOMATED_MACHINE_OUTPUT: 'units_produced',
});

export function buildProviderCandidateCoverageReport(
  profiles: readonly ExternalEconomicOracleProviderCandidateProfile[] = [],
): ProviderCandidateCoverageReport {
  const rows: CandidateCoverageRow[] = PRODUCTIVE_CATEGORIES.map((productiveCategory) => {
    const unit = CATEGORY_UNITS[productiveCategory];
    const family = CANONICAL_FAMILY_REGISTRY.list().find((row) => row.supportedProductiveCategories.includes(productiveCategory));
    const hasProfile = profiles.some((profile) => profile.productiveCategories.includes(productiveCategory));
    return Object.freeze({
      productiveCategory,
      candidateProfileArchitectureSupported: true,
      sourceFamilyMappingSupported: family !== undefined,
      unitPathSupported: unit !== undefined && lookupUnit(unit) !== undefined,
      certificationPathSupported: true,
      endpointBlueprintSupported: true,
      realExternalProviderConfigured: false,
      externalEvidencePresent: hasProfile && profiles.some((profile) => profile.commercialAgreementEvidenceRef !== null && profile.state === 'CONFORMANCE_PASSED'),
    });
  });
  rows.push(
    Object.freeze({
      productiveCategory: 'REFERENCE_DATA',
      candidateProfileArchitectureSupported: true,
      sourceFamilyMappingSupported: familyForSourceCategory('reference_price') === 'REFERENCE_DATA',
      unitPathSupported: true,
      certificationPathSupported: true,
      endpointBlueprintSupported: true,
      realExternalProviderConfigured: false,
      externalEvidencePresent: false,
    }),
  );
  return Object.freeze({
    reportId: EXTERNAL_PROVIDER_CANDIDATE_ID,
    version: EXTERNAL_PROVIDER_CANDIDATE_VERSION,
    rows: Object.freeze(rows),
    realExternalProviderConfigured: false,
    realNetworkCalled: false,
    productionActive: false,
  });
}
