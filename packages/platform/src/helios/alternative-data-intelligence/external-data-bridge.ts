/**
 * Maps external-data wave overlays to ALT01 signal families (fixture / catalog alignment only).
 */

import type { AlternativeDataSignalFamily } from './taxonomy.ts';

const WAVE6_CATEGORY_TO_SIGNAL: Readonly<Record<string, AlternativeDataSignalFamily>> = Object.freeze({
  jobs_skills: 'WORKFORCE',
  research: 'INNOVATION',
  patents: 'PATENTS',
  artificial_intelligence: 'DIGITAL_DEMAND',
  health: 'PRODUCT_DEMAND',
});

const WAVE5_CATEGORY_TO_SIGNAL: Readonly<Record<string, AlternativeDataSignalFamily>> = Object.freeze({
  energy: 'ENERGY',
  travel: 'PHYSICAL_ACTIVITY',
  geospatial: 'GEOSPATIAL',
  logistics: 'LOGISTICS',
  maritime: 'MARITIME',
  climate: 'CLIMATE',
  government: 'GOVERNMENT_PROCUREMENT',
});

export function wave6CategoryToSignalFamily(category: string): AlternativeDataSignalFamily | null {
  return WAVE6_CATEGORY_TO_SIGNAL[category] ?? null;
}

export function wave5CategoryToSignalFamily(category: string): AlternativeDataSignalFamily | null {
  return WAVE5_CATEGORY_TO_SIGNAL[category] ?? null;
}

export const ALT01_PRESERVED_ASSETS = Object.freeze({
  wave5PhysicalEconomy: true,
  wave6JobsPatentsResearch: true,
  geospatialProviderSurface: true,
  maritimeProviderSurface: true,
  productiveEconomyObservations: true,
  providerHealth: true,
  providerProvenance: true,
  knowableAt: true,
  revisionLedger: true,
  coverageTensor: true,
  biasSentinel: true,
});
