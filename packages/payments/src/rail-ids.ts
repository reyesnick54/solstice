import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type RailSubmissionId = Brand<string, 'RailSubmissionId'>;
export type ProviderId = Brand<string, 'ProviderId'>;
export type ProviderPaymentId = Brand<string, 'ProviderPaymentId'>;
export type RailReference = Brand<string, 'RailReference'>;
export type SettlementReference = Brand<string, 'SettlementReference'>;
export type ReturnReference = Brand<string, 'ReturnReference'>;
export type TraceReference = Brand<string, 'TraceReference'>;
export type ProviderIdempotencyKey = Brand<string, 'ProviderIdempotencyKey'>;
export type ProviderEventId = Brand<string, 'ProviderEventId'>;
export type SettlementReportId = Brand<string, 'SettlementReportId'>;
export type InboundPaymentId = Brand<string, 'InboundPaymentId'>;
export type OpaqueAccountRef = Brand<string, 'OpaqueAccountRef'>;
export type CapabilityId = Brand<string, 'RailCapabilityId'>;
export type PolicyCapabilityRef = Brand<string, 'PolicyCapabilityRef'>;

function asId<T extends string>(label: string, value: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asRailSubmissionId(value: string): RailSubmissionId {
  return asId('RailSubmissionId', value);
}

export function asProviderId(value: string): ProviderId {
  return asId('ProviderId', value);
}

export function asProviderPaymentId(value: string): ProviderPaymentId {
  return asId('ProviderPaymentId', value);
}

export function asRailReference(value: string): RailReference {
  return asId('RailReference', value);
}

export function asSettlementReference(value: string): SettlementReference {
  return asId('SettlementReference', value);
}

export function asReturnReference(value: string): ReturnReference {
  return asId('ReturnReference', value);
}

export function asTraceReference(value: string): TraceReference {
  return asId('TraceReference', value);
}

export function asProviderIdempotencyKey(value: string): ProviderIdempotencyKey {
  return asId('ProviderIdempotencyKey', value);
}

export function asProviderEventId(value: string): ProviderEventId {
  return asId('ProviderEventId', value);
}

export function asSettlementReportId(value: string): SettlementReportId {
  return asId('SettlementReportId', value);
}

export function asInboundPaymentId(value: string): InboundPaymentId {
  return asId('InboundPaymentId', value);
}

export function asOpaqueAccountRef(value: string): OpaqueAccountRef {
  return asId('OpaqueAccountRef', value);
}

export function asCapabilityId(value: string): CapabilityId {
  return asId('RailCapabilityId', value);
}

export function asPolicyCapabilityRef(value: string): PolicyCapabilityRef {
  return asId('PolicyCapabilityRef', value);
}

export type RailMessageReferences = {
  readonly providerPaymentId: ProviderPaymentId | null;
  readonly railReference: RailReference | null;
  readonly settlementReference: SettlementReference | null;
  readonly returnReference: ReturnReference | null;
  readonly traceReference: TraceReference | null;
};

export function emptyRailReferences(): RailMessageReferences {
  return Object.freeze({
    providerPaymentId: null,
    railReference: null,
    settlementReference: null,
    returnReference: null,
    traceReference: null,
  });
}
