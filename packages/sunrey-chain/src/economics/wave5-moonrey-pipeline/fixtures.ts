// @ts-nocheck
/**
 * Wave 5 — Development fixtures for MoonRey monetary pipeline scenarios.
 */

import type { ProductiveCategory } from '../../productive/types.ts';
import type { VerifiedProductiveContribution } from '../../productive/verification.ts';
import {
  fixtureAttribution,
  fixtureContribution,
  fixtureEvent,
  fixtureProductiveValueResult,
} from '../../productive/policy-governance/value-settlement/fixtures.ts';
import { computeProductiveValueDigest } from '../../productive/policy-governance/value-settlement/digest.ts';
import type { ProductiveValueResult } from '../../productive/policy-governance/value-settlement/types.ts';
import { buildInformationConsensusReceipt } from './information-consensus.ts';
import type { InformationConsensusReceipt } from './types.ts';

export type DevProductiveScenario = {
  readonly category: ProductiveCategory;
  readonly suffix: string;
  readonly contribution: VerifiedProductiveContribution;
  readonly event: ReturnType<typeof fixtureEvent>;
  readonly attribution: ReturnType<typeof fixtureAttribution>;
  readonly gpuvResult: ProductiveValueResult;
  readonly informationConsensus: InformationConsensusReceipt;
  readonly observationIds: readonly string[];
  readonly providerIds: readonly string[];
};

const SCENARIO_CONFIG: Record<
  'ENERGY' | 'COMPUTE' | 'MANUFACTURING',
  {
    readonly suffix: string;
    readonly quantity: bigint;
    readonly unit: string;
    readonly normalizedQuantity: bigint;
    readonly baseUnitId: string;
    readonly gpuv: bigint;
    readonly providers: readonly [string, string, string];
    readonly observations: readonly [string, string, string];
  }
> = {
  ENERGY: {
    suffix: 'renewable',
    quantity: 1_200n,
    unit: 'kWh',
    normalizedQuantity: 1_200_000n,
    baseUnitId: 'Wh',
    gpuv: 10_000n,
    providers: ['energi-data-service', 'uk-carbon-intensity', 'national-grid-eso'],
    observations: ['obs.energy.1', 'obs.energy.2', 'obs.energy.3'],
  },
  COMPUTE: {
    suffix: 'workload',
    quantity: 3_600n,
    unit: 'cpu_s',
    normalizedQuantity: 3_600n,
    baseUnitId: 'cpu_s',
    gpuv: 8_500n,
    providers: ['fixture-compute-a', 'fixture-compute-b', 'fixture-compute-c'],
    observations: ['obs.compute.1', 'obs.compute.2', 'obs.compute.3'],
  },
  MANUFACTURING: {
    suffix: 'output',
    quantity: 10n,
    unit: 'UNIT',
    normalizedQuantity: 10n,
    baseUnitId: 'UNIT',
    gpuv: 12_000n,
    providers: ['fixture-mfg-a', 'fixture-mfg-b', 'fixture-mfg-c'],
    observations: ['obs.mfg.1', 'obs.mfg.2', 'obs.mfg.3'],
  },
};

function buildScenario(category: 'ENERGY' | 'COMPUTE' | 'MANUFACTURING'): DevProductiveScenario {
  const cfg = SCENARIO_CONFIG[category];
  const contribution = fixtureContribution({
    contributionId: `c.${cfg.suffix}.wave5`,
    claimId: `claim.${cfg.suffix}.wave5`,
    objectId: `obj.${cfg.suffix}.wave5`,
    category,
    quantity: cfg.quantity,
    unit: cfg.unit,
    normalizedQuantity: cfg.normalizedQuantity,
    baseUnitId: cfg.baseUnitId,
    controller: `ctl.${cfg.suffix}.wave5`,
    fingerprint: `fp.${cfg.suffix}.wave5`,
    normalizationReceiptId: `norm.${cfg.suffix}.wave5`,
    oracleFactIds: [`fact.${cfg.suffix}.1`, `fact.${cfg.suffix}.2`, `fact.${cfg.suffix}.3`],
  });
  const event = fixtureEvent(contribution, {
    eventId: `event.${cfg.suffix}.wave5`,
    eventFingerprint: `efp.${cfg.suffix}.wave5`,
  });
  const attribution = fixtureAttribution(contribution, event.eventId, 400_000n);
  const gpuvResult = fixtureProductiveValueResult({
    contribution,
    event,
    attribution,
    productiveValueQuantity: cfg.gpuv,
    productiveValueId: `pvr.${cfg.suffix}.wave5`,
  });
  const consensusResult = buildInformationConsensusReceipt({
    receiptId: `icr.${cfg.suffix}.wave5`,
    observationIds: cfg.observations,
    providerIds: cfg.providers,
    finalizedAtUtc: '2026-09-01T12:00:00.000Z',
  });
  if ('ok' in consensusResult && consensusResult.ok === false) {
    throw new Error(`fixture consensus failed: ${consensusResult.code}`);
  }
  return Object.freeze({
    category,
    suffix: cfg.suffix,
    contribution,
    event,
    attribution,
    gpuvResult,
    informationConsensus: consensusResult as InformationConsensusReceipt,
    observationIds: cfg.observations,
    providerIds: cfg.providers,
  });
}

export function renewableEnergyScenario(): DevProductiveScenario {
  return buildScenario('ENERGY');
}

export function computeWorkloadScenario(): DevProductiveScenario {
  return buildScenario('COMPUTE');
}

export function manufacturingOutputScenario(): DevProductiveScenario {
  return buildScenario('MANUFACTURING');
}

export function allDevScenarios(): readonly DevProductiveScenario[] {
  return Object.freeze([
    renewableEnergyScenario(),
    computeWorkloadScenario(),
    manufacturingOutputScenario(),
  ]);
}

export function gpuvDigestOf(result: ProductiveValueResult): string {
  return computeProductiveValueDigest({
    productiveValueId: result.productiveValueId,
    contributionId: result.contributionId,
    contributionFingerprint: result.contributionFingerprint,
    eventId: result.eventId,
    eventFingerprint: result.eventFingerprint,
    attributionDecisionId: result.attributionDecisionId,
    normalizationReceiptId: result.normalizationReceiptId,
    valueFunctionPolicyId: result.valueFunctionPolicyId,
    valueFunctionPolicyVersion: result.valueFunctionPolicyVersion,
    productiveValueQuantity: result.productiveValueQuantity,
    productiveValueUnit: result.productiveValueUnit,
    productiveValueDigest: '',
    state: result.state,
    canMint: result.canMint,
    productionActivated: result.productionActivated,
    environment: result.environment,
    parameterClass: result.parameterClass,
    valueFunctionQuantityCap: result.valueFunctionQuantityCap,
    attributionShare: result.attributionShare,
    eventBasisQuantity: result.eventBasisQuantity,
    jurisdiction: result.jurisdiction,
    objectId: result.objectId,
    controller: result.controller,
    category: result.category,
    epoch: result.epoch,
    oracleFactIds: result.oracleFactIds,
  });
}
