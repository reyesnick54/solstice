/**
 * Map company → facility → port → route → commodity with confidence and evidence.
 */

import type { UtcInstant } from '@solstice/domain';
import type { Wave5Alt07BridgeResult } from './wave5-bridge.ts';
import type { FirmLogisticsExposure } from './types.ts';

export function alt07CompanyCanonicalId(ticker: string): string {
  const normalized = ticker.trim().toLowerCase().replace(/\s+/g, '_');
  return `helios:market:issuer:${normalized}`;
}

export type FirmExposureSeed = {
  readonly companyTicker: string;
  readonly facilityRef: string;
  readonly portRef: string;
  readonly routeRef: string;
  readonly commodityCode: string;
  readonly confidence: FirmLogisticsExposure['confidence'];
  readonly evidenceRefs: readonly string[];
};

export const ALT07_FIXTURE_FIRM_EXPOSURE_SEEDS: readonly FirmExposureSeed[] = Object.freeze([
  Object.freeze({
    companyTicker: 'XOM',
    facilityRef: 'refinery-baytown',
    portRef: 'port:US-Gulf',
    routeRef: 'route:strait-of-hormuz',
    commodityCode: 'CRUDE_OIL',
    confidence: 'HIGH',
    evidenceRefs: Object.freeze(['fixture:sec-10k-logistics-xom', 'fixture:hormuz/corridor-flow']),
  }),
]);

export function compileFirmLogisticsExposures(input: {
  readonly bridge: Wave5Alt07BridgeResult;
  readonly seeds?: readonly FirmExposureSeed[];
  readonly knowableAt: UtcInstant;
}): readonly FirmLogisticsExposure[] {
  const seeds = input.seeds ?? ALT07_FIXTURE_FIRM_EXPOSURE_SEEDS;
  const routeIds = new Set(input.bridge.routes.map((r) => r.routeId));
  const portIds = new Set(input.bridge.ports.map((p) => p.portId));

  const exposures: FirmLogisticsExposure[] = [];
  for (const seed of seeds) {
    const companyId = alt07CompanyCanonicalId(seed.companyTicker);
    const portId = seed.portRef.startsWith('port:') ? seed.portRef : `port:${seed.portRef}`;
    const routeId = seed.routeRef.startsWith('route:') ? seed.routeRef : `route:${seed.routeRef}`;
    const confidence =
      routeIds.has(routeId) || portIds.has(portId) ? seed.confidence : ('LOW' as const);

    exposures.push(
      Object.freeze({
        exposureId: `exposure:${seed.companyTicker}:${seed.commodityCode}`,
        companyId,
        facilityId: seed.facilityRef,
        portId: portIds.has(portId) ? portId : null,
        routeId: routeIds.has(routeId) ? routeId : null,
        commodityCode: seed.commodityCode,
        confidence,
        evidenceRefs: Object.freeze([...seed.evidenceRefs]),
        knowableAt: input.knowableAt,
        grantsExecutionAuthority: false,
      }),
    );
  }
  return Object.freeze(exposures);
}
