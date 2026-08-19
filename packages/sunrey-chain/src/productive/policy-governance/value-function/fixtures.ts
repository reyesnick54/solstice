/**
 * Engineering-simulation fixtures for the Productive Value engine.
 */

import { WEIGHT_SCALE, type ClaimType, type ProductiveCategory } from '../../types.ts';
import type { VerifiedProductiveContribution } from '../../verification.ts';
import {
  ATTRIBUTION_SHARE_SCALE,
  type GeographicContextKind,
  type ProductiveAttributionDecision,
  type ProductiveValueInput,
  type ProductiveValueReferenceFact,
  type RealizationState,
} from './types.ts';

const PERIOD = Object.freeze({
  validFromUnixSeconds: 1_799_000_000n,
  validUntilUnixSeconds: 1_800_000_000n,
  epoch: 1,
});

const GEO = Object.freeze({ geographyId: 'grid.west', jurisdiction: 'SIMULATION' });

export function engineContribution(
  category: ProductiveCategory,
  overrides: Partial<VerifiedProductiveContribution> = {},
): VerifiedProductiveContribution {
  const defaults: Record<ProductiveCategory, Pick<VerifiedProductiveContribution, 'quantity' | 'unit' | 'normalizedQuantity' | 'baseUnitId' | 'claimType' | 'objectId'>> = {
    ENERGY: { quantity: 1_200n, unit: 'kWh', normalizedQuantity: 1_200_000n, baseUnitId: 'Wh', claimType: 'OUTPUT', objectId: 'obj.solar.1' },
    AI_COMPUTE: { quantity: 7_200n, unit: 'gpu_s', normalizedQuantity: 7_200n, baseUnitId: 'gpu_s', claimType: 'USAGE', objectId: 'obj.gpu.1' },
    MANUFACTURING: { quantity: 10n, unit: 'UNIT', normalizedQuantity: 10n, baseUnitId: 'UNIT', claimType: 'OUTPUT', objectId: 'obj.factory.1' },
    LOGISTICS_TRANSPORTATION: { quantity: 100n, unit: 't_km', normalizedQuantity: 100n, baseUnitId: 't_km', claimType: 'DELIVERY', objectId: 'obj.fleet.1' },
    WATER: { quantity: 10_000n, unit: 'L', normalizedQuantity: 10_000n, baseUnitId: 'L', claimType: 'OUTPUT', objectId: 'obj.basin.1' },
    SERVICES: { quantity: 4n, unit: 'service_hour', normalizedQuantity: 4n, baseUnitId: 'service_hour', claimType: 'USAGE', objectId: 'obj.service.1' },
    FOOD_AGRICULTURE: { quantity: 2_000n, unit: 'g', normalizedQuantity: 2_000n, baseUnitId: 'g', claimType: 'OUTPUT', objectId: 'obj.farm.1' },
    MINERALS_RAW_MATERIALS: { quantity: 2_000_000n, unit: 'g', normalizedQuantity: 2_000_000n, baseUnitId: 'g', claimType: 'OUTPUT', objectId: 'obj.mine.1' },
    REAL_ESTATE_USE: { quantity: 7_200n, unit: 'm2_s', normalizedQuantity: 7_200n, baseUnitId: 'm2_s', claimType: 'USAGE', objectId: 'obj.space.1' },
    COMPUTE: { quantity: 3_600n, unit: 'cpu_s', normalizedQuantity: 3_600n, baseUnitId: 'cpu_s', claimType: 'USAGE', objectId: 'obj.cpu.1' },
    STORAGE: { quantity: 7_200n, unit: 'L_s', normalizedQuantity: 7_200n, baseUnitId: 'L_s', claimType: 'USAGE', objectId: 'obj.store.1' },
    BANDWIDTH_COMMUNICATIONS: { quantity: 2_000_000_000n, unit: 'B', normalizedQuantity: 2_000_000_000n, baseUnitId: 'B', claimType: 'OUTPUT', objectId: 'obj.net.1' },
    INFRASTRUCTURE: { quantity: 48n, unit: 'facility_hour', normalizedQuantity: 48n, baseUnitId: 'facility_hour', claimType: 'OUTPUT', objectId: 'obj.facility.1' },
    GOODS: { quantity: 4n, unit: 'UNIT', normalizedQuantity: 4n, baseUnitId: 'UNIT', claimType: 'OUTPUT', objectId: 'obj.goods.1' },
    AUTOMATED_MACHINE_OUTPUT: { quantity: 7_200n, unit: 'machine_s', normalizedQuantity: 7_200n, baseUnitId: 'machine_s', claimType: 'OUTPUT', objectId: 'obj.robot.1' },
  };
  const base = defaults[category];
  return Object.freeze({
    schemaVersion: 2,
    contributionId: `c.${category.toLowerCase()}.1`,
    claimId: `claim.${category.toLowerCase()}.1`,
    objectId: base.objectId,
    claimType: base.claimType,
    category,
    quantity: base.quantity,
    unit: base.unit,
    normalizedQuantity: base.normalizedQuantity,
    baseUnitId: base.baseUnitId,
    measurementPeriod: PERIOD,
    geography: GEO,
    oracleFactIds: ['fact.1', 'fact.2', 'fact.3'],
    rightsReferences: ['right.1'],
    controller: `ctl.${category.toLowerCase()}.1`,
    fingerprint: `fp.${category.toLowerCase()}.1`,
    fingerprintVersion: 'PRODUCTIVE_FINGERPRINT_V2',
    upstreamContributionIds: [],
    downstreamContributionIds: [],
    status: 'ELIGIBLE',
    qualityFactor: WEIGHT_SCALE,
    normalizationConstitutionVersion: 'sunrey.economic-unit.normalization.v1',
    normalizationReceiptId: `norm.${category.toLowerCase()}.1`,
    canonicalUnit: base.baseUnitId,
    ...overrides,
  });
}

export function engineAttribution(
  category: ProductiveCategory,
  shareNumerator = ATTRIBUTION_SHARE_SCALE,
): ProductiveAttributionDecision {
  const contribution = engineContribution(category);
  return Object.freeze({
    decisionId: `attr.${category.toLowerCase()}.1`,
    policyId: 'moonrey.attribution.simulation.v1',
    policyVersion: '1',
    eventId: `event.${category.toLowerCase()}.1`,
    claimId: contribution.claimId,
    contributionId: contribution.contributionId,
    share: { numerator: shareNumerator, denominator: ATTRIBUTION_SHARE_SCALE },
    availableShare: { numerator: shareNumerator, denominator: ATTRIBUTION_SHARE_SCALE },
    authoritative: true,
    reconciled: true,
  });
}

export function engineReferenceFact(
  factType: ProductiveValueReferenceFact['factType'],
  overrides: Partial<ProductiveValueReferenceFact> = {},
): ProductiveValueReferenceFact {
  return Object.freeze({
    factId: `ref.${factType}`,
    factType,
    sourceQuorumEvidence: ['oracle.1', 'oracle.2', 'oracle.3'],
    measurementPeriod: PERIOD,
    geography: GEO,
    freshnessEpochs: 0,
    quality: WEIGHT_SCALE,
    policyCompatible: true,
    verified: true,
    consensusHttpCall: false,
    rawHttpData: false,
    moonreyMarketPrice: false,
    socialMediaSentiment: false,
    providerSelfReportedAlone: false,
    ...overrides,
  });
}

const SEMANTICS: Record<ProductiveCategory, string> = {
  ENERGY: 'energy_output',
  AI_COMPUTE: 'gpu_time',
  MANUFACTURING: 'units_produced',
  LOGISTICS_TRANSPORTATION: 'tonne_km',
  WATER: 'water_output',
  SERVICES: 'completed_service',
  FOOD_AGRICULTURE: 'harvest_output',
  MINERALS_RAW_MATERIALS: 'extracted_output',
  REAL_ESTATE_USE: 'occupied_use',
  COMPUTE: 'cpu_time',
  STORAGE: 'occupied_storage',
  BANDWIDTH_COMMUNICATIONS: 'transferred_bytes',
  INFRASTRUCTURE: 'facility_service',
  GOODS: 'goods_identity',
  AUTOMATED_MACHINE_OUTPUT: 'machine_output',
};

const REALIZATION: Record<ProductiveCategory, RealizationState> = {
  ENERGY: 'ACTUAL_OUTPUT',
  AI_COMPUTE: 'ACTUAL_OUTPUT',
  MANUFACTURING: 'VERIFIED_DELIVERY',
  LOGISTICS_TRANSPORTATION: 'VERIFIED_DELIVERY',
  WATER: 'ACTUAL_OUTPUT',
  SERVICES: 'COMPLETED_ECONOMIC_SERVICE',
  FOOD_AGRICULTURE: 'ACTUAL_OUTPUT',
  MINERALS_RAW_MATERIALS: 'ACTUAL_OUTPUT',
  REAL_ESTATE_USE: 'COMPLETED_ECONOMIC_SERVICE',
  COMPUTE: 'ACTUAL_OUTPUT',
  STORAGE: 'ACTUAL_OUTPUT',
  BANDWIDTH_COMMUNICATIONS: 'ACTUAL_OUTPUT',
  INFRASTRUCTURE: 'ACTUAL_OUTPUT',
  GOODS: 'VERIFIED_DELIVERY',
  AUTOMATED_MACHINE_OUTPUT: 'ACTUAL_OUTPUT',
};

const GEO_KIND: Partial<Record<ProductiveCategory, GeographicContextKind>> = {
  ENERGY: 'VERIFIED_GRID_SCARCITY',
  WATER: 'WATER_BASIN_AVAILABILITY',
  LOGISTICS_TRANSPORTATION: 'LOGISTICS_CORRIDOR_CONGESTION',
  MINERALS_RAW_MATERIALS: 'REGIONAL_RESOURCE_AVAILABILITY',
};

function factsFor(category: ProductiveCategory): ProductiveValueReferenceFact[] {
  const facts = [engineReferenceFact('QUALITY'), engineReferenceFact('FRESHNESS')];
  if (category === 'ENERGY' || category === 'AI_COMPUTE' || category === 'WATER' || category === 'COMPUTE' || category === 'STORAGE') {
    facts.push(
      engineReferenceFact('UTILIZATION', { quantity: { numerator: 25n, denominator: 100n } }),
      engineReferenceFact('CAPACITY', { quantity: { numerator: 100n, denominator: 1n }, objectId: engineContribution(category).objectId }),
    );
  }
  if (category === 'ENERGY' || category === 'WATER' || category === 'LOGISTICS_TRANSPORTATION' || category === 'MINERALS_RAW_MATERIALS') {
    facts.push(
      engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 100n, denominator: 1n } }),
      engineReferenceFact('REGIONAL_DEMAND_PROXY', { quantity: { numerator: 100n, denominator: 1n } }),
    );
  }
  if (category === 'WATER') {
    facts.push(engineReferenceFact('AVAILABILITY', { quantity: { numerator: 100n, denominator: 1n } }));
  }
  if (category === 'MANUFACTURING' || category === 'LOGISTICS_TRANSPORTATION' || category === 'GOODS' || category === 'INFRASTRUCTURE') {
    facts.push(engineReferenceFact('DELIVERY_STATE'));
  }
  return facts;
}

export function engineValueInput(
  category: ProductiveCategory,
  overrides: Partial<ProductiveValueInput> = {},
): ProductiveValueInput {
  const contribution = engineContribution(category, overrides.contribution);
  const decision = overrides.attributionDecision ?? engineAttribution(category);
  const geographyKind = GEO_KIND[category];
  return {
    contribution,
    measurementReference: {
      unitId: contribution.baseUnitId,
      constitutionVersion: 'sunrey.economic-unit.normalization.v1',
      notUniversalPhysicalUnit: true,
    },
    normalizationReceipt: {
      receiptId: contribution.normalizationReceiptId ?? `norm.${category.toLowerCase()}.1`,
      conversionVersion: 'sunrey.economic-unit.normalization.v1',
      exact: true,
      lossy: false,
      sourceUnit: contribution.unit,
      targetUnit: contribution.baseUnitId,
    },
    event: {
      eventId: decision.eventId,
      identityVersion: '1',
      category,
      objectId: contribution.objectId,
      measurementPeriod: PERIOD,
      eventFingerprint: `evfp.${category.toLowerCase()}.1`,
    },
    attributionDecision: decision,
    availableAttributionShare: decision.availableShare,
    valueFunctionPolicyId: 'moonrey.productive-value-function.simulation.v1',
    valueFunctionPolicyVersion: 1,
    referenceFacts: factsFor(category),
    jurisdiction: 'SIMULATION',
    geography: GEO,
    measurementPeriod: PERIOD,
    oracleQuality: WEIGHT_SCALE,
    oracleProvenance: ['oracle.1', 'oracle.2', 'oracle.3'],
    realizationState: REALIZATION[category],
    claimOutputState: contribution.claimType === 'DELIVERY' || REALIZATION[category] === 'VERIFIED_DELIVERY'
      ? 'DELIVERED_OUTPUT'
      : REALIZATION[category] === 'COMPLETED_ECONOMIC_SERVICE'
        ? 'COMPLETED_SERVICE'
        : 'VERIFIED_OUTPUT',
    rawProviderPayload: undefined,
    eventFingerprint: `evfp.${category.toLowerCase()}.1`,
    measurementSemantic: SEMANTICS[category],
    evaluatedAt: '2026-08-19T00:00:00.000Z',
    freshnessAgeEpochs: 0n,
    policyMaxAgeEpochs: 4n,
    ...(geographyKind ? { geographyContextKind: geographyKind } : {}),
    utilization:
      category === 'ENERGY' || category === 'AI_COMPUTE' || category === 'WATER'
        ? {
            actual: 80n,
            basis: 100n,
            objectId: contribution.objectId,
            geography: GEO,
            measurementPeriod: PERIOD,
            basisFreshnessEpochs: 0,
            independentlyEvidenced: true,
          }
        : undefined,
    ...overrides,
  };
}

export type { ClaimType };
