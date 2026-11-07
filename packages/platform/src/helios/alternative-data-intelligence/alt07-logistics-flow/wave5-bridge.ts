/**
 * Bridge Wave 5 maritime / logistics / weather into ALT07 canonical observations.
 */

import type { ExternalDataPlane } from '@solstice/external-data';
import type { UtcInstant } from '@solstice/domain';
import { buildCargoAttribution } from './cargo-presentation.ts';
import type {
  ChokepointState,
  PortCongestionState,
  PortObservation,
  RouteObservation,
  ShipmentFlowState,
  VesselObservation,
} from './types.ts';
import { HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA } from './taxonomy.ts';

function aisLicensedForProvider(providerId: string): boolean {
  return providerId !== 'fixture-unlicensed-ais';
}

export type Wave5Alt07BridgeResult = {
  readonly vessels: readonly VesselObservation[];
  readonly ports: readonly PortObservation[];
  readonly routes: readonly RouteObservation[];
  readonly shipmentFlows: readonly ShipmentFlowState[];
  readonly portCongestion: readonly PortCongestionState[];
  readonly chokepoints: readonly ChokepointState[];
  readonly weatherObservationIds: readonly string[];
};

export function ingestWave5LogisticsFlow(
  plane: ExternalDataPlane,
  decisionTimeUtc: UtcInstant,
): Wave5Alt07BridgeResult {
  const vessels: VesselObservation[] = [];
  const ports: PortObservation[] = [];
  const routes: RouteObservation[] = [];
  const shipmentFlows: ShipmentFlowState[] = [];
  const portCongestion: PortCongestionState[] = [];
  const chokepoints: ChokepointState[] = [];
  const weatherObservationIds: string[] = [];

  for (const obs of plane.wave5.maritime.getVesselObservations().observations) {
    const licensed = aisLicensedForProvider(obs.providerId);
    const cargoClass = obs.data.cargoClass ? 'DECLARED_CARGO' : 'UNKNOWN';
    vessels.push(
      Object.freeze({
        schema: HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA,
        observationId: `alt07:vessel:${obs.observationId}`,
        vesselRef: obs.data.vesselId ?? obs.data.imo ?? obs.data.mmsi ?? 'unknown',
        knowableAt: obs.knowableAt as UtcInstant,
        observedAt: obs.data.observedAt as UtcInstant,
        ais: Object.freeze({
          licensed,
          features: licensed
            ? Object.freeze({
                vesselClass: obs.data.vesselType,
                speedAnomaly: obs.data.speedKnots !== null && obs.data.speedKnots < 3 ? 1 : 0,
              })
            : Object.freeze({}),
        }),
        cargo: buildCargoAttribution({
          evidenceClass: cargoClass,
          commodityCode: obs.data.cargoClass,
          sourceObservationIds: [obs.observationId],
        }),
        sourceProvider: obs.providerId,
        grantsExecutionAuthority: false,
      }),
    );
  }

  for (const obs of plane.wave5.maritime.getShippingFlow().observations) {
    const licensed = aisLicensedForProvider(obs.providerId);
    const routeId = `route:${obs.data.corridor.replace(/\s+/g, '-').toLowerCase()}`;
    const cargo = buildCargoAttribution({
      evidenceClass: obs.data.cargoType ? 'INFERRED_CARGO' : 'UNKNOWN',
      commodityCode: obs.data.cargoType,
      sourceObservationIds: [obs.observationId],
    });
    routes.push(
      Object.freeze({
        schema: HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA,
        observationId: `alt07:route:${obs.observationId}`,
        routeId,
        corridorLabel: obs.data.corridor,
        knowableAt: obs.knowableAt as UtcInstant,
        observedAt: obs.data.observedAt as UtcInstant,
        ais: Object.freeze({
          licensed,
          features: licensed
            ? Object.freeze({
                vesselCount: obs.data.vesselCount,
                chokepointFlow: obs.data.vesselCount,
                congestion: obs.data.vesselCount !== null && obs.data.vesselCount > 35 ? 0.7 : 0.2,
              })
            : Object.freeze({}),
        }),
        cargo,
        sourceProvider: obs.providerId,
        grantsExecutionAuthority: false,
      }),
    );

    shipmentFlows.push(
      Object.freeze({
        stateId: `flow:${routeId}:${obs.observationId}`,
        routeId,
        direction: obs.data.direction,
        cargo,
        vesselCount: obs.data.vesselCount,
        effectiveAt: obs.data.observedAt as UtcInstant,
        knowableAt: obs.knowableAt as UtcInstant,
        grantsExecutionAuthority: false,
      }),
    );

    chokepoints.push(
      Object.freeze({
        stateId: `choke:${routeId}`,
        chokepointId: routeId,
        label: obs.data.corridor,
        flowIndex: obs.data.vesselCount,
        vesselCount: obs.data.vesselCount,
        diversionDetected: false,
        effectiveAt: obs.data.observedAt as UtcInstant,
        knowableAt: obs.knowableAt as UtcInstant,
        grantsExecutionAuthority: false,
      }),
    );
  }

  for (const obs of plane.wave5.logistics.getObservations().observations) {
    if (obs.data.observationType === 'PORT_ACTIVITY') {
      const portId = `port:${obs.data.region ?? 'unknown'}`;
      ports.push(
        Object.freeze({
          schema: HELIOS_ALT07_LOGISTICS_FLOW_SCHEMA,
          observationId: `alt07:port:${obs.observationId}`,
          portId,
          portName: obs.data.origin ?? portId,
          knowableAt: obs.knowableAt as UtcInstant,
          observedAt: obs.data.effectiveAt as UtcInstant,
          ais: Object.freeze({
            licensed: aisLicensedForProvider(obs.providerId),
            features: Object.freeze({
              arrivalRate: obs.data.status === 'CONGESTED' ? 0.4 : 0.8,
              departureRate: 0.75,
              portDwellTime: obs.data.status === 'CONGESTED' ? 72 : 24,
            }),
          }),
          cargo: buildCargoAttribution({
            evidenceClass: 'UNKNOWN',
            commodityCode: null,
            sourceObservationIds: [obs.observationId],
          }),
          geographyCode: obs.data.region,
          sourceProvider: obs.providerId,
          grantsExecutionAuthority: false,
        }),
      );

      portCongestion.push(
        Object.freeze({
          stateId: `congestion:${portId}`,
          portId,
          congestionScore: obs.data.status === 'CONGESTED' ? 0.85 : 0.25,
          anchorageHours: obs.data.status === 'CONGESTED' ? 36 : 8,
          dwellHours: obs.data.status === 'CONGESTED' ? 72 : 24,
          effectiveAt: obs.data.effectiveAt as UtcInstant,
          knowableAt: obs.knowableAt as UtcInstant,
          grantsExecutionAuthority: false,
        }),
      );
    }
  }

  for (const obs of plane.wave5.weather.getCurrentWeather().observations) {
    if (obs.data.windSpeedMps !== null && obs.data.windSpeedMps > 15) {
      weatherObservationIds.push(obs.observationId);
    }
  }

  const filtered = {
    vessels: Object.freeze(vessels),
    ports: Object.freeze(ports),
    routes: Object.freeze(routes),
    shipmentFlows: Object.freeze(shipmentFlows),
    portCongestion: Object.freeze(portCongestion),
    chokepoints: Object.freeze(chokepoints),
    weatherObservationIds: Object.freeze(weatherObservationIds),
  };

  for (const row of [...filtered.vessels, ...filtered.routes, ...filtered.ports]) {
    if (row.knowableAt > decisionTimeUtc) {
      throw new Error(`ALT07 wave5 bridge future knowableAt: ${row.observationId}`);
    }
  }

  return filtered;
}
