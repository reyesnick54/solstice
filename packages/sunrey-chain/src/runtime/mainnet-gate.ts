/**
 * Wave 2 — centralized mainnet runtime fail-closed gate.
 *
 * Mainnet economic execution must refuse to start unless all mandatory
 * conditions are intentionally satisfied. Building software is not activation.
 */

import {
  ENVIRONMENT,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
  PRODUCTION_HSM_KMS_CONFIGURED,
} from '../../../config/src/flags.ts';
import { mainnetGenesisFailsClosed } from './genesis.ts';
import { MAINNET_INACTIVE } from './identity.ts';

export const MAINNET_GATE_STATUSES = ['MISSING', 'RECORDED_INTERNAL', 'EXTERNAL_REQUIRED', 'SATISFIED'] as const;
export type MainnetGateStatus = (typeof MAINNET_GATE_STATUSES)[number];

export type MainnetRuntimeBlocker = {
  readonly id: string;
  readonly label: string;
  readonly status: MainnetGateStatus;
  readonly blocking: true;
};

export type MainnetRuntimeGate = {
  readonly schema: 'sunrey.chain.mainnet.runtime.gate.v1';
  readonly evaluatedAtPolicy: 'FAIL_CLOSED';
  readonly passed: false;
  readonly mainnetActive: false;
  readonly productionEconomicsAuthorized: false;
  readonly environment: typeof ENVIRONMENT;
  readonly blockers: readonly MainnetRuntimeBlocker[];
  readonly missingBlockerIds: readonly string[];
};

function blocker(id: string, label: string, status: MainnetGateStatus): MainnetRuntimeBlocker {
  return Object.freeze({ id, label, status, blocking: true });
}

const MAINNET_RUNTIME_BLOCKERS: readonly MainnetRuntimeBlocker[] = Object.freeze([
  blocker('production_migration_not_performed', 'Production migration not performed', 'MISSING'),
  blocker('mainnet_economics_not_authorized', 'Mainnet economics not authorized', 'EXTERNAL_REQUIRED'),
  blocker('production_genesis_not_approved', 'Production genesis not approved', 'MISSING'),
  blocker('governance_not_configured', 'Governance not configured for mainnet', 'MISSING'),
  blocker('validator_set_not_approved', 'Validator set not approved', 'MISSING'),
  blocker('required_key_configuration_absent', 'Required key configuration absent', 'MISSING'),
  blocker(
    'moonrey_production_activation_false',
    'MoonRey production activation false',
    LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED ? 'SATISFIED' : 'MISSING',
  ),
  blocker('live_economic_sources_not_met', 'Live economic source requirements not met', 'EXTERNAL_REQUIRED'),
  blocker('production_hsm_kms_absent', 'Production HSM/KMS not configured', 'MISSING'),
  blocker('mainnet_genesis_fail_closed', 'Mainnet genesis generation fail-closed', 'RECORDED_INTERNAL'),
  blocker('environment_simulation_only', 'ENVIRONMENT remains simulation', 'RECORDED_INTERNAL'),
]);

export function evaluateMainnetRuntimeGate(): MainnetRuntimeGate {
  mainnetGenesisFailsClosed();
  const missing = MAINNET_RUNTIME_BLOCKERS.filter(
    (row) => row.status === 'MISSING' || row.status === 'EXTERNAL_REQUIRED',
  ).map((row) => row.id);
  if (MAINNET_INACTIVE !== true) {
    throw new Error('MAINNET_INACTIVE must remain true');
  }
  if (PRODUCTION_HSM_KMS_CONFIGURED) {
    throw new Error('PRODUCTION_HSM_KMS_CONFIGURED must remain false in this repository');
  }
  return Object.freeze({
    schema: 'sunrey.chain.mainnet.runtime.gate.v1',
    evaluatedAtPolicy: 'FAIL_CLOSED',
    passed: false,
    mainnetActive: false,
    productionEconomicsAuthorized: false,
    environment: ENVIRONMENT,
    blockers: MAINNET_RUNTIME_BLOCKERS,
    missingBlockerIds: Object.freeze(missing),
  });
}

export type MainnetRuntimeAction =
  | 'START_NODE'
  | 'ENABLE_ECONOMIC_EXECUTION'
  | 'ASSIGN_LAUNCH_SUPPLY'
  | 'ACTIVATE_MOONREY_ISSUANCE'
  | 'ACTIVATE_SUNREY_ISSUANCE';

export function refuseMainnetRuntimeAction(
  action: MainnetRuntimeAction,
  environment: string,
): 'OK' | 'MAINNET_RUNTIME_REFUSED' {
  if (environment !== 'MAINNET') {
    return 'OK';
  }
  const gate = evaluateMainnetRuntimeGate();
  if (!gate.passed) {
    return 'MAINNET_RUNTIME_REFUSED';
  }
  if (
    action === 'ENABLE_ECONOMIC_EXECUTION' ||
    action === 'ASSIGN_LAUNCH_SUPPLY' ||
    action === 'ACTIVATE_MOONREY_ISSUANCE' ||
    action === 'ACTIVATE_SUNREY_ISSUANCE'
  ) {
    return 'MAINNET_RUNTIME_REFUSED';
  }
  return 'MAINNET_RUNTIME_REFUSED';
}
