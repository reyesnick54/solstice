// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EconomicClaimRegistry,
  assertMonetizationLockForReconciliation,
  buildCandidateFromObservation,
  canPromoteReconciliationToClaim,
  classifyEventOverlap,
  classifyTemporalOverlap,
  isAggregationTemporalRelationship,
  promoteReconciliationToClaim,
  reconcileProductiveEvents,
  reconcileQuantity,
  temporalWindowContains,
} from './index.ts';
import { asMonetizationContextId } from './monetization-lock.ts';
import {
  WAVE5_DATACENTER,
  WAVE5_ENERGY_500_MWH,
  WAVE5_ENERGY_UNIT,
  WAVE5_FACTORY,
  WAVE5_FACTORY_LINE_A,
  WAVE5_FARM,
  WAVE5_FIXTURE_DAY_END,
  WAVE5_FIXTURE_HOUR_END,
  WAVE5_FIXTURE_NOW,
  WAVE5_LOGISTICS_HUB,
  WAVE5_MINE,
  WAVE5_POWER_PLANT,
  WAVE5_WATER_PLANT,
  wave5AgricultureDigest,
  wave5ComputeDigest,
  wave5EnergyDigest,
  wave5LogisticsDigest,
  wave5ManufacturingDigest,
  wave5ResourcesDigest,
  wave5WaterDigest,
} from './fixtures/wave5-productive.ts';

function registerEnergyObservation(
  registry: EconomicClaimRegistry,
  input: {
    id: string;
    providerId: string;
    sourceClass: string;
    recordId: string;
    quantity?: bigint;
    validFromUtc?: string;
    validUntilUtc?: string | null;
  },
) {
  const quantity = input.quantity ?? WAVE5_ENERGY_500_MWH;
  return registry.registerObservation({
    observationId: input.id,
    economy: 'PRODUCTIVE',
    providerId: input.providerId,
    sourceClass: input.sourceClass,
    providerRecordId: input.recordId,
    payloadDigest: wave5EnergyDigest(input.sourceClass, quantity),
    observedAtUtc: input.validFromUtc ?? WAVE5_FIXTURE_NOW,
    entityMaterial: {
      economy: 'PRODUCTIVE',
      entityKind: 'POWER_PLANT',
      entityCommitment: WAVE5_POWER_PLANT,
    },
    eventMaterial: {
      economicAction: 'ENERGY_GENERATED',
      quantity,
      unit: WAVE5_ENERGY_UNIT,
      validFromUtc: input.validFromUtc ?? WAVE5_FIXTURE_NOW,
      validUntilUtc: input.validUntilUtc ?? WAVE5_FIXTURE_HOUR_END,
      locationCommitment: 'geo:us-tx-wave5',
    },
  });
}

describe('Wave 5 — temporal overlap detection', () => {
  it('detects hourly record inside daily aggregate window', () => {
    const hourly = { validFromUtc: WAVE5_FIXTURE_NOW, validUntilUtc: WAVE5_FIXTURE_HOUR_END };
    const daily = { validFromUtc: WAVE5_FIXTURE_NOW, validUntilUtc: WAVE5_FIXTURE_DAY_END };

    assert.equal(classifyTemporalOverlap(hourly, daily), 'CONTAINED_BY');
    assert.equal(isAggregationTemporalRelationship(hourly, daily), 'COMPONENT_OF');
    assert.equal(temporalWindowContains(daily, hourly), true);
  });

  it('treats adjacent hourly windows as non-overlapping', () => {
    const first = { validFromUtc: WAVE5_FIXTURE_NOW, validUntilUtc: WAVE5_FIXTURE_HOUR_END };
    const second = { validFromUtc: WAVE5_FIXTURE_HOUR_END, validUntilUtc: WAVE5_FIXTURE_DAY_END };
    assert.equal(classifyTemporalOverlap(first, second), 'ADJACENT');
  });
});

describe('Wave 5 — anti-inflation: energy (500 MWh × 5 sources)', () => {
  it('reconciles five corroborating sources to one 500 MWh event, not 2,500 MWh', () => {
    const registry = new EconomicClaimRegistry();
    const providers = [
      { id: 'obs-meter', providerId: 'grid-meter', sourceClass: 'METER', recordId: 'm-1' },
      { id: 'obs-grid', providerId: 'grid-operator', sourceClass: 'GRID_OPERATOR', recordId: 'g-1' },
      { id: 'obs-gov', providerId: 'gov-dataset', sourceClass: 'GOVERNMENT_DATASET', recordId: 'gov-1' },
      { id: 'obs-satellite', providerId: 'satellite-estimate', sourceClass: 'SATELLITE', recordId: 'sat-1' },
      { id: 'obs-sensor', providerId: 'on-site-sensor', sourceClass: 'SENSOR', recordId: 'sen-1' },
    ] as const;

    const observations = [];
    for (const provider of providers) {
      const result = registerEnergyObservation(registry, provider);
      assert.equal(result.ok, true);
      if (result.ok) observations.push(result.value);
    }

    const candidates = observations.map((obs) =>
      buildCandidateFromObservation({
        observation: obs,
        economicAction: 'ENERGY_GENERATED',
        metric: 'energy_generated',
        quantity: WAVE5_ENERGY_500_MWH,
        unit: WAVE5_ENERGY_UNIT,
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'ENERGY',
        geographyCommitment: 'geo:us-tx-wave5',
      }),
    );

    const reconciliation = reconcileProductiveEvents({ candidates });
    assert.equal(reconciliation.ok, true);
    if (!reconciliation.ok) return;

    assert.equal(reconciliation.value.resolutionStatus, 'RESOLVED');
    assert.equal(reconciliation.value.quantityReconciliation?.reconciledQuantity, WAVE5_ENERGY_500_MWH);
    assert.equal(reconciliation.value.quantityReconciliation?.summedQuantity, WAVE5_ENERGY_500_MWH * 5n);
    assert.equal(reconciliation.value.quantityReconciliation?.inflationPrevented, true);
    assert.notEqual(
      reconciliation.value.quantityReconciliation?.reconciledQuantity,
      reconciliation.value.quantityReconciliation?.summedQuantity,
    );
    assert.equal(canPromoteReconciliationToClaim(reconciliation.value), true);

    const claim = promoteReconciliationToClaim(registry, reconciliation.value, {
      claimId: 'claim-wave5-energy',
      economy: 'PRODUCTIVE',
      entityMaterial: {
        economy: 'PRODUCTIVE',
        entityKind: 'POWER_PLANT',
        entityCommitment: WAVE5_POWER_PLANT,
      },
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      categoryCommitment: 'ENERGY',
      methodologyVersion: 'wave5-energy-v1',
    });
    assert.equal(claim.ok, true);
    if (claim.ok) {
      assert.equal(claim.value.quantity, WAVE5_ENERGY_500_MWH);
      assert.equal(claim.value.observationIds.length, 5);
    }

    const lockCheck = assertMonetizationLockForReconciliation(registry, reconciliation.value);
    assert.equal(lockCheck.ok, true);
  });
});

describe('Wave 5 — anti-inflation: manufacturing (ERP + logistics + energy model)', () => {
  it('does not sum 1,000 + 995 + 1,010 into 3,005 units', () => {
    const registry = new EconomicClaimRegistry();
    const quantities = [
      { id: 'obs-erp', sourceClass: 'ERP', quantity: 1000n },
      { id: 'obs-logistics', sourceClass: 'LOGISTICS', quantity: 995n },
      { id: 'obs-energy', sourceClass: 'ENERGY_MODEL', quantity: 1010n },
    ] as const;

    const observations = [];
    for (const item of quantities) {
      const result = registry.registerObservation({
        observationId: item.id,
        economy: 'PRODUCTIVE',
        providerId: item.sourceClass.toLowerCase(),
        sourceClass: item.sourceClass,
        providerRecordId: `${item.id}-rec`,
        payloadDigest: wave5ManufacturingDigest(item.sourceClass, item.quantity),
        observedAtUtc: WAVE5_FIXTURE_NOW,
        entityMaterial: {
          economy: 'PRODUCTIVE',
          entityKind: 'FACTORY',
          entityCommitment: WAVE5_FACTORY,
        },
        eventMaterial: {
          economicAction: 'GOODS_PRODUCED',
          quantity: item.quantity,
          unit: 'unit',
          validFromUtc: WAVE5_FIXTURE_NOW,
          validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        },
      });
      assert.equal(result.ok, true);
      if (result.ok) observations.push(result.value);
    }

    const candidates = observations.map((obs, i) =>
      buildCandidateFromObservation({
        observation: obs,
        economicAction: 'GOODS_PRODUCED',
        metric: 'goods_produced',
        quantity: quantities[i]!.quantity,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'MANUFACTURING',
        batchRunJobId: 'batch-wave5-acme-001',
      }),
    );

    const reconciliation = reconcileProductiveEvents({ candidates });
    assert.equal(reconciliation.ok, true);
    if (!reconciliation.ok) return;

    assert.equal(reconciliation.value.quantityReconciliation?.reconciledQuantity, 1000n);
    assert.equal(reconciliation.value.quantityReconciliation?.summedQuantity, 3005n);
  });
});

describe('Wave 5 — anti-inflation: compute (telemetry + billing + energy estimate)', () => {
  it('clusters 10,000 GPU-hours from three sources into one workload event', () => {
    const registry = new EconomicClaimRegistry();
    const gpuSeconds = 10_000n;
    const sources = [
      { id: 'obs-telemetry', sourceClass: 'DATACENTER_TELEMETRY' },
      { id: 'obs-billing', sourceClass: 'BILLING' },
      { id: 'obs-energy', sourceClass: 'ENERGY_ESTIMATE' },
    ] as const;

    const observations = [];
    for (const source of sources) {
      const result = registry.registerObservation({
        observationId: source.id,
        economy: 'PRODUCTIVE',
        providerId: source.sourceClass.toLowerCase(),
        sourceClass: source.sourceClass,
        providerRecordId: `${source.id}-rec`,
        payloadDigest: wave5ComputeDigest(source.sourceClass, gpuSeconds),
        observedAtUtc: WAVE5_FIXTURE_NOW,
        entityMaterial: {
          economy: 'PRODUCTIVE',
          entityKind: 'COMPUTE_CLUSTER',
          entityCommitment: WAVE5_DATACENTER,
        },
        eventMaterial: {
          economicAction: 'COMPUTE_WORKLOAD',
          quantity: gpuSeconds,
          unit: 'gpu_second',
          validFromUtc: WAVE5_FIXTURE_NOW,
          validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        },
      });
      assert.equal(result.ok, true);
      if (result.ok) observations.push(result.value);
    }

    const candidates = observations.map((obs) =>
      buildCandidateFromObservation({
        observation: obs,
        economicAction: 'COMPUTE_WORKLOAD',
        metric: 'compute_workload',
        quantity: gpuSeconds,
        unit: 'gpu_second',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'COMPUTE',
        batchRunJobId: 'job-wave5-gpu-42',
      }),
    );

    const reconciliation = reconcileProductiveEvents({ candidates });
    assert.equal(reconciliation.ok, true);
    if (!reconciliation.ok) return;

    assert.equal(reconciliation.value.quantityReconciliation?.reconciledQuantity, gpuSeconds);
    assert.equal(reconciliation.value.overlapAssessments.some(
      (a) => a.overlapClass === 'SAME_EVENT_CORROBORATION' || a.overlapClass === 'EXACT_DUPLICATE',
    ), true);
  });
});

describe('Wave 5 — parent/child aggregation reconciliation', () => {
  it('classifies factory total vs production line as AGGREGATE_OF / COMPONENT_OF', () => {
    const registry = new EconomicClaimRegistry();

    const factoryObs = registry.registerObservation({
      observationId: 'obs-factory-total',
      economy: 'PRODUCTIVE',
      providerId: 'factory-erp',
      sourceClass: 'ERP',
      providerRecordId: 'factory-total',
      payloadDigest: wave5ManufacturingDigest('factory-total', 5000n),
      observedAtUtc: WAVE5_FIXTURE_NOW,
      entityMaterial: {
        economy: 'PRODUCTIVE',
        entityKind: 'FACTORY',
        entityCommitment: WAVE5_FACTORY,
      },
      eventMaterial: {
        economicAction: 'GOODS_PRODUCED',
        quantity: 5000n,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      },
    });
    const lineObs = registry.registerObservation({
      observationId: 'obs-line-a',
      economy: 'PRODUCTIVE',
      providerId: 'line-scada',
      sourceClass: 'SCADA',
      providerRecordId: 'line-a',
      payloadDigest: wave5ManufacturingDigest('line-a', 2000n),
      observedAtUtc: WAVE5_FIXTURE_NOW,
      entityMaterial: {
        economy: 'PRODUCTIVE',
        entityKind: 'FACTORY',
        entityCommitment: WAVE5_FACTORY_LINE_A,
      },
      eventMaterial: {
        economicAction: 'GOODS_PRODUCED',
        quantity: 2000n,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      },
    });
    assert.equal(factoryObs.ok, true);
    assert.equal(lineObs.ok, true);
    if (!factoryObs.ok || !lineObs.ok) return;

    const factoryCandidate = buildCandidateFromObservation({
      observation: factoryObs.value,
      economicAction: 'GOODS_PRODUCED',
      metric: 'goods_produced',
      quantity: 5000n,
      unit: 'unit',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      domain: 'MANUFACTURING',
      aggregationLevel: 'AGGREGATE',
    });
    const lineCandidate = buildCandidateFromObservation({
      observation: lineObs.value,
      economicAction: 'GOODS_PRODUCED',
      metric: 'goods_produced',
      quantity: 2000n,
      unit: 'unit',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      domain: 'MANUFACTURING',
      aggregationLevel: 'COMPONENT',
      parentEntityCommitment: WAVE5_FACTORY,
    });

    const overlap = classifyEventOverlap(factoryCandidate, lineCandidate);
    assert.equal(overlap.overlapClass, 'AGGREGATE_OF');
  });
});

describe('Wave 5 — hourly vs daily energy aggregation overlap', () => {
  it('detects COMPONENT_OF relationship between hourly and daily windows', () => {
    const registry = new EconomicClaimRegistry();

    const hourly = registerEnergyObservation(registry, {
      id: 'obs-hourly',
      providerId: 'hourly-meter',
      sourceClass: 'METER',
      recordId: 'h-1',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
    });
    const daily = registerEnergyObservation(registry, {
      id: 'obs-daily',
      providerId: 'daily-aggregate',
      sourceClass: 'GRID_OPERATOR',
      recordId: 'd-1',
      quantity: WAVE5_ENERGY_500_MWH * 24n,
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_DAY_END,
    });
    assert.equal(hourly.ok, true);
    assert.equal(daily.ok, true);
    if (!hourly.ok || !daily.ok) return;

    const hourlyCandidate = buildCandidateFromObservation({
      observation: hourly.value,
      economicAction: 'ENERGY_GENERATED',
      metric: 'energy_generated',
      quantity: WAVE5_ENERGY_500_MWH,
      unit: WAVE5_ENERGY_UNIT,
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      domain: 'ENERGY',
      boundaryStrategy: 'FIXED_INTERVAL',
    });
    const dailyCandidate = buildCandidateFromObservation({
      observation: daily.value,
      economicAction: 'ENERGY_GENERATED',
      metric: 'energy_generated',
      quantity: WAVE5_ENERGY_500_MWH * 24n,
      unit: WAVE5_ENERGY_UNIT,
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_DAY_END,
      domain: 'ENERGY',
      boundaryStrategy: 'FIXED_INTERVAL',
      aggregationLevel: 'AGGREGATE',
    });

    const overlap = classifyEventOverlap(hourlyCandidate, dailyCandidate);
    assert.equal(overlap.overlapClass, 'COMPONENT_OF');
  });
});

describe('Wave 5 — domain adversarial cases', () => {
  it('agriculture: same harvest from satellite and field sensor corroborates once', () => {
    const bushels = 12_000n;
    const registry = new EconomicClaimRegistry();
    for (const source of [
      { id: 'obs-satellite', sourceClass: 'SATELLITE' },
      { id: 'obs-field', sourceClass: 'FIELD_SENSOR' },
    ]) {
      registry.registerObservation({
        observationId: source.id,
        economy: 'PRODUCTIVE',
        providerId: source.sourceClass.toLowerCase(),
        sourceClass: source.sourceClass,
        providerRecordId: source.id,
        payloadDigest: wave5AgricultureDigest(source.sourceClass, bushels),
        observedAtUtc: WAVE5_FIXTURE_NOW,
        entityMaterial: { economy: 'PRODUCTIVE', entityKind: 'FARM', entityCommitment: WAVE5_FARM },
        eventMaterial: {
          economicAction: 'CROP_HARVESTED',
          quantity: bushels,
          unit: 'bushel',
          validFromUtc: WAVE5_FIXTURE_NOW,
          validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        },
      });
    }

    const candidates = ['obs-satellite', 'obs-field'].map((id) => {
      const obs = registry.getObservation(id)!;
      return buildCandidateFromObservation({
        observation: obs,
        economicAction: 'CROP_HARVESTED',
        metric: 'crop_harvested',
        quantity: bushels,
        unit: 'bushel',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'AGRICULTURE',
      });
    });

    const result = reconcileProductiveEvents({ candidates });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.quantityReconciliation?.reconciledQuantity, bushels);
    }
  });

  it('logistics: shipment corroboration does not double-count units', () => {
    const units = 500n;
    const registry = new EconomicClaimRegistry();
    for (const source of [
      { id: 'obs-carrier', sourceClass: 'CARRIER' },
      { id: 'obs-warehouse', sourceClass: 'WAREHOUSE' },
    ]) {
      registry.registerObservation({
        observationId: source.id,
        economy: 'PRODUCTIVE',
        providerId: source.sourceClass.toLowerCase(),
        sourceClass: source.sourceClass,
        providerRecordId: `ship-${source.id}`,
        payloadDigest: wave5LogisticsDigest(source.sourceClass, units),
        observedAtUtc: WAVE5_FIXTURE_NOW,
        entityMaterial: {
          economy: 'PRODUCTIVE',
          entityKind: 'VEHICLE_FLEET',
          entityCommitment: WAVE5_LOGISTICS_HUB,
        },
        eventMaterial: {
          economicAction: 'GOODS_SHIPPED',
          quantity: units,
          unit: 'unit',
          validFromUtc: WAVE5_FIXTURE_NOW,
          validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        },
      });
    }

    const candidates = ['obs-carrier', 'obs-warehouse'].map((id) => {
      const obs = registry.getObservation(id)!;
      return buildCandidateFromObservation({
        observation: obs,
        economicAction: 'GOODS_SHIPPED',
        metric: 'goods_shipped',
        quantity: units,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'LOGISTICS',
        sourceIndependentEventId: 'shipment-wave5-001',
      });
    });

    const result = reconcileProductiveEvents({ candidates });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.quantityReconciliation?.reconciledQuantity, units);
      assert.equal(result.value.quantityReconciliation?.summedQuantity, units * 2n);
      assert.equal(result.value.quantityReconciliation?.inflationPrevented, true);
    }
  });

  it('resources: mine output from operator and government report reconciles once', () => {
    const tonnes = 250n;
    const registry = new EconomicClaimRegistry();
    for (const source of [
      { id: 'obs-operator', sourceClass: 'MINE_OPERATOR' },
      { id: 'obs-gov', sourceClass: 'GOVERNMENT_REPORT' },
    ]) {
      registry.registerObservation({
        observationId: source.id,
        economy: 'PRODUCTIVE',
        providerId: source.sourceClass.toLowerCase(),
        sourceClass: source.sourceClass,
        providerRecordId: source.id,
        payloadDigest: wave5ResourcesDigest(source.sourceClass, tonnes),
        observedAtUtc: WAVE5_FIXTURE_NOW,
        entityMaterial: {
          economy: 'PRODUCTIVE',
          entityKind: 'PRODUCTIVE_ASSET',
          entityCommitment: WAVE5_MINE,
        },
        eventMaterial: {
          economicAction: 'RESOURCE_EXTRACTED',
          quantity: tonnes,
          unit: 'tonne',
          validFromUtc: WAVE5_FIXTURE_NOW,
          validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        },
      });
    }

    const candidates = ['obs-operator', 'obs-gov'].map((id) => {
      const obs = registry.getObservation(id)!;
      return buildCandidateFromObservation({
        observation: obs,
        economicAction: 'RESOURCE_EXTRACTED',
        metric: 'resource_extracted',
        quantity: tonnes,
        unit: 'tonne',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'RESOURCES',
      });
    });

    const result = reconcileProductiveEvents({ candidates });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.quantityReconciliation?.reconciledQuantity, tonnes);
    }
  });

  it('water: treatment plant output from SCADA and billing reconciles once', () => {
    const liters = 1_000_000n;
    const registry = new EconomicClaimRegistry();
    for (const source of [
      { id: 'obs-scada', sourceClass: 'SCADA' },
      { id: 'obs-billing', sourceClass: 'UTILITY_BILLING' },
    ]) {
      registry.registerObservation({
        observationId: source.id,
        economy: 'PRODUCTIVE',
        providerId: source.sourceClass.toLowerCase(),
        sourceClass: source.sourceClass,
        providerRecordId: source.id,
        payloadDigest: wave5WaterDigest(source.sourceClass, liters),
        observedAtUtc: WAVE5_FIXTURE_NOW,
        entityMaterial: {
          economy: 'PRODUCTIVE',
          entityKind: 'PRODUCTIVE_ASSET',
          entityCommitment: WAVE5_WATER_PLANT,
        },
        eventMaterial: {
          economicAction: 'WATER_PRODUCED',
          quantity: liters,
          unit: 'liter',
          validFromUtc: WAVE5_FIXTURE_NOW,
          validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        },
      });
    }

    const candidates = ['obs-scada', 'obs-billing'].map((id) => {
      const obs = registry.getObservation(id)!;
      return buildCandidateFromObservation({
        observation: obs,
        economicAction: 'WATER_PRODUCED',
        metric: 'water_produced',
        quantity: liters,
        unit: 'liter',
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'WATER',
      });
    });

    const result = reconcileProductiveEvents({ candidates });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.quantityReconciliation?.reconciledQuantity, liters);
    }
  });
});

describe('Wave 5 — claim generation and monetization lock', () => {
  it('blocks claim promotion for unresolved reconciliation', () => {
    const registry = new EconomicClaimRegistry();
    const obs1 = registerEnergyObservation(registry, {
      id: 'obs-a', providerId: 'a', sourceClass: 'METER', recordId: 'a-1', quantity: 500n,
    });
    const obs2 = registerEnergyObservation(registry, {
      id: 'obs-b', providerId: 'b', sourceClass: 'GRID', recordId: 'b-1', quantity: 900n,
    });
    assert.equal(obs1.ok, true);
    assert.equal(obs2.ok, true);
    if (!obs1.ok || !obs2.ok) return;

    const candidates = [
      buildCandidateFromObservation({
        observation: obs1.value,
        economicAction: 'ENERGY_GENERATED',
        metric: 'energy_generated',
        quantity: 500n,
        unit: WAVE5_ENERGY_UNIT,
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'ENERGY',
        batchRunJobId: 'hour-a',
      }),
      buildCandidateFromObservation({
        observation: obs2.value,
        economicAction: 'ENERGY_GENERATED',
        metric: 'energy_generated',
        quantity: 900n,
        unit: WAVE5_ENERGY_UNIT,
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'ENERGY',
        batchRunJobId: 'hour-b',
      }),
    ];

    const reconciliation = reconcileProductiveEvents({ candidates });
    assert.equal(reconciliation.ok, true);
    if (!reconciliation.ok) return;

    assert.equal(reconciliation.value.resolutionStatus, 'UNRESOLVED');
    assert.equal(canPromoteReconciliationToClaim(reconciliation.value), false);

    const claim = promoteReconciliationToClaim(registry, reconciliation.value, {
      claimId: 'claim-blocked',
      economy: 'PRODUCTIVE',
      entityMaterial: {
        economy: 'PRODUCTIVE',
        entityKind: 'POWER_PLANT',
        entityCommitment: WAVE5_POWER_PLANT,
      },
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      methodologyVersion: 'wave5-v1',
    });
    assert.equal(claim.ok, false);
  });

  it('prevents bypassing monetization lock via different provider combination', () => {
    const registry = new EconomicClaimRegistry();
    const providers = [
      { id: 'obs-1', sourceClass: 'METER' },
      { id: 'obs-2', sourceClass: 'GRID_OPERATOR' },
    ] as const;

    const observations = [];
    for (const p of providers) {
      const result = registerEnergyObservation(registry, {
        id: p.id,
        providerId: p.sourceClass.toLowerCase(),
        sourceClass: p.sourceClass,
        recordId: `${p.id}-rec`,
      });
      assert.equal(result.ok, true);
      if (result.ok) observations.push(result.value);
    }

    const candidates = observations.map((obs) =>
      buildCandidateFromObservation({
        observation: obs,
        economicAction: 'ENERGY_GENERATED',
        metric: 'energy_generated',
        quantity: WAVE5_ENERGY_500_MWH,
        unit: WAVE5_ENERGY_UNIT,
        validFromUtc: WAVE5_FIXTURE_NOW,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END,
        domain: 'ENERGY',
      }),
    );

    const reconciliation = reconcileProductiveEvents({ candidates });
    assert.equal(reconciliation.ok, true);
    if (!reconciliation.ok) return;

    const claim1 = promoteReconciliationToClaim(registry, reconciliation.value, {
      claimId: 'claim-primary',
      economy: 'PRODUCTIVE',
      entityMaterial: {
        economy: 'PRODUCTIVE',
        entityKind: 'POWER_PLANT',
        entityCommitment: WAVE5_POWER_PLANT,
      },
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      methodologyVersion: 'wave5-v1',
    });
    assert.equal(claim1.ok, true);

    const contextId = asMonetizationContextId('sunrey:productive:settlement:wave5');
    assert.equal(registry.authorizeMonetization('claim-primary', contextId).ok, true);

    const claim2 = promoteReconciliationToClaim(registry, reconciliation.value, {
      claimId: 'claim-bypass-attempt',
      economy: 'PRODUCTIVE',
      entityMaterial: {
        economy: 'PRODUCTIVE',
        entityKind: 'POWER_PLANT',
        entityCommitment: WAVE5_POWER_PLANT,
      },
      economicAction: 'ENERGY_GENERATED',
      validFromUtc: WAVE5_FIXTURE_NOW,
      validUntilUtc: WAVE5_FIXTURE_HOUR_END,
      methodologyVersion: 'wave5-v1',
    });
    assert.equal(claim2.ok, false);
    if (!claim2.ok) {
      assert.equal(claim2.error.code, 'CLUSTER_ALREADY_MONETIZED');
    }
  });
});

describe('Wave 5 — reconcileQuantity unit behavior', () => {
  it('uses median for divergent corroborating quantities', () => {
    const result = reconcileQuantity([
      {
        eventKey: 'key-1' as never,
        canonicalEntityId: 'entity' as never,
        canonicalEventId: 'event' as never,
        economicAction: 'TEST',
        metric: 'test',
        quantity: 995n,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW as never,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END as never,
        domain: 'MANUFACTURING',
        aggregationLevel: 'LEAF',
        observationIds: ['obs-1' as never],
        sourceClasses: ['ERP'],
      },
      {
        eventKey: 'key-1' as never,
        canonicalEntityId: 'entity' as never,
        canonicalEventId: 'event' as never,
        economicAction: 'TEST',
        metric: 'test',
        quantity: 1000n,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW as never,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END as never,
        domain: 'MANUFACTURING',
        aggregationLevel: 'LEAF',
        observationIds: ['obs-2' as never],
        sourceClasses: ['LOGISTICS'],
      },
      {
        eventKey: 'key-1' as never,
        canonicalEntityId: 'entity' as never,
        canonicalEventId: 'event' as never,
        economicAction: 'TEST',
        metric: 'test',
        quantity: 1010n,
        unit: 'unit',
        validFromUtc: WAVE5_FIXTURE_NOW as never,
        validUntilUtc: WAVE5_FIXTURE_HOUR_END as never,
        domain: 'MANUFACTURING',
        aggregationLevel: 'LEAF',
        observationIds: ['obs-3' as never],
        sourceClasses: ['ENERGY_MODEL'],
      },
    ]);
    assert.equal(result.reconciledQuantity, 1000n);
    assert.equal(result.summedQuantity, 3005n);
    assert.equal(result.inflationPrevented, true);
  });
});
