/**
 * Physical risk derivation from observed environmental signals.
 *
 * Does not predict catastrophes — classifies risk only where source data supports it.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EnvironmentalLocation } from './location.ts';
import type {
  AirQualityObservation,
  PhysicalRiskObservation,
  PhysicalRiskType,
  SeismicObservation,
  WaterObservation,
  WeatherObservation,
  WildfireObservation,
} from './types.ts';

export function derivePhysicalRisks(input: {
  readonly location: EnvironmentalLocation;
  readonly weather: readonly WeatherObservation[];
  readonly water: readonly WaterObservation[];
  readonly airQuality: readonly AirQualityObservation[];
  readonly seismic: readonly SeismicObservation[];
  readonly wildfires: readonly WildfireObservation[];
  readonly nowUtc: UtcInstant;
}): readonly PhysicalRiskObservation[] {
  const risks: PhysicalRiskObservation[] = [];

  for (const obs of input.weather) {
    if (obs.temperature?.unit === 'celsius' && obs.temperature.value >= 40) {
      risks.push(buildRisk('EXTREME_HEAT', 'high', input.location, `Temperature ${obs.temperature.value}°C`, 'weather', obs.providerId, obs.observationTime, input.nowUtc));
    }
    if (obs.temperature?.unit === 'celsius' && obs.temperature.value <= -20) {
      risks.push(buildRisk('EXTREME_COLD', 'high', input.location, `Temperature ${obs.temperature.value}°C`, 'weather', obs.providerId, obs.observationTime, input.nowUtc));
    }
    if (obs.windSpeed && obs.windSpeed.value >= 25 && obs.windSpeed.unit === 'm/s') {
      risks.push(buildRisk('HIGH_WIND', 'moderate', input.location, `Wind ${obs.windSpeed.value} ${obs.windSpeed.unit}`, 'weather', obs.providerId, obs.observationTime, input.nowUtc));
    }
    if (obs.weatherCondition?.toLowerCase().includes('flood')) {
      risks.push(buildRisk('FLOOD', 'moderate', input.location, obs.weatherCondition, 'weather', obs.providerId, obs.observationTime, input.nowUtc));
    }
  }

  for (const obs of input.water) {
    if (obs.measurementType === 'drought_indicator' && obs.value > 3) {
      risks.push(buildRisk('DROUGHT', 'moderate', input.location, `Drought indicator ${obs.value}`, 'water', obs.providerId, obs.effectiveAt, input.nowUtc));
    }
    if (obs.measurementType === 'availability' && obs.value < 0.3) {
      risks.push(buildRisk('WATER_STRESS', 'moderate', input.location, `Availability ${obs.value} ${obs.unit}`, 'water', obs.providerId, obs.effectiveAt, input.nowUtc));
    }
  }

  for (const obs of input.airQuality) {
    const pm25 = obs.metrics.find((m) => m.pollutant === 'PM2.5');
    const aqi = obs.metrics.find((m) => m.pollutant === 'AQI');
    if ((pm25 && pm25.value > 55) || (aqi && aqi.value > 150)) {
      risks.push(buildRisk('POOR_AIR_QUALITY', 'moderate', input.location, `AQ ${aqi?.value ?? pm25?.value}`, 'air_quality', obs.providerId, obs.observedAt, input.nowUtc));
    }
  }

  for (const obs of input.seismic) {
    if (obs.magnitude >= 4.0) {
      const severity = obs.magnitude >= 6 ? 'severe' : obs.magnitude >= 5 ? 'high' : 'moderate';
      risks.push(buildRisk('EARTHQUAKE', severity, input.location, `M${obs.magnitude} ${obs.place}`, 'seismic', obs.providerId, obs.eventTime, input.nowUtc));
    }
  }

  for (const obs of input.wildfires) {
    risks.push(buildRisk('WILDFIRE', obs.status === 'active' ? 'high' : 'moderate', input.location, `Fire ${obs.eventId}`, 'wildfire', obs.providerId, obs.detectionTime, input.nowUtc));
  }

  return Object.freeze(risks);
}

function buildRisk(
  riskType: PhysicalRiskType,
  severity: PhysicalRiskObservation['severity'],
  location: EnvironmentalLocation,
  signal: string,
  derivedFrom: PhysicalRiskObservation['derivedFrom'],
  sourceProviderId: string,
  effectiveAt: UtcInstant,
  nowUtc: UtcInstant,
): PhysicalRiskObservation {
  return Object.freeze({
    schema: 'sunrey.physical-risk-observation.v1' as const,
    riskType,
    severity,
    location,
    observedSignal: signal,
    derivedFrom,
    sourceProviderId,
    effectiveAt,
    retrievedAt: nowUtc,
    prediction: false as const,
  });
}
