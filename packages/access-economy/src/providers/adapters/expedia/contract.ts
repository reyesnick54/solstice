/**
 * Expedia access provider contract (lodging + travel candidate).
 */

import type { ProviderRegistration } from '../../capabilities.ts';
import { PROVIDER_CAPABILITY_REGISTRY } from '../../capabilities.ts';

export const EXPEDIA_PROVIDER_CONTRACT = Object.freeze({
  providerId: 'expedia',
  integrationMode: 'SIMULATED',
  supportedDomains: Object.freeze(['lodging_discovery', 'lodging_availability', 'lodging_pricing', 'reservation', 'cancellation', 'car_discovery']),
  canonicalUnits: Object.freeze(['ROOM_NIGHT', 'OCCUPANCY_NIGHT', 'VEHICLE_DAY', 'PASSENGER_SEGMENT']),
  liveConnectivity: false,
  notes: 'SimulationExpediaProvider only; live Expedia connectivity remains capability-gated.',
});

export function expediaRegistration(): ProviderRegistration {
  return PROVIDER_CAPABILITY_REGISTRY.expedia;
}
