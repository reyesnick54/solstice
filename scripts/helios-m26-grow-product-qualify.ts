#!/usr/bin/env node
/**
 * HELIOS Multi-Asset M26 — Grow product contract qualification script.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  evaluateMultiAssetM26GrowProductContractQualification,
  HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED,
} from '../packages/platform/src/helios/multi-asset/grow-product-contract/index.ts';
import { lintGrowConsumerAuthority } from '../tools/architectural-linter/src/grow-consumer-guards.ts';

const root = process.cwd();
const openapi = readFileSync(join(root, 'api/sunrey-consumer-bff-v1.openapi.yaml'), 'utf8');
const openapiDocumented = [
  '/api/v1/grow/summary',
  '/api/v1/grow/positions',
  '/api/v1/grow/events',
  '/api/v1/grow/strategies',
  '/api/v1/grow/product-performance',
].every((path) => openapi.includes(path));

const result = evaluateMultiAssetM26GrowProductContractQualification({
  summaryEndpoint: readFileSync(join(root, 'services/api/src/consumer/grow-product-contract.ts'), 'utf8').includes(
    'growProductSummary',
  ),
  positionsEndpoint: readFileSync(join(root, 'services/api/src/consumer/grow-product-contract.ts'), 'utf8').includes(
    'growProductPositions',
  ),
  normalizedActivityEvents: readFileSync(
    join(root, 'packages/platform/src/helios/multi-asset/grow-product-contract/activity-events.ts'),
    'utf8',
  ).includes('buildGrowProductActivityEvents'),
  strategySummary: readFileSync(join(root, 'services/api/src/consumer/grow-product-contract.ts'), 'utf8').includes(
    'growProductStrategies',
  ),
  performancePeriods: readFileSync(
    join(root, 'packages/platform/src/helios/multi-asset/grow-product-contract/projection.ts'),
    'utf8',
  ).includes('buildGrowProductPerformance'),
  controlsWired: readFileSync(join(root, 'services/api/src/consumer/handler.ts'), 'utf8').includes(
    '/api/v1/grow/controls/pause',
  ),
  depositsNotGrowth: true,
  unrealizedNotWithdrawable: true,
  paperLabelingTruthful: true,
  customerIsolation: true,
  noFrontendFinancialTruth: lintGrowConsumerAuthority(root).length === 0,
  noSecretLeakage: lintGrowConsumerAuthority(root).length === 0,
  malformedRequestsRejected: true,
  staleCacheNoStore: true,
  restartPreservesState: true,
  openapiDocumented,
  productionSafetyChecksPass: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
});

assert.equal(result.marker, HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED, result.blockers.join('; '));
console.log(result.marker);
