/**
 * Agent evidence bridge for environmental observations.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EnvironmentalOracleService } from './service.ts';
import type { LocationInput } from './location.ts';

export type EnvironmentalAgentEvidence = {
  readonly schema: 'sunrey.agent.environmental-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly readOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly triggersAutonomousInvestment: false;
  readonly items: readonly {
    readonly category: string;
    readonly summary: string;
    readonly providerId: string;
    readonly label: 'RESEARCH_EVIDENCE_NOT_EXECUTION';
  }[];
};

export async function buildEnvironmentalAgentEvidence(
  service: EnvironmentalOracleService,
  location: LocationInput,
  nowUtc: UtcInstant,
): Promise<EnvironmentalAgentEvidence> {
  const items: EnvironmentalAgentEvidence['items'][number][] = [];
  const snapshot = await service.getEnvironmentalSnapshot(location, nowUtc);
  if (!snapshot.ok) {
    return Object.freeze({
      schema: 'sunrey.agent.environmental-evidence.v1',
      generatedAt: nowUtc,
      readOnly: true,
      grantsExecutionAuthority: false,
      triggersAutonomousInvestment: false,
      items: Object.freeze([]),
    });
  }

  for (const obs of snapshot.value.weather) {
    items.push(
      Object.freeze({
        category: 'weather',
        summary: `Weather: ${obs.weatherCondition ?? 'unknown'}, ${obs.temperature?.value ?? 'N/A'}°${obs.temperature?.unit === 'fahrenheit' ? 'F' : 'C'}`,
        providerId: obs.providerId,
        label: 'RESEARCH_EVIDENCE_NOT_EXECUTION',
      }),
    );
  }
  for (const obs of snapshot.value.airQuality) {
    const pm25 = obs.metrics.find((m) => m.pollutant === 'PM2.5');
    items.push(
      Object.freeze({
        category: 'air_quality',
        summary: `Air quality PM2.5: ${pm25?.value ?? 'N/A'} ${pm25?.unit ?? ''}`,
        providerId: obs.providerId,
        label: 'RESEARCH_EVIDENCE_NOT_EXECUTION',
      }),
    );
  }
  for (const risk of snapshot.value.physicalRisks) {
    items.push(
      Object.freeze({
        category: 'physical_risk',
        summary: `${risk.riskType}: ${risk.observedSignal}`,
        providerId: risk.sourceProviderId,
        label: 'RESEARCH_EVIDENCE_NOT_EXECUTION',
      }),
    );
  }

  return Object.freeze({
    schema: 'sunrey.agent.environmental-evidence.v1',
    generatedAt: nowUtc,
    readOnly: true,
    grantsExecutionAuthority: false,
    triggersAutonomousInvestment: false,
    items: Object.freeze(items),
  });
}
