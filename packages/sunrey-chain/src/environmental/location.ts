/**
 * Canonical environmental location input — no provider-specific formats leak through.
 */

export type EnvironmentalLocation = {
  readonly schema: 'sunrey.environmental-location.v1';
  readonly latitude: number;
  readonly longitude: number;
  readonly country: string | null;
  readonly region: string | null;
  readonly city: string | null;
  readonly geospatialCell: string | null;
};

export type LocationInput = {
  readonly latitude: number;
  readonly longitude: number;
  readonly country?: string | null;
  readonly region?: string | null;
  readonly city?: string | null;
  readonly geospatialCell?: string | null;
};

export function normalizeEnvironmentalLocation(input: LocationInput): EnvironmentalLocation {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error('latitude must be between -90 and 90');
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error('longitude must be between -180 and 180');
  }
  return Object.freeze({
    schema: 'sunrey.environmental-location.v1' as const,
    latitude: roundCoord(input.latitude),
    longitude: roundCoord(input.longitude),
    country: input.country?.trim().toUpperCase() ?? null,
    region: input.region?.trim() ?? null,
    city: input.city?.trim() ?? null,
    geospatialCell: input.geospatialCell?.trim() ?? null,
  });
}

export function locationKey(location: EnvironmentalLocation): string {
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

export function convertTemperature(
  value: number,
  from: 'celsius' | 'fahrenheit',
  to: 'celsius' | 'fahrenheit',
): number {
  if (from === to) return value;
  return from === 'celsius' ? celsiusToFahrenheit(value) : fahrenheitToCelsius(value);
}

export function convertWindSpeed(
  value: number,
  from: 'm/s' | 'km/h' | 'mph' | 'knots',
  to: 'm/s' | 'km/h' | 'mph' | 'knots',
): number {
  const toMs: Record<string, number> = {
    'm/s': 1,
    'km/h': 1 / 3.6,
    mph: 0.44704,
    knots: 0.514444,
  };
  const ms = value * toMs[from];
  return ms / toMs[to];
}
