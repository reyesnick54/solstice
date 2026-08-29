import type { ScarcityModelVersion } from './types.ts';

/**
 * Explicit, versioned scarcity methodology. Each component is bounded,
 * auditable, and tagged as market, policy, or verified evidence input.
 * This is not a universal economic truth — it is a configured model.
 */
export const SCARCITY_MODEL_V1: ScarcityModelVersion = Object.freeze({
  version: 'sunrey.access.scarcity.v1',
  description:
    'Deterministic scarcity pressure from verified capacity, demand forecast, time/geography modifiers, and explicit cost/policy components.',
  abundantThresholdBps: 2_000,
  balancedThresholdBps: 4_500,
  constrainedThresholdBps: 7_000,
  criticalThresholdBps: 9_000,
  components: Object.freeze([
    {
      id: 'capacity_pressure',
      inputClass: 'VERIFIED_EVIDENCE',
      description: 'Pressure from verified utilization and remaining availability.',
      weightBps: 3_500,
      ceilingBps: 10_000,
    },
    {
      id: 'demand_forecast',
      inputClass: 'MARKET',
      description: 'Forecast demand relative to verified available units.',
      weightBps: 2_000,
      ceilingBps: 10_000,
    },
    {
      id: 'time_scarcity',
      inputClass: 'MARKET',
      description: 'Time-window scarcity supplied by scheduling or market data.',
      weightBps: 1_000,
      ceilingBps: 10_000,
    },
    {
      id: 'geographic_scarcity',
      inputClass: 'MARKET',
      description: 'Location-specific scarcity supplied by corridor configuration.',
      weightBps: 1_000,
      ceilingBps: 10_000,
    },
    {
      id: 'productive_resource_cost',
      inputClass: 'MARKET',
      description: 'Productive resource cost signal; not a price oracle.',
      weightBps: 800,
      ceilingBps: 8_000,
    },
    {
      id: 'energy_requirement',
      inputClass: 'MARKET',
      description: 'Energy requirement cost signal.',
      weightBps: 500,
      ceilingBps: 8_000,
    },
    {
      id: 'logistics_cost',
      inputClass: 'MARKET',
      description: 'Logistics cost signal.',
      weightBps: 500,
      ceilingBps: 8_000,
    },
    {
      id: 'maintenance_cost',
      inputClass: 'MARKET',
      description: 'Maintenance/service cost signal.',
      weightBps: 400,
      ceilingBps: 8_000,
    },
    {
      id: 'quality_tier',
      inputClass: 'MARKET',
      description: 'Quality tier premium modifier.',
      weightBps: 600,
      ceilingBps: 6_000,
    },
    {
      id: 'policy_subsidy',
      inputClass: 'POLICY',
      description: 'Externally supplied policy subsidy reducing pressure.',
      weightBps: 1_200,
      ceilingBps: 10_000,
    },
    {
      id: 'policy_benefit',
      inputClass: 'POLICY',
      description: 'Externally supplied entitlement/benefit units.',
      weightBps: 1_000,
      ceilingBps: 10_000,
    },
    {
      id: 'externality',
      inputClass: 'VERIFIED_EVIDENCE',
      description: 'Verified externality input where configured.',
      weightBps: 600,
      ceilingBps: 8_000,
    },
  ]),
});

export const SCARCITY_MODEL_REGISTRY: Readonly<Record<string, ScarcityModelVersion>> = Object.freeze({
  [SCARCITY_MODEL_V1.version]: SCARCITY_MODEL_V1,
});

export function resolveScarcityModel(version: string): ScarcityModelVersion | null {
  return SCARCITY_MODEL_REGISTRY[version] ?? null;
}
