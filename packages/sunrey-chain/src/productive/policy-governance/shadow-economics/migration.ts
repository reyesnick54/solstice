/**
 * V2 migration readiness. Passing tests never activates production.
 */

import { PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED } from '../value-function/constitution.ts';
import { PRODUCTION_VALUE_FUNCTION_POLICY } from '../value-function/types.ts';
import { adversarialTestsPassing } from './adversarial.ts';
import { feedbackLoopCheckPassing } from './feedback-loop.ts';
import { PRODUCTION_MIGRATION_APPROVED } from './identities.ts';
import type { MoonReyV2MigrationReadinessReport } from './types.ts';

export function buildV2MigrationReadinessReport(): MoonReyV2MigrationReadinessReport {
  if (PRODUCTION_VALUE_FUNCTION_POLICY.productionActivated || PRODUCTION_MIGRATION_APPROVED) {
    throw new Error('production value policy must remain unconfigured');
  }
  return Object.freeze({
    canonicalUnitsReady: true,
    sourceTaxonomyReady: true,
    eventIdentityReady: true,
    attributionReady: true,
    valueEngineReady: PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
    conversionBridgeReady: false,
    monetaryAuthorityReady: true,
    supplyReconciliationReady: true,
    allCategoriesReviewed: true,
    adversarialTestsPassing: adversarialTestsPassing(),
    feedbackLoopCheckPassing: feedbackLoopCheckPassing(),
    productionParametersConfigured: false,
    productionMigrationApproved: false,
  });
}
