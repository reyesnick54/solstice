/**
 * Canonical energy-source classification mapping from provider-native labels.
 */

import type { EnergySourceType } from './types.ts';

const NATIVE_SOURCE_MAP: Readonly<Record<string, EnergySourceType>> = Object.freeze({
  solar: 'SOLAR',
  photovoltaics: 'SOLAR',
  pv: 'SOLAR',
  wind: 'WIND',
  onshore_wind: 'WIND',
  offshore_wind: 'WIND',
  hydro: 'HYDRO',
  hydroelectric: 'HYDRO',
  nuclear: 'NUCLEAR',
  coal: 'COAL',
  gas: 'NATURAL_GAS',
  natural_gas: 'NATURAL_GAS',
  lng: 'NATURAL_GAS',
  oil: 'OIL',
  petroleum: 'OIL',
  biomass: 'BIOMASS',
  biogas: 'BIOMASS',
  geothermal: 'GEOTHERMAL',
  hydrogen: 'HYDROGEN',
  battery: 'BATTERY_STORAGE',
  storage: 'BATTERY_STORAGE',
  pumped_storage: 'BATTERY_STORAGE',
  other: 'OTHER',
  unknown: 'OTHER',
  // UK carbon intensity fuel mix labels
  wind_onshore: 'WIND',
  wind_offshore: 'WIND',
  gas_ccgt: 'NATURAL_GAS',
  gas_ocgt: 'NATURAL_GAS',
  // Danish energidataservice labels
  SolarPower: 'SOLAR',
  WindPower: 'WIND',
  HydroPower: 'HYDRO',
  BiomassPower: 'BIOMASS',
});

export function mapEnergySource(nativeLabel: string | null | undefined): EnergySourceType | null {
  if (!nativeLabel) {
    return null;
  }
  const key = nativeLabel.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return NATIVE_SOURCE_MAP[key] ?? 'OTHER';
}

export function preserveNativeSource(nativeLabel: string): { readonly canonical: EnergySourceType; readonly native: string } {
  return Object.freeze({
    canonical: mapEnergySource(nativeLabel) ?? 'OTHER',
    native: nativeLabel,
  });
}
