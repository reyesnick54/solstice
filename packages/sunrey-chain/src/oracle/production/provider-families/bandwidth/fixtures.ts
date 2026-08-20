/**
 * Deterministic sandbox bandwidth fixtures. Not commercial providers.
 */

import type { BandwidthSourceClass, BandwidthSourceObservation, BandwidthTransferSemantics, NetworkServiceStage } from './types.ts';

export const SANDBOX_NOW = 1_700_000_000n;
export const SANDBOX_START = 1_699_999_990n;
export const SANDBOX_END = 1_700_000_000n;
export const SANDBOX_SERVICE = 'svc.sandbox.transfer.1';
export const SANDBOX_AGREEMENT = 'agr.sandbox.1';
export const SANDBOX_PROVIDER = 'prov.sandbox.net';
export const SANDBOX_EDGE = 'edge.sandbox.a';
export const SANDBOX_AGGREGATE = 'agg.sandbox.flow.1';
export const SANDBOX_CONTROLLER = 'controller.sandbox.telecom';

function base(overrides: Partial<BandwidthSourceObservation> = {}): BandwidthSourceObservation {
  return Object.freeze({
    sourceClass: overrides.sourceClass ?? 'TELECOM_NETWORK_METER',
    schemaId: overrides.schemaId ?? 'BANDWIDTH_USAGE_V2',
    schemaVersion: overrides.schemaVersion ?? 2,
    factType: overrides.factType ?? 'BANDWIDTH_USAGE',
    productiveCategory: overrides.productiveCategory ?? 'BANDWIDTH_COMMUNICATIONS',
    claimType: overrides.claimType ?? 'USAGE',
    identifier: overrides.identifier ?? 'net_sandbox_1',
    numericValue: overrides.numericValue ?? '20',
    unit: overrides.unit ?? 'GB',
    sourceTimestampUnix: overrides.sourceTimestampUnix ?? SANDBOX_NOW.toString(),
    transferSemantics: Object.hasOwn(overrides, 'transferSemantics')
      ? overrides.transferSemantics ?? null
      : 'VERIFIED_TRANSFERRED_BYTES',
    networkStage: overrides.networkStage ?? 'LAST_MILE_ACCESS',
    quantityKind: overrides.quantityKind ?? 'DATA_VOLUME',
    durationSeconds: Object.hasOwn(overrides, 'durationSeconds') ? overrides.durationSeconds ?? null : 10n,
    region: overrides.region ?? 'sandbox-east',
    networkServiceId: overrides.networkServiceId ?? SANDBOX_SERVICE,
    serviceAgreementId: overrides.serviceAgreementId ?? SANDBOX_AGREEMENT,
    providerId: overrides.providerId ?? SANDBOX_PROVIDER,
    networkEdgeId: overrides.networkEdgeId ?? SANDBOX_EDGE,
    trafficAggregateId: overrides.trafficAggregateId ?? SANDBOX_AGGREGATE,
    peeringDomainId: Object.hasOwn(overrides, 'peeringDomainId') ? overrides.peeringDomainId ?? null : null,
    controllerId: overrides.controllerId ?? SANDBOX_CONTROLLER,
    accountControllerId: overrides.accountControllerId ?? SANDBOX_CONTROLLER,
    measurementStart: overrides.measurementStart ?? SANDBOX_START,
    measurementEnd: overrides.measurementEnd ?? SANDBOX_END,
    quality: overrides.quality,
    cacheHit: overrides.cacheHit,
    retransmissionObserved: overrides.retransmissionObserved,
    extras: overrides.extras,
  });
}

export function capacityRateFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'SUBSEA_CAPACITY_REFERENCE',
    schemaId: 'BANDWIDTH_CAPACITY_V1',
    schemaVersion: 1,
    factType: 'BANDWIDTH_CAPACITY',
    claimType: 'CAPACITY',
    identifier: 'cap_sandbox_1',
    numericValue: '2',
    unit: 'GB_s',
    quantityKind: 'DATA_RATE',
    transferSemantics: null,
    durationSeconds: null,
    networkStage: 'TRANSIT_NETWORK',
  });
}

export function transferredBytesFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'CLOUD_EGRESS_METER',
    schemaId: 'BANDWIDTH_USAGE_V2',
    schemaVersion: 2,
    identifier: 'xfer_sandbox_1',
    numericValue: '20',
    unit: 'GB',
    quantityKind: 'DATA_VOLUME',
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
    networkStage: 'ORIGIN_HOSTING_NETWORK',
  });
}

export function tbUsageFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'DATA_CENTER_NETWORK_METER',
    identifier: 'tb_sandbox_1',
    numericValue: '3',
    unit: 'TB',
    quantityKind: 'DATA_VOLUME',
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
    networkStage: 'ORIGIN_HOSTING_NETWORK',
  });
}

export function rateOverTimeFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'TELECOM_NETWORK_METER',
    schemaId: 'BANDWIDTH_USAGE_V1',
    schemaVersion: 1,
    identifier: 'rate_sandbox_1',
    numericValue: '2',
    unit: 'GB_s',
    quantityKind: 'DATA_RATE',
    durationSeconds: 10n,
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
    networkStage: 'LAST_MILE_ACCESS',
  });
}

export function missingDurationFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'TELECOM_NETWORK_METER',
    schemaId: 'BANDWIDTH_USAGE_V1',
    schemaVersion: 1,
    identifier: 'rate_no_duration',
    numericValue: '2',
    unit: 'GB_s',
    quantityKind: 'DATA_RATE',
    durationSeconds: null,
    measurementStart: SANDBOX_NOW,
    measurementEnd: SANDBOX_NOW,
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
  });
}

export function gbPerSecondPresentedAsGbFixture(): BandwidthSourceObservation {
  return base({
    schemaId: 'BANDWIDTH_USAGE_V2',
    schemaVersion: 2,
    identifier: 'rate_as_volume',
    numericValue: '2',
    unit: 'GB_s',
    quantityKind: 'DATA_VOLUME',
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
  });
}

export function capacityReportedAsUsageFixture(): BandwidthSourceObservation {
  return base({
    ...capacityRateFixture(),
    factType: 'BANDWIDTH_USAGE',
    schemaId: 'BANDWIDTH_USAGE_V1',
    schemaVersion: 1,
    claimType: 'USAGE',
    extras: Object.freeze({ capacityInventory: true }),
  });
}

export function grossBytesFixture(): BandwidthSourceObservation {
  return base({
    identifier: 'gross_sandbox_1',
    transferSemantics: 'GROSS_NETWORK_BYTES',
    retransmissionObserved: true,
  });
}

export function deliveredBytesFixture(): BandwidthSourceObservation {
  return base({
    identifier: 'delivered_sandbox_1',
    transferSemantics: 'DELIVERED_BYTES',
    retransmissionObserved: true,
  });
}

export function cdnAggregateFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'CDN_METERING',
    identifier: 'cdn_sandbox_1',
    transferSemantics: 'CACHE_EGRESS_BYTES',
    networkStage: 'CDN',
    cacheHit: true,
  });
}

export function ispObservationFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'ISP_USAGE_METER',
    identifier: 'isp_sandbox_1',
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
    networkStage: 'LAST_MILE_ACCESS',
  });
}

export function edgeObservationFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'NETWORK_EDGE_METER',
    identifier: 'edge_sandbox_1',
    transferSemantics: 'VERIFIED_TRANSFERRED_BYTES',
    networkStage: 'LAST_MILE_ACCESS',
  });
}

export function transitStageFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'TRANSIT_PROVIDER_METER',
    identifier: 'transit_sandbox_1',
    transferSemantics: 'TRANSIT_BYTES',
    networkStage: 'TRANSIT_NETWORK',
    peeringDomainId: 'peer.sandbox.ix',
  });
}

export function originStageFixture(): BandwidthSourceObservation {
  return base({
    sourceClass: 'CLOUD_EGRESS_METER',
    identifier: 'origin_sandbox_1',
    transferSemantics: 'BILLABLE_EGRESS_BYTES',
    networkStage: 'ORIGIN_HOSTING_NETWORK',
  });
}

export function subscriberPiiFixture(): BandwidthSourceObservation {
  return Object.freeze({
    ...transferredBytesFixture(),
    extras: Object.freeze({ subscriber_name: 'Ada Lovelace', subscriber_email: 'ada@example.test' }),
  });
}

export function urlFieldFixture(): BandwidthSourceObservation {
  return Object.freeze({
    ...transferredBytesFixture(),
    extras: Object.freeze({ url: 'https://example.test/video' }),
  });
}

export function packetPayloadFixture(): BandwidthSourceObservation {
  return Object.freeze({
    ...transferredBytesFixture(),
    extras: Object.freeze({ packet_payload: 'deadbeef' }),
  });
}

export function credentialLeakFixture(): BandwidthSourceObservation {
  return Object.freeze({
    ...transferredBytesFixture(),
    extras: Object.freeze({ apiKey: 'sandbox-not-a-real-secret' }),
  });
}

export function floatUsageFixture(): BandwidthSourceObservation {
  return base({ numericValue: '12.5' });
}

export function negativeUsageFixture(): BandwidthSourceObservation {
  return base({ numericValue: '-20' });
}

export function staleTrafficFixture(): BandwidthSourceObservation {
  return base({ sourceTimestampUnix: (SANDBOX_NOW - 10_000n).toString() });
}

export function qualityOnlyFixture(): BandwidthSourceObservation {
  return base({
    quality: Object.freeze({
      latencyMillis: 18n,
      packetLossBps: 40,
      availabilityBps: 9_990,
      uptimeSeconds: 86_400n,
      addedToQuantity: false,
    }),
  });
}

export function corroboratingSources(): readonly BandwidthSourceObservation[] {
  const shared = {
    networkServiceId: SANDBOX_SERVICE,
    serviceAgreementId: SANDBOX_AGREEMENT,
    trafficAggregateId: SANDBOX_AGGREGATE,
    measurementStart: SANDBOX_START,
    measurementEnd: SANDBOX_END,
    numericValue: '20',
    unit: 'GB' as const,
    quantityKind: 'DATA_VOLUME' as const,
    schemaId: 'BANDWIDTH_USAGE_V2' as const,
    schemaVersion: 2 as const,
  };
  const classes: readonly { readonly sourceClass: BandwidthSourceClass; readonly semantics: BandwidthTransferSemantics }[] = [
    { sourceClass: 'CDN_METERING', semantics: 'CACHE_EGRESS_BYTES' },
    { sourceClass: 'ISP_USAGE_METER', semantics: 'VERIFIED_TRANSFERRED_BYTES' },
    { sourceClass: 'NETWORK_EDGE_METER', semantics: 'VERIFIED_TRANSFERRED_BYTES' },
  ];
  return Object.freeze(
    classes.map((row, index) =>
      base({
        ...shared,
        sourceClass: row.sourceClass,
        networkStage: 'LAST_MILE_ACCESS',
        transferSemantics: row.semantics,
        identifier: `src_${row.sourceClass.toLowerCase()}_${index}`,
      }),
    ),
  );
}
