/**
 * Property checks over dual-economy simulations.
 */

import { simulateScenario } from './engine.ts';
import type { PropertyCheckSnapshot } from './types.ts';

export function propertyChecks(scenarioId = 'baseline', seed = 75, epochs = 3): PropertyCheckSnapshot {
  return simulateScenario(scenarioId, { seed, epochs }).properties;
}

export function allPropertiesHold(snapshot: PropertyCheckSnapshot): boolean {
  return (
    snapshot.sunreySupplyReconciles &&
    snapshot.moonreySupplyReconciles &&
    snapshot.exchangeDvpConserves &&
    snapshot.feeConserves &&
    snapshot.validatorEconomicsReconciles &&
    snapshot.noDuplicateMoonreyIssuance &&
    snapshot.noMachineMandateBypass
  );
}
