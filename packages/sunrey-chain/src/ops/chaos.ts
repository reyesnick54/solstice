import { SimulatedResilienceNetwork } from './network.ts';
import { CHAOS_FAULTS, type ChaosFault } from './types.ts';

export function runChaosScenario(network: SimulatedResilienceNetwork, fault: ChaosFault, targetId?: string): void {
  network.applyFault(fault, targetId);
}

export function allChaosFaults(): readonly ChaosFault[] {
  return CHAOS_FAULTS;
}
