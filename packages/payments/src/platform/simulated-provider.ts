/**
 * Deterministic, simulation-only payment provider for tests and Lovable.
 * Impossible to enable as real production money movement.
 */

import { ENVIRONMENT, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { SimulatedRailAdapter, type SimulatedAdapterMode } from '../rail-adapters.ts';
import { simulationCapabilities } from '../rail-capability.ts';
import type { RailAdapter } from '../rail-port.ts';

export const SIMULATED_PROVIDER_MODES = [
  'SUCCESS',
  'PENDING',
  'FAILED',
  'RETURNED',
  'TIMEOUT',
] as const;
export type SimulatedProviderScenario = (typeof SIMULATED_PROVIDER_MODES)[number];

export const SIMULATED_PAYMENT_PROVIDER_LABEL = 'SIMULATION_ONLY_NOT_PRODUCTION_MONEY_MOVEMENT' as const;

const MODE_MAP: Record<SimulatedProviderScenario, SimulatedAdapterMode> = {
  SUCCESS: 'SUCCESS',
  PENDING: 'PENDING',
  FAILED: 'FAIL_AFTER_SUBMIT',
  RETURNED: 'RETURNED',
  TIMEOUT: 'TIMEOUT_AFTER_UNKNOWN',
};

export class SimulationOnlyPaymentProvider {
  readonly label = SIMULATED_PAYMENT_PROVIDER_LABEL;
  readonly productionEnabled = false as const;
  readonly livePaymentsEnabled = LIVE_PAYMENTS_ENABLED;
  readonly environment = ENVIRONMENT;
  private readonly adapter: SimulatedRailAdapter;

  constructor() {
    assertSimulationOnly();
    const capability = simulationCapabilities()[0];
    if (!capability) {
      throw new Error('simulation rail capability missing');
    }
    this.adapter = new SimulatedRailAdapter(capability);
  }

  asRailAdapter(): RailAdapter {
    assertSimulationOnly();
    return this.adapter;
  }

  setScenario(paymentId: string, scenario: SimulatedProviderScenario): void {
    assertSimulationOnly();
    this.adapter.setMode(paymentId, MODE_MAP[scenario]);
  }

  cannotEnableProduction(): true {
    return true;
  }
}

export function assertSimulationOnly(): void {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('simulated payment provider requires ENVIRONMENT=simulation');
  }
  if (LIVE_PAYMENTS_ENABLED) {
    throw new Error('simulated payment provider cannot run when LIVE_PAYMENTS_ENABLED is true');
  }
}
