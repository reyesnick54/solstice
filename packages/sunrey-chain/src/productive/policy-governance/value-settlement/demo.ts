/**
 * demo:moonrey-governed-value-settlement
 *
 * VerifiedProductiveContribution
 * → ProductiveValueResult = X GPUV
 * → Simulation Conversion Policy
 * → Authorized MoonRey Quantity = Y
 * → Chunk 71 MonetaryIssuanceAuthority
 * → canonical MoonRey supply
 */

import { nativeAssetConstitution } from '../../../economics/constitution.ts';
import { emptyBook, supplyReconciles } from '../../../economics/supply.ts';
import { MoonReyProductiveSettlementBridge } from './bridge.ts';
import { convertGpuvToMoonRey, simulationConversionPolicy } from './conversion.ts';
import {
  fixtureAttribution,
  fixtureContribution,
  fixtureEvent,
  fixtureProductiveValueResult,
} from './fixtures.ts';
import {
  AI_AUTHORIZED,
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTION_ACTIVE,
} from './types.ts';

export function runGovernedValueSettlementDemo(): string {
  const contribution = fixtureContribution();
  const event = fixtureEvent(contribution);
  const attribution = fixtureAttribution(contribution, event.eventId);
  const value = fixtureProductiveValueResult({ contribution, event, attribution });
  const conversion = simulationConversionPolicy();
  const authorizedMoonRey = convertGpuvToMoonRey(value.productiveValueQuantity, conversion);
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  const book = emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId);
  const issued = new MoonReyProductiveSettlementBridge().attempt(
    {
      contribution,
      event,
      attributionDecision: attribution,
      valueResult: value,
      conversionPolicy: conversion,
      authorizedBy: 'PROTOCOL',
    },
    constitution,
    book,
  );
  if (!issued.ok) {
    throw new Error(issued.code);
  }
  const lines = [
    'CHUNK-125 MoonRey governed-value settlement demo',
    `VerifiedProductiveContribution=${contribution.contributionId}`,
    `ProductiveValueResult=${value.productiveValueId}`,
    `GPUV=${value.productiveValueQuantity.toString()}`,
    `SIMULATION_CONVERSION=${conversion.conversionNumerator.toString()}/${conversion.conversionDenominator.toString()}`,
    `MOONREY_SIMULATION_QUANTITY=${authorizedMoonRey.toString()}`,
    `GPUV_EQUALS_MOONREY_BY_DEFINITION=${String(GPUV_EQUALS_MOONREY_BY_DEFINITION)}`,
    `PRODUCTIVE_VALUE_ENGINE_CAN_MINT=${String(PRODUCTIVE_VALUE_ENGINE_CAN_MINT)}`,
    `AI_AUTHORIZED=${String(AI_AUTHORIZED)}`,
    `PRODUCTION_ACTIVE=${String(PRODUCTION_ACTIVE)}`,
    `CHUNK_71_AUTHORIZED=${String(issued.authority.authorized)}`,
    `CANONICAL_MOONREY_SUPPLY=${issued.book.issuedPostGenesis.toString()}`,
    `SUPPLY_RECONCILES=${String(supplyReconciles(issued.book))}`,
    `PATH=${issued.authorization.pathClass}`,
  ];
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${runGovernedValueSettlementDemo()}\n`);
}
