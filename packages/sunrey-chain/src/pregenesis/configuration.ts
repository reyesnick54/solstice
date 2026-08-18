/**
 * Shadow vs production configuration parity.
 *
 * Expected rehearsal differences are recorded, not hidden.
 * Unaccounted variance fails qualification.
 */

import { IAC_MODULES } from '../infra/config.ts';
import { STORAGE_ENGINE_NAME } from '../ops/storage.ts';
import {
  CANDIDATE_V2_ADDRESS_HRP,
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_ID,
  CANDIDATE_V2_NETWORK_ID,
} from '../mainnet/candidate-v2/identity.ts';
import { commitCanonical } from '../hash.ts';
import {
  PREGENESIS_ADDRESS_HRP,
  PREGENESIS_CHAIN_ID,
  PREGENESIS_DOMAIN,
  PREGENESIS_NETWORK_ID,
} from './identity.ts';
import type { ConfigVariance, ProductionEnvironmentPlan } from './types.ts';

export const EXPECTED_REHEARSAL_PATHS = [
  'networkId',
  'chainId',
  'addressHrp',
  'genesis',
  'validatorKeys',
  'governanceKeys',
  'providerCredentials',
  'customerFacingEndpoints',
  'productionAuthorizationState',
] as const;

export function productionEnvironmentPlan(): ProductionEnvironmentPlan {
  return Object.freeze({
    schemaVersion: 1,
    planId: 'plan_production_environment_candidate_v2',
    source: 'CHUNK_66_INFRA_AND_CHUNK_81_CANDIDATE_V2',
    networkId: CANDIDATE_V2_NETWORK_ID,
    chainId: CANDIDATE_V2_CHAIN_ID,
    addressHrp: CANDIDATE_V2_ADDRESS_HRP,
    validatorCount: 7,
    serviceRoles: Object.freeze([
      'validator',
      'sentry',
      'remote_signer',
      'rpc',
      'explorer',
      'monitoring',
      'backup',
      'oracle_collector',
      'database',
      'exchange',
      'custody',
    ]),
    storageEngine: STORAGE_ENGINE_NAME,
    postgresProfile: 'sunrey.postgres.production-candidate.v1',
    environment: 'simulation',
    mainnetEnabled: false,
    productionAuthorized: false,
    configurationDigest: commitCanonical({
      domain: PREGENESIS_DOMAIN,
      label: 'production-environment-plan',
      candidateId: CANDIDATE_V2_ID,
      iac: IAC_MODULES.map((row) => row.path),
      harness: 'PRODUCTION_CANDIDATE',
    }),
  });
}

export function compareShadowConfiguration(plan: ProductionEnvironmentPlan = productionEnvironmentPlan()): readonly ConfigVariance[] {
  const rows: ConfigVariance[] = [
    variance('networkId', plan.networkId, PREGENESIS_NETWORK_ID, 'EXPECTED_REHEARSAL_VARIANCE', 'isolated shadow network ID'),
    variance('chainId', plan.chainId, PREGENESIS_CHAIN_ID, 'EXPECTED_REHEARSAL_VARIANCE', 'isolated shadow chain ID'),
    variance('addressHrp', plan.addressHrp, PREGENESIS_ADDRESS_HRP, 'EXPECTED_REHEARSAL_VARIANCE', 'isolated shadow address HRP'),
    variance('genesis', 'production-or-candidate-genesis', 'pregenesis-shadow-1', 'EXPECTED_REHEARSAL_VARIANCE', 'distinct shadow genesis'),
    variance('validatorKeys', 'production-or-candidate-keys', 'SUNREY_PREGENESIS_SHADOW_1_FIXTURE', 'EXPECTED_REHEARSAL_VARIANCE', 'shadow validator keys only'),
    variance('governanceKeys', 'production-or-candidate-governance', 'SUNREY_PREGENESIS_SHADOW_1_GOVERNANCE', 'EXPECTED_REHEARSAL_VARIANCE', 'shadow governance keys only'),
    variance('providerCredentials', 'production-provider-refs', 'sandbox-or-simulated-refs', 'EXPECTED_REHEARSAL_VARIANCE', 'no production provider credentials'),
    variance('customerFacingEndpoints', 'production-public-endpoints', 'shadow.invalid.example', 'EXPECTED_REHEARSAL_VARIANCE', 'non-production customer endpoints'),
    variance('productionAuthorizationState', 'AWAITING_HUMAN_AUTHORIZATION', 'UNAUTHORIZED_SHADOW', 'EXPECTED_REHEARSAL_VARIANCE', 'shadow never authorizes mainnet'),
    variance('storageEngine', plan.storageEngine, STORAGE_ENGINE_NAME, 'APPROVED_ENVIRONMENT_VARIANCE', 'same redb engine; environment paths differ'),
    variance('postgresProfile', plan.postgresProfile, 'sunrey.postgres.pregenesis-shadow.v1', 'APPROVED_ENVIRONMENT_VARIANCE', 'same TLS/pooling/replica shape; shadow DSN'),
    variance('environment', plan.environment, 'simulation', 'APPROVED_ENVIRONMENT_VARIANCE', 'both remain simulation'),
  ];
  return Object.freeze(rows);
}

export function unaccountedVariances(rows: readonly ConfigVariance[]): readonly ConfigVariance[] {
  return Object.freeze(rows.filter((row) => row.classification === 'UNEXPECTED_VARIANCE'));
}

export function rejectUnaccountedConfigurationVariance(rows: readonly ConfigVariance[]): void {
  const unexpected = unaccountedVariances(rows);
  if (unexpected.length > 0) {
    throw new TypeError(`unaccounted configuration variance fails qualification: ${unexpected.map((row) => row.path).join(',')}`);
  }
}

export function accountUnexpectedVariance(path: string, productionValue: string, shadowValue: string): ConfigVariance {
  return variance(path, productionValue, shadowValue, 'UNEXPECTED_VARIANCE', 'not in the expected or approved variance catalog');
}

function variance(
  path: string,
  productionValue: string,
  shadowValue: string,
  classification: ConfigVariance['classification'],
  rationale: string,
): ConfigVariance {
  return Object.freeze({ path, productionValue, shadowValue, classification, rationale });
}
